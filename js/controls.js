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

  /* ── BASE LAYER CARDS ────────────────────────────── */
  document.querySelectorAll('.basemap-card').forEach(function (card) {
    card.addEventListener('click', function () {
      document.querySelectorAll('.basemap-card').forEach(function (c) {
        c.classList.remove('active');
      });
      this.classList.add('active');
      if (window.switchBaseLayer) window.switchBaseLayer(this.dataset.basemap);
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
      function handler(ev) {
        if (ev.detail.name === name) {
          document.removeEventListener('layerReady', handler);
          if (nowActive) toggleLayer(name, true);
          updateLegend();
        }
      }
      document.addEventListener('layerReady', handler);
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

  /* ── SIDEBAR COLLAPSE ────────────────────────────── */
  const sidebar       = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', function () {
      sidebar.classList.toggle('collapsed');
      this.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
      setTimeout(function () { if (window.map) window.map.invalidateSize(); }, 320);
    });
  }

  /* ── RIGHT PANEL COLLAPSE ────────────────────────── */
  const rightPanel   = document.getElementById('right-panel');
  const rightToggle  = document.getElementById('right-panel-toggle');
  if (rightToggle && rightPanel) {
    rightToggle.addEventListener('click', function () {
      rightPanel.classList.toggle('collapsed');
      this.textContent = rightPanel.classList.contains('collapsed') ? '◀' : '▶';
      setTimeout(function () { if (window.map) window.map.invalidateSize(); }, 320);
    });
  }

  /* ── PANEL TABS ──────────────────────────────────── */
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
      this.classList.add('active');
      const tab = document.getElementById('tab-' + this.dataset.tab);
      if (tab) tab.classList.add('active');
    });
  });

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

  const btnInfo = document.getElementById('btn-info');
  if (btnInfo) btnInfo.addEventListener('click', openInfoModal);

  /* ── MAP EXPAND BUTTON ───────────────────────────── */
  var mapExpanded = false;
  var btnMapExpand = document.getElementById('btn-map-expand');
  if (btnMapExpand) {
    btnMapExpand.addEventListener('click', function () {
      mapExpanded = !mapExpanded;
      document.body.classList.toggle('map-expanded', mapExpanded);
      var ei = document.getElementById('expand-icon');
      var ci = document.getElementById('collapse-icon');
      if (ei) ei.style.display = mapExpanded ? 'none' : '';
      if (ci) ci.style.display = mapExpanded ? ''     : 'none';
      btnMapExpand.title = mapExpanded ? 'Réduire la carte' : 'Agrandir la carte';
      /* Let Leaflet know the map container changed size */
      setTimeout(function () { if (window.map) window.map.invalidateSize(); }, 200);
    });
  }

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
      var newW = Math.max(120, Math.min(400, startW + e.clientX - startX));
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

  /* ── ORIENTATION CHANGE — auto-close panels on landscape ── */
  window.addEventListener('orientationchange', function () {
    setTimeout(function () {
      var sidebar    = document.getElementById('sidebar');
      var rightPanel = document.getElementById('right-panel');
      var overlay    = document.getElementById('mobile-overlay');
      if (sidebar)    sidebar.classList.remove('mobile-open');
      if (rightPanel) rightPanel.classList.remove('mobile-open');
      if (overlay)    overlay.classList.remove('active');
      if (window.map) window.map.invalidateSize();
    }, 350);
  });

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

  /* ══ MOBILE PANEL MANAGEMENT ════════════════════════
     Sidebar  → slides from left  (☰ button)
     RightPanel → slides from right (📊 button)
     Backdrop → closes any open panel on tap
     ═════════════════════════════════════════════════ */
  var mobileOverlay = document.getElementById('mobile-overlay');

  function isMobile() { return window.innerWidth <= 768; }

  function openMobilePanel(panel) {
    closeMobilePanels(false);
    if (panel) panel.classList.add('mobile-open');
    if (mobileOverlay) mobileOverlay.classList.add('visible');
    if (window.map) window.map.invalidateSize();
  }

  function closeMobilePanels(doInvalidate) {
    if (sidebar)     sidebar.classList.remove('mobile-open');
    if (rightPanel)  rightPanel.classList.remove('mobile-open');
    if (mobileOverlay) mobileOverlay.classList.remove('visible');
    if (doInvalidate !== false)
      setTimeout(function () { if (window.map) window.map.invalidateSize(); }, 300);
  }

  /* Hamburger — toggle sidebar */
  var mobileMenu = document.getElementById('btn-mobile-menu');
  if (mobileMenu) {
    mobileMenu.addEventListener('click', function () {
      if (isMobile()) {
        sidebar && sidebar.classList.contains('mobile-open')
          ? closeMobilePanels() : openMobilePanel(sidebar);
      } else {
        if (sidebar) {
          sidebar.classList.toggle('collapsed');
          sidebarToggle && (sidebarToggle.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀');
          setTimeout(function () { if (window.map) window.map.invalidateSize(); }, 320);
        }
      }
    });
  }

  /* Stats button — toggle right panel */
  var mobileStats = document.getElementById('btn-mobile-stats');
  if (mobileStats) {
    mobileStats.addEventListener('click', function () {
      rightPanel && rightPanel.classList.contains('mobile-open')
        ? closeMobilePanels() : openMobilePanel(rightPanel);
    });
  }

  /* Backdrop tap → close all */
  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', function () { closeMobilePanels(); });
  }

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
          lgLine('#0d47a1', 3.5, false, 'Principal — Sebou, Bou Regreg, Tanoubert, Beht, Grou…'),
          lgLine('#1565c0', 2.4, false, 'Majeur — ≥ 28 km'),
          lgLine('#2196f3', 1.5, false, 'Secondaire / réseau DEM'),
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

      if (L === 'Zones de risque')
        sections.push(lgSection('⚠️ Risque d\'inondation', [
          lgPoly('#ef4444','#b91c1c', false, 'Très élevé — corridors des oueds'),
          lgPoly('#f97316','#c2410c', false, 'Élevé — plaines inondables'),
          lgPoly('#fde047','#a16207', false, 'Modéré — zones de transition'),
          lgPoly('#4ade80','#16a34a', false, 'Faible — zones périphériques'),
        ]));
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
