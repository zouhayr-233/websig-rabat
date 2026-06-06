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

  /* ── BASE LAYER RADIOS ───────────────────────────── */
  document.querySelectorAll('input[name="base-layer"]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (window.switchBaseLayer) window.switchBaseLayer(this.value);
    });
  });

  /* ── OVERLAY CHECKBOXES ──────────────────────────── */
  document.querySelectorAll('.layer-checkbox').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const name    = this.dataset.layer;
      const checked = this.checked;

      if (getLayer(name)) {
        /* Layer already loaded — toggle immediately */
        toggleLayer(name, checked);
        updateLegend();
        return;
      }

      /* Layer not yet loaded — wait for layerReady event */
      console.log('[controls] waiting for layer:', name);
      function handler(e) {
        if (e.detail.name === name) {
          document.removeEventListener('layerReady', handler);
          if (checked) toggleLayer(name, true);
          updateLegend();
        }
      }
      document.addEventListener('layerReady', handler);
    });
  });

  /* ── ZOOM-TO-LAYER BUTTONS ───────────────────────── */
  document.querySelectorAll('.layer-zoom-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      const lyr = getLayer(this.dataset.layer);
      if (!lyr || !lyr.getBounds) return;
      try {
        const b = lyr.getBounds();
        if (b.isValid()) window.map.fitBounds(b, { padding: [30, 30], animate: true });
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

  /* ── DYNAMIC LEGEND — single source of truth ─────── */
  /* Colours match layers.js exactly (no duplicates).   */
  function updateLegend() {
    const container = document.getElementById('legend-content');
    if (!container) return;
    const active = Array.from(
      document.querySelectorAll('.layer-checkbox:checked')
    ).map(function(c){ return c.dataset.layer; });
    if (!active.length) {
      container.innerHTML = '<p class="legend-empty">Activez une couche pour voir sa légende.</p>';
      return;
    }
    let html = '';

    if (active.includes('Bassins versants'))
      html += lg('Bassins versants', [
        {fill:'#c8e6fa', border:'#1565c0', label:'Sous-bassin 1'},
        {fill:'#c8efd8', border:'#2e7d32', label:'Sous-bassin 2'},
        {fill:'#fff9c4', border:'#f9a825', label:'Sous-bassin 3'},
        {fill:'#fce4d0', border:'#bf360c', label:'Sous-bassin 4'},
        {fill:'#ead5f5', border:'#6a1b9a', label:'Sous-bassin 5'},
      ], 'polygon');

    if (active.includes('Oueds / Rivières'))
      html += lg('Oueds / Rivières', [
        {color:'#0d47a1', height:5,   label:'Oued majeur (Sebou, Bou Regreg)'},
        {color:'#1565c0', height:2.5, label:'Oued principal'},
        {color:'#64b5f6', height:1.2, label:'Oued secondaire'},
      ], 'line');

    if (active.includes('Barrages'))
      html += lg('Barrages', [{icon:'🏗️', label:'Barrage existant (opérationnel)'}], 'icon');

    if (active.includes('Stations pluviométriques'))
      html += lg('Stations pluviométriques', [{icon:'🌦', label:'Station pluviométrique'}], 'icon');

    if (active.includes('Nappes souterraines'))
      html += lg('Nappes souterraines', [
        {fill:'#bfdbfe', border:'#1d4ed8', dashed:true, label:'Nappe souterraine'},
        {fill:'#a5f3fc', border:'#0891b2', dashed:true, label:'Nappe littorale'},
        {fill:'#bbf7d0', border:'#15803d', dashed:true, label:'Nappe alluviale'},
      ], 'polygon');

    if (active.includes('Zones de risque'))
      html += lg('Risque inondation (Random Forest)', [
        {fill:'#ffcdd2', border:'#c62828', label:'Risque élevé'},
        {fill:'#ffe0b2', border:'#e65100', label:'Risque moyen'},
        {fill:'#dcedc8', border:'#2e7d32', label:'Risque faible', dashed:true},
      ], 'polygon');

    if (active.includes('Limites administratives'))
      html += lg('Limites administratives', [
        {color:'#1d4ed8', dashed:true, height:2.5, label:'Limite de région / préfecture'},
      ], 'line');

    if (active.includes('Villes principales'))
      html += lg('Villes principales', [
        {color:'#6d28d9', size:12, label:'Capitale (Rabat)'},
        {color:'#1d4ed8', size:9,  label:'Ville principale (Salé, Kénitra)'},
        {color:'#2563eb', size:7,  label:'Ville secondaire'},
      ], 'city');

    container.innerHTML = html || '<p class="legend-empty">Activez une couche pour voir sa légende.</p>';
  }

  function lg(title, items, type) {
    const rows = items.map(function(item) {
      if (type === 'polygon') {
        const bd = item.border || item.fill;
        const ds = item.dashed ? 'border:2px dashed '+bd : 'border:2px solid '+bd;
        return '<div class="legend-item">'
          + '<span class="legend-color" style="background:' + item.fill + ';' + ds + ';opacity:.85"></span>'
          + '<span>' + item.label + '</span></div>';
      }
      if (type === 'line') {
        const s = item.dashed
          ? 'border-top:' + (item.height||2) + 'px dashed ' + item.color + ';height:0'
          : 'background:' + item.color + ';height:' + (item.height||2) + 'px';
        return '<div class="legend-item">'
          + '<span class="legend-line" style="' + s + '"></span>'
          + '<span>' + item.label + '</span></div>';
      }
      if (type === 'icon')
        return '<div class="legend-item">'
          + '<span style="font-size:16px;line-height:1">' + item.icon + '</span>'
          + '<span>' + item.label + '</span></div>';
      if (type === 'city') {
        var sz = item.size || 9;
        return '<div class="legend-item">'
          + '<span style="display:inline-block;width:' + (sz+4) + 'px;height:' + (sz+4) + 'px;border-radius:50%;'
          + 'background:' + item.color + ';border:2px solid white;'
          + 'outline:1.5px solid ' + item.color + ';flex-shrink:0"></span>'
          + '<span>' + item.label + '</span></div>';
      }
      return '';
    }).join('');
    return '<div class="legend-group">'
      + '<div class="legend-group-title">' + title + '</div>'
      + rows + '</div>';
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
