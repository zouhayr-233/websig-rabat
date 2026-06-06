'use strict';
/* ===================================================
   WebSIG RSK — controls.js v3
   Floating-panel cartographic interface.
   =================================================== */

document.addEventListener('DOMContentLoaded', function () {

  /* ── helpers ──────────────────────────────────────── */
  function getLayer(name) { return window.overlayLayers && window.overlayLayers[name]; }

  function toggleLayer(name, add) {
    var lyr = getLayer(name);
    if (!lyr || !window.map) return;
    try { add ? window.map.addLayer(lyr) : window.map.removeLayer(lyr); } catch (e) {}
  }

  /* ── LAYER CHECKBOXES ─────────────────────────────── */
  document.querySelectorAll('.layer-checkbox').forEach(function (cb) {
    cb.addEventListener('change', function () {
      var name    = this.dataset.layer;
      var checked = this.checked;
      if (getLayer(name)) { toggleLayer(name, checked); updateLegend(); return; }
      function handler(e) {
        if (e.detail.name !== name) return;
        document.removeEventListener('layerReady', handler);
        if (checked) toggleLayer(name, true);
        updateLegend();
      }
      document.addEventListener('layerReady', handler);
    });
  });

  /* ── ZOOM-TO-LAYER BUTTONS ────────────────────────── */
  document.querySelectorAll('.layer-zoom-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault();
      var lyr = getLayer(this.dataset.layer);
      if (!lyr || !window.map) return;
      try { var b = lyr.getBounds(); if (b.isValid()) window.map.fitBounds(b, { padding:[30,30], animate:true }); } catch (_) {}
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

  /* ── TOOL STRIP — zoom ────────────────────────────── */
  var btnZoomIn  = document.getElementById('btn-zoom-in');
  var btnZoomOut = document.getElementById('btn-zoom-out');
  if (btnZoomIn)  btnZoomIn.addEventListener('click',  function () { if (window.map) window.map.zoomIn(); });
  if (btnZoomOut) btnZoomOut.addEventListener('click', function () { if (window.map) window.map.zoomOut(); });

  /* ── FLOATING PANEL TOGGLES ───────────────────────── */
  function openPanel(id)  { var p = document.getElementById(id); if (p) p.style.display = 'flex'; }
  function closePanel(id) { var p = document.getElementById(id); if (p) p.style.display = 'none'; }
  function togglePanel(id) {
    var p = document.getElementById(id);
    if (!p) return;
    p.style.display = (p.style.display === 'none' || !p.style.display) ? 'flex' : 'none';
    if (p.style.display === 'flex') {
      /* close other floating panels */
      ['layers-panel','search-panel','stats-panel'].forEach(function(oid) {
        if (oid !== id) closePanel(oid);
      });
    }
  }

  /* Layers panel */
  var btnLayers = document.getElementById('btn-layers');
  var btnCloseLayers = document.getElementById('close-layers-panel');
  if (btnLayers)     btnLayers.addEventListener('click', function () { togglePanel('layers-panel'); this.classList.toggle('active'); });
  if (btnCloseLayers) btnCloseLayers.addEventListener('click', function () { closePanel('layers-panel'); var b=document.getElementById('btn-layers'); if(b) b.classList.remove('active'); });

  /* Stats panel */
  var btnStats = document.getElementById('btn-stats');
  var btnCloseStats = document.getElementById('close-stats-panel');
  if (btnStats)     btnStats.addEventListener('click', function () { togglePanel('stats-panel'); this.classList.toggle('active'); });
  if (btnCloseStats) btnCloseStats.addEventListener('click', function () { closePanel('stats-panel'); var b=document.getElementById('btn-stats'); if(b) b.classList.remove('active'); });

  /* Search panel */
  var btnSearch = document.getElementById('btn-search');
  var btnCloseSearch = document.getElementById('close-search-panel');
  if (btnSearch)     btnSearch.addEventListener('click', function () { togglePanel('search-panel'); this.classList.toggle('active'); });
  if (btnCloseSearch) btnCloseSearch.addEventListener('click', function () { closePanel('search-panel'); var b=document.getElementById('btn-search'); if(b) b.classList.remove('active'); });

  /* ── PANEL TABS ───────────────────────────────────── */
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var container = this.closest('.stats-fp-body') || document;
      container.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      container.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
      this.classList.add('active');
      var tab = document.getElementById('tab-' + this.dataset.tab);
      if (tab) tab.classList.add('active');
    });
  });

  /* ── LEGEND TOGGLE ────────────────────────────────── */
  var legendToggle = document.getElementById('legend-toggle');
  var floatLegend  = document.getElementById('float-legend');
  if (legendToggle && floatLegend) {
    legendToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      floatLegend.classList.toggle('collapsed');
      legendToggle.textContent = floatLegend.classList.contains('collapsed') ? '›' : '∨';
    });
    document.getElementById('float-legend-header').addEventListener('click', function () {
      floatLegend.classList.toggle('collapsed');
      legendToggle.textContent = floatLegend.classList.contains('collapsed') ? '›' : '∨';
    });
  }

  /* ── SEARCH ───────────────────────────────────────── */
  var searchInput = document.getElementById('search-input');
  var searchBtn   = document.getElementById('search-btn');
  if (searchInput) {
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && window.searchLocation) window.searchLocation(this.value.trim());
    });
  }
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', function () {
      if (window.searchLocation) window.searchLocation(searchInput.value.trim());
    });
  }

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

  /* ── EXPORT PNG ───────────────────────────────────── */
  var btnExport = document.getElementById('btn-export-png');
  if (btnExport) btnExport.addEventListener('click', function () { if (window.exportMapPNG) window.exportMapPNG(); });

  /* ── FULLSCREEN ───────────────────────────────────── */
  var btnFS = document.getElementById('btn-fullscreen');
  if (btnFS) btnFS.addEventListener('click', function () { if (window.toggleFullscreen) window.toggleFullscreen(); });

  /* ── INFO MODAL ───────────────────────────────────── */
  function openModal()  { var m = document.getElementById('info-modal'); if (m) m.style.display = 'flex'; }
  function closeModal() { var m = document.getElementById('info-modal'); if (m) m.style.display = 'none'; }
  var btnInfo = document.getElementById('btn-info');
  if (btnInfo) btnInfo.addEventListener('click', openModal);
  var infoModal = document.getElementById('info-modal');
  if (infoModal) infoModal.addEventListener('click', function (e) { if (e.target === this) closeModal(); });
  var btnMC = document.getElementById('modal-close-btn'); if (btnMC) btnMC.addEventListener('click', closeModal);
  var btnMO = document.getElementById('modal-ok-btn');    if (btnMO) btnMO.addEventListener('click', closeModal);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closePanel('layers-panel'); closePanel('search-panel'); closePanel('stats-panel'); } });

  /* ══════════════════════════════════════════════════
     PROFESSIONAL GIS LEGEND
     ══════════════════════════════════════════════════ */
  function updateLegend() {
    var container = document.getElementById('legend-content');
    if (!container) return;
    var active = Array.from(document.querySelectorAll('.layer-checkbox:checked'))
                      .map(function(c){ return c.dataset.layer; });
    if (!active.length) { container.innerHTML = '<p class="legend-empty">Activez une couche pour voir sa légende.</p>'; return; }

    var sections = [];

    if (active.includes('Bassins versants'))
      sections.push(lgSection('🗺️ Bassins versants', [
        lgPoly('#c8e6fa','#1565c0',false,'Sous-bassin atlantique'),
        lgPoly('#c8efd8','#2e7d32',false,'Sous-bassin Sebou'),
        lgPoly('#fff9c4','#f9a825',false,'Sous-bassin intermédiaire'),
        lgPoly('#fce4d0','#bf360c',false,'Sous-bassin côtier N.'),
        lgPoly('#ead5f5','#6a1b9a',false,'Sous-bassin côtier S.'),
      ]));

    if (active.includes('Oueds / Rivières'))
      sections.push(lgSection('🌊 Oueds / Rivières', [
        lgLine('#0066CC',5,  false,'Oued majeur — Sebou, Bou Regreg'),
        lgLine('#0066CC',2.5,false,'Oued principal'),
        lgLine('#4499DD',1.5,false,'Oued secondaire / affluent'),
      ]));

    if (active.includes('Barrages'))
      sections.push(lgSection('🏗️ Barrages', [lgPoint('#0d47a1',12,'Barrage opérationnel')]));

    if (active.includes('Stations pluviométriques'))
      sections.push(lgSection('🌧️ Stations pluviométriques', [lgPoint('#1565c0',10,'Station de mesure')]));

    if (active.includes('Nappes souterraines'))
      sections.push(lgSection('💧 Nappes souterraines', [
        lgPoly('#bfdbfe','#1d4ed8',true,'Nappe phréatique (bleue)'),
        lgPoly('#a5f3fc','#0891b2',true,'Nappe littorale (cyan)'),
        lgPoly('#bae6fd','#0369a1',true,'Nappe alluviale (bleu ciel)'),
        lgPoly('#cffafe','#0e7490',true,'Nappe côtière (cyan pâle)'),
      ]));

    if (active.includes('Zones de risque'))
      sections.push(lgSection('⚠️ Risque d\'inondation', [
        lgPoly('#fecaca','#dc2626',false,'Risque ÉLEVÉ'),
        lgPoly('#fed7aa','#ea580c',false,'Risque MODÉRÉ'),
        lgPoly('#fef9c3','#ca8a04',true, 'Risque FAIBLE'),
      ]));

    if (active.includes('Limites administratives'))
      sections.push(lgSection('🗂️ Limites administratives', [
        lgLine('#1d4ed8',2.5,true,'Limite région / préfecture'),
      ]));

    if (active.includes('Villes principales'))
      sections.push(lgSection('🏙️ Villes principales', [
        lgCity('#6d28d9',14,'★ Capitale — Rabat'),
        lgCity('#1d4ed8',10,'● Ville principale'),
        lgCity('#2563eb', 8,'● Ville secondaire'),
      ]));

    container.innerHTML = sections.length
      ? '<div class="gis-legend">' + sections.join('') + '</div>'
      : '<p class="legend-empty">Activez une couche pour voir sa légende.</p>';
  }

  function lgSection(title, rows) {
    return '<div class="lg-section"><div class="lg-title">' + title + '</div>' + rows.join('') + '</div>';
  }
  function lgPoly(fill, border, dashed, label) {
    var bd = dashed ? 'border:1.5px dashed '+border : 'border:1.5px solid '+border;
    return '<div class="lg-item"><span class="lg-sym-poly" style="background:'+fill+';'+bd+'"></span><span class="lg-label">'+label+'</span></div>';
  }
  function lgLine(color, weight, dashed, label) {
    var s = dashed
      ? 'border-top:'+weight+'px dashed '+color+';height:0;margin-top:'+Math.max(weight,2)+'px'
      : 'height:'+weight+'px;background:'+color+';border-radius:1px';
    return '<div class="lg-item"><span class="lg-sym-line" style="'+s+'"></span><span class="lg-label">'+label+'</span></div>';
  }
  function lgPoint(color, size, label) {
    return '<div class="lg-item">'
      +'<span style="display:inline-block;width:'+size+'px;height:'+size+'px;border-radius:50%;'
      +'background:'+color+';border:2px solid white;outline:1.5px solid '+color+';flex-shrink:0"></span>'
      +'<span class="lg-label">'+label+'</span></div>';
  }
  function lgCity(color, size, label) {
    return '<div class="lg-item">'
      +'<span style="display:inline-flex;align-items:center;justify-content:center;'
      +'width:'+size+'px;height:'+size+'px;border-radius:50%;'
      +'background:'+color+';border:2px solid white;outline:1.5px solid '+color+';'
      +'color:white;font-size:'+(size>=12?'8':'6')+'px;flex-shrink:0">'+(size>=12?'★':'')+'</span>'
      +'<span class="lg-label">'+label+'</span></div>';
  }

  window.updateLegend = updateLegend;
  document.addEventListener('layerReady', updateLegend);

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

}); /* end DOMContentLoaded */
