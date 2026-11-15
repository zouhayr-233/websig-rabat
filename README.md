# WebSIG RSK — Ressources en eau et susceptibilité aux inondations
### Région Rabat-Salé-Kénitra, Maroc

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-264DE4?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=flat&logo=leaflet&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=flat&logo=chartdotjs&logoColor=white)

**Version 2 — mise à jour : novembre 2026**
Application en ligne : <https://zouhayr-233.github.io/websig-rabat/>

---

## Description

Système d'Information Géographique Web (WebSIG) qui accompagne le rapport de PFE
(Master Géomatique Appliquée, Université Ibn Tofail) sur les **ressources en eau** et la
**susceptibilité aux inondations** de la région **Rabat-Salé-Kénitra** (RSK).

L'application est entièrement statique (HTML5, CSS3, JavaScript ES6, Leaflet 1.9, Chart.js 4) :
pas de serveur, pas de base de données, pas d'étape de compilation.

Fonctions : carte multicouche, popups attributaires, légende dynamique, tableau de bord
statistique, précipitations, recherche de lieu (Nominatim), mesure de distance et de surface,
export PNG, plein écran, grille de coordonnées.

> La couche **Susceptibilité aux inondations (modèle GTB)** est un indice relatif issu d'un
> modèle Gradient Tree Boosting ; ce n'est pas un zonage réglementaire ni un système d'alerte.

---

## Lancer en local

```bash
cd websig-rabat
python3 -m http.server 8080
# puis ouvrir http://localhost:8080/
```

Le chargement des GeoJSON passe par `fetch()` : il faut un serveur HTTP (l'ouverture directe
du fichier `index.html` ne suffit pas).

---

## Couches cartographiques

| Couche | Fichier | Type | Contenu |
|---|---|---|---|
| **Susceptibilité aux inondations (modèle GTB)** | `data/susceptibilite_tuiles/` (+ `susceptibilite_classes.png`, `susceptibilite_raster.json`) | Tuiles raster | Raster classé affiché tel quel (cellules de 90 m), tuiles XYZ zooms 7 à 12 ; popup lue dans la grille d'origine. Chargée au premier cochage |
| Bassins & sous-bassins versants | `data/watersheds_real.geojson` | Polygone | Sous-bassins (ABHS) |
| Réseau hydrographique — oueds | `data/rivers_real.geojson` | Ligne | Hiérarchie en 4 niveaux (rang ABHS) |
| Nappes souterraines | `data/aquifers.geojson` | Polygone | 12 systèmes (source : NAPPES.shp, ABHS et ABHBC), attributs `NOM_NAPPE`, `TYPE_NAPPE`, `AREA_KM2` |
| Barrages & retenues | `data/dams_real.geojson` | Point | 11 ouvrages (source : Barrages.shp ; attributs `BARRAGE`, `OUED`, `Capacité_` en Mm³, `AGENCE`, `ANNEE`) |
| Stations pluviométriques | `data/rain_stations_real.geojson` | Point | 5 stations |
| Découpage administratif | `data/admin_boundaries_real.geojson` | Polygone | Limite de la région (géométrie de `limite-de-région.shp`, la limite utilisée pour le modèle) |
| Villes principales | (dans `js/layers.js`) | Point | 12 centres urbains |

Classes de susceptibilité (indice p, probabilité estimée par le modèle) :

| Classe | Libellé | Seuils | Couleur | Superficie | Part |
|---|---|---|---|---|---|
| 1 | Très faible | p < 0,2 | `#006100` | 13 870 km² | 79,0 % |
| 2 | Faible | 0,2 à 0,4 | `#7aab00` | 1 524 km² | 8,7 % |
| 3 | Modérée | 0,4 à 0,6 | `#ffff00` | 940 km² | 5,4 % |
| 4 | Élevée | 0,6 à 0,8 | `#ff9900` | 682 km² | 3,9 % |
| 5 | Très élevée | p ≥ 0,8 | `#ff2200` | 537 km² | 3,1 % |

Total classé : 17 553 km² sur environ 17 576 km² (23 km² non classés : plans d'eau, trous
sans données). Ces superficies sont calculées sur le **raster classé** (grille de 3 secondes
d'arc). La carte affiche ce même raster, **sans généralisation** : tuiles PNG en Web Mercator
(classe majoritaire aux zooms 7 à 11, plus proche voisin au zoom 12, environ 3 pixels par
cellule), cellules hors de la limite régionale transparentes. Au-delà du zoom 12, les tuiles
sont agrandies en gardant des cellules nettes.

---

## Structure du projet

```
websig-rabat/
├── index.html              # Application (page unique)
├── css/style.css           # Styles
├── js/
│   ├── map.js              # Carte Leaflet, fonds, contrôles, géocodage, export PNG
│   ├── graticule.js        # Grille de coordonnées
│   ├── layers.js           # Chargement des GeoJSON, styles, popups
│   ├── controls.js         # Panneaux, cartes de couches, légende, mesures
│   ├── charts.js           # Tableau de bord (Chart.js)
│   └── about.js            # Onglet « À propos » (depuis json/metadonnees.json)
├── data/                   # Couches GeoJSON, tuiles de susceptibilité, précipitations
├── outils/
│   └── generer_tuiles_susceptibilite.py   # Régénère la couche de susceptibilité depuis le raster
├── json/
│   ├── statistiques.json   # Chiffres du tableau de bord (référence du rapport)
│   └── metadonnees.json    # Méthode, validation, limites, sources, version
└── README.md
```

Les chiffres du tableau de bord (superficies par classe, indicateurs, capacités par agence)
viennent de `json/statistiques.json` et ne sont jamais recalculés dans le navigateur.

---

## Remplacer une couche

1. Préparer le GeoJSON en **EPSG:4326** (WGS 84), coordonnées arrondies à 5 décimales,
   en gardant les **mêmes noms d'attributs** que la couche actuelle (voir le tableau ci-dessus).
2. Le copier dans `data/` sous **le même nom de fichier** (ex. `data/dams_real.geojson`).
   Pour la **susceptibilité** (raster), lancer depuis la racine du dépôt :
   `python outils/generer_tuiles_susceptibilite.py chemin/vers/Susceptibilite_GTB_classes.tif`
   (rasterio, numpy et Pillow requis) : le script régénère les tuiles, la grille de la popup
   et `data/susceptibilite_raster.json`.
3. Si les chiffres changent, mettre à jour `json/statistiques.json` (et `json/metadonnees.json`
   si la méthode change). Pour la susceptibilité, recopier les superficies calculées sur le raster.
4. Changer le paramètre de version pour contourner le cache de GitHub Pages :
   - susceptibilité (tuiles, grille, description) : constante `SUSC_FILE_VERSION` dans `js/layers.js` ;
   - fichiers CSS/JS modifiés : `?v=AAAAMMJJ` dans `index.html` ;
   - fichiers JSON : `?v=AAAAMMJJ` dans `js/charts.js` et `js/about.js`.
5. Tester en local (`python3 -m http.server`), puis commiter et pousser sur `master`
   (branche publiée par GitHub Pages). Le site est à jour en une à deux minutes.

---

## Méthode (résumé)

- Modèle : Gradient Tree Boosting (scikit-learn, `HistGradientBoostingClassifier`),
  15 variables, grille de 3 secondes d'arc (environ 90 m).
- Entraînement : 797 points exploitables (398 inondés, 399 non inondés) issus d'un
  inventaire de 800 points.
- Validation spatiale par blocs géographiques : AUC de 0,77 (blocs de 10 km) et de 0,73
  (blocs de 20 km). Une validation aléatoire donnerait 0,87 et surestime la qualité de la carte.

Limites et détails : onglet « À propos » de l'application et rapport de PFE.

---

## Sources des données

- **ABHS** — Agence du Bassin Hydraulique du Sebou
- **ABHBC** — Agence du Bassin Hydraulique du Bouregreg et de la Chaouia
- **ABH Loukkos** — Agence du Bassin Hydraulique du Loukkos
- **DMN** — Direction de la Météorologie Nationale
- **HCP** — Haut-Commissariat au Plan (RGPH)
- **NASA POWER** — séries de précipitations des stations
- **OpenStreetMap** — limite régionale, géocodage (Nominatim)
- **Esri, CARTO, OpenStreetMap** — fonds de carte

La liste complète, y compris les données d'entrée du modèle, est dans `json/metadonnees.json`
(affichée dans l'onglet « À propos »).

---

## Technologies

| Technologie | Version | Rôle |
|---|---|---|
| [Leaflet](https://leafletjs.com) | 1.9.4 | Moteur cartographique (vecteurs SVG, tuiles) |
| [Chart.js](https://chartjs.org) | 4.4.0 | Graphiques |
| [Leaflet.draw](https://github.com/Leaflet/Leaflet.draw) | 1.0.4 | Outils de mesure |
| [Leaflet.MiniMap](https://github.com/Norkart/Leaflet-MiniMap) | 3.6.1 | Carte de situation |
| [html2canvas](https://html2canvas.hertzen.com) | 1.4.1 | Export PNG |
| [Nominatim](https://nominatim.openstreetmap.org) | — | Géocodage |

---

## Auteur

| | |
|---|---|
| **Projet** | Projet de Fin d'Études (PFE) — Master 2 Géomatique Appliquée |
| **Université** | Université Ibn Tofail — Faculté des Sciences, Kénitra |
| **Années** | 2024 – 2026 |
| **Auteur** | AANZOUL Zouhayr — zouhayr.aanzoul@uit.ac.ma |

© 2026 — Université Ibn Tofail, Faculté des Sciences, Kénitra, Maroc.
