'use strict';
/* ===================================================
   WebSIG RSK — controls.js
   All UI interactions wired here.
   Critical fix: never cache window.overlayLayers
   reference — always read it fresh at call time.
   =================================================== */

document.addEventListener('DOMContentLoaded', function () {

  /* ── helpers ─────────────────────────────────────── */

  function getLayer(name) {
    return window.overlayLayers && window.overlayLayers[name];
  }

  /* Add or remove a layer by name.
     Reads window.overlayLayers at call time — no stale refs. */
  function toggleLayer(name, add) {
    const lyr = getLayer(name);
    if (!lyr || !window.map) return;
    try {
      if (add) { window.map.addLayer(lyr); }
      else      { window.map.removeLayer(lyr); }
    } catch (e) { console.warn('[controls] toggleLayer:', name, e.message); }
  }

  /* ── BASE LAYER CARDS — vrai groupe de boutons radio ─
     Un seul fond actif à la fois (géré nativement par le navigateur :
     clic, Entrée/Espace, flèches). On synchronise juste la classe
     .active (style visuel) avec l'input réellement coché. ── */
  document.querySelectorAll('.basemap-radio-input').forEach(function (input) {
    input.addEventListener('change', function () {
      if (!this.checked) return;
      document.querySelectorAll('.basemap-card').forEach(function (c) {
        c.classList.remove('active');
      });
      var card = this.closest('.basemap-card');
      if (card) card.classList.add('active');
      if (window.switchBaseLayer) window.switchBaseLayer(this.value);
    });
  });

  /* ── THEMATIC MAP CARDS ──────────────────────────── */
  /* Layers NOT shown in their own legend section */
  var NO_LEGEND_LAYERS = ['Limites administratives', 'Villes principales'];

  document.querySelectorAll('.thematic-card').forEach(function (card) {
    card.addEventListener('click', function (e) {
      if (e.target.classList.contains('tc-zoom')) return;
      const name      = this.dataset.layer;
      const wasActive = this.classList.contains('active');
      this.classList.toggle('active');
      const nowActive = !wasActive;

      if (getLayer(name)) {
        toggleLayer(name, nowActive);
        updateLegend();
        return;
      }
      var cardEl = this;
      function handler(ev) {
        if (ev.detail.name === name) {
          document.removeEventListener('layerReady', handler);
          /* État lu au moment où la couche arrive (l'utilisateur a pu
             décocher pendant le téléchargement). */
          toggleLayer(name, cardEl.classList.contains('active'));
          updateLegend();
        }
      }
      document.addEventListener('layerReady', handler);
      /* Couches chargées à la demande (susceptibilité) : premier cochage */
      if (nowActive && window.ensureLayerLoaded) window.ensureLayerLoaded(name);
      updateLegend();
    });
  });

  /* ── ZOOM-TO-LAYER BUTTONS (on thematic cards) ───── */
  document.querySelectorAll('.tc-zoom').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const lyr = getLayer(this.dataset.layer);
      if (!lyr || !window.map) return;
      try {
        const b = lyr.getBounds ? lyr.getBounds() : null;
        if (b && b.isValid()) window.map.fitBounds(b, { padding: [30, 30], animate: true });
      } catch (_) {}
    });
  });

  /* ── COLLAPSIBLE LAYER GROUPS ────────────────────── */
  document.querySelectorAll('.layer-group-header').forEach(function (h) {
    h.addEventListener('click', function () {
      const g = this.closest('.layer-group');
      if (g) g.classList.toggle('collapsed');
    });
  });

  /* ══════════════════════════════════════════════════
     PANNEAUX À LA DEMANDE — barre de boutons + panneau unique
     Un seul panneau ouvert à la fois ; même bouton, croix ou Échap
     pour le fermer. Tous fermés au chargement.
     ══════════════════════════════════════════════════ */
  var PANEL_TITLES = { couches: 'Couches', stats: 'Statistiques', precip: 'Précipitations', apropos: 'À propos' };
  var panel      = document.getElementById('panel');
  var panelTitle = document.getElementById('panel-title');
  var panelBody  = panel ? panel.querySelector('.panel-body') : null;
  var legendEl   = document.getElementById('map-legend-float');
  var currentPanel = null;
  var lastOpener   = null;

  function isPhone() { return window.matchMedia('(max-width: 768px)').matches; }
  function railBtn(key) { return document.querySelector('.rail-btn[data-open="' + key + '"]'); }
  function setExpanded(key, on) {
    var b = railBtn(key);
    if (b) b.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  /* Un graphique créé dans un conteneur masqué a une taille nulle :
     on le redimensionne à l'ouverture de son panneau. */
  function resizeChartsIn(el) {
    if (!el || !window.Chart || !Chart.instances) return;
    Object.values(Chart.instances).forEach(function (c) {
      if (el.contains(c.canvas)) c.resize();
    });
  }

  function openPanel(key) {
    if (!panel || !PANEL_TITLES[key]) return;
    if (isPhone()) setLegendOpen(false);          /* téléphone : un seul élément ouvert */
    var section = null;
    panel.querySelectorAll('.panel-section').forEach(function (s) {
      var on = s.dataset.panel === key;
      s.classList.toggle('active', on);
      if (on) section = s;
    });
    panelTitle.textContent = PANEL_TITLES[key];
    panel.hidden = false;
    Object.keys(PANEL_TITLES).forEach(function (k) { setExpanded(k, k === key); });
    currentPanel = key;
    if (panelBody) panelBody.scrollTop = 0;
    requestAnimationFrame(function () { resizeChartsIn(section); });
  }

  function closePanel(returnFocus) {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    Object.keys(PANEL_TITLES).forEach(function (k) { setExpanded(k, false); });
    var key = currentPanel;
    currentPanel = null;
    if (returnFocus) { var b = railBtn(key); if (b) b.focus(); }
  }

  /* Légende : affichée / repliée par son bouton (réglages : voir plus bas) */
  function setLegendOpen(on) {
    if (!legendEl) return;
    legendEl.classList.toggle('is-collapsed', !on);
    setExpanded('legende', on);
    if (on && isPhone()) closePanel(false);
  }
  window.setLegendOpen = setLegendOpen;

  /* Barre de boutons : contrôle Leaflet en haut à gauche, sous le zoom
     (rangée en bas sur téléphone, par CSS). */
  var railEl = document.getElementById('rail');
  if (railEl && window.map) {
    var RailControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: function () {
        L.DomEvent.disableClickPropagation(railEl);
        L.DomEvent.disableScrollPropagation(railEl);
        return railEl;
      }
    });
    new RailControl().addTo(window.map);
  }
  document.querySelectorAll('.rail-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = this.dataset.open;
      lastOpener = this;
      if (key === 'legende') {
        setLegendOpen(legendEl && legendEl.classList.contains('is-collapsed'));
        return;
      }
      if (currentPanel === key) closePanel(true); else openPanel(key);
    });
  });
  var panelClose = document.getElementById('panel-close');
  if (panelClose) panelClose.addEventListener('click', function () { closePanel(true); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (currentPanel) { closePanel(true); return; }
    if (document.body.classList.contains('search-open')) toggleSearch(false);
  });
  window.openPanel = openPanel;
  window.closePanel = closePanel;

  /* ── Panneau Couches : Tout décocher / Réinitialiser ──
     « Réinitialiser » = couches affichées par défaut dans index.html. */
  var allCards = Array.prototype.slice.call(document.querySelectorAll('.thematic-card'));
  var DEFAULT_ACTIVE = allCards.filter(function (c) { return c.classList.contains('active'); })
                               .map(function (c) { return c.dataset.layer; });
  function setCard(card, on) { if (card.classList.contains('active') !== on) card.click(); }
  var btnNone  = document.getElementById('btn-layers-none');
  var btnReset = document.getElementById('btn-layers-reset');
  if (btnNone)  btnNone.addEventListener('click', function () { allCards.forEach(function (c) { setCard(c, false); }); });
  if (btnReset) btnReset.addEventListener('click', function () {
    allCards.forEach(function (c) { setCard(c, DEFAULT_ACTIVE.indexOf(c.dataset.layer) !== -1); });
  });

  /* Cartes de couches utilisables au clavier (case à cocher) */
  allCards.forEach(function (card) {
    card.setAttribute('role', 'checkbox');
    card.setAttribute('tabindex', '0');
    var name = card.querySelector('.tc-name');
    if (name) card.setAttribute('aria-label', name.textContent.trim());
    var sync = function () { card.setAttribute('aria-checked', card.classList.contains('active') ? 'true' : 'false'); };
    sync();
    card.addEventListener('click', function () { setTimeout(sync, 0); });
    card.addEventListener('keydown', function (e) {
      if (e.target !== card) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });

  /* ── Curseur d'opacité de la couche de susceptibilité (20 à 100 %) ── */
  var opRange = document.getElementById('susc-opacity-range');
  var opValue = document.getElementById('susc-opacity-value');
  if (opRange) {
    opRange.addEventListener('input', function () {
      var v = +this.value;
      if (opValue) opValue.textContent = v + ' %';
      if (window.setSusceptibilityOpacity) window.setSusceptibilityOpacity(v / 100);
    });
  }

  /* ── Recherche sur téléphone : barre ouverte par la loupe ── */
  var btnSearchToggle = document.getElementById('btn-search-toggle');
  function toggleSearch(on) {
    document.body.classList.toggle('search-open', on);
    if (btnSearchToggle) btnSearchToggle.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) { var i = document.getElementById('search-input'); if (i) i.focus(); }
  }
  if (btnSearchToggle) btnSearchToggle.addEventListener('click', function () {
    toggleSearch(!document.body.classList.contains('search-open'));
  });

  /* Passage téléphone <-> ordinateur : Leaflet doit recalculer sa taille */
  window.addEventListener('resize', function () {
    if (window.map) window.map.invalidateSize();
  });

  /* ── DATA ERROR BANNER — dismiss button ──────────── */
  const dataErrorClose = document.getElementById('data-error-close');
  if (dataErrorClose) {
    dataErrorClose.addEventListener('click', function () {
      const banner = document.getElementById('data-error-banner');
      if (banner) banner.style.display = 'none';
    });
  }

  /* ── SEARCH BAR ──────────────────────────────────── */
  const searchInput = document.getElementById('search-input');
  const searchBtn   = document.getElementById('search-btn');
  if (searchInput) {
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter'  && window.searchLocation) window.searchLocation(this.value.trim());
      if (e.key === 'Escape') { const d = document.getElementById('search-results'); if (d) d.innerHTML = ''; }
    });
  }
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', function () {
      if (window.searchLocation) window.searchLocation(searchInput.value.trim());
    });
  }
  document.addEventListener('click', function (e) {
    const sec = document.querySelector('.search-section');
    if (sec && !sec.contains(e.target)) { const d = document.getElementById('search-results'); if (d) d.innerHTML = ''; }
  });

  /* ── TOOLBAR BUTTONS ─────────────────────────────── */
  const btnExport = document.getElementById('btn-export-png');
  if (btnExport) btnExport.addEventListener('click', function () { if (window.exportMapPNG) window.exportMapPNG(); });

  const btnFS = document.getElementById('btn-fullscreen');
  if (btnFS) {
    btnFS.addEventListener('click', function () { if (window.toggleFullscreen) window.toggleFullscreen(); });
    document.addEventListener('fullscreenchange', function () {
      const fs = !!document.fullscreenElement;
      const lbl = btnFS.querySelector('.btn-label');
      if (lbl) lbl.textContent = fs ? 'Quitter' : 'Plein écran';
    });
  }

  const btnGrid = document.getElementById('btn-grid');
  if (btnGrid) {
    btnGrid.addEventListener('click', function () {
      var isOn = window.WebSIGGraticule && window.WebSIGGraticule.toggle();
      btnGrid.classList.toggle('active', !!isOn);
    });
  }

  const btnInfo = document.getElementById('btn-info');
  if (btnInfo) btnInfo.addEventListener('click', openInfoModal);

  /* ── LEGEND DRAG-RESIZE ──────────────────────────── */
  (function () {
    var legend  = document.getElementById('map-legend-float');
    var handle  = document.getElementById('legend-resize-handle');
    var content = document.getElementById('legend-content');
    if (!legend || !handle) return;

    var dragging = false, startX, startY, startW, startH;

    function onDown(e) {
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = legend.offsetWidth;
      startH = content.offsetHeight;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    }

    function onMove(e) {
      if (!dragging) return;
      /* Légende ancrée à droite : la poignée est dans le coin inférieur
         gauche, tirer vers la gauche élargit l'encart. */
      var newW = Math.max(120, Math.min(400, startW - (e.clientX - startX)));
      var newH = Math.max(40,  Math.min(window.innerHeight * 0.75, startH + e.clientY - startY));
      legend.style.width    = newW + 'px';
      content.style.maxHeight = newH + 'px';
    }

    function onUp() {
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    }

    handle.addEventListener('mousedown', onDown);

    /* Touch support — capture phase bypasses Leaflet stopPropagation on legend */
    handle.addEventListener('touchstart', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var t = e.touches[0];
      onDown({ clientX: t.clientX, clientY: t.clientY, preventDefault: function(){} });
    }, { passive: false, capture: true });
    document.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      e.preventDefault();
      var t = e.touches[0];
      onMove({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: false, capture: true });
    document.addEventListener('touchend',    onUp, { capture: true });
    document.addEventListener('touchcancel', onUp, { capture: true });
  }());

  /* ── MEASURE TOOLS ───────────────────────────────── */
  let measureGroup = null;
  let measureMode = null;
  let drawHandler = null;

  /* Wrap in try/catch — Leaflet.draw CDN may be unavailable */
  try { measureGroup = new L.FeatureGroup().addTo(window.map); } catch (e) { console.warn('L.FeatureGroup unavailable'); }

  function startMeasure(mode) {
    stopMeasure();
    measureMode = mode;
    const btn = document.getElementById(mode === 'distance' ? 'btn-measure-distance' : 'btn-measure-area');
    if (btn) btn.classList.add('active');
    const clearBtn = document.getElementById('btn-clear-measure');
    if (clearBtn) clearBtn.style.display = 'flex';
    try {
      const opts = mode === 'distance'
        ? { shapeOptions: { color: '#00b4d8', weight: 2, dashArray: '5,5' }, metric: true, feet: false }
        : { shapeOptions: { color: '#f4a261', weight: 2, fillOpacity: 0.15 }, metric: true };
      drawHandler = mode === 'distance'
        ? new L.Draw.Polyline(window.map, opts)
        : new L.Draw.Polygon(window.map, opts);
      drawHandler.enable();
      window.map.getContainer().style.cursor = 'crosshair';
    } catch (e) { console.warn('Leaflet.draw unavailable:', e.message); stopMeasure(); }
  }

  function stopMeasure() {
    try { if (drawHandler) { drawHandler.disable(); drawHandler = null; } } catch (_) {}
    measureMode = null;
    if (window.map) window.map.getContainer().style.cursor = '';
    document.querySelectorAll('#btn-measure-distance,#btn-measure-area').forEach(function (b) { b.classList.remove('active'); });
  }

  function clearMeasures() {
    stopMeasure();
    if (measureGroup) measureGroup.clearLayers();
    const r = document.getElementById('measure-result'); if (r) r.style.display = 'none';
    const c = document.getElementById('btn-clear-measure'); if (c) c.style.display = 'none';
  }

  const btnDist  = document.getElementById('btn-measure-distance');
  const btnArea  = document.getElementById('btn-measure-area');
  const btnClear = document.getElementById('btn-clear-measure');
  if (btnDist)  btnDist.addEventListener('click',  function () { measureMode === 'distance' ? stopMeasure() : startMeasure('distance'); });
  if (btnArea)  btnArea.addEventListener('click',  function () { measureMode === 'area'     ? stopMeasure() : startMeasure('area');     });
  if (btnClear) btnClear.addEventListener('click', clearMeasures);

  if (window.map) {
    window.map.on('draw:created', function (e) {
      if (measureGroup) measureGroup.addLayer(e.layer);
      stopMeasure();
      let txt = '';
      if (e.layerType === 'polyline') {
        const ll = e.layer.getLatLngs();
        let m = 0;
        for (let i = 1; i < ll.length; i++) m += ll[i-1].distanceTo(ll[i]);
        txt = m >= 1000 ? 'Distance : ' + (m/1000).toFixed(3) + ' km' : 'Distance : ' + Math.round(m) + ' m';
      } else if (e.layerType === 'polygon') {
        try {
          const a = L.GeometryUtil.geodesicArea(e.layer.getLatLngs()[0]);
          txt = a >= 1e6 ? 'Superficie : ' + (a/1e6).toFixed(4) + ' km²' : 'Superficie : ' + Math.round(a) + ' m²';
        } catch (_) {}
      }
      if (txt) {
        const r = document.getElementById('measure-result');
        if (r) { r.textContent = txt; r.style.display = 'block'; setTimeout(function () { r.style.display = 'none'; }, 8000); }
      }
    });
  }

  /* ── INFO MODAL ──────────────────────────────────── */
  function openInfoModal()  { const m = document.getElementById('info-modal'); if (m) m.style.display = 'flex';  }
  function closeInfoModal() { const m = document.getElementById('info-modal'); if (m) m.style.display = 'none'; }

  const infoModal = document.getElementById('info-modal');
  if (infoModal) infoModal.addEventListener('click', function (e) { if (e.target === this) closeInfoModal(); });
  const btnMC = document.getElementById('modal-close-btn'); if (btnMC) btnMC.addEventListener('click', closeInfoModal);
  const btnMO = document.getElementById('modal-ok-btn');    if (btnMO) btnMO.addEventListener('click', closeInfoModal);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeInfoModal(); });

  /* ══════════════════════════════════════════════════
     PROFESSIONAL GIS LEGEND — all active layers shown
     ══════════════════════════════════════════════════ */
  function updateLegend() {
    const container = document.getElementById('legend-content');
    if (!container) return;

    /* Collect all active thematic layers (excluding always-on ones) */
    var activeLayers = Array.from(document.querySelectorAll('.thematic-card.active'))
      .map(function (c) { return c.dataset.layer; })
      .filter(function (n) { return NO_LEGEND_LAYERS.indexOf(n) === -1; });

    var sections = [];

    activeLayers.forEach(function (L) {
      if (L === 'Bassins versants')
        sections.push(lgSection('🗺️ Bassins versants', [
          lgPoly('#c8e6fa','#1565c0', false, 'Bassin Atlantique'),
          lgPoly('#c8efd8','#2e7d32', false, 'Bassin Sebou'),
          lgPoly('#fff9c4','#f9a825', false, 'Bassin Intermédiaire'),
          lgPoly('#fce4d0','#bf360c', false, 'Bassin Côtier Nord'),
          lgPoly('#ead5f5','#6a1b9a', false, 'Bassin Côtier Sud'),
        ]));

      if (L === 'Oueds / Rivières')
        sections.push(lgSection('🌊 Oueds / Rivières', [
          lgLine('#04266e', 6.0, false, 'Axe principal — Sebou (rang ABHS 1)'),
          lgLine('#1565c0', 2.8, false, 'Affluent majeur — Ouergha, Beht, Grou, Bou Regreg, Cherrat…'),
          lgLine('#1e88e5', 1.1, false, 'Affluent secondaire (rang ABHS 8–16)'),
          lgLine('#90caf9', 0.5, false, 'Drain / talweg mineur (rang ABHS > 16)'),
        ]));

      if (L === 'Barrages')
        sections.push(lgSection('🏗️ Barrages', [
          lgPoint('#0d47a1', 12, '⬟', 'Barrage opérationnel'),
        ]));

      if (L === 'Stations pluviométriques')
        sections.push(lgSection('🌧️ Stations pluviométriques', [
          lgPoint('#1565c0', 10, '●', 'Station de mesure'),
        ]));

      if (L === 'Nappes souterraines')
        sections.push(lgSection('💧 Nappes souterraines', [
          lgPoly('#bfdbfe','#1d4ed8', true, 'Nappe phréatique'),
          lgPoly('#a5f3fc','#0891b2', true, 'Nappe littorale'),
          lgPoly('#bae6fd','#0369a1', true, 'Nappe alluviale'),
          lgPoly('#cffafe','#0e7490', true, 'Nappe côtière'),
        ]));

      if (L === window.SUSC_KEY)
        sections.push(lgSusceptibilitySection());
    });

    /* Limites admin + Villes — toujours présentes si leurs layers sont actifs */
    var adminActive = document.querySelector('.thematic-card.active[data-layer="Limites administratives"]');
    var villsActive = document.querySelector('.thematic-card.active[data-layer="Villes principales"]');
    if (adminActive)
      sections.push(lgSection('🗂️ Limites administratives', [
        lgLine('#000000', 2.5, false, 'Limite de région RSK'),
      ]));
    if (villsActive)
      sections.push(lgSection('🏙️ Villes principales', [
        lgCity('#6d28d9', 14, '★', 'Capitale — Rabat'),
        lgCity('#1d4ed8', 10, '●', 'Ville principale (Salé, Kénitra)'),
        lgCity('#2563eb',  8, '●', 'Ville (Khémisset, Tiflet…)'),
      ]));

    container.innerHTML = sections.length
      ? '<div class="gis-legend">' + sections.join('') + '</div>'
      : '<p class="legend-empty">Activez une carte pour voir sa légende.</p>';
  }

  /* ── Legend section wrapper ── */
  function lgSection(title, rows) {
    return '<div class="lg-section">'
      + '<div class="lg-title">' + title + '</div>'
      + rows.join('')
      + '</div>';
  }

  /* ── Susceptibilité aux inondations — cinq classes avec leurs seuils
     (palette SUSC_CLASSES de layers.js, même source que la carte), puis la
     mention sur la nature de l'indice. ── */
  function lgSusceptibilitySection() {
    var rows = (window.SUSC_CLASSES || []).map(function (c) {
      return lgPoly(c.couleur, c.couleur, false, c.libelle + ' (' + c.seuil + ')');
    });
    rows.push('<p class="lg-note">Indice relatif issu d\'un modèle Gradient Tree '
      + 'Boosting ; ce n\'est pas un zonage réglementaire.</p>');
    return lgSection('🌊 ' + window.SUSC_KEY, rows);
  }

  /* ── Polygon symbol ── */
  function lgPoly(fill, border, dashed, label) {
    var bd = dashed
      ? 'border:1.5px dashed ' + border
      : 'border:1.5px solid ' + border;
    return '<div class="lg-item">'
      + '<span class="lg-sym-poly" style="background:' + fill + ';' + bd + '"></span>'
      + '<span class="lg-label">' + label + '</span>'
      + '</div>';
  }

  /* ── Line symbol ── */
  function lgLine(color, weight, dashed, label) {
    var style = dashed
      ? 'border-top:' + weight + 'px dashed ' + color + ';height:0;margin-top:' + Math.max(weight,2) + 'px'
      : 'height:' + weight + 'px;background:' + color + ';border-radius:1px';
    return '<div class="lg-item">'
      + '<span class="lg-sym-line" style="' + style + '"></span>'
      + '<span class="lg-label">' + label + '</span>'
      + '</div>';
  }

  /* ── Point symbol ── */
  function lgPoint(color, size, glyph, label) {
    return '<div class="lg-item">'
      + '<span class="lg-sym-point" style="width:' + size + 'px;height:' + size + 'px;'
      + 'background:' + color + ';border-radius:50%;border:2px solid white;'
      + 'outline:1.5px solid ' + color + ';flex-shrink:0;'
      + 'display:inline-flex;align-items:center;justify-content:center;'
      + 'color:white;font-size:' + Math.round(size*0.55) + 'px">' + '</span>'
      + '<span class="lg-label">' + label + '</span>'
      + '</div>';
  }

  /* ── City symbol ── */
  function lgCity(color, size, glyph, label) {
    return '<div class="lg-item">'
      + '<span style="display:inline-flex;align-items:center;justify-content:center;'
      + 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;'
      + 'background:' + color + ';border:2px solid white;outline:1.5px solid ' + color + ';'
      + 'color:white;font-size:' + Math.round(size*0.55) + 'px;flex-shrink:0">'
      + (size >= 12 ? '★' : '') + '</span>'
      + '<span class="lg-label">' + label + '</span>'
      + '</div>';
  }

  window.updateLegend = updateLegend;
  /* Each time a layer finishes loading, refresh the legend */
  document.addEventListener('layerReady', function () {
    updateLegend();
  });

  /* ── TABLE SORT ───────────────────────────────────── */
  document.querySelectorAll('.data-table th').forEach(function (th, idx) {
    th.addEventListener('click', function () {
      const tbody = this.closest('table').querySelector('tbody');
      const rows  = Array.from(tbody.querySelectorAll('tr'));
      const asc   = !(this.dataset.asc === '1');
      this.dataset.asc = asc ? '1' : '';
      rows.sort(function (a, b) {
        const av = a.querySelectorAll('td')[idx].textContent.trim();
        const bv = b.querySelectorAll('td')[idx].textContent.trim();
        const an = parseFloat(av.replace(/\s/g,'').replace(',','.'));
        const bn = parseFloat(bv.replace(/\s/g,'').replace(',','.'));
        if (!isNaN(an) && !isNaN(bn)) return asc ? an-bn : bn-an;
        return asc ? av.localeCompare(bv,'fr') : bv.localeCompare(av,'fr');
      });
      rows.forEach(function (r) { tbody.appendChild(r); });
      document.querySelectorAll('.data-table th').forEach(function (t) { t.style.color = ''; });
      this.style.color = 'var(--accent-water)';
    });
  });

}); /* end DOMContentLoaded */
