/* ===================================================
   WebSIG RSK — layers.js
   GeoJSON layer loading, styling, popups
   =================================================== */

'use strict';

/* Layer references (populated after fetch) */
window.overlayLayers = {};

/* ---- Fetch with automatic _real fallback ----
 * Tries data/<stem>_real.geojson first (from process_websig_data.py output),
 * falls back to data/<stem>.geojson (demo data) if the real file is missing.
 */
function fetchLayer(stem) {
  return fetch('data/' + stem + '_real.geojson')
    .then(function (r) {
      if (!r.ok) throw new Error('no real');
      return r.json().then(function (d) { return { data: d, source: 'real' }; });
    })
    .catch(function () {
      return fetch('data/' + stem + '.geojson')
        .then(function (r) { return r.json(); })
        .then(function (d) { return { data: d, source: 'demo' }; });
    });
}

/* ---- Utility: risk colour ---- */
function riskColor(level) {
  if (!level) return '#8899aa';
  const l = level.toLowerCase();
  if (l === 'élevé' || l === 'high')   return '#e63946';
  if (l === 'moyen' || l === 'medium') return '#f4a261';
  if (l === 'faible' || l === 'low')   return '#2a9d8f';
  return '#8899aa';
}

/* ---- Custom dam icon ---- */
const damIcon = L.divIcon({
  className: '',
  html: `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    <circle cx="14" cy="14" r="12" fill="#0d1b2a" stroke="#00b4d8" stroke-width="2"/>
    <rect x="8" y="10" width="12" height="8" rx="1" fill="#00b4d8" opacity="0.9"/>
    <rect x="6" y="17" width="16" height="3" rx="1" fill="#0096c7"/>
    <path d="M8 13 Q14 11 20 13" stroke="white" stroke-width="1" fill="none" opacity="0.6"/>
  </svg>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16]
});

/* ---- Custom rain station icon ---- */
const stationIcon = L.divIcon({
  className: '',
  html: `<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
    <circle cx="13" cy="13" r="11" fill="#0d1b2a" stroke="#48cae4" stroke-width="2"/>
    <path d="M10 8 C10 8, 6 12, 6 14 C6 16.2, 7.8 18, 10 18 C12.2 18, 14 16.2, 14 14 C14 12, 10 8, 10 8Z"
          fill="#48cae4" opacity="0.85"/>
    <line x1="17" y1="9" x2="16" y2="12" stroke="#48cae4" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="19" y1="11" x2="18" y2="14" stroke="#48cae4" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="21" y1="9" x2="20" y2="12" stroke="#48cae4" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -15]
});

/* ---- Helper: level progress bar HTML ---- */
function levelBarHTML(pct) {
  const color = pct > 70 ? '#2a9d8f' : pct > 40 ? '#f4a261' : '#e63946';
  return `
    <div class="popup-level-bar">
      <div class="popup-level-bar-label">
        <span>Niveau actuel</span><span style="color:${color};font-weight:700">${pct}%</span>
      </div>
      <div class="popup-level-bar-track">
        <div class="popup-level-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
    </div>`;
}

/* ---- Station monthly chart (inline in popup) ---- */
let popupChartInstance = null;
function renderStationChart(canvasId, monthlyData) {
  if (popupChartInstance) {
    popupChartInstance.destroy();
    popupChartInstance = null;
  }
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
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
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8899aa', font: { size: 9 } }, grid: { display: false } },
        y: { ticks: { color: '#8899aa', font: { size: 9 } }, grid: { color: 'rgba(136,153,170,0.15)' } }
      }
    }
  });
}

/* ======================================
   1. WATERSHEDS
   ====================================== */
const watershedColors = ['#264653', '#2a9d8f', '#457b9d', '#1d3557'];
let watershedLayer;

fetchLayer('watersheds')
  .then(function (result) {
    const data = result.data;
    if (result.source === 'real') console.info('Bassins versants: données réelles');
  return Promise.resolve(data);
  })
  .then(function (data) {
    let idx = 0;
    watershedLayer = L.geoJSON(data, {
      style: function (feature) {
        const color = watershedColors[idx % watershedColors.length];
        idx++;
        return {
          fillColor: color,
          fillOpacity: 0.35,
          color: '#00b4d8',
          weight: 2,
          dashArray: null
        };
      },
      onEachFeature: function (feature, layer) {
        const p = feature.properties;
        layer.bindPopup(function () {
          return `
            <div class="popup-content">
              <h3>🏔️ ${p.name}</h3>
              <table>
                <tr><td>Superficie</td><td>${(p.area_km2 || 0).toLocaleString('fr-FR')} km²</td></tr>
                <tr><td>Oued principal</td><td>${p.main_river || '—'}</td></tr>
                <tr><td>Précip. moy.</td><td>${p.avg_rainfall || '—'} mm/an</td></tr>
                <tr><td>Altitude max</td><td>${p.alt_max || '—'} m</td></tr>
                <tr><td>Provinces</td><td>${p.provinces || '—'}</td></tr>
                <tr><td>Population</td><td>${(p.population || 0).toLocaleString('fr-FR')} hab.</td></tr>
              </table>
            </div>`;
        }, { maxWidth: 280 });

        layer.on('mouseover', function () {
          this.setStyle({ fillOpacity: 0.55, weight: 3 });
        });
        layer.on('mouseout', function () {
          watershedLayer.resetStyle(this);
        });
      }
    });

    window.overlayLayers['Bassins versants'] = watershedLayer;
    notifyLayerReady('Bassins versants');
  })
  .catch(function (err) {
    console.error('Watersheds load failed:', err);
  });

/* ======================================
   2. RIVERS
   ====================================== */
let riversLayer;

fetchLayer('rivers')
  .then(function (result) {
    if (result.source === 'real') console.info('Rivières: données réelles');
    return result.data;
  })
  .then(function (data) {
    riversLayer = L.geoJSON(data, {
      style: function (feature) {
        const order = feature.properties.order || 1;
        return {
          color: '#0077b6',
          weight: order >= 6 ? 4 : order >= 4 ? 2.5 : 1.5,
          opacity: 0.85
        };
      },
      onEachFeature: function (feature, layer) {
        const p = feature.properties;
        layer.bindPopup(function () {
          return `
            <div class="popup-content">
              <h3>🌊 ${p.name}</h3>
              <table>
                <tr><td>Longueur</td><td>${p.length_km || '—'} km</td></tr>
                <tr><td>Débit moyen</td><td>${p.flow_rate || '—'}</td></tr>
                <tr><td>Ordre</td><td>${p.order || '—'} (Strahler)</td></tr>
                <tr><td>Bassin</td><td>${p.basin || '—'}</td></tr>
                <tr><td>Source</td><td>${p.source || '—'}</td></tr>
                <tr><td>Embouchure</td><td>${p.mouth || '—'}</td></tr>
              </table>
            </div>`;
        }, { maxWidth: 260 });

        layer.on('mouseover', function () {
          this.setStyle({ weight: (feature.properties.order || 1) >= 6 ? 6 : 4, opacity: 1 });
        });
        layer.on('mouseout', function () {
          riversLayer.resetStyle(this);
        });
      }
    });

    window.overlayLayers['Oueds / Rivières'] = riversLayer;
    notifyLayerReady('Oueds / Rivières');
  })
  .catch(function (err) {
    console.error('Rivers load failed:', err);
  });

/* ======================================
   3. DAMS
   ====================================== */
let damsLayer;

fetchLayer('dams')
  .then(function (result) {
    if (result.source === 'real') console.info('Barrages: données réelles');
    return result.data;
  })
  .then(function (data) {
    damsLayer = L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: damIcon });
      },
      onEachFeature: function (feature, layer) {
        const p = feature.properties;
        layer.bindPopup(function () {
          return `
            <div class="popup-content">
              <h3>🏗️ ${p.name}</h3>
              <table>
                <tr><td>Capacité</td><td>${(p.capacity_Mm3 || 0).toLocaleString('fr-FR')} Mm³</td></tr>
                <tr><td>Hauteur</td><td>${p.height_m || '—'} m</td></tr>
                <tr><td>Mis en service</td><td>${p.year_built || '—'}</td></tr>
                <tr><td>Oued</td><td>${p.oued || '—'}</td></tr>
                <tr><td>Superficie retenue</td><td>${p.area_ha || '—'} ha</td></tr>
                <tr><td>Usage</td><td>${p.purpose || '—'}</td></tr>
              </table>
              ${levelBarHTML(p.current_level || 0)}
            </div>`;
        }, { maxWidth: 300 });
      }
    });

    window.overlayLayers['Barrages'] = damsLayer;
    notifyLayerReady('Barrages');
  })
  .catch(function (err) {
    console.error('Dams load failed:', err);
  });

/* ======================================
   4. RAIN STATIONS
   ====================================== */
let stationsLayer;
let stationChartCounter = 0;

fetchLayer('rain_stations')
  .then(function (result) {
    if (result.source === 'real') console.info('Stations: données réelles');
    return result.data;
  })
  .then(function (data) {
    stationsLayer = L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: stationIcon });
      },
      onEachFeature: function (feature, layer) {
        const p = feature.properties;
        const chartId = 'station-chart-' + (++stationChartCounter);

        layer.bindPopup(function () {
          return `
            <div class="popup-content" style="min-width:230px">
              <h3>🌧 ${p.name}</h3>
              <table>
                <tr><td>Altitude</td><td>${p.altitude || '—'} m</td></tr>
                <tr><td>Précip. annuelle</td><td>${p.annual_rainfall || '—'} mm</td></tr>
                <tr><td>Dernière lecture</td><td>${p.last_reading || '—'}</td></tr>
                <tr><td>Valeur</td><td>${p.last_value_mm || '—'} mm</td></tr>
                <tr><td>Réseau</td><td>${p.network || '—'}</td></tr>
                <tr><td>Ancienneté</td><td>${p.years_active || '—'} ans</td></tr>
              </table>
              <div style="margin-top:8px;font-size:11px;color:#8899aa;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">
                Précipitations mensuelles (mm)
              </div>
              <div class="popup-chart-wrap">
                <canvas id="${chartId}"></canvas>
              </div>
            </div>`;
        }, { maxWidth: 280 });

        layer.on('popupopen', function () {
          if (p.monthly_data) {
            setTimeout(function () {
              renderStationChart(chartId, p.monthly_data);
            }, 50);
          }
        });

        layer.on('popupclose', function () {
          if (popupChartInstance) {
            popupChartInstance.destroy();
            popupChartInstance = null;
          }
        });
      }
    });

    window.overlayLayers['Stations pluviométriques'] = stationsLayer;
    notifyLayerReady('Stations pluviométriques');
  })
  .catch(function (err) {
    console.error('Stations load failed:', err);
  });

/* ======================================
   5. FLOOD RISK ZONES
   ====================================== */
let floodLayer;

fetchLayer('flood_zones')
  .then(function (result) {
    if (result.source === 'real') console.info('Zones inondation: données DEM réelles');
    return result.data;
  })
  .then(function (data) {
    floodLayer = L.geoJSON(data, {
      style: function (feature) {
        const code = feature.properties.risk_code || 'low';
        const color = riskColor(code);
        return {
          fillColor: color,
          fillOpacity: 0.4,
          color: color,
          weight: 1.5,
          dashArray: code === 'low' ? '6,4' : null
        };
      },
      onEachFeature: function (feature, layer) {
        const p = feature.properties;
        const badgeClass = p.risk_code || 'low';
        const badgeLabel = p.risk_level || '—';

        const measuresHTML = (p.mitigation_measures || []).map(function (m) {
          return '<li>' + m + '</li>';
        }).join('');

        layer.bindPopup(function () {
          return `
            <div class="popup-content">
              <h3>⚠️ ${p.name}</h3>
              <table>
                <tr><td>Niveau de risque</td>
                    <td><span class="risk-badge ${badgeClass}">${badgeLabel}</span></td></tr>
                <tr><td>Superficie</td><td>${p.area_km2 || '—'} km²</td></tr>
                <tr><td>Pop. exposée</td><td>${(p.population_exposed || 0).toLocaleString('fr-FR')} hab.</td></tr>
                <tr><td>Dernière inondation</td><td>${p.last_flood_year || '—'}</td></tr>
                <tr><td>Fréquence</td><td>${p.flood_frequency || '—'}</td></tr>
                <tr><td>Profondeur max</td><td>${p.water_depth_max_m || '—'} m</td></tr>
              </table>
              ${measuresHTML ? `
              <div class="popup-measures">
                <div class="popup-measures-title">Mesures d'atténuation</div>
                <ul>${measuresHTML}</ul>
              </div>` : ''}
            </div>`;
        }, { maxWidth: 300 });

        layer.on('mouseover', function () {
          this.setStyle({ fillOpacity: 0.6, weight: 2.5 });
        });
        layer.on('mouseout', function () {
          floodLayer.resetStyle(this);
        });
      }
    });

    window.overlayLayers['Zones de risque'] = floodLayer;
    notifyLayerReady('Zones de risque');
  })
  .catch(function (err) {
    console.error('Flood zones load failed:', err);
  });

/* ======================================
   6. ADMINISTRATIVE BOUNDARIES
   ====================================== */
let adminLayer;

fetchLayer('admin_boundaries')
  .then(function (result) {
    if (result.source === 'real') console.info('Limites admin: données réelles');
    return result.data;
  })
  .then(function (data) {
    adminLayer = L.geoJSON(data, {
      style: function () {
        return {
          fillColor: 'transparent',
          fillOpacity: 0,
          color: '#e0e0e0',
          weight: 1.5,
          dashArray: '8,4',
          opacity: 0.7
        };
      },
      onEachFeature: function (feature, layer) {
        const p = feature.properties;
        layer.bindPopup(function () {
          return `
            <div class="popup-content">
              <h3>🗂️ ${p.name}</h3>
              <table>
                <tr><td>Type</td><td>${p.type || '—'}</td></tr>
                <tr><td>Population</td><td>${(p.population || 0).toLocaleString('fr-FR')} hab.</td></tr>
                <tr><td>Superficie</td><td>${(p.area_km2 || 0).toLocaleString('fr-FR')} km²</td></tr>
                <tr><td>Densité</td><td>${(p.density || 0).toLocaleString('fr-FR')} hab./km²</td></tr>
              </table>
            </div>`;
        }, { maxWidth: 240 });

        /* Label at centroid */
        const bounds = layer.getBounds();
        const center = bounds.getCenter();
        const label = L.tooltip({
          permanent: true,
          direction: 'center',
          className: 'admin-label'
        }).setContent(p.name);
        layer.bindTooltip(label);
      }
    });

    window.overlayLayers['Limites administratives'] = adminLayer;
    notifyLayerReady('Limites administratives');
  })
  .catch(function (err) {
    console.error('Admin boundaries load failed:', err);
  });

/* ======================================
   Layer-ready notification
   ====================================== */
function notifyLayerReady(name) {
  const event = new CustomEvent('layerReady', { detail: { name: name } });
  document.dispatchEvent(event);
}

/* Add style for admin labels */
(function () {
  const style = document.createElement('style');
  style.textContent = `
    .admin-label {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      color: rgba(224,224,224,0.7) !important;
      font-family: 'Rajdhani', sans-serif !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      letter-spacing: 1px !important;
      text-shadow: 0 0 4px #0d1b2a !important;
    }
    .admin-label::before { display: none !important; }
  `;
  document.head.appendChild(style);
})();
