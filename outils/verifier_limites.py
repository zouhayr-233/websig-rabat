"""Vérifie qu'aucune couche thématique du WebSIG RSK ne dépasse la limite de la région.

Outil hors du site. Usage, depuis la racine du dépôt :

    .venv-outils/Scripts/python outils/verifier_limites.py [--avant aff3da6]

Pour chaque couche : entités avant / après, surface ou longueur avant / après (EPSG:26191),
part hors limite avant / après, sommets hors limite (tolérance 1e-6 degré). « Avant » = la version
des fichiers au commit de référence (par défaut aff3da6, sauvegarde précédant le découpage).
La part hors limite est mesurée hors de la limite élargie de la même tolérance (1e-6 degré,
environ 0,1 m), pour ne pas compter l'arrondi des coordonnées à 6 décimales.
Code de sortie : 0 si chaque couche a 0 sommet et 0 m² (ou 0 m) hors limite, les points situés à
moins de 500 m de la limite étant admis et listés ; 1 sinon.
"""
import argparse
import json
import os
import re
import subprocess
import sys

import numpy as np
import shapely
from shapely.geometry import Point, shape
from shapely.validation import make_valid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from decouper_couches import COUCHES, DISTANCE_MAX_M, RACINE, TOLERANCE_DEG, VILLES_JS, lire_limite, p26  # noqa: E402

VILLES_RE = re.compile(r"coordinates: \[(-?[\d.]+), (-?[\d.]+)\] \},\s*properties: \{ name: '([^']+)'")


def lire(chemin, ref=None):
    if ref:
        txt = subprocess.run(['git', '-C', RACINE, 'show', f'{ref}:{chemin}'], capture_output=True, check=True).stdout.decode('utf-8')
    else:
        txt = open(os.path.join(RACINE, chemin), encoding='utf-8').read()
    return txt


def features(chemin, ref=None):
    if chemin == VILLES_JS:
        return [{'properties': {'name': n}, 'geometry': {'type': 'Point', 'coordinates': [float(x), float(y)]}}
                for x, y, n in VILLES_RE.findall(lire(chemin, ref))]
    return json.loads(lire(chemin, ref))['features']


def mesurer(feats, B, Btol, B26):
    """Retourne : nombre, mesure totale, mesure hors limite, sommets hors limite, points hors limite."""
    tot = hors = 0.0
    sommets_hors = 0
    pts = []
    genre = None
    for f in feats:
        g = shape(f['geometry'])
        if g.is_empty:
            continue
        c = shapely.get_coordinates(g)
        sommets_hors += int((~shapely.contains_xy(Btol, c[:, 0], c[:, 1])).sum())
        if g.geom_type in ('Point', 'MultiPoint'):
            genre = 'points'
            if not Btol.covers(g):
                p = f['properties']
                nom = p.get('BARRAGE') or p.get('name') or p.get('NOM') or '?'
                pts.append((nom, round(g.x, 5), round(g.y, 5), round(p26(g).distance(B26))))
            continue
        gv = g if g.is_valid else make_valid(g)
        g26 = p26(gv)
        # La différence est calculée en WGS 84 (comme le découpage), puis projetée pour être
        # mesurée : projeter séparément la couche et la limite avant la différence créerait de
        # faux liserés, une arête droite en degrés n'étant plus tout à fait droite en EPSG:26191.
        dehors = p26(gv.difference(Btol))
        if 'Line' in g.geom_type:
            genre = 'longueur_km'
            tot += g26.length / 1e3
            hors += dehors.length / 1e3
        else:
            genre = 'surface_km2'
            tot += g26.area / 1e6
            hors += dehors.area / 1e6
    return {'n': len(feats), 'genre': genre, 'tot': tot, 'hors': hors, 'sommets_hors': sommets_hors, 'pts': pts}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--avant', default='aff3da6', help='commit de référence « avant découpage »')
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')

    B, notes = lire_limite()
    Btol = B.buffer(TOLERANCE_DEG)
    B26 = p26(B)
    print(f'Limite : data/admin_boundaries_real.geojson | {B26.area / 1e6:.1f} km² (EPSG:26191) | tolérance {TOLERANCE_DEG:g} degré'
          + (' | ' + ' ; '.join(notes) if notes else ''))
    print(f'Référence « avant » : commit {a.avant}\n')
    ok = True
    for chemin in COUCHES + [VILLES_JS]:
        av = mesurer(features(chemin, a.avant), B, Btol, B26)
        ap_ = mesurer(features(chemin), B, Btol, B26)
        nom = chemin if chemin != VILLES_JS else f'{VILLES_JS} (villes principales)'
        print(f'== {nom}')
        print(f"   entités : {av['n']} -> {ap_['n']}")
        if ap_['genre'] in ('surface_km2', 'longueur_km'):
            u = 'km²' if ap_['genre'] == 'surface_km2' else 'km'
            print(f"   {'surface' if u == 'km²' else 'longueur'} : {av['tot']:.3f} -> {ap_['tot']:.3f} {u} ({100 * (ap_['tot'] - av['tot']) / av['tot']:+.3f} %)")
            print(f"   hors limite : {av['hors']:.4f} -> {ap_['hors']:.6f} {u}")
        print(f"   sommets hors limite : {av['sommets_hors']} -> {ap_['sommets_hors']}")
        proches = [p for p in ap_['pts'] if p[3] <= DISTANCE_MAX_M]
        loin = [p for p in ap_['pts'] if p[3] > DISTANCE_MAX_M]
        for p in proches:
            print(f'   point conservé à moins de {DISTANCE_MAX_M} m (admis) : {p[0]} ({p[1]}, {p[2]}) à {p[3]} m')
        for p in loin:
            print(f'   ÉCHEC : point hors limite à plus de {DISTANCE_MAX_M} m : {p[0]} ({p[1]}, {p[2]}) à {p[3]} m')
        sommets_non_admis = ap_['sommets_hors'] - len(proches)
        couche_ok = (sommets_non_admis == 0 and not loin and ap_['hors'] == 0)
        if not couche_ok:
            ok = False
        print('   ->', 'OK' if couche_ok else 'ÉCHEC')
    print('\nRÉSULTAT :', 'OK — aucune couche ne dépasse la limite' if ok else 'ÉCHEC — au moins une couche dépasse la limite (voir ci-dessus)')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
