'use strict';
/* ===================================================
   WebSIG RSK — layers.js
   Loads REAL shapefile-derived GeoJSON data.
   All shapefiles are WGS84 (EPSG:4326) — verified.
   =================================================== */

window.overlayLayers = {};

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

/* ── Custom icons (professional light theme) ─────────── */
var damIcon = L.divIcon({
  className: '',
  html: '<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">'
      + '<circle cx="16" cy="16" r="14" fill="#ffffff" stroke="#1565c0" stroke-width="2.5"/>'
      + '<rect x="9" y="12" width="14" height="8" rx="1.5" fill="#1565c0"/>'
      + '<rect x="7" y="19" width="18" height="3.5" rx="1.5" fill="#0d47a1"/>'
      + '<path d="M10 15.5 Q16 13 22 15.5" stroke="white" stroke-width="1.2" fill="none" opacity="0.7"/>'
      + '</svg>',
  iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18]
});

var stationIcon = L.divIcon({
  className: '',
  html: '<svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">'
      + '<circle cx="15" cy="15" r="13" fill="#ffffff" stroke="#1976d2" stroke-width="2.5"/>'
      + '<path d="M12 8C12 8,7 14,7 17C7 19.8,9.2 22,12 22C14.8 22,17 19.8,17 17C17 14,12 8,12 8Z" fill="#42a5f5" opacity="0.85"/>'
      + '<line x1="20" y1="9"  x2="19" y2="13" stroke="#1976d2" stroke-width="1.5" stroke-linecap="round"/>'
      + '<line x1="22" y1="13" x2="21" y2="17" stroke="#1976d2" stroke-width="1.5" stroke-linecap="round"/>'
      + '</svg>',
  iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -17]
});

/* ── Professional risk colours ──────────────────────── */
function riskColor(code) {
  if (!code) return '#388e3c';
  const c = code.toLowerCase();
  return c.includes('elev') || c.includes('high') || c === '1' ? '#c62828'
       : c.includes('moyen') || c.includes('med') || c === '2' ? '#e65100'
       : '#388e3c';
}

/* ── Level bar ──────────────────────────────────────── */
function levelBar(pct) {
  const c = pct > 70 ? '#1976d2' : pct > 40 ? '#e65100' : '#c62828';
  return '<div class="popup-level-bar">'
       + '<div class="popup-level-bar-label"><span>Remplissage</span>'
       + '<span style="color:' + c + ';font-weight:700">' + pct + '%</span></div>'
       + '<div class="popup-level-bar-track">'
       + '<div class="popup-level-bar-fill" style="width:' + pct + '%;background:' + c + '"></div>'
       + '</div></div>';
}

/* ── Popup chart for stations ───────────────────────── */
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
      datasets: [{ data: months, backgroundColor: months.map(function(v){ return v>40?'#00b4d8':v>15?'#48cae4':'#caf0f8'; }), borderRadius: 2 }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{ x:{ticks:{color:'#8899aa',font:{size:9}},grid:{display:false}}, y:{ticks:{color:'#8899aa',font:{size:9}},grid:{color:'rgba(136,153,170,0.15)'}} } }
  });
}

/* ══════════════════════════════════════════════════
   LOADER FUNCTIONS — using REAL shapefile field names
   ══════════════════════════════════════════════════ */

/* 1. SOUS-BASSINS (SousBassin.shp)
      Fields: NomSousBas, CodeSousBas, Superficie, CodeBassin */
function loadWatersheds(data) {
  /* Distinct pastel palette — professional cartographic colours */
  const palette = [
    { fill: '#aed6f1', border: '#1565c0' },  /* sky blue    */
    { fill: '#a9dfbf', border: '#1b5e20' },  /* mint green  */
    { fill: '#f9e79f', border: '#f57f17' },  /* pale yellow */
    { fill: '#f5cba7', border: '#bf360c' },  /* peach       */
    { fill: '#d7bde2', border: '#4a148c' },  /* lavender    */
  ];
  let i = 0;
  const lyr = L.geoJSON(data, {
    style: function() {
      const p = palette[i++ % palette.length];
      return { fillColor: p.fill, fillOpacity: 0.45, color: p.border, weight: 1.8 };
    },
    onEachFeature: function(feat, l) {
      const p = feat.properties || {};
      const name = p.NomSousBas || p.name || p.OBJECTID || 'Bassin';
      const sup  = p.Superficie ? (+p.Superficie).toLocaleString('fr-FR', {maximumFractionDigits:1}) + ' km²' : '—';
      l.bindPopup('<div class="popup-content">'
        + '<h3>&#x1F3D4; ' + name + '</h3>'
        + '<table>'
        + '<tr><td>Code</td><td>' + (p.CodeSousBas || p.CodeBassin || '—') + '</td></tr>'
        + '<tr><td>Superficie</td><td>' + sup + '</td></tr>'
        + '<tr><td>Bassin</td><td>' + (p.CodeBassin || '—') + '</td></tr>'
        + '</table></div>', { maxWidth: 280 });
      l.on('mouseover', function(){ this.setStyle({ fillOpacity: 0.6, weight: 3 }); });
      l.on('mouseout',  function(){ lyr.resetStyle(this); });
    }
  });
  window.overlayLayers['Bassins versants'] = lyr;
  if (window.map) lyr.addTo(window.map);
  notifyLayerReady('Bassins versants');
}

/* 2. OUEDS (OUEDS.shp)
      Fields: name, fclass, Shape_Leng */
function loadRivers(data) {
  const lyr = L.geoJSON(data, {
    style: function(feat) {
      const fc = (feat.properties || {}).fclass || '';
      const major = fc.includes('river') || fc === '';
      return {
        color:   major ? '#1565c0' : '#1976d2',
        weight:  major ? 2.5 : 1.2,
        opacity: 0.9
      };
    },
    onEachFeature: function(feat, l) {
      const p = feat.properties || {};
      const name = p.name || p.NAME || 'Oued';
      const len  = p.Shape_Leng ? (+p.Shape_Leng * 111).toFixed(1) + ' km (approx)' : '—';
      l.bindPopup('<div class="popup-content">'
        + '<h3>&#x1F30A; ' + name + '</h3>'
        + '<table>'
        + '<tr><td>Type</td><td>' + (p.fclass || '—') + '</td></tr>'
        + '<tr><td>Longueur</td><td>' + len + '</td></tr>'
        + '</table></div>', { maxWidth: 260 });
      l.on('mouseover', function(){ this.setStyle({ weight: 5, opacity: 1 }); });
      l.on('mouseout',  function(){ lyr.resetStyle(this); });
    }
  });
  window.overlayLayers['Oueds / Rivières'] = lyr;
  if (window.map) lyr.addTo(window.map);
  notifyLayerReady('Oueds / Rivières');
}

/* 3. BARRAGES EXISTANTS (BARRAGES_EXISTANTS.shp)
      Fields: BARRAGE, OUED, Capacité_, ANNEE */
function loadDams(data) {
  const lyr = L.geoJSON(data, {
    pointToLayer: function(feat, ll) { return L.marker(ll, { icon: damIcon }); },
    onEachFeature: function(feat, l) {
      const p = feat.properties || {};
      const name = p.BARRAGE || p.name || 'Barrage';
      const cap  = p['Capacit\xe9_'] || p.Capacite_ || p['Capacité_'] || '—';
      l.bindPopup('<div class="popup-content">'
        + '<h3>&#x1F3D7; ' + name + '</h3>'
        + '<table>'
        + '<tr><td>Oued</td><td>' + (p.OUED || '—') + '</td></tr>'
        + '<tr><td>Capacité</td><td>' + cap + ' Mm³</td></tr>'
        + '<tr><td>Année</td><td>' + (p.ANNEE || '—') + '</td></tr>'
        + '</table>'
        + levelBar(p.current_level || 75)
        + '</div>', { maxWidth: 300 });
    }
  });
  window.overlayLayers['Barrages'] = lyr;
  if (window.map) lyr.addTo(window.map);
  notifyLayerReady('Barrages');
}

/* 4. RAIN STATIONS (rain_stations.geojson — kept as demo, no shapefile)
      Fields: name, altitude, annual_rainfall, network, monthly_data */
function loadStations(data) {
  const lyr = L.geoJSON(data, {
    pointToLayer: function(feat, ll) { return L.marker(ll, { icon: stationIcon }); },
    onEachFeature: function(feat, l) {
      const p = feat.properties || {};
      const cid = 'sc-' + (++chartN);
      l.bindPopup('<div class="popup-content" style="min-width:230px">'
        + '<h3>&#x1F327; ' + (p.name || 'Station') + '</h3>'
        + '<table>'
        + '<tr><td>Altitude</td><td>' + (p.altitude || '—') + ' m</td></tr>'
        + '<tr><td>Précip. annuelle</td><td>' + (p.annual_rainfall || '—') + ' mm</td></tr>'
        + '<tr><td>Réseau</td><td>' + (p.network || '—') + '</td></tr>'
        + '</table>'
        + '<div style="margin-top:8px;font-size:11px;color:#8899aa">Précipitations mensuelles (mm)</div>'
        + '<div class="popup-chart-wrap"><canvas id="' + cid + '"></canvas></div>'
        + '</div>', { maxWidth: 280 });
      l.on('popupopen', function(){ if (p.monthly_data) setTimeout(function(){ renderStationChart(cid, p.monthly_data); }, 50); });
      l.on('popupclose', function(){ if (popupChart){ popupChart.destroy(); popupChart = null; } });
    }
  });
  window.overlayLayers['Stations pluviométriques'] = lyr;
  if (window.map) lyr.addTo(window.map);
  notifyLayerReady('Stations pluviométriques');
}

/* 5. FLOOD ZONES (flood_zones.geojson — demo, no shapefile source)
      Fields: risk_code, risk_level, area_km2, population_exposed */
function loadFloodZones(data) {
  const lyr = L.geoJSON(data, {
    style: function(feat) {
      const code  = (feat.properties || {}).risk_code || 'low';
      const fills = { high: '#ffcdd2', medium: '#ffe0b2', low: '#dcedc8' };
      const lines = { high: '#c62828', medium: '#e65100', low: '#2e7d32' };
      return {
        fillColor: fills[code] || '#dcedc8',
        fillOpacity: 0.65,
        color: lines[code] || '#2e7d32',
        weight: 1.5,
        dashArray: code === 'low' ? '6,4' : null
      };
    },
    onEachFeature: function(feat, l) {
      const p = feat.properties || {};
      const measures = (p.mitigation_measures || []).map(function(m){ return '<li>' + m + '</li>'; }).join('');
      l.bindPopup('<div class="popup-content">'
        + '<h3>&#x26A0; ' + (p.name || 'Zone') + '</h3>'
        + '<table>'
        + '<tr><td>Risque</td><td><span class="risk-badge ' + (p.risk_code || 'low') + '">' + (p.risk_level || '—') + '</span></td></tr>'
        + '<tr><td>Superficie</td><td>' + (p.area_km2 || '—') + ' km²</td></tr>'
        + '<tr><td>Pop. exposée</td><td>' + ((p.population_exposed || 0).toLocaleString('fr-FR')) + ' hab.</td></tr>'
        + '<tr><td>Dernière inondation</td><td>' + (p.last_flood_year || '—') + '</td></tr>'
        + '</table>'
        + (measures ? '<div class="popup-measures"><div class="popup-measures-title">Mesures</div><ul>' + measures + '</ul></div>' : '')
        + '</div>', { maxWidth: 300 });
      l.on('mouseover', function(){ this.setStyle({ fillOpacity: 0.65, weight: 2.5 }); });
      l.on('mouseout',  function(){ lyr.resetStyle(this); });
    }
  });
  window.overlayLayers['Zones de risque'] = lyr;
  if (window.map) lyr.addTo(window.map);
  notifyLayerReady('Zones de risque');
}

/* 6. ADMINISTRATIVE — LIMITE REGION (limite-de-région.shp)
      Fields: Nom_Region, Population, CODE_REGIO */
function loadAdmin(data) {
  const lyr = L.geoJSON(data, {
    style: function() {
      return { fillColor: 'transparent', fillOpacity: 0, color: '#0d47a1',
               weight: 2.5, dashArray: '9,5', opacity: 0.75 };
    },
    onEachFeature: function(feat, l) {
      const p = feat.properties || {};
      const name = p.Nom_Region || p.NOM_REGION || p.name || 'Région RSK';
      l.bindPopup('<div class="popup-content">'
        + '<h3>&#x1F5FA; ' + name + '</h3>'
        + '<table>'
        + '<tr><td>Code région</td><td>' + (p.CODE_REGIO || '—') + '</td></tr>'
        + '<tr><td>Population</td><td>' + ((+p.Population || 0).toLocaleString('fr-FR')) + ' hab.</td></tr>'
        + '<tr><td>Ménages</td><td>' + ((+p.Menages || 0).toLocaleString('fr-FR')) + '</td></tr>'
        + '</table></div>', { maxWidth: 260 });
      try {
        l.bindTooltip(name, { permanent: true, direction: 'center', className: 'admin-label' });
      } catch(e) {}
    }
  });
  window.overlayLayers['Limites administratives'] = lyr;
  if (window.map) lyr.addTo(window.map);
  notifyLayerReady('Limites administratives');
}

/* 7. NAPPES (NAPPES.shp)
      Fields: Nom_Nappe */
function loadAquifers(data) {
  const lyr = L.geoJSON(data, {
    style: function() {
      return { fillColor: '#bbdefb', fillOpacity: 0.5, color: '#1565c0', weight: 1.5, dashArray: '5,4' };
    },
    onEachFeature: function(feat, l) {
      const p = feat.properties || {};
      l.bindPopup('<div class="popup-content">'
        + '<h3>&#x1F4A7; ' + (p.Nom_Nappe || 'Nappe') + '</h3>'
        + '<table><tr><td>Type</td><td>Nappe souterraine</td></tr></table>'
        + '</div>', { maxWidth: 240 });
      l.on('mouseover', function(){ this.setStyle({ fillOpacity: 0.5 }); });
      l.on('mouseout',  function(){ lyr.resetStyle(this); });
    }
  });
  window.overlayLayers['Nappes souterraines'] = lyr;
  if (window.map) lyr.addTo(window.map);
  notifyLayerReady('Nappes souterraines');
}

/* ══════════════════════════════════════════════════
   MAIN — load real shapefiles, fallback to demo
   ══════════════════════════════════════════════════ */
async function loadAllLayers() {
  await Promise.allSettled([
    /* Real shapefile data */
    loadLayer('watersheds_real.geojson',       loadWatersheds),
    loadLayer('rivers_real.geojson',           loadRivers),
    loadLayer('dams_real.geojson',             loadDams),
    loadLayer('admin_boundaries_real.geojson', loadAdmin),
    loadLayer('aquifers.geojson',              loadAquifers),
    /* Demo data (no real shapefile source) */
    loadLayer('rain_stations.geojson',         loadStations),
    loadLayer('flood_zones.geojson',           loadFloodZones)
  ]);
  console.log('[layers] done. Keys:', Object.keys(window.overlayLayers));
  hideSpinnerNow();
}

loadAllLayers();

/* Admin label style */
(function(){
  var s = document.createElement('style');
  s.textContent = '.admin-label{background:transparent!important;border:none!important;box-shadow:none!important;'
    + 'color:rgba(200,220,255,0.85)!important;font-family:Rajdhani,sans-serif!important;'
    + 'font-size:13px!important;font-weight:700!important;text-transform:uppercase!important;'
    + 'letter-spacing:1.5px!important;text-shadow:1px 1px 3px #0d1b2a!important;}'
    + '.admin-label::before{display:none!important}';
  document.head.appendChild(s);
}());
