# WebSIG — Ressources en eau & Risques d'inondation
### Région Rabat-Salé-Kénitra, Maroc

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-264DE4?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=flat&logo=leaflet&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=flat&logo=chartdotjs&logoColor=white)

---

## Description

Système d'Information Géographique Web (WebSIG) interactif dédié à la gestion des **ressources en eau** et à la cartographie du **risque d'inondation** dans la région **Rabat-Salé-Kénitra** (RSK), Maroc.

Ce projet PFE (Projet de Fin d'Études) offre :
- Une interface cartographique multi-couches (Leaflet.js)
- Des outils de mesure distance/superficie
- Des visualisations statistiques dynamiques (Chart.js)
- Un géocodeur intégré (Nominatim/OpenStreetMap)
- Un export PNG de la carte
- Un affichage des attributs par popup au clic

---

## Installation & Utilisation

Aucune dépendance serveur requise. Toutes les bibliothèques sont chargées via CDN.

```bash
# Ouvrir directement dans un navigateur moderne
# (Chrome, Firefox, Edge — version récente)
ouvrir: websig-rabat/index.html
```

> **Note :** Pour un fonctionnement optimal (chargement des GeoJSON via `fetch()`), servez le dossier via un serveur local :
> ```bash
> # Python 3
> python -m http.server 8080
> # ou Live Server dans VS Code
> ```
> Puis ouvrir `http://localhost:8080/websig-rabat/`

---

## Structure du projet

```
websig-rabat/
├── index.html              # Application principale
├── css/
│   └── style.css           # Styles complets (thème sombre)
├── js/
│   ├── map.js              # Initialisation Leaflet, fonds de carte, contrôles
│   ├── layers.js           # Chargement GeoJSON, styles, popups
│   ├── controls.js         # Interactions UI (checkboxes, onglets, mesures)
│   └── charts.js           # Graphiques Chart.js
├── data/
│   ├── watersheds.geojson       # Bassins versants (4 polygones)
│   ├── rivers.geojson           # Réseau hydrographique (6 tronçons)
│   ├── dams.geojson             # Barrages (3 points)
│   ├── rain_stations.geojson    # Stations pluviométriques (5 points)
│   ├── flood_zones.geojson      # Zones de risque d'inondation (6 polygones)
│   └── admin_boundaries.geojson # Limites administratives (6 entités)
└── README.md
```

---

## Couches cartographiques

| Couche | Type | Description |
|---|---|---|
| **Bassins versants** | Polygone | 4 bassins hydrologiques (Bou Regreg, Sebou, côtiers) |
| **Oueds / Rivières** | Ligne | 6 cours d'eau, stylisés par ordre de Strahler |
| **Barrages** | Point | 3 grands barrages avec niveau de remplissage |
| **Stations pluviométriques** | Point | 5 stations avec données mensuelles et graphique intégré |
| **Zones de risque** | Polygone | 6 zones classifiées (élevé / moyen / faible) |
| **Limites administratives** | Polygone | 6 préfectures et provinces de la région RSK |

---

## Fonds de carte

| Nom | Source |
|---|---|
| OpenStreetMap | © OpenStreetMap contributors |
| Satellite Esri | © Esri, DigitalGlobe |
| Terrain Esri | © Esri, HERE |
| CartoDB Dark | © CARTO |

---

## Technologies utilisées

| Technologie | Version | Rôle |
|---|---|---|
| [Leaflet.js](https://leafletjs.com) | 1.9.4 | Moteur cartographique |
| [Chart.js](https://chartjs.org) | 4.4.0 | Graphiques statistiques |
| [Leaflet.draw](https://github.com/Leaflet/Leaflet.draw) | 1.0.4 | Outils de mesure |
| [Leaflet.MiniMap](https://github.com/Norkart/Leaflet-MiniMap) | 3.6.1 | Carte de situation |
| [html2canvas](https://html2canvas.hertzen.com) | 1.4.1 | Export PNG |
| [Nominatim](https://nominatim.openstreetmap.org) | — | Géocodage |
| Google Fonts | — | Rajdhani + Source Sans Pro |

---

## Fonctionnalités

- **4 fonds de carte** interchangeables (radio buttons)
- **6 couches thématiques** activables/désactivables (checkboxes)
- **Popups riches** avec tableaux d'attributs, barres de niveau, graphiques inline
- **Légende dynamique** (se met à jour selon les couches actives)
- **Outils de mesure** : distance (polyligne) et superficie (polygone)
- **Géocodeur** Nominatim avec autocomplete (région Maroc)
- **Export PNG** de la carte via html2canvas
- **Plein écran** natif (API Fullscreen)
- **MiniMap** de situation (CartoDB Dark)
- **Boussole Nord** permanente
- **Échelle** métrique
- **Coordonnées** en temps réel au survol
- **Statistiques** : camembert risques, niveaux barrages, aires bassins
- **Précipitations** : histogramme mensuel, série interannuelle 2000–2023
- **Tableau** stations trié par colonne
- **Design responsive** (mobile 768px, smartphone 480px)

---

## Données

Les données GeoJSON sont des données de référence basées sur :
- **ABHS** — Agence du Bassin Hydraulique du Sebou
- **DMN** — Direction de la Météorologie Nationale
- **HCEFLCD** — Haut Commissariat aux Eaux et Forêts
- Coordonnées issues du référentiel géographique national (Lambert Maroc → WGS84)

---

## Auteur & Encadrement

| | |
|---|---|
| **Type** | Projet de Fin d'Études (PFE) Master 2 |
| **Année** | 2024 – 2025 |
| **Université** | Université Ibn Tofail, Kénitra |
| **Filière** | Géomatique & Systèmes d'Information Géographique |
| **Email** | zouhayr.aanzoul@uit.ac.ma |

---

© 2025 — Université Ibn Tofail, Faculté des Sciences, Kénitra, Maroc.
