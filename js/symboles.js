'use strict';
/* ===================================================
   WebSIG RSK — symboles.js
   Définition UNIQUE des symboles ponctuels (barrages, stations
   pluviométriques). La carte (layers.js), le panneau « Couches »
   (index.html, attribut data-symbole) et la légende (controls.js)
   appellent tous symboleSVG() : forme, couleurs et contour identiques
   partout, seule la taille d'affichage change.
   Aucun élément ne varie selon un attribut (capacité, réseau…).
   =================================================== */

var SYMBOLES = {
  /* Barrage — symbole cartographique (convention IGN/BRGM) ; taille carte : 38 px */
  barrages: {
    taille: 38,
    viewBox: '0 0 38 38',
    contenu:
        '<circle cx="19" cy="19" r="17" fill="#083d6e" stroke="white" stroke-width="2.5"/>'
      + '<rect x="7" y="10" width="24" height="4.5" fill="#bbdefb" rx="1" opacity="0.75"/>'
      + '<polygon points="8,14.5 30,14.5 27,25 11,25" fill="white" opacity="0.97"/>'
      + '<rect x="17" y="14.5" width="4" height="10.5" fill="#1e88e5" opacity="0.55"/>'
      + '<line x1="8" y1="18.5" x2="30" y2="18.5" stroke="#1976d2" stroke-width="0.7" opacity="0.4"/>'
      + '<line x1="9" y1="22" x2="29" y2="22" stroke="#1976d2" stroke-width="0.7" opacity="0.4"/>'
      + '<path d="M7 29 Q10.5 26.5 14 29 Q17.5 31.5 21 29 Q24.5 26.5 31 27.5" stroke="#90caf9" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
  },
  /* Station pluviométrique — pluviomètre + échelle (symbole hydrologique ABHS) ; taille carte : 30 px */
  stations: {
    taille: 30,
    viewBox: '0 0 30 30',
    contenu:
        '<circle cx="15" cy="15" r="13" fill="#1565c0" stroke="white" stroke-width="2"/>'
      + '<rect x="10" y="8" width="7" height="14" fill="white" rx="2" opacity="0.95"/>'
      + '<rect x="11" y="16" width="5" height="6" fill="#64b5f6" rx="1" opacity="0.85"/>'
      + '<line x1="14" y1="10.5" x2="16.5" y2="10.5" stroke="#1565c0" stroke-width="0.9" opacity="0.7"/>'
      + '<line x1="14" y1="12.5" x2="16.5" y2="12.5" stroke="#1565c0" stroke-width="0.9" opacity="0.7"/>'
      + '<line x1="14" y1="14.5" x2="16.5" y2="14.5" stroke="#1565c0" stroke-width="0.9" opacity="0.7"/>'
      + '<path d="M20 10 Q21 8 22 10 Q23 12 22 13.5 Q21 15 20 13.5 Q19 12 20 10Z" fill="white" opacity="0.85"/>'
  }
};

/* Balisage SVG d'un symbole.
   options.taille    : taille en px (par défaut : celle de la carte)
   options.decoratif : true dans le panneau et la légende (aria-hidden,
                       le nom de la couche est déjà lu à côté) */
function symboleSVG(couche, options) {
  var s = SYMBOLES[couche];
  if (!s) return '';
  options = options || {};
  var t = options.taille || s.taille;
  var a11y = options.decoratif ? ' aria-hidden="true" focusable="false"' : '';
  return '<svg width="' + t + '" height="' + t + '" viewBox="' + s.viewBox + '" xmlns="http://www.w3.org/2000/svg"' + a11y + '>'
       + s.contenu + '</svg>';
}

/* Remplit les emplacements <span data-symbole="…" data-taille="…"> (panneau Couches) */
function remplirSymboles(racine) {
  (racine || document).querySelectorAll('[data-symbole]').forEach(function (el) {
    el.innerHTML = symboleSVG(el.getAttribute('data-symbole'), { taille: +el.getAttribute('data-taille') || 18, decoratif: true });
    el.setAttribute('aria-hidden', 'true');
  });
}

window.SYMBOLES = SYMBOLES;
window.symboleSVG = symboleSVG;
window.remplirSymboles = remplirSymboles;
document.addEventListener('DOMContentLoaded', function () { remplirSymboles(document); });
