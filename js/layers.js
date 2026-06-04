/* ===================================================
   WebSIG RSK — layers.js
   Resilient GeoJSON loading with Promise.allSettled
   =================================================== */

'use strict';

window.overlayLayers = {};

/* ── Helpers ─────────────────────────────────────── */

function riskColor(level) {
  if (!level) return '#8899aa';
  const l = level.toLowerCase();
  if (l === 'élevé'  || l === 'high')   return '#e63946';
  if (l === 'moyen'  || l === 'medium') return '#f4a261';
  if (l === 'faible' || l === 'low')    return '#2a9d8f';
  return '#8899aa';
}

function notifyLayerReady(name) {
  document.dispatchEvent(new CustomEvent('layerReady', { detail: { name: name } }));
}

function hideSpinnerNow() {
  var s = document.getElementById('loading-spinner');
  if (s) s.style.display = 'none';
}

function levelBarHTML(pct) {
  var color = pct > 70 ? '#2a9d8f' : pct > 40 ? '#f4a261' : '#e63946';
  return '<div class="popup-level-bar">'
    + '<div class="popup-level-bar-label">'
    + '<span>Niveau actuel</span>'
    + '<span style="color:' + color + ';font-weight:700">' + pct + '%</span>'
    + '</div>'
    + '<div class="popup-level-bar-track">'
    + '<div class="popup-level-bar-fill" style="width:' + pct + '%;background:' + color + '"></div>'
    + '</div></div>';
}

/* ── Custom icons ─────────────────────────────────── */

var damIcon = L.divIcon({
  className: '',
  html: '<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">'
      + '<circle cx="14" cy="14" r="12" fill="#0d1b2a" stroke="#00b4d8" stroke-width="2"/>'
      + '<rect x="8" y="10" width="12" height="8" rx="1" fill="#00b4d8" opacity="0.9"/>'
      + '<rect x="6" y="17" width="16" height="3" rx="1" fill="#0096c7"/>'
      + '<path d="M8 13 Q14 11 20 13" stroke="white" stroke-width="1" fill="none" opacity="0.6"/>'
      + '</svg>',
  iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -16]
});

var stationIcon = L.divIcon({
  className: '',
  html: '<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">'
      + '<circle cx="13" cy="13" r="11" fill="#0d1b2a" stroke="#48cae4" stroke-width="2"/>'
      + '<path d="M10 8 C10 8,6 12,6 14 C6 16.2,7.8 18,10 18 C12.2 18,14 16.2,14 14 C14 12,10 8,10 8Z" fill="#48cae4" opacity="0.85"/>'
      + '<line x1="17" y1="9" x2="16" y2="12" stroke="#48cae4" stroke-width="1.5" stroke-linecap="round"/>'
      + '<line x1="19" y1="11" x2="18" y2="14" stroke="#48cae4" stroke-width="1.5" stroke-linecap="round"/>'
      + '<line x1="21" y1="9" x2="20" y2="12" stroke="#48cae4" stroke-width="1.5" stroke-linecap="round"/>'
      + '</svg>',
  iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -15]
});

/* ── Popup chart for stations ─────────────────────── */
var popupChartInstance = null;
var stationChartCounter = 0;

function renderStationChart(canvasId, monthlyData) {
  if (popupChartInstance) { popupChartInstance.destroy(); popupChartInstance = null; }
  var ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;
  popupChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['J','F','M','A','M','J','J','A','S','O','N','D'],
      datasets: [{
        data: monthlyData,
        backgroundColor: monthlyData.map(function (v) {
          return v > 40 ? '#00b4d8' : v > 15 ? '#48cae4' : '#caf0f8';
        }),
        borderRadius: 2
      }]
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

/* ══════════════════════════════════════════════════
   NAMED LOADER FUNCTIONS
   ══════════════════════════════════════════════════ */

function loadWatersheds(data) {
  var colors = ['#264653', '#2a9d8f', '#457b9d', '#1d3557'];
  var idx = 0;
  var layer = L.geoJSON(data, {
    style: function () {
      return { fillColor: colors[idx++ % colors.length], fillOpacity: 0.35, color: '#00b4d8', weight: 2 };
    },
    onEachFeature: function (feature, lyr) {
      var p = feature.properties || {};
      lyr.bindPopup(
        '<div class="popup-content">'
        + '<h3>&#x1F3D4;&#xFE0F; ' + (p.name || 'Bassin') + '</h3>'
        + '<table>'
        + '<tr><td>Superficie</td><td>' + ((p.area_km2 || 0).toLocaleString('fr-FR')) + ' km\xB2</td></tr>'
        + '<tr><td>Oued principal</td><td>' + (p.main_river || '—') + '</td></tr>'
        + '<tr><td>Pr\xe9cip. moy.</td><td>' + (p.avg_rainfall || '—') + ' mm/an</td></tr>'
        + '<tr><td>Altitude max</td><td>' + (p.alt_max || '—') + ' m</td></tr>'
        + '</table></div>',
        { maxWidth: 280 }
      );
      lyr.on('mouseover', function () { this.setStyle({ fillOpacity: 0.55, weight: 3 }); });
      lyr.on('mouseout',  function () { layer.resetStyle(this); });
    }
  });
  window.overlayLayers['Bassins versants'] = layer;
  notifyLayerReady('Bassins versants');
}

function loadRivers(data) {
  var layer = L.geoJSON(data, {
    style: function (feature) {
      var order = (feature.properties || {}).order || 1;
      return { color: '#0077b6', weight: order >= 6 ? 4 : order >= 4 ? 2.5 : 1.5, opacity: 0.85 };
    },
    onEachFeature: function (feature, lyr) {
      var p = feature.properties || {};
      lyr.bindPopup(
        '<div class="popup-content">'
        + '<h3>&#x1F30A; ' + (p.name || 'Oued') + '</h3>'
        + '<table>'
        + '<tr><td>Longueur</td><td>' + (p.length_km || '—') + ' km</td></tr>'
        + '<tr><td>D\xe9bit moyen</td><td>' + (p.flow_rate || '—') + '</td></tr>'
        + '<tr><td>Ordre</td><td>' + (p.order || '—') + ' (Strahler)</td></tr>'
        + '<tr><td>Bassin</td><td>' + (p.basin || '—') + '</td></tr>'
        + '</table></div>',
        { maxWidth: 260 }
      );
      lyr.on('mouseover', function () {
        this.setStyle({ weight: ((feature.properties || {}).order || 1) >= 6 ? 6 : 4, opacity: 1 });
      });
      lyr.on('mouseout', function () { layer.resetStyle(this); });
    }
  });
  window.overlayLayers['Oueds / Rivi\xe8res'] = layer;
  notifyLayerReady('Oueds / Rivi\xe8res');
}

function loadDams(data) {
  var layer = L.geoJSON(data, {
    pointToLayer: function (feature, latlng) {
      return L.marker(latlng, { icon: damIcon });
    },
    onEachFeature: function (feature, lyr) {
      var p = feature.properties || {};
      lyr.bindPopup(
        '<div class="popup-content">'
        + '<h3>&#x1F3D7;&#xFE0F; ' + (p.name || 'Barrage') + '</h3>'
        + '<table>'
        + '<tr><td>Capacit\xe9</td><td>' + ((p.capacity_Mm3 || 0).toLocaleString('fr-FR')) + ' Mm\xB3</td></tr>'
        + '<tr><td>Hauteur</td><td>' + (p.height_m || '—') + ' m</td></tr>'
        + '<tr><td>Mis en service</td><td>' + (p.year_built || '—') + '</td></tr>'
        + '<tr><td>Oued</td><td>' + (p.oued || '—') + '</td></tr>'
        + '<tr><td>Usage</td><td>' + (p.purpose || '—') + '</td></tr>'
        + '</table>'
        + levelBarHTML(p.current_level || 0)
        + '</div>',
        { maxWidth: 300 }
      );
    }
  });
  window.overlayLayers['Barrages'] = layer;
  notifyLayerReady('Barrages');
}

function loadStations(data) {
  var layer = L.geoJSON(data, {
    pointToLayer: function (feature, latlng) {
      return L.marker(latlng, { icon: stationIcon });
    },
    onEachFeature: function (feature, lyr) {
      var p = feature.properties || {};
      var chartId = 'station-chart-' + (++stationChartCounter);
      lyr.bindPopup(
        '<div class="popup-content" style="min-width:230px">'
        + '<h3>&#x1F327; ' + (p.name || 'Station') + '</h3>'
        + '<table>'
        + '<tr><td>Altitude</td><td>' + (p.altitude || '—') + ' m</td></tr>'
        + '<tr><td>Pr\xe9cip. annuelle</td><td>' + (p.annual_rainfall || '—') + ' mm</td></tr>'
        + '<tr><td>Derni\xe8re lecture</td><td>' + (p.last_reading || '—') + '</td></tr>'
        + '<tr><td>R\xe9seau</td><td>' + (p.network || '—') + '</td></tr>'
        + '</table>'
        + '<div style="margin-top:8px;font-size:11px;color:#8899aa;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Pr\xe9cipitations mensuelles</div>'
        + '<div class="popup-chart-wrap"><canvas id="' + chartId + '"></canvas></div>'
        + '</div>',
        { maxWidth: 280 }
      );
      lyr.on('popupopen', function () {
        if (p.monthly_data) {
          setTimeout(function () { renderStationChart(chartId, p.monthly_data); }, 50);
        }
      });
      lyr.on('popupclose', function () {
        if (popupChartInstance) { popupChartInstance.destroy(); popupChartInstance = null; }
      });
    }
  });
  window.overlayLayers['Stations pluvi\xf3m\xe9triques'] = layer;
  notifyLayerReady('Stations pluvi\xf3m\xe9triques');
}

function loadFloodZones(data) {
  var layer = L.geoJSON(data, {
    style: function (feature) {
      var code  = (feature.properties || {}).risk_code || 'low';
      var color = riskColor(code);
      return { fillColor: color, fillOpacity: 0.4, color: color, weight: 1.5,
               dashArray: code === 'low' ? '6,4' : null };
    },
    onEachFeature: function (feature, lyr) {
      var p = feature.properties || {};
      var badgeClass = p.risk_code || 'low';
      var measures   = (p.mitigation_measures || [])
        .map(function (m) { return '<li>' + m + '</li>'; }).join('');
      lyr.bindPopup(
        '<div class="popup-content">'
        + '<h3>&#x26A0;&#xFE0F; ' + (p.name || 'Zone') + '</h3>'
        + '<table>'
        + '<tr><td>Risque</td><td><span class="risk-badge ' + badgeClass + '">' + (p.risk_level || '—') + '</span></td></tr>'
        + '<tr><td>Superficie</td><td>' + (p.area_km2 || '—') + ' km\xB2</td></tr>'
        + '<tr><td>Pop. expos\xe9e</td><td>' + ((p.population_exposed || 0).toLocaleString('fr-FR')) + ' hab.</td></tr>'
        + '<tr><td>Derni\xe8re inondation</td><td>' + (p.last_flood_year || '—') + '</td></tr>'
        + '<tr><td>Fr\xe9quence</td><td>' + (p.flood_frequency || '—') + '</td></tr>'
        + '</table>'
        + (measures ? '<div class="popup-measures"><div class="popup-measures-title">Mesures</div><ul>' + measures + '</ul></div>' : '')
        + '</div>',
        { maxWidth: 300 }
      );
      lyr.on('mouseover', function () { this.setStyle({ fillOpacity: 0.6, weight: 2.5 }); });
      lyr.on('mouseout',  function () { layer.resetStyle(this); });
    }
  });
  window.overlayLayers['Zones de risque'] = layer;
  notifyLayerReady('Zones de risque');
}

function loadAdmin(data) {
  var layer = L.geoJSON(data, {
    style: function () {
      return { fillColor: 'transparent', fillOpacity: 0, color: '#e0e0e0',
               weight: 1.5, dashArray: '8,4', opacity: 0.7 };
    },
    onEachFeature: function (feature, lyr) {
      var p = feature.properties || {};
      lyr.bindPopup(
        '<div class="popup-content">'
        + '<h3>&#x1F5C2;&#xFE0F; ' + (p.name || 'Limite') + '</h3>'
        + '<table>'
        + '<tr><td>Type</td><td>' + (p.type || '—') + '</td></tr>'
        + '<tr><td>Population</td><td>' + ((p.population || 0).toLocaleString('fr-FR')) + ' hab.</td></tr>'
        + '<tr><td>Superficie</td><td>' + ((p.area_km2 || 0).toLocaleString('fr-FR')) + ' km\xB2</td></tr>'
        + '</table></div>',
        { maxWidth: 240 }
      );
      try {
        lyr.bindTooltip(p.name || '', {
          permanent: true, direction: 'center', className: 'admin-label'
        });
      } catch (e) { /* tooltip optional */ }
    }
  });
  window.overlayLayers['Limites administratives'] = layer;
  notifyLayerReady('Limites administratives');
}

/* ══════════════════════════════════════════════════
   MAIN LOADER — Promise.allSettled, never throws
   ══════════════════════════════════════════════════ */

async function loadAllLayers() {
  var layers = [
    { file: 'data/watersheds.geojson',    loader: loadWatersheds },
    { file: 'data/rivers.geojson',        loader: loadRivers     },
    { file: 'data/dams.geojson',          loader: loadDams       },
    { file: 'data/rain_stations.geojson', loader: loadStations   },
    { file: 'data/flood_zones.geojson',   loader: loadFloodZones },
    { file: 'data/admin_boundaries.geojson', loader: loadAdmin   }
  ];

  await Promise.allSettled(
    layers.map(async function (l) {
      try {
        var r = await fetch(l.file);
        if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + l.file);
        var data = await r.json();
        l.loader(data);
        console.log('Loaded:', l.file);
      } catch (e) {
        console.warn('Skipped:', l.file, e.message);
      }
    })
  );

  /* Hide spinner after all fetch attempts (success or failure) */
  hideSpinnerNow();
}

loadAllLayers();

/* Admin label style injected once */
(function () {
  var s = document.createElement('style');
  s.textContent = '.admin-label{'
    + 'background:transparent!important;border:none!important;box-shadow:none!important;'
    + 'color:rgba(224,224,224,0.7)!important;font-family:Rajdhani,sans-serif!important;'
    + 'font-size:11px!important;font-weight:700!important;text-transform:uppercase!important;'
    + 'letter-spacing:1px!important;text-shadow:0 0 4px #0d1b2a!important;}'
    + '.admin-label::before{display:none!important}';
  document.head.appendChild(s);
}());
