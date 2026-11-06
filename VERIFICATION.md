# VERIFICATION — Audit Phase 0 (sans modification)

Date de l'audit : 2026-11-06
Méthode : lecture du code, extraction indépendante des GeoJSON via un script Node (calculs de longueur et de surface recalculés depuis les géométries, indépendamment de l'application), et tests Playwright/Chromium réels (desktop 1440×900, mobile 390×844 tactile) sur un serveur statique local.

> ⚠️ **Avertissement préalable important** : l'arborescence réelle du dépôt diffère de celle décrite dans la commande de travail. Les fichiers `js/` s'appellent `charts.js, controls.js, graticule.js, layers.js, map.js` (pas `carte/couches/statistiques/outils/recherche.js`). Les GeoJSON portent des noms différents (`admin_boundaries_real`, `aquifers`, `dams_real`, `flood_susceptibility`, `rain_stations_real`, `rivers_real`, `watersheds_real`, etc. — pas `region/provinces/bassins/reseau_hydro/nappes/barrages/stations/susceptibilite`). **Aucun dossier `json/` n'existe** (pas de `precipitations.json` / `statistiques.json` / `metadonnees.json` — en revanche `data/precip_report.json` existe et joue déjà ce rôle pour les précipitations). Je conserve les noms de fichiers existants (pas de renommage non demandé) et je crée `json/metadonnees.json` en Phase 3 comme demandé.

---

## 1. Couches par groupe, entités par fichier, poids des fichiers

### Groupes de couches (8 couches thématiques + 4 fonds de carte, confirmé par la console de l'app)

| Groupe | Couches | Source |
|---|---|---|
| Fonds de carte (4) | OpenStreetMap *(défaut)*, Satellite (Esri), Terrain (Esri), CartoDB Dark (« Nuit ») | tuiles externes |
| Ressources en eau (5) | Bassins & Sous-bassins Versants, Oueds/Rivières, Nappes souterraines, Barrages, Stations pluviométriques | GeoJSON |
| Susceptibilité (1) | Carte d'inondation (GTB, 5 classes) | GeoJSON |
| Administratif (2) | Limites administratives, Villes principales | 1 GeoJSON + **données codées en dur dans `js/layers.js`** (12 villes, aucun fichier dédié) |

### Entités et poids — fichiers **réellement chargés** par l'application

| Fichier | Entités | Poids |
|---|---|---|
| `admin_boundaries_real.geojson` | 1 (région RSK) | 147,8 KB |
| `aquifers.geojson` | 7 (nappes) | 36,9 KB |
| `dams_real.geojson` | 10 (barrages) | 3,1 KB |
| `rain_stations_real.geojson` | 5 (stations) | 3,7 KB |
| `rivers_real.geojson` | 2 491 (segments) | **1 333,2 KB** |
| `watersheds_real.geojson` | 5 (bassins/sous-bassins) | 196,8 KB |
| `flood_susceptibility.geojson` | 5 (classes) | **1 049,7 KB** |
| `precip_report.json` | — (série temporelle) | 2,2 KB |

### Fichiers présents dans `data/` mais **jamais chargés** par l'application (poids mort, ≈ 1,31 Mo)

| Fichier | Entités | Poids | Remarque |
|---|---|---|---|
| `hydraulic_agencies.geojson` | 3 | **1 143,3 KB** | le plus lourd du dépôt, totalement inutilisé |
| `dam_reservoirs.geojson` | 9 | 132,4 KB | inutilisé |
| `admin_boundaries.geojson` | 6 | 3,5 KB | doublon non utilisé de la version `_real` |
| `dams.geojson` | 3 | 1,7 KB | doublon non utilisé (3 barrages seulement) |
| `rain_stations.geojson` | 5 | 2,4 KB | doublon non utilisé |
| `rivers.geojson` | 6 | 4,0 KB | doublon non utilisé |
| `watersheds.geojson` | 4 | 3,2 KB | doublon non utilisé |
| `precip_grid_rsk.geojson` | 12 | 2,5 KB | inutilisé |
| `dem_stats.json` | — | 0,5 KB | inutilisé |
| `rf_model_report.json` | — | 0,8 KB | **décrit un ancien modèle Random Forest** (voir §5), inutilisé et obsolète |

Aucun fichier ne dépasse individuellement 2 Mo (seuil Phase 4), mais ~1,3 Mo de fichiers morts sont inutilement présents dans `data/` et servis publiquement sur GitHub Pages. Je ne supprime rien sans ton accord (voir résumé final) — simple signalement.

*(Hors périmètre `data/` : le dossier racine contient aussi des fichiers shapefile non versionnés `Flood-area.*` et `NON.*` ainsi qu'un `.sr.lock` — manifestement des exports QGIS de travail, sans lien avec l'application web. Je n'y touche pas.)*

---

## 2. Barrages

**Fichier réellement chargé : `data/dams_real.geojson` — 10 barrages.**

| Barrage | Oued | Capacité (Mm³) | Année |
|---|---|---|---|
| Oued El Makhazine | Loukkos | 773 | 1979 |
| Ouljet Es Soltane | Beht | 510 | 2018 |
| El Kansera | Beht | 266 | 1935 (Sur, 1969) |
| Sidi Yahya | Khellata | 11 | 2009 |
| Rouidat Amont | Rouidat | 3 | 1987 |
| Aïn Koreima | Akrech | 1,3 | 1987 |
| Bouknadil | Dfila | 1 | 2001 |
| Had Laghoualem | Bridila | 0,9 | 2002 |
| Arid | Arid | 0,7 | 1985 |
| Aït Lambrabtiya | Khanaza | 0,2 | 1985 |

**Nombre : 10 → conforme à ta référence (10 barrages).**
**Somme des capacités : 1 567,1 Mm³ → conforme à ta référence (1 567 Mm³).**

### Écarts avec la liste de ton mémoire (11 barrages)

- **« Koudiat Bourna » est absent** du jeu de données `dams_real.geojson` — c'est le barrage manquant (ta liste en a 11, le fichier en a 10 ; le compte et le total correspondent déjà à ta référence de 10/1 567, donc Koudiat Bourna semble ne jamais avoir fait partie de ce jeu de données).
- **Barrage Sidi Mohamed Ben Abdellah (Bouregreg) : ABSENT**, confirmé — il n'apparaît dans aucun des 10 barrages.
- **Écart de valeur à trancher** : El Kansera est à **266 Mm³** dans le fichier, alors que tu cites **297 Mm³** dans ton mémoire (écart de 31 Mm³). Le total du fichier (1 567,1 Mm³) correspond exactement à ta référence globale avec la valeur 266 — donc soit ton mémoire a une coquille sur El Kansera, soit le fichier est basé sur une source différente. **Je n'invente pas de correction** : à trancher de ton côté.
- Agence : le champ « Agence » demandé n'existe pas dans `dams_real.geojson` (champs réels : `BARRAGE, OUED, Capacité_, ANNEE`). Je n'invente pas cette donnée ; elle apparaîtra comme « n.d. » si affichée.

---

## 3. Stations, réseau hydrographique, susceptibilité

### Stations pluviométriques

**5 stations dans `rain_stations_real.geojson` → conforme à ta référence (5).**

⚠️ **Incohérence détectée** : le tableau HTML statique de l'onglet « Précipitations » (codé en dur dans `index.html`) affiche des valeurs (Rabat 562 mm, Kénitra 618, Salé 548, Tiflet 498, Khémisset 478) qui **ne correspondent pas** aux données réelles du fichier (`annual_rainfall` : Rabat-Météo 454,2 / Kénitra 455,3 / Salé 454,2 / Tiflet 474,1 / Khémisset 474,1 mm). À corriger en Phase 2 en calculant la table depuis le GeoJSON.

À noter aussi : le champ `source` de `rain_stations_real.geojson` indique **« NASA POWER PRECTOTCORR »** (réanalyse satellite), alors que le réseau affiché est « DMN / ABHS » — ce sont des valeurs modélisées, pas des relevés de station au sens strict. À nuancer dans l'interface si tu veux rester rigoureux.

### Réseau hydrographique

**Longueur recalculée indépendamment (formule haversine sur les 2 491 segments de `rivers_real.geojson`) : 8 888 km.**
Confirmé deux fois : par un script Node indépendant (8 887,9 km) et par la valeur affichée en direct dans l'application testée au navigateur (8 888 km, carte `stat-rivers`).

**Écart majeur avec ta référence (1 339 km) — facteur ×6,6.** Répartition par catégorie : secondaire 5 774,5 km, majeur 2 378,4 km, principal 735,0 km. Aucune de ces sous-catégories ne correspond à 1 339 km non plus. L'historique Git montre que ce fichier a été reclassifié/étendu significativement après la rédaction probable de ton chiffre de référence (commit *« Unify hydraulic network (oueds) classification into a single real 4-tier hierarchy »*). **Je ne tranche pas lequel est correct** — à toi de décider si le total affiché doit être limité à un sous-ensemble (ex. « principal » seul, ou principal+majeur) ou si la référence de 1 339 km doit être mise à jour. Je ne modifie pas ce chiffre sans ta décision.

### Susceptibilité aux inondations (GTB, 5 classes)

Les propriétés **déclarées** dans `flood_susceptibility.geojson` correspondent **exactement** à ta référence :

| Classe | Surface (km²) | % |
|---|---|---|
| Très faible | 16 295 | 92,24 |
| Faible | 188 | 1,06 |
| Modérée | 167 | 0,95 |
| Élevée | 191 | 1,08 |
| Très élevée | 825 | 4,67 |
| **Total** | **17 666** | **100** |

**→ Conforme à ta référence.**

Un recalcul géométrique indépendant (projection équirectangulaire approchée, pas une projection équivalente) donne des surfaces proches mais pas identiques (16 385,8 / 200,0 / 167,9 / 194,6 / 809,2 km², total 17 757,6 km² ; écart < 0,6 %). Cet écart est attribuable à l'approximation de ma méthode de vérification (non équivalente en surface), **pas à une erreur de donnée** — les propriétés enregistrées sont déjà cohérentes avec ta référence et c'est ce que l'application affiche.

---

## 4. Défauts techniques

| Défaut | Constat | Statut |
|---|---|---|
| Balise viewport | `width=device-width, initial-scale=1.0` (avec « .0 ») | ⚠️ à corriger en `initial-scale=1` exact (Phase 1) |
| Texte parasite en tête de page | Aucun trouvé (pas de « meta-viewport » ni « --- » visible) | ✅ OK |
| « Chargement… » bloqué | Le spinner se masque correctement avant 2,5 s dans tous les tests ; un filet de sécurité le force à disparaître à 4 s au cas où | ⚠️ partiel : si un fichier échoue, le filet masque le spinner **silencieusement**, sans message d'erreur lisible — à corriger (Phase 1) |
| Lecture Lat/Lon bloquée sur « — » | Desktop : fonctionne, testé au survol réel (passe de « — » à des coordonnées). Mobile : non confirmé au **toucher** réel (seul un `mousemove` simulé a été testé) | ⚠️ à vérifier/renforcer pour le tactile (Phase 1) |
| Graphiques qui ne s'affichent pas | **5 graphiques existent réellement** dans le code (`riskBarChart`, `damLevelChart`, `watershedChart`, `monthlyRainChart`, `annualRainChart`) — pas 6 comme attendu. Les 2 graphiques de l'onglet « Précipitations » ont un canvas 0×0 tant que l'onglet n'est pas ouvert (Chart.js ne peut pas dimensionner un canvas cché par `display:none`), mais se redimensionnent et s'affichent correctement dès que l'onglet devient visible (vérifié avec Chromium réel) | ⚠️ pas cassé, mais rendu fragile — à renforcer avec un `resize()` explicite au changement d'onglet (Phase 1). **Le compte de 6 graphiques ne correspond pas au code actuel (5) — voir résumé final.** |
| Erreurs console / 404 | Aucune erreur console, aucune requête en échec, aucun code ≥ 400 détecté (desktop et mobile, Playwright/Chromium) | ✅ OK |
| Bibliothèques chargées | Leaflet **1.9.4** (unpkg, sans SRI), Leaflet.draw **1.0.4** (cdnjs), Leaflet MiniMap **3.6.1** (cdnjs), Chart.js **4.4.0** (jsdelivr), html2canvas **1.4.1** (cdnjs) | ✅ conforme au contexte technique (Leaflet 1.9, Chart.js 4) + 3 bibliothèques additionnelles déjà en place, à mentionner dans le README |
| Défilement horizontal mobile | Aucun (`scrollWidth === clientWidth === 390px`), vérifié à 390×844 | ✅ OK |
| Panneaux mobiles par défaut | Déjà repliés hors écran par défaut sous 1024 px (plus large que le seuil 768 px demandé), s'ouvrent au tap | ✅ déjà conforme |

---

## 5. Incohérences de vocabulaire, de nom et de sources

- **Nom du site** : actuellement incohérent — `<title>` dit « WebSIG RSK — Risque d'inondation… », les modales disent « WebSIG — Ressources en eau & Risque d'inondation », le sous-titre sidebar dit « Ressources en eau & Risques ». **20 occurrences** de « risque » / « Carte d'inondation » / « zone(s) de risque » trouvées dans `index.html`, `js/`, `css/` (couche, titre de graphique, popup de repli « Zone de risque », commentaires CSS, libellé de groupe). À unifier en Phase 2 vers le nom unique demandé et remplacer « susceptibilité » partout où le sens est « susceptibilité modélisée », en gardant bien la distinction avec « aléa » et « risque » au sens technique.
- **Légende de la susceptibilité** : n'apparaît **pas** à l'ouverture dans le panneau légende flottant de la carte (celui-ci affiche par défaut « Cliquez sur une carte pour voir sa légende » jusqu'à un clic utilisateur) — à corriger en Phase 2.
- **Fonds de carte** : déjà à sélection unique fonctionnellement (OSM actif par défaut, un seul actif à la fois), mais implémentés comme des `<div>` cliquables, pas comme de vrais boutons radio accessibles — à convertir en Phase 2/4.
- **Sources citées (onglet À propos)** : ABHS, DMN, **HCEF**, OpenStreetMap, ESRI, SRTM (NASA). **Aucune couche ne provient du HCEF** (Haut-Commissariat aux Eaux et Forêts) — à retirer comme demandé. Sources manquantes par rapport à ta liste Phase 3 : ABHBC, HCP (RGPH), Sentinel-2/Copernicus, ERA5-Land/ECMWF, MERIT Hydro, FAO/UNESCO (sols) — à ajouter.
- **Contenu méthodologique (Phase 3)** : n'existe **nulle part** dans l'app actuelle. Le seul fichier de rapport de modèle présent, `data/rf_model_report.json`, décrit un **ancien modèle Random Forest** à 10 facteurs différents de ceux de ta méthode GTB (elevation/slope/twi/dist_river/dist_reservoir/river_score/reservoir_score/ann_precip/max_monthly/precip_cv, sans NDVI/orientation/occupation du sol/routes), **sans aucune métrique de validation** (ni AUC, ni exactitude, ni Kappa), et il est orphelin (jamais chargé). Le contenu que tu fournis (800 points, AUC 0,99, 265 points de validation…) sera donc intégré **tel que tu l'as donné**, dans un nouveau `json/metadonnees.json`, sans tentative de recoupement avec ce fichier obsolète qui ne décrit pas le même modèle.
- **Villes principales** : 12 villes et populations codées en dur dans `js/layers.js` (fonction `loadCities`), sans source/année citée dans le code. Les chiffres (ex. Rabat 577 827 hab.) correspondent au **RGPH 2014**, pas au RGPH 2024 mentionné en Phase 3. Je ne les modifie pas (pas de données RGPH 2024 disponibles ici) — à mettre à jour de ton côté si tu as les résultats 2024, sinon je recommande de citer RGPH 2014 pour rester exact.
- **Population régionale** dans `admin_boundaries_real.geojson` : 5 132 639 hab., `source` indiqué = « OpenStreetMap relation/4730737 » (pas HCP). À clarifier si cette valeur doit être attribuée au HCP.

---

## Récapitulatif des points à trancher (aucune donnée inventée, écrits « n.d. » sinon)

1. Barrage manquant : **Koudiat Bourna** (absent du fichier) — confirmer s'il doit être ajouté (avec capacité/oued réels) ou si la référence doit rester à 10.
2. El Kansera : **266 Mm³** (fichier) vs **297 Mm³** (mémoire) — lequel est correct ?
3. Réseau hydrographique : **8 888 km** (calcul réel) vs **1 339 km** (référence) — écart ×6,6, à clarifier (sous-ensemble à afficher, ou référence à mettre à jour).
4. Nombre de graphiques du tableau de bord : **5 dans le code actuel**, pas 6 — je proposerai en Phase 2 un 6ᵉ graphique basé sur une donnée déjà réelle et non utilisée (surface des nappes souterraines, `aquifers.geojson`, champ `AREA_KM2`, 7 nappes) plutôt que d'inventer une donnée.
5. Sources HCEF à retirer ; sources manquantes à ajouter (voir §5).
6. Fichiers morts (~1,3 Mo, dont `hydraulic_agencies.geojson` 1,14 Mo) : à supprimer ou archiver ? Je ne supprime rien sans ton feu vert.
