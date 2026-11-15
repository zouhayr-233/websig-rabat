"""Génère la couche « Susceptibilité aux inondations (modèle GTB) » du WebSIG
à partir du raster classé (classes 1 à 5, 0 = non classé, EPSG:4326).

Sorties (dans data/) :
  susceptibilite_tuiles/{z}/{x}/{y}.png  tuiles XYZ Web Mercator 256 px, zooms 7 à 12
  susceptibilite_classes.png             grille d'origine (1 niveau de gris = 1 classe), lue par la popup
  susceptibilite_raster.json             description des deux sorties (emprise, grille, zooms)

Les cellules et pixels hors de data/admin_boundaries_real.geojson sont transparents.

Usage (depuis la racine du dépôt, avec rasterio, numpy et Pillow installés) :
  python outils/generer_tuiles_susceptibilite.py import/Susceptibilite_GTB_classes.tif

Ensuite : changer SUSC_FILE_VERSION dans js/layers.js (AAAAMMJJ) pour contourner le cache.
"""
import json, math, os, shutil, sys

import numpy as np
import rasterio
from PIL import Image
from rasterio import features
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject, transform_geom

ZMIN, ZMAX, N = 7, 12, 256          # z12 : ~3 px par cellule de 90 m
DATA = 'data'
OUT = os.path.join(DATA, 'susceptibilite_tuiles')
LIMITE = os.path.join(DATA, 'admin_boundaries_real.geojson')
# Couleurs des classes : identiques à SUSC_CLASSES (js/layers.js) et à la carte du rapport
PALETTE = [0, 0, 0,  0x00, 0x61, 0x00,  0x7a, 0xab, 0x00,  0xff, 0xff, 0x00,  0xff, 0x99, 0x00,  0xff, 0x22, 0x00]
PALETTE += [0] * (768 - len(PALETTE))
ORIG = math.pi * 6378137.0


def tuile_x(lon, z):
    return int((lon + 180) / 360 * 2 ** z)


def tuile_y(lat, z):
    l = math.radians(lat)
    return int((1 - math.log(math.tan(l) + 1 / math.cos(l)) / math.pi) / 2 * 2 ** z)


def main(src):
    with rasterio.open(src) as r:
        a = r.read(1)
        T, crs = r.transform, r.crs
    H, W = a.shape
    lim = json.load(open(LIMITE, encoding='utf-8'))['features'][0]['geometry']
    lim3857 = transform_geom('EPSG:4326', 'EPSG:3857', lim)
    ouest, sud, est, nord = rasterio.transform.array_bounds(H, W, T)

    # 1) Grille de consultation (raster d'origine ; cellule dont le centre est hors limite -> 0)
    m = features.rasterize([(lim, 1)], out_shape=a.shape, transform=T, fill=0, dtype='uint8')
    grille = np.where(m == 1, a, 0).astype(np.uint8)
    Image.fromarray(grille, 'L').save(os.path.join(DATA, 'susceptibilite_classes.png'), optimize=True)

    # 2) Tuiles
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    total = 0
    for z in range(ZMIN, ZMAX + 1):
        taille = 2 * ORIG / 2 ** z
        n = 0
        for x in range(tuile_x(ouest, z), tuile_x(est, z) + 1):
            for y in range(tuile_y(nord, z), tuile_y(sud, z) + 1):
                x0, y1 = -ORIG + x * taille, ORIG - y * taille
                tr = from_bounds(x0, y1 - taille, x0 + taille, y1, N, N)
                dst = np.zeros((N, N), np.uint8)
                # pixel plus grand que la cellule (z < 12) : classe majoritaire ; z12 : plus proche voisin
                reproject(a, dst, src_transform=T, src_crs=crs, dst_transform=tr, dst_crs='EPSG:3857',
                          resampling=Resampling.mode if z < ZMAX else Resampling.nearest,
                          src_nodata=0, dst_nodata=0)
                mz = features.rasterize([(lim3857, 1)], out_shape=(N, N), transform=tr, fill=0, dtype='uint8')
                dst[mz == 0] = 0
                os.makedirs(os.path.join(OUT, str(z), str(x)), exist_ok=True)
                im = Image.fromarray(dst, 'P')
                im.putpalette(PALETTE)
                im.save(os.path.join(OUT, str(z), str(x), f'{y}.png'), optimize=True, transparency=0)
                n += 1
        total += n
        print(f'z{z} : {n} tuiles')

    # 3) Description
    meta = {
        "_description": "Couche Susceptibilité aux inondations (modèle GTB) : tuiles du raster classé, sans généralisation vectorielle.",
        "source": os.path.basename(src) + " (classes 1 à 5, 0 = non classé, EPSG:4326)",
        "consultation": {"fichier": "susceptibilite_classes.png", "projection": "EPSG:4326 (grille d'origine)",
                         "valeur": "niveau de gris = classe (0 = non classé)",
                         "largeur": W, "hauteur": H, "ouest": T.c, "nord": T.f, "pas_lon": T.a, "pas_lat": -T.e},
        "masque": "cellules et pixels hors de data/admin_boundaries_real.geojson rendus transparents",
        "tuiles": {"modele": "susceptibilite_tuiles/{z}/{x}/{y}.png", "schema": "XYZ, EPSG:3857, 256 px",
                   "zoom_min": ZMIN, "zoom_max": ZMAX,
                   "reechantillonnage": "classe majoritaire (zooms 7 à 11), plus proche voisin (zoom 12, ~3 px par cellule)",
                   "sud": round(sud, 6), "ouest": round(ouest, 6), "nord": round(nord, 6), "est": round(est, 6)}
    }
    with open(os.path.join(DATA, 'susceptibilite_raster.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f'{total} tuiles ; cellules par classe :', [int((grille == k).sum()) for k in range(1, 6)])


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'import/Susceptibilite_GTB_classes.tif')
