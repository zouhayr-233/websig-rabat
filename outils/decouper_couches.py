"""Découpe les couches thématiques du WebSIG RSK sur la limite de la région.

Outil hors du site (rien n'est chargé par la page). Usage, depuis la racine du dépôt :

    .venv-outils/Scripts/python outils/decouper_couches.py              # simulation (défaut) : n'écrit rien
    .venv-outils/Scripts/python outils/decouper_couches.py --appliquer  # écrit les fichiers découpés

Règles (prompt de découpage, novembre 2026) :
- limite : data/admin_boundaries_real.geojson, utilisée telle quelle (fusion et make_valid en mémoire
  seulement si nécessaire), sans simplification ;
- polygones : intersection avec la limite, on ne garde que des polygones, entités vides supprimées ;
- lignes : intersection avec la limite, on ne garde que des lignes (MultiLineString si besoin) ;
- points : gardés s'ils sont dans la limite ou à moins de 500 m ; sinon retirés et notés ; garde-fou :
  si plus de 3 points ou plus de 10 % des points d'une couche sont concernés, rien n'est retiré ;
- attributs, ordre des champs et identifiants inchangés ; convention de fichier conservée (compacte
  ou une entité par ligne façon GDAL), UTF-8, ensure_ascii=False ;
- coordonnées arrondies à 6 décimales au plus : la limite elle-même est stockée à 6 décimales, et un
  arrondi à 5 décimales écarterait les sommets découpés de la limite de plus de la tolérance de
  vérification (1e-6 degré).
Les distances et surfaces du rapport sont calculées en Merchich / Nord Maroc (EPSG:26191).
"""
import argparse
import json
import os
import re
import sys

import shapely
from pyproj import Transformer
from shapely.geometry import (GeometryCollection, LineString, MultiLineString, MultiPolygon, Point,
                              Polygon, mapping, shape)
import numpy as np
from shapely.ops import unary_union
from shapely.validation import make_valid

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIMITE = 'data/admin_boundaries_real.geojson'
# Couches de l'audit (étape 0). La limite n'est pas dans la liste : elle sert de référence.
COUCHES = [
    'data/susceptibilite.geojson',
    'data/watersheds_real.geojson',
    'data/aquifers.geojson',
    'data/rivers_real.geojson',
    'data/dams_real.geojson',
    'data/rain_stations_real.geojson',
]
# Couche de points écrite dans le code (analysée seulement, jamais modifiée par ce script)
VILLES_JS = 'js/layers.js'
DISTANCE_MAX_M = 500
GARDE_FOU_POINTS = 3
GARDE_FOU_PART = 0.10
DECIMALES = 6
# Tolérance « déjà dans la limite » : égale à la tolérance de vérification (outils/verifier_limites.py).
# Elle rend le script idempotent : l'arrondi à 6 décimales peut placer un sommet découpé à moins de
# 1e-6 degré hors de la limite ; une seconde exécution ne doit pas le redécouper.
TOLERANCE_DEG = 1e-6

_T26191 = Transformer.from_crs(4326, 26191, always_xy=True)


def p26(g):
    """Géométrie WGS84 -> EPSG:26191 (pour les distances et surfaces du rapport)."""
    return shapely.transform(g, lambda c: np.column_stack(_T26191.transform(c[:, 0], c[:, 1])))


def lire_limite():
    d = json.load(open(os.path.join(RACINE, LIMITE), encoding='utf-8'))
    geoms = [shape(f['geometry']) for f in d['features']]
    notes = []
    if len(geoms) > 1:
        notes.append(f'{len(geoms)} entités fusionnées en mémoire')
    repar = []
    for i, g in enumerate(geoms):
        if not g.is_valid:
            repar.append(i)
            geoms[i] = make_valid(g)
    if repar:
        notes.append(f'géométrie(s) invalide(s) réparée(s) en mémoire (make_valid) : {repar}')
    return unary_union(geoms), notes


# ── lecture / écriture en conservant la convention du fichier ─────────────────
def style_fichier(texte):
    return 'gdal' if texte.startswith('{\n"type"') else 'compact'


def arrondir(c):
    if isinstance(c, (int, float)):
        return round(c, DECIMALES)
    return [arrondir(x) for x in c]


def gdal_dumps(o):
    """Sérialisation « façon GDAL » : { "k": v, ... } et [ a, b ] avec espaces intérieurs."""
    if isinstance(o, dict):
        if not o:
            return '{ }'
        return '{ ' + ', '.join(json.dumps(k, ensure_ascii=False) + ': ' + gdal_dumps(v) for k, v in o.items()) + ' }'
    if isinstance(o, list):
        if not o:
            return '[ ]'
        return '[ ' + ', '.join(gdal_dumps(v) for v in o) + ' ]'
    return json.dumps(o, ensure_ascii=False)


def ecrire(chemin, doc, style):
    if style == 'gdal':
        tete = [f'{json.dumps(k, ensure_ascii=False)}: {gdal_dumps(v)},' for k, v in doc.items() if k != 'features']
        corps = ',\n'.join(gdal_dumps(f) for f in doc['features'])
        texte = '{\n' + '\n'.join(tete) + '\n"features": [\n' + corps + '\n]\n}\n'
    else:
        texte = json.dumps(doc, ensure_ascii=False, separators=(',', ':'))
    with open(chemin, 'w', encoding='utf-8', newline='') as fh:
        fh.write(texte)


# ── géométries ────────────────────────────────────────────────────────────────
def parties(g, genre):
    """Ne garde que les parties du genre voulu (Polygon ou LineString) d'un résultat d'intersection."""
    if g.is_empty:
        return []
    if genre == 'Polygon' and isinstance(g, Polygon):
        return [g]
    if genre == 'LineString' and isinstance(g, LineString):
        return [g]
    if isinstance(g, (MultiPolygon, MultiLineString, GeometryCollection)):
        out = []
        for h in g.geoms:
            out += parties(h, genre)
        return out
    return []


def assembler(parts, genre, type_origine):
    if genre == 'Polygon':
        if len(parts) == 1 and type_origine == 'Polygon':
            return parts[0]
        return MultiPolygon(parts)
    if len(parts) == 1 and type_origine == 'LineString':
        return parts[0]
    # lignes : on recolle les morceaux contigus sans en changer le tracé
    m = shapely.line_merge(MultiLineString(parts))
    if isinstance(m, LineString) and type_origine == 'LineString':
        return m
    return m if isinstance(m, MultiLineString) else MultiLineString([m])


def geometrie_vers_json(g):
    m = mapping(g)
    return {'type': m['type'], 'coordinates': arrondir(json.loads(json.dumps(m['coordinates'])))}


def nom_point(props):
    for k in ('BARRAGE', 'name', 'NOM', 'nom'):
        if props.get(k):
            return props[k]
    return '?'


def traiter_couche(chemin, B, B26, Bb):
    Btol = B.buffer(TOLERANCE_DEG)
    brut = open(os.path.join(RACINE, chemin), encoding='utf-8').read()
    style = style_fichier(brut)
    doc = json.loads(brut)
    feats = doc['features']
    r = {'couche': chemin, 'style': style, 'entites_avant': len(feats), 'retirees': [], 'points_proches': [],
         'points_hors': [], 'garde_fou': None, 'mesure': None, 'avant': 0.0, 'apres': 0.0, 'coupees': 0}
    types = {f['geometry']['type'] for f in feats if f.get('geometry')}
    if types <= {'Point', 'MultiPoint'}:
        r['mesure'] = 'points'
        hors = []
        for i, f in enumerate(feats):
            g = shape(f['geometry'])
            if B.covers(g):
                continue
            dist = p26(g).distance(B26)
            info = (nom_point(f['properties']), round(g.x, 5), round(g.y, 5), round(dist))
            if dist <= DISTANCE_MAX_M:
                r['points_proches'].append(info)
            else:
                hors.append((i, info))
        r['points_hors'] = [h[1] for h in hors]
        if hors and (len(hors) > GARDE_FOU_POINTS or len(hors) / len(feats) > GARDE_FOU_PART):
            r['garde_fou'] = (f'{len(hors)} point(s) sur {len(feats)} ({100 * len(hors) / len(feats):.0f} %) à plus de '
                              f'{DISTANCE_MAX_M} m : garde-fou déclenché, rien n\'est retiré de cette couche')
            nouveaux = feats
        else:
            idx = {i for i, _ in hors}
            r['retirees'] = [info for _, info in hors]
            nouveaux = [f for i, f in enumerate(feats) if i not in idx]
    else:
        genre = 'Polygon' if any('Polygon' in t for t in types) else 'LineString'
        r['mesure'] = 'surface_km2' if genre == 'Polygon' else 'longueur_km'
        nouveaux = []
        for f in feats:
            g = shape(f['geometry'])
            gv = g if g.is_valid else make_valid(g)
            av = p26(gv)
            r['avant'] += av.area / 1e6 if genre == 'Polygon' else av.length / 1e3
            dedans = Btol.covers(gv)
            if dedans:
                parts = parties(gv, genre)
            else:
                r['coupees'] += 1
                parts = parties(gv.intersection(B), genre)
            if not parts:
                ident = {k: f['properties'].get(k) for k in list(f['properties'])[:2]}
                r['retirees'].append(('entité vide après découpage', ident))
                continue
            ng = assembler(parts, genre, f['geometry']['type'])
            ap = p26(ng)
            r['apres'] += ap.area / 1e6 if genre == 'Polygon' else ap.length / 1e3
            nf = dict(f)                                   # même ordre de clés, mêmes attributs
            nf['geometry'] = f['geometry'] if dedans else geometrie_vers_json(ng)
            nouveaux.append(nf)
    r['entites_apres'] = len(nouveaux)
    doc_sortie = dict(doc)
    doc_sortie['features'] = nouveaux
    return r, doc_sortie, style


def villes_inline(B, B26):
    src = open(os.path.join(RACINE, VILLES_JS), encoding='utf-8').read()
    villes = re.findall(r"coordinates: \[(-?[\d.]+), (-?[\d.]+)\] \},\s*properties: \{ name: '([^']+)'", src)
    hors = []
    for x, y, nom in villes:
        g = Point(float(x), float(y))
        if not B.covers(g):
            hors.append((nom, float(x), float(y), round(p26(g).distance(B26))))
    return len(villes), hors


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group()
    g.add_argument('--simulation', action='store_true', default=True, help='affiche le rapport sans rien écrire (défaut)')
    g.add_argument('--appliquer', action='store_true', help='écrit les fichiers découpés')
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')

    B, notes = lire_limite()
    B26 = p26(B)
    print(f'Limite : {LIMITE} | {B26.area / 1e6:.1f} km² (EPSG:26191)' + (' | ' + ' ; '.join(notes) if notes else ''))
    print('Mode :', 'APPLICATION (écriture des fichiers)' if a.appliquer else 'SIMULATION (aucun fichier écrit)')
    for chemin in COUCHES:
        r, doc, style = traiter_couche(chemin, B, B26, B.boundary)
        print(f"\n== {chemin} ({style}) : {r['entites_avant']} -> {r['entites_apres']} entités")
        if r['mesure'] in ('surface_km2', 'longueur_km'):
            u = 'km²' if r['mesure'] == 'surface_km2' else 'km'
            ec = 100 * (r['apres'] - r['avant']) / r['avant'] if r['avant'] else 0
            print(f"   entités coupées : {r['coupees']} | {r['mesure'].split('_')[0]} avant {r['avant']:.3f} {u} -> après {r['apres']:.3f} {u} ({ec:+.4f} %)")
        for x in r['retirees']:
            print('   retirée :', x)
        for x in r['points_proches']:
            print(f'   point conservé à moins de {DISTANCE_MAX_M} m : {x[0]} ({x[1]}, {x[2]}) à {x[3]} m')
        if r['garde_fou']:
            print('   GARDE-FOU :', r['garde_fou'])
            for x in r['points_hors']:
                print(f'      {x[0]} ({x[1]}, {x[2]}) à {x[3]} m')
        modifiee = r['coupees'] > 0 or bool(r['retirees'])
        if a.appliquer and modifiee:
            ecrire(os.path.join(RACINE, chemin), doc, style)
            print('   -> fichier écrit')
        elif a.appliquer:
            print('   -> rien à découper : fichier laissé tel quel')
    n, hors = villes_inline(B, B26)
    print(f'\n== {VILLES_JS} (villes principales, données dans le code) : {n} points, {len(hors)} hors limite')
    for x in hors:
        print(f'   {x[0]} ({x[1]}, {x[2]}) à {x[3]} m de la limite -> à retirer à la main du code (ce script ne modifie pas le JavaScript)')


if __name__ == '__main__':
    main()
