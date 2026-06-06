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
  document.querySelectorAll('.thematic-card').forEach(function (card) {
    card.addEventListener('click', function (e) {
      /* ignore clicks on the zoom button */
      if (e.target.classList.contains('tc-zoom')) return;
      const name    = this.dataset.layer;
      const wasActive = this.classList.contains('active');
      this.classList.toggle('active');
      const nowActive = !wasActive;

      if (getLayer(name)) {
        toggleLayer(name, nowActive);
        updateLegend();
        return;
      }
      /* layer not yet loaded — wait */
      function handler(e) {
        if (e.detail.name === name) {
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

  /* ── MOBILE HAMBURGER ────────────────────────────── */
  const mobileMenu = document.getElementById('btn-mobile-menu');
  if (mobileMenu && sidebar) mobileMenu.addEventListener('click', function () { sidebar.classList.toggle('collapsed'); });

  /* ══════════════════════════════════════════════════
     PROFESSIONAL GIS LEGEND
     Colours mirror layers.js exactly.
     ══════════════════════════════════════════════════ */
  function updateLegend() {
    const container = document.getElementById('legend-content');
    if (!container) return;
    const active = Array.from(
      document.querySelectorAll('.thematic-card.active')
    ).map(function(c){ return c.dataset.layer; });

    if (!active.length) {
      container.innerHTML = '<p class="legend-empty">Activez une couche pour voir sa légende.</p>';
      return;
    }

    var sections = [];

    if (active.includes('Bassins versants'))
      sections.push(lgSection('🗺️ Bassins versants', [
        lgPoly('#c8e6fa','#1565c0', false, 'Sous-bassin (Atlantique)'),
        lgPoly('#c8efd8','#2e7d32', false, 'Sous-bassin (Sebou)'),
        lgPoly('#fff9c4','#f9a825', false, 'Sous-bassin (Intermédiaire)'),
        lgPoly('#fce4d0','#bf360c', false, 'Sous-bassin (Côtier N.)'),
        lgPoly('#ead5f5','#6a1b9a', false, 'Sous-bassin (Côtier S.)'),
      ]));

    if (active.includes('Oueds / Rivières'))
      sections.push(lgSection('🌊 Oueds / Rivières', [
        lgLine('#0066CC', 5,   false, 'Oued majeur — Sebou, Bou Regreg'),
        lgLine('#0066CC', 2.5, false, 'Oued principal'),
        lgLine('#4499DD', 1.5, false, 'Oued secondaire / affluent'),
      ]));

    if (active.includes('Barrages'))
      sections.push(lgSection('🏗️ Barrages', [
        lgPoint('#0d47a1', 12, '⬟', 'Barrage opérationnel'),
      ]));

    if (active.includes('Stations pluviométriques'))
      sections.push(lgSection('🌧️ Stations pluviométriques', [
        lgPoint('#1565c0', 10, '●', 'Station de mesure'),
      ]));

    if (active.includes('Nappes souterraines'))
      sections.push(lgSection('💧 Nappes souterraines', [
        lgPoly('#bfdbfe','#1d4ed8', true, 'Nappe phréatique (bleue)'),
        lgPoly('#a5f3fc','#0891b2', true, 'Nappe littorale (cyan)'),
        lgPoly('#bae6fd','#0369a1', true, 'Nappe alluviale (bleu ciel)'),
        lgPoly('#cffafe','#0e7490', true, 'Nappe côtière (cyan pâle)'),
      ]));

    if (active.includes('Zones de risque'))
      sections.push(lgSection('⚠️ Risque d\'inondation', [
        lgPoly('#fecaca','#dc2626', false, 'Risque ÉLEVÉ'),
        lgPoly('#fed7aa','#ea580c', false, 'Risque MODÉRÉ'),
        lgPoly('#fef9c3','#ca8a04', true,  'Risque FAIBLE'),
      ]));

    if (active.includes('Limites administratives'))
      sections.push(lgSection('🗂️ Limites administratives', [
        lgLine('#1d4ed8', 2.5, true, 'Limite de région / préfecture'),
      ]));

    if (active.includes('Villes principales'))
      sections.push(lgSection('🏙️ Villes principales', [
        lgCity('#6d28d9', 14, '★', 'Capitale — Rabat'),
        lgCity('#1d4ed8', 10, '●', 'Ville principale (Salé, Kénitra)'),
        lgCity('#2563eb',  8, '●', 'Ville (Khémisset, Tiflet…)'),
      ]));

    container.innerHTML = sections.length
      ? '<div class="gis-legend">' + sections.join('') + '</div>'
      : '<p class="legend-empty">Activez une couche pour voir sa légende.</p>';
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
  /* Call once on first layerReady, then on every change — no duplicates because
     container.innerHTML is always fully replaced */
  document.addEventListener('layerReady', updateLegend);

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
