'use strict';
/* ===================================================
   WebSIG RSK — controls.js v4
   Full-screen professional cartographic interface.
   =================================================== */

document.addEventListener('DOMContentLoaded', function () {

  /* ── helpers ──────────────────────────────────────── */
  function getLayer(name) { return window.overlayLayers && window.overlayLayers[name]; }
  function toggleLayer(name, add) {
    var lyr = getLayer(name);
    if (!lyr || !window.map) return;
    try { add ? window.map.addLayer(lyr) : window.map.removeLayer(lyr); } catch (e) {}
  }

  /* ── CUSTOM ZOOM BUTTONS ──────────────────────────── */
  var btnZI = document.getElementById('btn-zoom-in');
  var btnZO = document.getElementById('btn-zoom-out');
  if (btnZI) btnZI.addEventListener('click', function () { if (window.map) window.map.zoomIn(); });
  if (btnZO) btnZO.addEventListener('click', function () { if (window.map) window.map.zoomOut(); });

  /* ── PANEL HELPERS ────────────────────────────────── */
  function showPanel(id) { var p = document.getElementById(id); if (p) p.style.display = 'flex'; }
  function hidePanel(id) { var p = document.getElementById(id); if (p) p.style.display = 'none'; }
  function togglePanel(id, btnId) {
    var p = document.getElementById(id);
    if (!p) return;
    var open = p.style.display === 'none' || !p.style.display;
    p.style.display = open ? 'flex' : 'none';
    /* close other floating panels */
    ['layers-panel', 'stats-panel'].forEach(function (oid) { if (oid !== id) hidePanel(oid); });
    /* sync button active state */
    if (btnId) {
      var btn = document.getElementById(btnId);
      if (btn) btn.classList.toggle('active', open);
    }
  }

  /* ── LAYERS PANEL ─────────────────────────────────── */
  var btnOpen = document.getElementById('btn-open-layers');
  if (btnOpen) btnOpen.addEventListener('click', function () {
    togglePanel('layers-panel', 'btn-open-layers');
  });
  var btnClose = document.getElementById('close-layers');
  if (btnClose) btnClose.addEventListener('click', function () {
    hidePanel('layers-panel');
    var b = document.getElementById('btn-open-layers'); if (b) b.classList.remove('active');
  });

  /* ── STATS PANEL ──────────────────────────────────── */
  var btnStats = document.getElementById('btn-stats');
  if (btnStats) btnStats.addEventListener('click', function () { togglePanel('stats-panel', 'btn-stats'); });
  var btnCloseStats = document.getElementById('close-stats');
  if (btnCloseStats) btnCloseStats.addEventListener('click', function () {
    hidePanel('stats-panel');
    var b = document.getElementById('btn-stats'); if (b) b.classList.remove('active');
  });

  /* ── THEMATIC CARDS ───────────────────────────────── */
  document.querySelectorAll('.thematic-card').forEach(function (card) {
    card.addEventListener('click', function (e) {
      if (e.target.classList.contains('tc-zoom')) return;
      var name    = this.dataset.layer;
      var wasOn   = this.classList.contains('active');
      this.classList.toggle('active');
      var nowOn   = !wasOn;
      if (getLayer(name)) {
        toggleLayer(name, nowOn);
        updateLegend();
      } else {
        document.addEventListener('layerReady', function handler(ev) {
          if (ev.detail.name !== name) return;
          document.removeEventListener('layerReady', handler);
          if (nowOn) toggleLayer(name, true);
          updateLegend();
        });
      }
    });
  });

  /* ── ZOOM-TO-LAYER ────────────────────────────────── */
  document.querySelectorAll('.tc-zoom').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var lyr = getLayer(this.dataset.layer);
      if (!lyr || !window.map) return;
      try { var b = lyr.getBounds(); if (b && b.isValid()) window.map.fitBounds(b, { padding: [40, 40], animate: true }); } catch (_) {}
    });
  });

  /* ── BASEMAP CARDS ────────────────────────────────── */
  document.querySelectorAll('.basemap-card').forEach(function (card) {
    card.addEventListener('click', function () {
      document.querySelectorAll('.basemap-card').forEach(function (c) { c.classList.remove('active'); });
      this.classList.add('active');
      if (window.switchBaseLayer) window.switchBaseLayer(this.dataset.basemap);
    });
  });

  /* ── SEARCH ───────────────────────────────────────── */
  var searchInput = document.getElementById('search-input');
  var searchBtn   = document.getElementById('search-btn');
  if (searchInput) {
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && window.searchLocation) window.searchLocation(this.value.trim());
      if (e.key === 'Escape') { var d = document.getElementById('search-results'); if (d) d.innerHTML = ''; }
    });
  }
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', function () {
      if (window.searchLocation) window.searchLocation(searchInput.value.trim());
    });
  }
  document.addEventListener('click', function (e) {
    var sb = document.getElementById('search-bar');
    if (sb && !sb.contains(e.target)) { var d = document.getElementById('search-results'); if (d) d.innerHTML = ''; }
  });

  /* ── PANEL TABS ───────────────────────────────────── */
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var container = this.closest('.sp-body') || document;
      container.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      container.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
      this.classList.add('active');
      var tab = document.getElementById('tab-' + this.dataset.tab);
      if (tab) tab.classList.add('active');
    });
  });

  /* ── MEASUREMENT TOOLS ────────────────────────────── */
  var measureGroup = null;
  var measureMode  = null;
  var drawHandler  = null;
  try { measureGroup = new L.FeatureGroup().addTo(window.map); } catch (e) {}

  function startMeasure(mode) {
    stopMeasure();
    measureMode = mode;
    var btn = document.getElementById(mode === 'distance' ? 'btn-measure-distance' : 'btn-measure-area');
    if (btn) btn.classList.add('active');
    var clearBtn = document.getElementById('btn-clear-measure');
    if (clearBtn) clearBtn.style.display = 'flex';
    try {
      var opts = mode === 'distance'
        ? { shapeOptions: { color: '#0066CC', weight: 2, dashArray: '5,5' }, metric: true, feet: false }
        : { shapeOptions: { color: '#ea580c', weight: 2, fillOpacity: 0.15 }, metric: true };
      drawHandler = mode === 'distance'
        ? new L.Draw.Polyline(window.map, opts)
        : new L.Draw.Polygon(window.map, opts);
      drawHandler.enable();
      if (window.map) window.map.getContainer().style.cursor = 'crosshair';
    } catch (e) { stopMeasure(); }
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
    var r = document.getElementById('measure-result'); if (r) r.style.display = 'none';
    var c = document.getElementById('btn-clear-measure'); if (c) c.style.display = 'none';
  }

  var btnDist  = document.getElementById('btn-measure-distance');
  var btnArea  = document.getElementById('btn-measure-area');
  var btnClear = document.getElementById('btn-clear-measure');
  if (btnDist)  btnDist.addEventListener('click',  function () { measureMode === 'distance' ? stopMeasure() : startMeasure('distance'); });
  if (btnArea)  btnArea.addEventListener('click',  function () { measureMode === 'area'     ? stopMeasure() : startMeasure('area'); });
  if (btnClear) btnClear.addEventListener('click', clearMeasures);

  if (window.map) {
    window.map.on('draw:created', function (e) {
      if (measureGroup) measureGroup.addLayer(e.layer);
      stopMeasure();
      var txt = '';
      if (e.layerType === 'polyline') {
        var ll = e.layer.getLatLngs(); var m = 0;
        for (var i = 1; i < ll.length; i++) m += ll[i-1].distanceTo(ll[i]);
        txt = m >= 1000 ? 'Distance : ' + (m/1000).toFixed(3) + ' km' : 'Distance : ' + Math.round(m) + ' m';
      } else if (e.layerType === 'polygon') {
        try { var a = L.GeometryUtil.geodesicArea(e.layer.getLatLngs()[0]); txt = a >= 1e6 ? 'Superficie : ' + (a/1e6).toFixed(4) + ' km²' : 'Superficie : ' + Math.round(a) + ' m²'; } catch (_) {}
      }
      if (txt) { var r = document.getElementById('measure-result'); if (r) { r.textContent = txt; r.style.display = 'block'; setTimeout(function () { r.style.display = 'none'; }, 8000); } }
    });
  }

  /* ── EXPORT / FULLSCREEN / INFO ───────────────────── */
  var btnExp = document.getElementById('btn-export-png');
  if (btnExp) btnExp.addEventListener('click', function () { if (window.exportMapPNG) window.exportMapPNG(); });

  var btnFS = document.getElementById('btn-fullscreen');
  if (btnFS) btnFS.addEventListener('click', function () { if (window.toggleFullscreen) window.toggleFullscreen(); });

  function openModal()  { var m = document.getElementById('info-modal'); if (m) m.style.display = 'flex'; }
  function closeModal() { var m = document.getElementById('info-modal'); if (m) m.style.display = 'none'; }
  var btnInfo = document.getElementById('btn-info');
  if (btnInfo) btnInfo.addEventListener('click', openModal);
  var modal = document.getElementById('info-modal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === this) closeModal(); });
  var btnMC = document.getElementById('modal-close-btn'); if (btnMC) btnMC.addEventListener('click', closeModal);
  var btnMO = document.getElementById('modal-ok-btn');    if (btnMO) btnMO.addEventListener('click', closeModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeModal();
      hidePanel('layers-panel'); var bl = document.getElementById('btn-open-layers'); if (bl) bl.classList.remove('active');
      hidePanel('stats-panel');  var bs = document.getElementById('btn-stats');        if (bs) bs.classList.remove('active');
    }
  });

  /* ── TABLE SORT ───────────────────────────────────── */
  document.querySelectorAll('.data-table th').forEach(function (th, idx) {
    th.style.cursor = 'pointer';
    th.addEventListener('click', function () {
      var tbody = this.closest('table').querySelector('tbody');
      var rows  = Array.from(tbody.querySelectorAll('tr'));
      var asc   = !(this.dataset.asc === '1');
      this.dataset.asc = asc ? '1' : '';
      rows.sort(function (a, b) {
        var av = a.querySelectorAll('td')[idx].textContent.trim();
        var bv = b.querySelectorAll('td')[idx].textContent.trim();
        var an = parseFloat(av.replace(/\s/g,'').replace(',','.')); var bn = parseFloat(bv.replace(/\s/g,'').replace(',','.'));
        if (!isNaN(an) && !isNaN(bn)) return asc ? an-bn : bn-an;
        return asc ? av.localeCompare(bv,'fr') : bv.localeCompare(av,'fr');
      });
      rows.forEach(function (r) { tbody.appendChild(r); });
    });
  });

  /* ══════════════════════════════════════════════════
     PROFESSIONAL GIS LEGEND — matches the example style
     Large colored rectangles + labels
     ══════════════════════════════════════════════════ */
  function updateLegend() {
    var container = document.getElementById('legend-content');
    if (!container) return;

    var active = Array.from(document.querySelectorAll('.thematic-card.active'))
                      .map(function (c) { return c.dataset.layer; });

    if (!active.length) {
      container.innerHTML = '<p class="legend-empty">Aucune carte sélectionnée.</p>';
      return;
    }

    var html = '';

    if (active.includes('Bassins versants')) {
      html += mlSection('Bassins Versants', [
        mlColor('#c8e6fa','#1565c0', false, 'Bassin Atlantique'),
        mlColor('#c8efd8','#2e7d32', false, 'Bassin Sebou'),
        mlColor('#fff9c4','#f9a825', false, 'Bassin Intermédiaire'),
        mlColor('#fce4d0','#bf360c', false, 'Bassin Côtier Nord'),
        mlColor('#ead5f5','#6a1b9a', false, 'Bassin Côtier Sud'),
      ]);
    }

    if (active.includes('Oueds / Rivières')) {
      html += mlSection('Réseau Hydrographique', [
        mlLine('#0066CC', 5,   'Oued majeur (Sebou, Bou Regreg)'),
        mlLine('#0066CC', 2.5, 'Oued principal'),
        mlLine('#4499DD', 1.5, 'Oued secondaire / affluent'),
      ]);
    }

    if (active.includes('Nappes souterraines')) {
      html += mlSection('Nappes Souterraines', [
        mlColor('#bfdbfe','#1d4ed8', true, 'Nappe phréatique'),
        mlColor('#a5f3fc','#0891b2', true, 'Nappe littorale'),
        mlColor('#bae6fd','#0369a1', true, 'Nappe alluviale'),
        mlColor('#cffafe','#0e7490', true, 'Nappe côtière'),
      ]);
    }

    if (active.includes('Barrages')) {
      html += mlSection('Barrages', [
        mlPoint('#0d47a1', 'Barrage opérationnel'),
      ]);
    }

    if (active.includes('Stations pluviométriques')) {
      html += mlSection('Stations Pluviométriques', [
        mlPoint('#1565c0', 'Station de mesure pluviométrique'),
      ]);
    }

    if (active.includes('Zones de risque')) {
      html += mlSection('Risque d\'Inondation', [
        mlColor('#fecaca','#dc2626', false, 'Risque élevé'),
        mlColor('#fed7aa','#ea580c', false, 'Risque modéré'),
        mlColor('#fef9c3','#ca8a04', true,  'Risque faible'),
      ]);
    }

    if (active.includes('Limites administratives')) {
      html += mlSection('Limites Administratives', [
        mlLine('#1d4ed8', 2.5, 'Limite région / préfecture', true),
      ]);
    }

    if (active.includes('Villes principales')) {
      html += mlSection('Villes Principales', [
        mlPointCity('#6d28d9', 16, '★ Capitale (Rabat)'),
        mlPointCity('#1d4ed8', 12, '● Ville principale'),
        mlPointCity('#2563eb',  9, '● Ville secondaire'),
      ]);
    }

    container.innerHTML = html || '<p class="legend-empty">Aucune carte sélectionnée.</p>';
  }

  /* legend builders */
  function mlSection(title, rows) {
    return '<div class="ml-section"><div class="ml-section-title">' + title + '</div>' + rows.join('') + '</div>';
  }

  function mlColor(fill, border, dashed, label) {
    var bd = dashed ? 'border:1.5px dashed ' + border : 'border:1.5px solid ' + border;
    return '<div class="ml-item">'
      + '<div class="ml-color" style="background:' + fill + ';' + bd + '"></div>'
      + '<span class="ml-label">' + label + '</span>'
      + '</div>';
  }

  function mlLine(color, weight, label, dashed) {
    var s = dashed
      ? 'height:0;border-top:' + weight + 'px dashed ' + color + ';margin-top:' + Math.max(weight,3) + 'px'
      : 'height:' + weight + 'px;background:' + color + ';border-radius:1px';
    return '<div class="ml-item">'
      + '<div class="ml-color-line" style="' + s + '"></div>'
      + '<span class="ml-label">' + label + '</span>'
      + '</div>';
  }

  function mlPoint(color, label) {
    return '<div class="ml-item">'
      + '<div style="width:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0">'
      + '<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:' + color + ';border:2px solid white;box-shadow:0 0 0 1.5px ' + color + '"></span>'
      + '</div>'
      + '<span class="ml-label">' + label + '</span>'
      + '</div>';
  }

  function mlPointCity(color, size, label) {
    return '<div class="ml-item">'
      + '<div style="width:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0">'
      + '<span style="display:inline-flex;align-items:center;justify-content:center;width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + color + ';border:2px solid white;box-shadow:0 0 0 1.5px ' + color + ';color:white;font-size:' + Math.round(size*0.5) + 'px">' + (size>=14?'★':'') + '</span>'
      + '</div>'
      + '<span class="ml-label">' + label + '</span>'
      + '</div>';
  }

  window.updateLegend = updateLegend;
  document.addEventListener('layerReady', updateLegend);

}); /* end DOMContentLoaded */
