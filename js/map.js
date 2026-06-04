/* ===================================================
   WebSIG RSK — map.js
   Leaflet map initialisation, base layers, controls
   =================================================== */

'use strict';

/* --- Map init --- */
const map = L.map('map', {
  center: [34.02, -6.83],
  zoom: 9,
  zoomControl: false,
  attributionControl: false
});

/* --- Base layers --- */
const baseLayers = {
  'OpenStreetMap': L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  ),
  'Satellite': L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 19,
      attribution: '© Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS'
    }
  ),
  'Terrain': L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 19,
      attribution: '© Esri, HERE, DeLorme, MapmyIndia, © OpenStreetMap contributors'
    }
  ),
  'CartoDB Dark': L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'
    }
  )
};

/* Add default base layer */
baseLayers['OpenStreetMap'].addTo(map);

/* BUG 2 — force map to recalculate its container size after DOM settles */
setTimeout(function () { map.invalidateSize(); }, 500);

/* Active base layer reference (used by controls) */
window.activeBaseLayer = baseLayers['OpenStreetMap'];

/* --- Zoom control (top-right) --- */
L.control.zoom({ position: 'topright' }).addTo(map);

/* --- Scale bar (bottom-left) --- */
L.control.scale({
  position: 'bottomleft',
  maxWidth: 120,
  metric: true,
  imperial: false
}).addTo(map);

/* --- Attribution (bottom-right, custom) --- */
L.control.attribution({
  position: 'bottomright',
  prefix: 'WebSIG RSK — PFE 2025'
}).addTo(map);

/* --- North arrow control (bottom-right) --- */
const NorthArrowControl = L.Control.extend({
  options: { position: 'bottomright' },
  onAdd: function () {
    const div = L.DomUtil.create('div', 'leaflet-control-north-arrow leaflet-bar');
    div.innerHTML = `
      <svg class="north-arrow-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <polygon points="12,2 15,10 12,8 9,10" fill="#00b4d8"/>
        <polygon points="12,22 15,14 12,16 9,14" fill="#8899aa"/>
        <text x="12" y="13.5" text-anchor="middle" font-size="5"
              font-family="Rajdhani,sans-serif" font-weight="700" fill="#e0e0e0">N</text>
      </svg>`;
    div.title = 'Nord géographique';
    L.DomEvent.disableClickPropagation(div);
    return div;
  }
});

new NorthArrowControl().addTo(map);

/* --- MiniMap (bottom-right) --- */
const miniMapLayer = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  { subdomains: 'abcd', maxZoom: 19 }
);

const miniMap = new L.Control.MiniMap(miniMapLayer, {
  position: 'bottomright',
  width: 110,
  height: 80,
  zoomLevelOffset: -6,
  toggleDisplay: true,
  minimized: false,
  aimingRectOptions: { color: '#00b4d8', weight: 1, opacity: 0.8, fillOpacity: 0.1 },
  shadowRectOptions: { color: '#00b4d8', weight: 1, opacity: 0, fillOpacity: 0 }
}).addTo(map);

/* --- Mouse coordinates (updates on mousemove) --- */
map.on('mousemove', function (e) {
  const latEl = document.getElementById('coord-lat');
  const lonEl = document.getElementById('coord-lon');
  if (latEl) latEl.textContent = e.latlng.lat.toFixed(5);
  if (lonEl) lonEl.textContent = e.latlng.lng.toFixed(5);
});

map.on('mouseout', function () {
  const latEl = document.getElementById('coord-lat');
  const lonEl = document.getElementById('coord-lon');
  if (latEl) latEl.textContent = '—';
  if (lonEl) lonEl.textContent = '—';
});

/* --- BUG 4 — Loading spinner: reliable hide on window load + tile load --- */
function hideSpinner() {
  const spinner = document.getElementById('loading-spinner');
  if (!spinner || spinner.style.display === 'none') return;
  spinner.style.transition = 'opacity 0.5s';
  spinner.style.opacity = '0';
  setTimeout(function () {
    spinner.style.display = 'none';
  }, 500);
}

/* Primary: hide 2 s after everything (scripts, images, tiles) is loaded */
window.addEventListener('load', function () {
  setTimeout(hideSpinner, 2000);
});

/* Secondary: hide as soon as the first tile layer finishes painting */
baseLayers['OpenStreetMap'].on('load', function () {
  setTimeout(hideSpinner, 400);
});

/* Hard fallback: hide after 5 s no matter what */
setTimeout(hideSpinner, 5000);

/* --- Export PNG (html2canvas) --- */
function exportMapPNG() {
  const btn = document.getElementById('btn-export-png');
  if (btn) {
    btn.classList.add('active');
    btn.querySelector('.btn-label').textContent = 'Export...';
  }

  html2canvas(document.getElementById('map'), {
    useCORS: true,
    allowTaint: false,
    scale: 1,
    logging: false
  }).then(function (canvas) {
    const link = document.createElement('a');
    link.download = 'websig-rsk-carte.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }).catch(function (err) {
    console.warn('Export PNG failed:', err);
    alert('Export impossible (images tiles cross-origin). Essayez en mode fichier local.');
  }).finally(function () {
    if (btn) {
      btn.classList.remove('active');
      btn.querySelector('.btn-label').textContent = 'Export PNG';
    }
  });
}

window.exportMapPNG = exportMapPNG;

/* --- Nominatim geocoder search --- */
function searchLocation(query) {
  if (!query || query.trim().length < 2) return;

  const resultsDiv = document.getElementById('search-results');
  if (resultsDiv) {
    resultsDiv.innerHTML = '<div class="search-result-item">🔍 Recherche en cours...</div>';
  }

  const url = 'https://nominatim.openstreetmap.org/search?format=json&q='
    + encodeURIComponent(query)
    + '&countrycodes=ma&limit=5&addressdetails=1';

  fetch(url, { headers: { 'Accept-Language': 'fr' } })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!resultsDiv) return;

      if (data.length === 0) {
        resultsDiv.innerHTML = '<div class="search-result-item" style="color:var(--text-dim)">Aucun résultat trouvé.</div>';
        return;
      }

      resultsDiv.innerHTML = '';
      data.forEach(function (item) {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.textContent = item.display_name;
        div.addEventListener('click', function () {
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          map.setView([lat, lon], 12, { animate: true });

          /* Remove any previous search marker */
          if (window._searchMarker) {
            map.removeLayer(window._searchMarker);
          }
          window._searchMarker = L.marker([lat, lon])
            .addTo(map)
            .bindPopup('<div class="popup-content"><h3>📍 Résultat</h3><p style="font-size:12px;color:var(--text-primary)">'
              + item.display_name + '</p></div>')
            .openPopup();

          resultsDiv.innerHTML = '';
        });
        resultsDiv.appendChild(div);
      });
    })
    .catch(function (err) {
      console.warn('Geocoder error:', err);
      if (resultsDiv) {
        resultsDiv.innerHTML = '<div class="search-result-item" style="color:var(--text-dim)">Erreur de connexion.</div>';
      }
    });
}

window.searchLocation = searchLocation;

/* --- Base layer switching (called from controls.js) --- */
function switchBaseLayer(name) {
  if (!baseLayers[name]) return;
  if (window.activeBaseLayer) {
    map.removeLayer(window.activeBaseLayer);
  }
  baseLayers[name].addTo(map);
  baseLayers[name].bringToBack();
  window.activeBaseLayer = baseLayers[name];
}

window.switchBaseLayer = switchBaseLayer;

/* --- Fullscreen toggle --- */
function toggleFullscreen() {
  const el = document.getElementById('app-container') || document.documentElement;
  if (!document.fullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen).call(el);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen).call(document);
  }
}

window.toggleFullscreen = toggleFullscreen;

/* Expose map globally so other modules can use it */
window.map = map;
window.baseLayers = baseLayers;
