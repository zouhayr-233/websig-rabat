'use strict';

/* ──────────────────────────────────────────────────
   WebSIG RSK — layers.js
   Resilient GeoJSON loading: Promise.allSettled
   ────────────────────────────────────────────────── */

window.overlayLayers = {};

const DATA_PATH = 'data/';   /* relative — works on GH Pages & locally */

/* ── Fetch helper ──────────────────────────────────
   Validates response, checks features exist, calls onLoad.
   Never throws — always returns null on failure.
   ─────────────────────────────────────────────────── */
async function loadLayer(filename, onLoad) {
  const url = DATA_PATH + filename;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[layers] HTTP', res.status, url);
      return null;
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.features) || data.features.length === 0) {
      console.warn('[layers] empty / invalid GeoJSON:', filename);
      return null;
    }
    console.log('[layers]', data.features.length, 'features <-', filename);
    onLoad(data);
    return true;
  } catch (err) {
    console.warn('[layers] failed:', filename, err.message);
    return null;
  }
}

/* ── Notify controls.js ────────────────────────────── */
function notifyLayerReady(name) {
  document.dispatchEvent(new CustomEvent('layerReady', { detail: { name: name } }));
}

/* ── Spinner off ───────────────────────────────────── */
function hideSpinnerNow() {
  const s = document.getElementById('loading-spinner');
  if (s) s.style.display = 'none';
}

/* ── Custom icons ───────────────────────────────────── */
const damIcon = L.divIcon({
  className: '',
  html: '<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">'
      + '<circle cx="14" cy="14" r="12" fill="#0d1b2a" stroke="#00b4d8" stroke-width="2"/>'
      + '<rect x="8" y="10" width="12" height="8" rx="1" fill="#00b4d8" opacity="0.9"/>'
      + '<rect x="6" y="17" width="16" height="3" rx="1" fill="#0096c7"/>'
      + '</svg>',
  iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -16]
});

const stationIcon = L.divIcon({
  className: '',
  html: '<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">'
      + '<circle cx="13" cy="13" r="11" fill="#0d1b2a" stroke="#48cae4" stroke-width="2"/>'
      + '<path d="M10 8C10 8,6 12,6 14C6 16.2,7.8 18,10 18C12.2 18,14 16.2,14 14C14 12,10 8,10 8Z" fill="#48cae4" opacity="0.85"/>'
      + '<line x1="17" y1="9" x2="16" y2="12" stroke="#48cae4" stroke-width="1.5" stroke-linecap="round"/>'
      + '<line x1="19" y1="11" x2="18" y2="14" stroke="#48cae4" stroke-width="1.5" stroke-linecap="round"/>'
      + '</svg>',
  iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -15]
});

/* ── Popup helpers ──────────────────────────────────── */
function levelBarHTML(pct) {
  const c = pct > 70 ? '#2a9d8f' : pct > 40 ? '#f4a261' : '#e63946';
  return `<div class="popup-level-bar">
    <div class="popup-level-bar-label"><span>Niveau</span><span style="color:${c};font-weight:700">${pct}%</span></div>
    <div class="popup-level-bar-track"><div class="popup-level-bar-fill" style="width:${pct}%;background:${c}"></div></div>
  </div>`;
}

function riskColor(code) {
  return code === 'high' || code === 'élevé'  ? '#e63946'
       : code === 'medium'|| code === 'moyen'  ? '#f4a261'
       : '#2a9d8f';
}

let popupChart = null;
let chartCounter = 0;
function renderStationChart(id, months) {
  if (popupChart) { popupChart.destroy(); popupChart = null; }
  const ctx = document.getElementById(id);
  if (!ctx || typeof Chart === 'undefined') return;
  popupChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['J','F','M','A','M','J','J','A','S','O','N','D'],
      datasets: [{ data: months, backgroundColor: months.map(v => v > 40 ? '#00b4d8' : v > 15 ? '#48cae4' : '#caf0f8'), borderRadius: 2 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8899aa', font: { size: 9 } }, grid: { display: false } },
        y: { ticks: { color: '#8899aa', font: { size: 9 } }, grid: { color: 'rgba(136,153,170,0.15)' } }
      }
    }
  });
}

/* ══════════════════════════════════════════════════════
   LOADER FUNCTIONS
   Each populates window.overlayLayers[key] and fires
   notifyLayerReady(key).  Key strings are plain UTF-8 —
   no escape sequences — to avoid typos.
   ══════════════════════════════════════════════════════ */

function loadWatersheds(data) {
  const palette = ['#264653','#2a9d8f','#457b9d','#1d3557'];
  let i = 0;
  const lyr = L.geoJSON(data, {
    style: () => ({ fillColor: palette[i++ % palette.length], fillOpacity: 0.35, color: '#00b4d8', weight: 2 }),
    onEachFeature(feat, l) {
      const p = feat.properties || {};
      l.bindPopup(`<div class="popup-content">
        <h3>&#x1F3D4; ${p.name || 'Bassin'}</h3>
        <table>
          <tr><td>Superficie</td><td>${(p.area_km2||0).toLocaleString('fr-FR')} km²</td></tr>
          <tr><td>Oued principal</td><td>${p.main_river||'—'}</td></tr>
          <tr><td>Précip. moy.</td><td>${p.avg_rainfall||'—'} mm/an</td></tr>
          <tr><td>Altitude max</td><td>${p.alt_max||'—'} m</td></tr>
        </table></div>`, { maxWidth: 280 });
      l.on('mouseover', function(){ this.setStyle({ fillOpacity: 0.55, weight: 3 }); });
      l.on('mouseout',  function(){ lyr.resetStyle(this); });
    }
  });
  window.overlayLayers['Bassins versants'] = lyr;
  if (window.map) lyr.addTo(window.map);
  notifyLayerReady('Bassins versants');
}

function loadRivers(data) {
  const lyr = L.geoJSON(data, {
    style(feat) {
      const o = (feat.properties||{}).order || 1;
      return { color: '#0077b6', weight: o >= 6 ? 4 : o >= 4 ? 2.5 : 1.5, opacity: 0.85 };
    },
    onEachFeature(feat, l) {
      const p = feat.properties || {};
      l.bindPopup(`<div class="popup-content">
        <h3>&#x1F30A; ${p.name||'Oued'}</h3>
        <table>
          <tr><td>Longueur</td><td>${p.length_km||'—'} km</td></tr>
          <tr><td>Débit</td><td>${p.flow_rate||'—'}</td></tr>
          <tr><td>Ordre</td><td>${p.order||'—'}</td></tr>
          <tr><td>Bassin</td><td>${p.basin||'—'}</td></tr>
        </table></div>`, { maxWidth: 260 });
      l.on('mouseover', function(){ this.setStyle({ weight: 5, opacity: 1 }); });
      l.on('mouseout',  function(){ lyr.resetStyle(this); });
    }
  });
  window.overlayLayers['Oueds / Rivières'] = lyr;
  if (window.map) lyr.addTo(window.map);
  notifyLayerReady('Oueds / Rivières');
}

function loadDams(data) {
  const lyr = L.geoJSON(data, {
    pointToLayer: (feat, ll) => L.marker(ll, { icon: damIcon }),
    onEachFeature(feat, l) {
      const p = feat.properties || {};
      l.bindPopup(`<div class="popup-content">
        <h3>&#x1F3D7; ${p.name||'Barrage'}</h3>
        <table>
          <tr><td>Capacité</td><td>${(p.capacity_Mm3||0).toLocaleString('fr-FR')} Mm³</td></tr>
          <tr><td>Hauteur</td><td>${p.height_m||'—'} m</td></tr>
          <tr><td>Mis en service</td><td>${p.year_built||'—'}</td></tr>
          <tr><td>Oued</td><td>${p.oued||'—'}</td></tr>
          <tr><td>Usage</td><td>${p.purpose||'—'}</td></tr>
        </table>
        ${levelBarHTML(p.current_level||0)}</div>`, { maxWidth: 300 });
    }
  });
  window.overlayLayers['Barrages'] = lyr;
  if (window.map) lyr.addTo(window.map);
  notifyLayerReady('Barrages');
}

function loadStations(data) {
  const lyr = L.geoJSON(data, {
    pointToLayer: (feat, ll) => L.marker(ll, { icon: stationIcon }),
    onEachFeature(feat, l) {
      const p = feat.properties || {};
      const cid = 'sc-' + (++chartCounter);
      l.bindPopup(`<div class="popup-content" style="min-width:230px">
        <h3>&#x1F327; ${p.name||'Station'}</h3>
        <table>
          <tr><td>Altitude</td><td>${p.altitude||'—'} m</td></tr>
          <tr><td>Précip. annuelle</td><td>${p.annual_rainfall||'—'} mm</td></tr>
          <tr><td>Réseau</td><td>${p.network||'—'}</td></tr>
        </table>
        <div style="margin-top:8px;font-size:11px;color:#8899aa">Précipitations mensuelles (mm)</div>
        <div class="popup-chart-wrap"><canvas id="${cid}"></canvas></div>
      </div>`, { maxWidth: 280 });
      l.on('popupopen', () => { if (p.monthly_data) setTimeout(() => renderStationChart(cid, p.monthly_data), 50); });
      l.on('popupclose', () => { if (popupChart) { popupChart.destroy(); popupChart = null; } });
    }
  });
  window.overlayLayers['Stations pluviométriques'] = lyr;
  if (window.map) lyr.addTo(window.map);
  notifyLayerReady('Stations pluviométriques');
}

function loadFloodZones(data) {
  const lyr = L.geoJSON(data, {
    style(feat) {
      const code = (feat.properties||{}).risk_code || 'low';
      const c = riskColor(code);
      return { fillColor: c, fillOpacity: 0.4, color: c, weight: 1.5, dashArray: code === 'low' ? '6,4' : null };
    },
    onEachFeature(feat, l) {
      const p = feat.properties || {};
      const measures = (p.mitigation_measures||[]).map(m => `<li>${m}</li>`).join('');
      l.bindPopup(`<div class="popup-content">
        <h3>&#x26A0; ${p.name||'Zone'}</h3>
        <table>
          <tr><td>Risque</td><td><span class="risk-badge ${p.risk_code||'low'}">${p.risk_level||'—'}</span></td></tr>
          <tr><td>Superficie</td><td>${p.area_km2||'—'} km²</td></tr>
          <tr><td>Pop. exposée</td><td>${(p.population_exposed||0).toLocaleString('fr-FR')} hab.</td></tr>
          <tr><td>Dernière inondation</td><td>${p.last_flood_year||'—'}</td></tr>
        </table>
        ${measures ? `<div class="popup-measures"><div class="popup-measures-title">Mesures</div><ul>${measures}</ul></div>` : ''}
      </div>`, { maxWidth: 300 });
      l.on('mouseover', function(){ this.setStyle({ fillOpacity: 0.65, weight: 2.5 }); });
      l.on('mouseout',  function(){ lyr.resetStyle(this); });
    }
  });
  window.overlayLayers['Zones de risque'] = lyr;
  if (window.map) lyr.addTo(window.map);
  notifyLayerReady('Zones de risque');
}

function loadAdmin(data) {
  const lyr = L.geoJSON(data, {
    style: () => ({ fillColor: 'transparent', fillOpacity: 0, color: '#e0e0e0', weight: 1.5, dashArray: '8,4', opacity: 0.7 }),
    onEachFeature(feat, l) {
      const p = feat.properties || {};
      l.bindPopup(`<div class="popup-content">
        <h3>&#x1F5C2; ${p.name||'Limite'}</h3>
        <table>
          <tr><td>Type</td><td>${p.type||'—'}</td></tr>
          <tr><td>Population</td><td>${(p.population||0).toLocaleString('fr-FR')} hab.</td></tr>
          <tr><td>Superficie</td><td>${(p.area_km2||0).toLocaleString('fr-FR')} km²</td></tr>
        </table></div>`, { maxWidth: 240 });
      try { l.bindTooltip(p.name||'', { permanent: true, direction: 'center', className: 'admin-label' }); } catch(e){}
    }
  });
  window.overlayLayers['Limites administratives'] = lyr;
  if (window.map) lyr.addTo(window.map);
  notifyLayerReady('Limites administratives');
}

/* ══════════════════════════════════════════════════════
   MAIN ENTRY POINT
   ══════════════════════════════════════════════════════ */
async function loadAllLayers() {
  await Promise.allSettled([
    loadLayer('watersheds.geojson',       loadWatersheds),
    loadLayer('rivers.geojson',           loadRivers),
    loadLayer('dams.geojson',             loadDams),
    loadLayer('rain_stations.geojson',    loadStations),
    loadLayer('flood_zones.geojson',      loadFloodZones),
    loadLayer('admin_boundaries.geojson', loadAdmin)
  ]);
  console.log('[layers] all done. Keys:', Object.keys(window.overlayLayers));
  hideSpinnerNow();
}

loadAllLayers();

/* Admin label style */
(function(){
  const s = document.createElement('style');
  s.textContent = '.admin-label{background:transparent!important;border:none!important;box-shadow:none!important;'
    + 'color:rgba(224,224,224,.7)!important;font-family:Rajdhani,sans-serif!important;'
    + 'font-size:11px!important;font-weight:700!important;text-transform:uppercase!important;'
    + 'letter-spacing:1px!important;text-shadow:0 0 4px #0d1b2a!important;}'
    + '.admin-label::before{display:none!important}';
  document.head.appendChild(s);
}());
