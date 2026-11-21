# WebSIG RSK — Ressources en eau et susceptibilité aux inondations
### Région Rabat-Salé-Kénitra, Maroc

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-264DE4?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=flat&logo=leaflet&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=flat&logo=chartdotjs&logoColor=white)

**Version 3 — mise à jour : novembre 2026**
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

## Interface (version 3)

- **Carte en pleine page** (100 % de la largeur, hauteur `100dvh`) sous un bandeau compact
  (48 px, 40 px sur téléphone) qui porte la recherche de lieu, les outils (mesure de distance et
  de surface, export PNG, plein écran, grille) et les coordonnées du curseur. Sur téléphone, la
  recherche s'ouvre par la loupe ; mesure, export, plein écran et coordonnées y sont masqués.
- **Barre de 5 boutons** (icônes SVG intégrées, info-bulle et `aria-label`) : Couches, Légende,
  Statistiques, Précipitations, À propos. Sur ordinateur : colonne à gauche sous le zoom ; sur
  téléphone (768 px ou moins) : rangée en bas, boutons de 48 px.
- **Panneaux à la demande** : un seul ouvert à la fois, tous fermés au chargement ; fermeture par
  le même bouton, la croix ou Échap. Tiroir à gauche de 360 px au plus sur ordinateur (la carte
  reste utilisable à côté), feuille montante de 65 dvh au plus sur téléphone.
  - *Couches* : fonds de carte (boutons radio), couches thématiques (cases à cocher, utilisables
    au clavier), boutons « Tout décocher » et « Réinitialiser » (retour aux couches par défaut),
    curseur d'opacité de la susceptibilité (20 à 100 %).
  - *Statistiques*, *Précipitations*, *À propos* : graphiques et textes, redimensionnés à
    l'ouverture du panneau.
- **Légende** : ouverte en bas à droite sur ordinateur, repliée par défaut sur téléphone. Carte
  compacte (fond semi-transparent, 220 px de large au plus, 40 dvh de haut au plus, 24 % de la
  carte au plus sur téléphone) ; boutons A− / A+ (échelle 0,8 à 1,4), curseur de transparence
  (0,4 à 1) et bouton de repli. Réglages mémorisés dans le navigateur (`localStorage`).
- **Votre avis** : le panneau « À propos » (et la fenêtre « Info ») propose un bouton « Donner mon
  avis », lien vers un formulaire Google Forms (nouvel onglet) pour signaler une erreur, proposer une
  amélioration ou donner son appréciation de l'application.
- **Vue limitée à la région** : zoom minimal 8, emprise maximale `[[32.2, -8.2], [35.8, -4.2]]`
  (`maxBoundsViscosity` 1), vue initiale cadrée sur la limite régionale. La vue ne descend
  jamais au sud du 30e parallèle.

## Fonds de carte

| Fond | Source | Clé |
|---|---|---|
| OpenStreetMap (par défaut) | tile.openstreetmap.org | non |
| Satellite | Esri World Imagery (sans étiquettes ni frontières) | non |
| Terrain | Esri World Topo Map | non |
| Nuit | Esri World Dark Gray Base (sans étiquettes ; données jusqu'au zoom 16, agrandies au-delà) | non |

Le fond « Nuit » utilisait CARTO Dark Matter : constat de novembre 2026, toutes les tuiles CARTO
renvoient une image « API KEY REQUIRED ». Il a été remplacé par Esri World Dark Gray Base, qui ne
demande pas de clé (la mini-carte de situation utilise le même fond). Si plus de 6 tuiles d'un
fond échouent, le message « Ce fond de carte est momentanément indisponible » s'affiche.

---

## Couches cartographiques

| Couche | Fichier | Type | Contenu |
|---|---|---|---|
| **Susceptibilité aux inondations (modèle GTB)** | `data/susceptibilite.geojson` | MultiPolygone | 5 entités, une par classe (attributs `classe`, `libelle`, `superficie_km2`), version segmentée (6 314 zones). Moteur canvas, chargée au premier cochage, opacité réglable |
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
d'arc) et viennent de `json/statistiques.json`, jamais d'un calcul sur les polygones.

**Couche segmentée (méthode d'affichage).** Segmentation par objets (algorithme de Felzenszwalb
et Huttenlocher) appliquée à la carte de probabilité du modèle. Chaque segment reçoit la classe
dominante de ses cellules, pondérée pour conserver la superficie de chaque classe ; les segments
voisins de même classe sont fusionnés ; les contours sont simplifiés à environ 50 m. Les
polygones diffèrent du raster de 0,2 % à 0,9 % par classe. Les statistiques viennent du raster.

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
│   ├── controls.js         # Barre de boutons, panneaux, légende, mesures, recherche
│   ├── charts.js           # Tableau de bord (Chart.js)
│   └── about.js            # Onglet « À propos » (depuis json/metadonnees.json)
├── data/                   # Couches GeoJSON et données de précipitations
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
   **Couche de susceptibilité segmentée** : copier le nouveau GeoJSON tel quel sous
   `data/susceptibilite.geojson`, sans le re-simplifier : 5 entités MultiPolygon (une par
   classe) en EPSG:4326, attributs `classe` (1 à 5), `libelle` et `superficie_km2`. Vérifier
   qu'il s'ouvre, qu'il contient 5 entités et que les superficies des attributs sont celles du
   raster. Garder les fichiers sources hors du dépôt publié (dossier `import/`, ignoré par Git).
3. Si les chiffres changent, mettre à jour `json/statistiques.json` (et `json/metadonnees.json`
   si la méthode change). Pour la susceptibilité, recopier les superficies calculées sur le raster.
4. Changer le paramètre de version pour contourner le cache de GitHub Pages :
   - couche de susceptibilité : constante `SUSC_FILE_VERSION` dans `js/layers.js` ;
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
- **OpenStreetMap, Esri** — fonds de carte

La liste complète, y compris les données d'entrée du modèle, est dans `json/metadonnees.json`
(affichée dans l'onglet « À propos »).

---

## Technologies

| Technologie | Version | Rôle |
|---|---|---|
| [Leaflet](https://leafletjs.com) | 1.9.4 | Moteur cartographique (SVG ; canvas pour la susceptibilité) |
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
