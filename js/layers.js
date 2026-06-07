'use strict';
/* ===================================================
   WebSIG RSK — layers.js v3
   Professional cartographic symbology.
   Real shapefile-derived GeoJSON (WGS84 / EPSG:4326).
   =================================================== */

window.overlayLayers = {};
window.appData = { dams: null, stations: null, watersheds: null, floodZones: null, rivers: null };

/* Check if a thematic card is active — uses getAttribute to avoid encoding issues */
function isCardActive(layerName) {
  var cards = document.querySelectorAll('.thematic-card');
  for (var i = 0; i < cards.length; i++) {
    if (cards[i].getAttribute('data-layer') === layerName) {
      return cards[i].classList.contains('active');
    }
  }
  return false; /* card not found = inactive */
}

/* ── Fetch helper ─────────────────────────────────── */
async function loadLayer(filename, onLoad) {
  const url = 'data/' + filename;
  try {
    const res = await fetch(url);
    if (!res.ok) { console.warn('[layers] ' + res.status + ' ' + url); return null; }
    const data = await res.json();
    if (!data || !Array.isArray(data.features) || !data.features.length) {
      console.warn('[layers] empty:', filename); return null;
    }
    console.log('[layers] ' + data.features.length + ' features <- ' + filename);
    onLoad(data);
    return true;
  } catch (e) {
    console.warn('[layers] error:', filename, e.message); return null;
  }
}

function notifyLayerReady(name) {
  document.dispatchEvent(new CustomEvent('layerReady', { detail: { name: name } }));
}

function hideSpinnerNow() {
  var s = document.getElementById('loading-spinner');
  if (s) s.style.display = 'none';
}

/* ══════════════════════════════════════════════════
   PROFESSIONAL ICONS
   ══════════════════════════════════════════════════ */

/* Dam icon — blue background, white trapezoid wall */
var damIcon = L.divIcon({
  className: '',
  html: '<svg width="38" height="38" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg">'
      + '<circle cx="19" cy="19" r="17" fill="#0d47a1" stroke="white" stroke-width="2.5"/>'
      + '<polygon points="11,14 27,14 24.5,24 13.5,24" fill="white" opacity="0.95"/>'
      + '<rect x="17.5" y="14" width="3" height="10" fill="#64b5f6" opacity="0.7"/>'
      + '<path d="M8 28 Q12 25 16 28 Q20 31 24 28 Q28 25 30 26" stroke="#64b5f6" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
      + '</svg>',
  iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -22]
});

/* Rain station icon — blue filled circle with drop */
var stationIcon = L.divIcon({
  className: '',
  html: '<svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">'
      + '<circle cx="15" cy="15" r="13" fill="#1976d2" stroke="white" stroke-width="2"/>'
      + '<path d="M12 8C12 8,7 14,7 17C7 19.8,9.2 22,12 22C14.8 22,17 19.8,17 17C17 14,12 8,12 8Z" fill="white" opacity="0.9"/>'
      + '<line x1="20" y1="9"  x2="19" y2="13" stroke="white" stroke-width="1.5" stroke-linecap="round"/>'
      + '<line x1="22" y1="13" x2="21" y2="17" stroke="white" stroke-width="1.5" stroke-linecap="round"/>'
      + '</svg>',
  iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -17]
});

/* City icons — 3 tiers */
function makeCityIcon(type) {
  if (type === 'capital') {
    return L.divIcon({
      className: '',
      html: '<svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">'
          + '<circle cx="15" cy="15" r="14" fill="#6d28d9" stroke="white" stroke-width="2.5"/>'
          + '<polygon points="15,5 17,11.5 24,11.5 18.5,15.5 20.5,22 15,18 9.5,22 11.5,15.5 6,11.5 13,11.5" fill="white" opacity="0.95"/>'
          + '</svg>',
      iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -17]
    });
  }
  if (type === 'major') {
    return L.divIcon({
      className: '',
      html: '<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">'
          + '<circle cx="11" cy="11" r="10" fill="#1d4ed8" stroke="white" stroke-width="2.5"/>'
          + '<circle cx="11" cy="11" r="4" fill="white"/>'
          + '</svg>',
      iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -13]
    });
  }
  return L.divIcon({
    className: '',
    html: '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">'
        + '<circle cx="8" cy="8" r="7" fill="#2563eb" stroke="white" stroke-width="2"/>'
        + '<circle cx="8" cy="8" r="2.5" fill="white"/>'
        + '</svg>',
    iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -10]
  });
}

/* ── Risk colour helpers — 4 classes like GIS output ─
   very_high: rouge   high: orange  moderate: jaune  low: vert */
/* Professional cartographic palette — moderate saturation */
var RISK_FILL   = { very_high:'#ef4444', high:'#f97316', moderate:'#f59e0b', low:'#4ade80' };
var RISK_BORDER = { very_high:'#b91c1c', high:'#c2410c', moderate:'#b45309', low:'#16a34a' };
var RISK_LABEL  = { very_high:'Très élevé', high:'Élevé', moderate:'Modéré', low:'Faible' };

function riskKey(code) {
  if (!code) return 'low';
  const c = code.toLowerCase();
  if (c === 'very_high' || c.includes('very') || c.includes('très')) return 'very_high';
  if (c === 'high'  || c.includes('elev') || c === '1') return 'high';
  if (c === 'moderate' || c.includes('moder') || c.includes('moyen') || c === '2') return 'moderate';
  return 'low';
}

/* ── Level fill bar ──────────────────────────────── */
function levelBar(pct) {
  const c = pct > 70 ? '#1976d2' : pct > 40 ? '#e65100' : '#c62828';
  return '<div class="popup-level-bar">'
       + '<div class="popup-level-bar-label"><span>Remplissage actuel</span>'
       + '<span style="color:' + c + ';font-weight:700">' + pct + '%</span></div>'
       + '<div class="popup-level-bar-track">'
       + '<div class="popup-level-bar-fill" style="width:' + pct + '%;background:' + c + '"></div>'
       + '</div></div>';
}

/* ── Popup header helper ─────────────────────────── */
function popupHeader(color, icon, title) {
  return '<div class="popup-hd" style="background:' + color + '">'
       + '<span class="popup-hd-icon">' + icon + '</span>'
       + '<span class="popup-hd-title">' + title + '</span>'
       + '</div>';
}

/* ── Station popup chart ─────────────────────────── */
var popupChart = null;
var chartN = 0;
function renderStationChart(id, months) {
  if (popupChart) { popupChart.destroy(); popupChart = null; }
  var ctx = document.getElementById(id);
  if (!ctx || typeof Chart === 'undefined') return;
  popupChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['J','F','M','A','M','J','J','A','S','O','N','D'],
      datasets: [{ data: months, backgroundColor: months.map(function(v){ return v>40?'#0077b6':v>15?'#0096c7':'#90e0ef'; }), borderRadius: 2 }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{ x:{ticks:{color:'#64748b',font:{size:9}},grid:{display:false}}, y:{ticks:{color:'#64748b',font:{size:9}},grid:{color:'rgba(100,116,139,0.12)'}} } }
  });
}

/* ══════════════════════════════════════════════════
   1. BASSINS VERSANTS — professional cartographic palette
   Fields: NomSousBas, CodeSousBas, Superficie, CodeBassin
   ══════════════════════════════════════════════════ */
function loadWatersheds(data) {
  window.appData.watersheds = data;
  const palette = [
    { fill: '#c8e6fa', border: '#1565c0' },
    { fill: '#c8efd8', border: '#2e7d32' },
    { fill: '#fff9c4', border: '#f9a825' },
    { fill: '#fce4d0', border: '#bf360c' },
    { fill: '#ead5f5', border: '#6a1b9a' },
  ];
  const colorMap = {};
  data.features.forEach(function(f, idx) {
    const id = (f.properties && (f.properties.OBJECTID || f.properties.CodeSousBas)) || idx;
    colorMap[String(id)] = palette[idx % palette.length];
  });
  const lyr = L.geoJSON(data, {
    style: function(feature) {
      const id = String((feature.properties && (feature.properties.OBJECTID || feature.properties.CodeSousBas)) || 0);
      const p  = colorMap[id] || palette[0];
      return { fillColor: p.fill, fillOpacity: 0.50, color: p.border, weight: 2, opacity: 0.85 };
    },
    onEachFeature: function(feat, l) {
      const p   = feat.properties || {};
      const id  = String((p.OBJECTID || p.CodeSousBas) || 0);
      const cp  = colorMap[id] || palette[0];
      const name = p.NomSousBas || p.name || 'Bassin';
      const sup  = p.Superficie ? (+p.Superficie).toLocaleString('fr-FR', {maximumFractionDigits:1}) + ' km²' : '—';
      l.bindPopup('<div class="popup-content">'
        + popupHeader(cp.border, '🗺️', name)
        + '<table>'
        + '<tr><td>Code sous-bassin</td><td><b>' + (p.CodeSousBas || '—') + '</b></td></tr>'
        + '<tr><td>Code bassin</td><td>' + (p.CodeBassin || '—') + '</td></tr>'
        + '<tr><td>Superficie</td><td>' + sup + '</td></tr>'
        + '</table></div>', { maxWidth: 290 });
      l.on('mouseover', function() { this.setStyle({ fillOpacity: 0.75, weight: 2.8 }); });
      l.on('mouseout', function() {
        const rid = String((this.feature.properties && (this.feature.properties.OBJECTID || this.feature.properties.CodeSousBas)) || 0);
        const rp  = colorMap[rid] || palette[0];
        this.setStyle({ fillColor: rp.fill, fillOpacity: 0.50, color: rp.border, weight: 2 });
      });
    }
  });
  window.overlayLayers['Bassins versants'] = lyr;
  if (window.map && isCardActive('Bassins versants')) lyr.addTo(window.map);
  notifyLayerReady('Bassins versants');
}

/* ══════════════════════════════════════════════════
   2. OUEDS — 3-tier classification
   principal : Sebou, Bou Regreg → thick #0d47a1
   major     : other main rivers → medium #1565c0
   secondary : tributaries        → thin   #42a5f5
   Fields: name, fclass, Shape_Leng
   ══════════════════════════════════════════════════ */
function classifyOued(feat) {
  const p  = feat.properties || {};
  const n  = (p.name || p.NAME || '').toLowerCase();
  const fc = (p.fclass || '').toLowerCase();
  if (n.includes('sebou') || n.includes('bou regreg') || n.includes('bouregreg') || n.includes('bou-regreg'))
    return 'principal';
  if (fc === 'river' || fc === 'major' || fc === '') return 'major';
  return 'secondary';
}

/* Professional river palette — deep blue gradient */
var ouedStyles = {
  principal: { color: '#0d47a1', weight: 4.5, opacity: 1,    lineCap: 'round', lineJoin: 'round' },
  major:     { color: '#1565c0', weight: 2.2, opacity: 0.92, lineCap: 'round', lineJoin: 'round' },
  secondary: { color: '#42a5f5', weight: 1.0, opacity: 0.70, lineCap: 'round', lineJoin: 'round' }
};

function loadRivers(data) {
  window.appData.rivers = data;
  /* ── river line layer ── */
  var riverLines = L.geoJSON(data, {
    style: function(feat) { return ouedStyles[classifyOued(feat)]; },
    onEachFeature: function(feat, l) {
      const p    = feat.properties || {};
      const name = p.name || p.NAME || 'Oued';
      const tier = classifyOued(feat);
      const tierLabels = {
        principal: 'Oued majeur (axe principal)',
        major:     'Oued principal',
        secondary: 'Oued secondaire / affluent'
      };
      const tierColors = { principal: '#0044AA', major: '#0066CC', secondary: '#3377BB' };
      const len = p.Shape_Leng ? (+p.Shape_Leng * 111).toFixed(1) + ' km (approx.)' : '—';
      l.bindPopup('<div class="popup-content">'
        + popupHeader(tierColors[tier], '🌊', name)
        + '<table>'
        + '<tr><td>Classification</td><td><b>' + tierLabels[tier] + '</b></td></tr>'
        + '<tr><td>Type hydrologique</td><td>' + (p.fclass || '—') + '</td></tr>'
        + '<tr><td>Longueur estimée</td><td>' + len + '</td></tr>'
        + '</table></div>', { maxWidth: 290 });
      l.on('mouseover', function() {
        const t = classifyOued(this.feature);
        this.setStyle({ weight: t === 'principal' ? 7 : t === 'major' ? 4 : 2, opacity: 1,
                        color: t === 'principal' ? '#0a3d8f' : t === 'major' ? '#1048a0' : '#1e88e5' });
      });
      l.on('mouseout', function() { riverLines.resetStyle(this); });
    }
  });

  /* ── river name labels — deduplicated by name (longest segment) ── */
  var namedFeats = {};
  data.features.forEach(function(feat) {
    var p    = feat.properties || {};
    var name = (p.name || p.NAME || '').trim();
    if (!name) return;
    var tier = classifyOued(feat);
    if (tier === 'secondary') return;
    var len  = +(p.Shape_Leng || 0);
    if (!namedFeats[name] || len > namedFeats[name].len)
      namedFeats[name] = { feat: feat, len: len, tier: tier };
  });

  var labelGroup = L.layerGroup();
  Object.keys(namedFeats).forEach(function(name) {
    var entry = namedFeats[name];
    var geom  = entry.feat.geometry;
    var coords = null;
    if (geom.type === 'LineString') {
      coords = geom.coordinates;
    } else if (geom.type === 'MultiLineString' && geom.coordinates.length) {
      coords = geom.coordinates.reduce(function(a, b) { return b.length > a.length ? b : a; });
    }
    if (!coords || coords.length < 2) return;
    var mid    = coords[Math.floor(coords.length / 2)];
    var marker = L.marker([mid[1], mid[0]], {
      icon: L.divIcon({ className: '', html: '', iconSize: [0, 0], iconAnchor: [0, 0] }),
      interactive: false
    });
    marker.bindTooltip(name, {
      permanent: true, direction: 'center',
      className: entry.tier === 'principal' ? 'river-label-main' : 'river-label-major'
    });
    labelGroup.addLayer(marker);
  });

  var lyr = L.featureGroup([riverLines, labelGroup]);
  window.overlayLayers['Oueds / Rivières'] = lyr;
  if (window.map && isCardActive('Oueds / Rivières')) lyr.addTo(window.map);
  notifyLayerReady('Oueds / Rivières');
}

/* ══════════════════════════════════════════════════
   3. BARRAGES — professional symbols + rich popups
   Fields: BARRAGE, OUED, Capacité_, ANNEE, current_level
   ══════════════════════════════════════════════════ */
function loadDams(data) {
  window.appData.dams = data;
  const lyr = L.geoJSON(data, {
    pointToLayer: function(feat, ll) {
      return L.marker(ll, { icon: damIcon, zIndexOffset: 500 });
    },
    onEachFeature: function(feat, l) {
      const p    = feat.properties || {};
      const name = p.BARRAGE || p.name || 'Barrage';
      const cap  = p['Capacit\xe9_'] || p.Capacite_ || p['Capacité_'] || '—';
      const pct  = p.current_level || 75;
      l.bindPopup('<div class="popup-content">'
        + popupHeader('#0d47a1', '🏗️', name)
        + '<table>'
        + '<tr><td>Oued</td><td><b>' + (p.OUED || '—') + '</b></td></tr>'
        + '<tr><td>Capacité totale</td><td>' + cap + ' Mm³</td></tr>'
        + '<tr><td>Mise en service</td><td>' + (p.ANNEE || '—') + '</td></tr>'
        + '<tr><td>Statut</td><td><span class="status-badge operational">● Opérationnel</span></td></tr>'
        + '</table>'
        + levelBar(pct)
        + '</div>', { maxWidth: 320 });
      l.bindTooltip(name, {
        permanent: false, direction: 'top', offset: [0, -20],
        className: 'dam-tooltip'
      });
    }
  });
  window.overlayLayers['Barrages'] = lyr;
  if (window.map && isCardActive('Barrages')) lyr.addTo(window.map);
  notifyLayerReady('Barrages');
}

/* ══════════════════════════════════════════════════
   4. STATIONS PLUVIOMÉTRIQUES
   Fields: name, altitude, annual_rainfall, network, monthly_data
   ══════════════════════════════════════════════════ */
function loadStations(data) {
  window.appData.stations = data;
  const lyr = L.geoJSON(data, {
    pointToLayer: function(feat, ll) { return L.marker(ll, { icon: stationIcon }); },
    onEachFeature: function(feat, l) {
      const p   = feat.properties || {};
      const cid = 'sc-' + (++chartN);
      l.bindPopup('<div class="popup-content" style="min-width:235px">'
        + popupHeader('#1565c0', '🌧️', p.name || 'Station')
        + '<table>'
        + '<tr><td>Altitude</td><td>' + (p.altitude || '—') + ' m</td></tr>'
        + '<tr><td>Précip. annuelle</td><td><b>' + (p.annual_rainfall || '—') + ' mm</b></td></tr>'
        + '<tr><td>Réseau</td><td>' + (p.network || '—') + '</td></tr>'
        + '</table>'
        + '<div class="chart-subtitle">Précipitations mensuelles (mm)</div>'
        + '<div class="popup-chart-wrap"><canvas id="' + cid + '"></canvas></div>'
        + '</div>', { maxWidth: 290 });
      l.on('popupopen',  function() { if (p.monthly_data) setTimeout(function() { renderStationChart(cid, p.monthly_data); }, 50); });
      l.on('popupclose', function() { if (popupChart) { popupChart.destroy(); popupChart = null; } });
    }
  });
  window.overlayLayers['Stations pluviométriques'] = lyr;
  if (window.map && isCardActive('Stations pluviométriques')) lyr.addTo(window.map);
  notifyLayerReady('Stations pluviométriques');
}

/* ══════════════════════════════════════════════════
   5. ZONES INONDATION — GEE-style homogeneous render
   No visible borders, solid fills — looks like raster
   ══════════════════════════════════════════════════ */
function loadFloodZones(data) {
  window.appData.floodZones = data;
  const lyr = L.geoJSON(data, {
    style: function(feat) {
      const key = riskKey((feat.properties || {}).risk_code);
      return {
        fillColor:   RISK_FILL[key],
        fillOpacity: 0.82,
        color:       RISK_FILL[key],   /* border = same as fill → invisible seams */
        weight:      0.3,
        dashArray:   null,
        opacity:     0.4
      };
    },
    onEachFeature: function(feat, l) {
      const p     = feat.properties || {};
      const key   = riskKey(p.risk_code);
      const label = RISK_LABEL[key];
      const measures = (p.mitigation_measures || []).map(function(m) { return '<li>' + m + '</li>'; }).join('');
      l.bindPopup('<div class="popup-content">'
        + popupHeader(RISK_BORDER[key], '⚠️', p.name || 'Zone inondation')
        + '<table>'
        + '<tr><td>Niveau de risque</td><td><span style="background:' + RISK_FILL[key] + ';color:' + RISK_BORDER[key] + ';border:1px solid ' + RISK_BORDER[key] + ';padding:2px 8px;border-radius:4px;font-weight:700">' + label + '</span></td></tr>'
        + '<tr><td>Superficie</td><td>' + (p.area_km2 || '—') + ' km²</td></tr>'
        + '<tr><td>Dernière inondation</td><td>' + (p.last_flood_year || '—') + '</td></tr>'
        + (p.cv_f1 ? '<tr><td>Précision modèle (F1)</td><td><b>' + p.cv_f1 + '</b></td></tr>' : '')
        + '</table>'
        + (measures ? '<div class="popup-measures"><div class="popup-measures-title">Mesures de prévention</div><ul>' + measures + '</ul></div>' : '')
        + '</div>', { maxWidth: 300 });
      l.on('mouseover', function() {
        this.setStyle({ fillOpacity: 0.95, weight: 1.5, color: RISK_BORDER[riskKey(this.feature.properties.risk_code)] });
      });
      l.on('mouseout', function() { lyr.resetStyle(this); });
    }
  });
  window.overlayLayers['Zones de risque'] = lyr;
  if (window.map && isCardActive('Zones de risque')) lyr.addTo(window.map);
  notifyLayerReady('Zones de risque');
}

/* ══════════════════════════════════════════════════
   6. LIMITES ADMINISTRATIVES
   Fields: Nom_Region, Population, CODE_REGIO, Menages
   ══════════════════════════════════════════════════ */
function loadAdmin(data) {
  const lyr = L.geoJSON(data, {
    style: function() {
      return {
        fillColor: 'transparent', fillOpacity: 0,
        color: '#1d4ed8', weight: 3,
        dashArray: '10,6', opacity: 0.80
      };
    },
    onEachFeature: function(feat, l) {
      const p    = feat.properties || {};
      const name = p.Nom_Region || p.NOM_REGION || p.name || 'Région RSK';
      l.bindPopup('<div class="popup-content">'
        + popupHeader('#1d4ed8', '🗂️', name)
        + '<table>'
        + '<tr><td>Code région</td><td>' + (p.CODE_REGIO || p.type || '—') + '</td></tr>'
        + '<tr><td>Population</td><td><b>' + ((+(p.Population || p.population) || 0).toLocaleString('fr-FR')) + '</b> hab.</td></tr>'
        + '<tr><td>Superficie</td><td>' + ((+(p.area_km2) || 0).toLocaleString('fr-FR') || '—') + ' km²</td></tr>'
        + '</table></div>', { maxWidth: 270 });
    }
  });
  window.overlayLayers['Limites administratives'] = lyr;
  if (window.map && isCardActive('Limites administratives')) lyr.addTo(window.map);
  notifyLayerReady('Limites administratives');
}

/* ══════════════════════════════════════════════════
   7. NAPPES SOUTERRAINES — per-nappe color coding
   Fields: Nom_Nappe
   ══════════════════════════════════════════════════ */
function loadAquifers(data) {
  /* Blue → cyan gradient — professional hydrogeology convention */
  const aqPalette = [
    { fill: '#bfdbfe', border: '#1d4ed8' },  /* bleu          */
    { fill: '#a5f3fc', border: '#0891b2' },  /* cyan          */
    { fill: '#bae6fd', border: '#0369a1' },  /* bleu ciel     */
    { fill: '#cffafe', border: '#0e7490' },  /* cyan pâle     */
    { fill: '#e0f2fe', border: '#0284c7' },  /* bleu très pâle*/
  ];
  const aqMap = {};
  data.features.forEach(function(f, idx) {
    const id = (f.properties && f.properties.Nom_Nappe) || String(idx);
    aqMap[id] = aqPalette[idx % aqPalette.length];
  });
  const lyr = L.geoJSON(data, {
    style: function(feat) {
      const id = (feat.properties && feat.properties.Nom_Nappe) || '0';
      const cp = aqMap[id] || aqPalette[0];
      return { fillColor: cp.fill, fillOpacity: 0.55, color: cp.border, weight: 2, dashArray: '7,4' };
    },
    onEachFeature: function(feat, l) {
      const p  = feat.properties || {};
      const id = p.Nom_Nappe || '0';
      const cp = aqMap[id] || aqPalette[0];
      l.bindPopup('<div class="popup-content">'
        + popupHeader(cp.border, '💧', p.Nom_Nappe || 'Nappe souterraine')
        + '<table>'
        + '<tr><td>Type</td><td>Nappe souterraine libre</td></tr>'
        + '<tr><td>Nom</td><td><b>' + (p.Nom_Nappe || '—') + '</b></td></tr>'
        + '</table></div>', { maxWidth: 270 });
      l.on('mouseover', function() { this.setStyle({ fillOpacity: 0.78, weight: 2.5 }); });
      l.on('mouseout',  function() { lyr.resetStyle(this); });
    }
  });
  window.overlayLayers['Nappes souterraines'] = lyr;
  if (window.map && isCardActive('Nappes souterraines')) lyr.addTo(window.map);
  notifyLayerReady('Nappes souterraines');
}

/* ══════════════════════════════════════════════════
   8. VILLES PRINCIPALES — inline data (no fetch)
   Cities: Rabat, Salé, Kénitra, Khémisset, Tiflet,
           Sidi Kacem, Sidi Slimane
   ══════════════════════════════════════════════════ */
function loadCities() {
  var data = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature',
        geometry: { type: 'Point', coordinates: [-6.8498, 34.0209] },
        properties: { name: 'Rabat',           type: 'capital',   population: 577827, role: 'Capitale administrative du Maroc',  altitude: 75  }},
      { type: 'Feature',
        geometry: { type: 'Point', coordinates: [-6.7975, 34.0378] },
        properties: { name: 'Salé',            type: 'major',     population: 902021, role: 'Préfecture de Salé',                altitude: 20  }},
      { type: 'Feature',
        geometry: { type: 'Point', coordinates: [-6.9072, 33.9254] },
        properties: { name: 'Témara',          type: 'major',     population: 320000, role: 'Préfecture Skhirate-Témara',        altitude: 65  }},
      { type: 'Feature',
        geometry: { type: 'Point', coordinates: [-6.5753, 34.2610] },
        properties: { name: 'Kénitra',         type: 'major',     population: 431282, role: 'Préfecture de Kénitra',             altitude: 15  }},
      { type: 'Feature',
        geometry: { type: 'Point', coordinates: [-6.0667, 33.8240] },
        properties: { name: 'Khémisset',       type: 'secondary', population: 131542, role: 'Chef-lieu de province',             altitude: 405 }},
      { type: 'Feature',
        geometry: { type: 'Point', coordinates: [-6.3082, 33.8942] },
        properties: { name: 'Tiflet',          type: 'secondary', population: 59478,  role: 'Province de Khémisset',             altitude: 285 }},
      { type: 'Feature',
        geometry: { type: 'Point', coordinates: [-5.7084, 34.2213] },
        properties: { name: 'Sidi Kacem',      type: 'secondary', population: 73000,  role: 'Chef-lieu de province',             altitude: 120 }},
      { type: 'Feature',
        geometry: { type: 'Point', coordinates: [-5.9218, 34.2590] },
        properties: { name: 'Sidi Slimane',    type: 'secondary', population: 80000,  role: 'Province de Sidi Kacem',            altitude: 80  }},
      { type: 'Feature',
        geometry: { type: 'Point', coordinates: [-7.1200, 33.6190] },
        properties: { name: 'Benslimane',      type: 'secondary', population: 70000,  role: 'Chef-lieu de province',             altitude: 220 }},
      { type: 'Feature',
        geometry: { type: 'Point', coordinates: [-6.0085, 34.6890] },
        properties: { name: 'Souk El Arbaa',   type: 'secondary', population: 76000,  role: 'Province de Kénitra',               altitude: 20  }},
      { type: 'Feature',
        geometry: { type: 'Point', coordinates: [-6.7037, 33.8518] },
        properties: { name: 'Skhirate',        type: 'secondary', population: 45000,  role: 'Préfecture Skhirate-Témara',        altitude: 30  }},
      { type: 'Feature',
        geometry: { type: 'Point', coordinates: [-6.2500, 34.3000] },
        properties: { name: 'Sidi Yahya',      type: 'secondary', population: 35000,  role: 'Province de Kénitra',               altitude: 40  }},
    ]
  };

  var lyr = L.geoJSON(data, {
    pointToLayer: function(feat, ll) {
      return L.marker(ll, { icon: makeCityIcon(feat.properties.type), zIndexOffset: 1000 });
    },
    onEachFeature: function(feat, l) {
      var p = feat.properties;
      var hdrColor  = p.type === 'capital' ? '#6d28d9' : p.type === 'major' ? '#1d4ed8' : '#2563eb';
      var typeLabel = p.type === 'capital' ? '★ Capitale' : p.type === 'major' ? 'Ville principale' : 'Ville';
      l.bindPopup('<div class="popup-content">'
        + popupHeader(hdrColor, '🏙️', p.name)
        + '<table>'
        + '<tr><td>Type</td><td><b>' + typeLabel + '</b></td></tr>'
        + '<tr><td>Rôle administratif</td><td>' + p.role + '</td></tr>'
        + '<tr><td>Population</td><td><b>' + p.population.toLocaleString('fr-FR') + '</b> hab.</td></tr>'
        + '<tr><td>Altitude</td><td>' + p.altitude + ' m</td></tr>'
        + '</table></div>', { maxWidth: 310 });
      var ttDir = (p.name === 'Sidi Kacem' || p.name === 'Sidi Slimane') ? 'left' : 'right';
      l.bindTooltip(p.name, {
        permanent: true,
        direction: ttDir,
        offset: ttDir === 'right' ? [10, 0] : [-10, 0],
        className: 'city-label city-label-' + p.type
      });
    }
  });
  window.overlayLayers['Villes principales'] = lyr;
  if (window.map && isCardActive('Villes principales')) lyr.addTo(window.map);
  notifyLayerReady('Villes principales');
}

/* ══════════════════════════════════════════════════
   MAIN — load all layers
   ══════════════════════════════════════════════════ */
async function loadAllLayers() {
  await Promise.allSettled([
    loadLayer('watersheds_real.geojson',       loadWatersheds),
    loadLayer('rivers_real.geojson',           loadRivers),
    loadLayer('dams_real.geojson',             loadDams),
    loadLayer('admin_boundaries_real.geojson', loadAdmin),
    loadLayer('aquifers.geojson',              loadAquifers),
    loadLayer('rain_stations.geojson',         loadStations),
    loadLayer('flood_zones_dem_simple.geojson', loadFloodZones)
  ]);
  loadCities();
  console.log('[layers] done. Keys:', Object.keys(window.overlayLayers));
  updateStatCards();
  document.dispatchEvent(new CustomEvent('appDataReady'));
  hideSpinnerNow();
}

function getDamCapacity(props) {
  for (var k in props) { if (k.toLowerCase().includes('apacit')) return +props[k] || 0; }
  return 0;
}

function updateStatCards() {
  var d = window.appData;

  if (d.dams) {
    var feats = d.dams.features;
    var totalCap = feats.reduce(function(s, f) { return s + getDamCapacity(f.properties); }, 0);
    var elD = document.getElementById('stat-dams');
    var elC = document.getElementById('stat-capacity');
    if (elD) elD.textContent = feats.length;
    if (elC) elC.textContent = Math.round(totalCap).toLocaleString('fr-FR');
  }

  if (d.rivers) {
    var totalKm = d.rivers.features.reduce(function(s, f) {
      return s + (+(f.properties.Shape_Leng || 0) * 111);
    }, 0);
    var elR = document.getElementById('stat-rivers');
    if (elR) elR.textContent = Math.round(totalKm).toLocaleString('fr-FR');
  }

  if (d.stations) {
    var elS = document.getElementById('stat-stations');
    if (elS) elS.textContent = d.stations.features.length;
  }
}

loadAllLayers();

/* ── Injected styles for labels, popups, tooltips ── */
(function() {
  var s = document.createElement('style');
  s.textContent =
    /* River name labels — italic, white halo */
    '.river-label-main{'
      + 'background:transparent!important;border:none!important;box-shadow:none!important;'
      + 'color:#003d99!important;font-family:"Source Sans Pro",sans-serif!important;'
      + 'font-size:9px!important;font-weight:600!important;font-style:italic!important;'
      + 'white-space:nowrap!important;pointer-events:none!important;'
      + 'text-shadow:1px 0 3px rgba(255,255,255,0.95),-1px 0 3px rgba(255,255,255,0.95),'
      +              '0 1px 3px rgba(255,255,255,0.95),0 -1px 3px rgba(255,255,255,0.95)!important;}'
    + '.river-label-main::before{display:none!important}'
    + '.river-label-major{'
      + 'background:transparent!important;border:none!important;box-shadow:none!important;'
      + 'color:#0055aa!important;font-family:"Source Sans Pro",sans-serif!important;'
      + 'font-size:8px!important;font-style:italic!important;'
      + 'white-space:nowrap!important;pointer-events:none!important;'
      + 'text-shadow:1px 0 2px rgba(255,255,255,0.9),-1px 0 2px rgba(255,255,255,0.9),'
      +              '0 1px 2px rgba(255,255,255,0.9),0 -1px 2px rgba(255,255,255,0.9)!important;}'
    + '.river-label-major::before{display:none!important}'
    /* Admin region labels — white bg, blue text */
    + '.admin-label{'
      + 'background:rgba(255,255,255,0.92)!important;'
      + 'border:1.5px solid #1d4ed8!important;'
      + 'border-radius:4px!important;'
      + 'box-shadow:0 1px 5px rgba(29,78,216,0.22)!important;'
      + 'padding:2px 7px!important;'
      + 'color:#1e3a8a!important;'
      + 'font-family:Rajdhani,sans-serif!important;'
      + 'font-size:11px!important;font-weight:700!important;'
      + 'text-transform:uppercase!important;letter-spacing:1px!important;'
      + 'white-space:nowrap!important;pointer-events:none!important;}'
    + '.admin-label::before{display:none!important}'
    /* City labels — text with white halo */
    + '.city-label{'
      + 'background:transparent!important;border:none!important;box-shadow:none!important;'
      + 'font-family:Rajdhani,sans-serif!important;font-weight:700!important;'
      + 'white-space:nowrap!important;pointer-events:none!important;'
      + 'text-shadow:1px 1px 0 white,-1px 1px 0 white,1px -1px 0 white,-1px -1px 0 white,'
      +              '0 1px 3px rgba(255,255,255,0.9)!important;}'
    + '.city-label::before{display:none!important}'
    + '.city-label-capital{font-size:10px!important;color:#5b21b6!important;}'
    + '.city-label-major  {font-size:9px!important;color:#1e3a8a!important;}'
    + '.city-label-secondary{font-size:8px!important;color:#1e40af!important;}'
    /* Dam hover tooltip */
    + '.dam-tooltip{'
      + 'background:rgba(13,71,161,0.92)!important;border:none!important;'
      + 'color:white!important;font-family:Rajdhani,sans-serif!important;'
      + 'font-size:13px!important;font-weight:600!important;'
      + 'padding:3px 9px!important;border-radius:4px!important;'
      + 'box-shadow:0 2px 6px rgba(0,0,0,0.2)!important;}'
    + '.dam-tooltip::before{display:none!important}'
    /* Popup colored header */
    + '.popup-hd{'
      + 'display:flex;align-items:center;gap:8px;'
      + 'margin:-12px -14px 10px;padding:9px 12px;'
      + 'border-radius:8px 8px 0 0;'
      + 'color:white;font-family:Rajdhani,sans-serif;'
      + 'font-size:15px;font-weight:700;}'
    + '.popup-hd-icon{font-size:17px;}'
    + '.popup-hd-title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    /* Status badge */
    + '.status-badge.operational{color:#16a34a;font-weight:700;}'
    + '.status-badge.construction{color:#ea580c;font-weight:700;}'
    /* Chart subtitle in popups */
    + '.chart-subtitle{margin-top:8px;font-size:11px;color:#64748b;}';
  document.head.appendChild(s);
}());
