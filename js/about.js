'use strict';
/* ===================================================
   WebSIG RSK — about.js
   Remplit l'onglet "À propos" à partir de json/metadonnees.json.
   Rien n'est codé en dur ici : si le fichier est absent ou incomplet,
   chaque section manquante affiche "n.d." plutôt qu'une valeur inventée.
   =================================================== */

function naIfMissing(v, suffix) {
  if (v === undefined || v === null || v === '') return 'n.d.';
  return suffix ? (v + suffix) : v;
}

function renderAbout(meta) {
  var root = document.getElementById('about-dynamic-content');
  if (!root) return;

  if (!meta) {
    root.innerHTML = '<p class="legend-empty">Contenu indisponible (n.d.) — json/metadonnees.json n\'a pas pu être chargé.</p>';
    return;
  }

  var p = meta.projet || {};
  var m = meta.methode || {};
  var v = meta.validation || {};

  var html = '';

  html += '<div class="about-header">'
    + '<h2>' + naIfMissing(meta.nom_site) + '</h2>'
    + '<h3>' + naIfMissing(meta.region) + '</h3>'
    + '<p class="about-version">' + naIfMissing(meta.version) + ' — mise à jour : ' + naIfMissing(meta.mise_a_jour) + '</p>'
    + '</div>';

  html += '<div class="about-card"><h4>🎓 Contexte académique</h4><table class="about-table">'
    + '<tr><td>Type</td><td>' + naIfMissing(p.type) + '</td></tr>'
    + '<tr><td>Année</td><td>' + naIfMissing(p.annees) + '</td></tr>'
    + '<tr><td>Université</td><td>' + naIfMissing(p.universite) + '</td></tr>'
    + '<tr><td>Faculté</td><td>' + naIfMissing(p.faculte) + '</td></tr>'
    + '<tr><td>Filière</td><td><strong>' + naIfMissing(p.filiere) + '</strong></td></tr>'
    + '<tr><td>Auteur</td><td>' + naIfMissing(p.auteur) + '</td></tr>'
    + '<tr><td>Contact</td><td>' + (p.contact ? '<a href="mailto:' + p.contact + '">' + p.contact + '</a>' : 'n.d.') + '</td></tr>'
    + '</table></div>';

  /* Votre avis : lien simple vers le formulaire (nouvel onglet, sans iframe ni suivi) */
  var av = meta.avis || {};
  if (av.url) {
    html += '<div class="about-card"><h4>💬 ' + (av.titre || 'Votre avis') + '</h4>'
      + '<p class="about-text">' + naIfMissing(av.texte) + '</p>'
      + '<a class="btn-primary btn-avis" href="' + av.url + '" target="_blank" rel="noopener noreferrer"'
      + ' aria-label="' + (av.aria_label || '').replace(/"/g, '&quot;') + '">' + (av.libelle || 'Donner mon avis') + '</a>'
      + '</div>';
  }

  html += '<div class="about-card"><h4>🎯 Objectif</h4><p class="about-text">' + naIfMissing(meta.objectif) + '</p></div>';

  var nf = function (x) { return (x == null) ? 'n.d.' : String(x).replace('.', ','); };

  html += '<div class="about-card"><h4>🤖 Méthode</h4><table class="about-table">'
    + '<tr><td>Modèle</td><td>' + naIfMissing(m.modele) + '</td></tr>'
    + '<tr><td>Implémentation</td><td>' + naIfMissing(m.implementation) + '</td></tr>'
    + '<tr><td>Grille</td><td>' + naIfMissing(m.grille) + '</td></tr>'
    + '<tr><td>Points d\'entraînement</td><td>'
        + (m.points_exploitables != null
            ? m.points_exploitables + ' points exploitables (' + naIfMissing(m.points_inondes) + ' inondés, '
              + naIfMissing(m.points_non_inondes) + ' non inondés), issus d\'un inventaire de '
              + naIfMissing(m.inventaire_points) + ' points'
            : 'n.d.') + '</td></tr>'
    + '<tr><td>Classes</td><td>' + naIfMissing(m.nombre_classes) + '</td></tr>'
    + '</table>'
    + (m.indice ? '<p class="about-text" style="margin-top:6px">' + m.indice + '</p>' : '')
    + (m.affichage_carte ? '<p class="about-subtitle">Affichage de la carte</p><p class="about-text">' + m.affichage_carte + '</p>' : '')
    + (Array.isArray(m.variables) && m.variables.length
        ? '<p class="about-subtitle">Variables du modèle (' + naIfMissing(m.nombre_variables) + ')</p>'
          + '<ul class="about-list about-list-compact">'
          + m.variables.map(function (g) {
              return '<li><strong>' + g.groupe + '</strong> : ' + (g.liste || []).join(', ') + '</li>';
            }).join('')
          + '</ul>'
        : '')
    + '</div>';

  html += '<div class="about-card"><h4>✅ Validation</h4><table class="about-table">'
    + '<tr><td>Méthode</td><td>' + naIfMissing(v.type) + '</td></tr>'
    + '<tr><td>AUC, blocs de 10 km</td><td><b>' + nf(v.auc_blocs_10km) + '</b></td></tr>'
    + '<tr><td>AUC, blocs de 20 km</td><td><b>' + nf(v.auc_blocs_20km) + '</b></td></tr>'
    + '</table>'
    + (v.commentaire_aleatoire ? '<p class="about-text" style="margin-top:6px">' + v.commentaire_aleatoire + '</p>' : '')
    + (v.variables_dominantes ? '<p class="about-text" style="margin-top:4px">' + v.variables_dominantes + '</p>' : '')
    + '</div>';

  if (Array.isArray(meta.limites) && meta.limites.length) {
    html += '<div class="about-card"><h4>⚠️ Limites</h4><ul class="about-list">'
      + meta.limites.map(function (l) { return '<li>' + l + '</li>'; }).join('')
      + '</ul></div>';
  }

  if (Array.isArray(meta.technologies) && meta.technologies.length) {
    /* Classes de couleur déjà définies dans style.css pour ces libellés
       exacts ; sinon on reste sur le badge générique .tech-badge. */
    var techClass = {
      'HTML5': 'html', 'CSS3': 'css', 'JavaScript ES6': 'js',
      'Leaflet 1.9': 'leaflet', 'Chart.js 4': 'chartjs',
      'GeoJSON': 'geojson', 'Nominatim': 'nominatim'
    };
    html += '<div class="about-card"><h4>🛠️ Technologies</h4><div class="tech-stack">'
      + meta.technologies.map(function (t) {
          var cls = techClass[t] ? ' ' + techClass[t] : '';
          return '<span class="tech-badge' + cls + '">' + t + '</span>';
        }).join('')
      + '</div></div>';
  }

  if (Array.isArray(meta.sources) && meta.sources.length) {
    html += '<div class="about-card"><h4>📦 Sources de données</h4><ul class="about-list">'
      + meta.sources.map(function (s) {
          return '<li><strong>' + (s.sigle || '?') + '</strong>' + (s.nom ? ' — ' + s.nom : '') + '</li>';
        }).join('')
      + '</ul></div>';
  }

  if (meta.avertissement) {
    html += '<div class="about-card about-disclaimer-card">' + meta.avertissement + '</div>';
  }

  html += '<div class="about-footer"><p>© 2026 — ' + naIfMissing(p.type) + ', ' + naIfMissing(p.universite) + '</p></div>';

  root.innerHTML = html;
}

async function loadAbout() {
  try {
    var res = await fetch('json/metadonnees.json?v=20261121');
    if (!res.ok) { renderAbout(null); return; }
    var meta = await res.json();
    renderAbout(meta);
  } catch (e) {
    console.warn('[about] error:', e.message);
    renderAbout(null);
  }
}

document.addEventListener('DOMContentLoaded', loadAbout);
