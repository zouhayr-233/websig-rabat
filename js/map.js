'use strict';

/* ═══════════════════════════════════════════════════
   FIX 1 — Map init with preferCanvas + immediate tiles
   ═══════════════════════════════════════════════════ */
const map = L.map('map', {
  center: [34.02, -6.83],
  zoom: 9,
  zoomControl: false
});

/* Add OSM tiles IMMEDIATELY — no crossOrigin (OSM doesn't send CORS headers) */
const osmLayer = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }
).addTo(map);

/* Force map to measure its container at 100 / 500 / 1000 ms */
setTimeout(function () { map.invalidateSize(); }, 100);
setTimeout(function () { map.invalidateSize(); }, 500);
setTimeout(function () { map.invalidateSize(); }, 1000);

/* ── Base-layer catalogue (for radio-button switching) ── */
const baseLayers = {
  'OpenStreetMap': osmLayer,
  'Satellite': L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: '&copy; Esri' }
  ),
  'Terrain': L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: '&copy; Esri' }
  ),
  'CartoDB Dark': L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    { maxZoom: 19, subdomains: 'abcd', attribution: '&copy; CARTO' }
  )
};

window.activeBaseLayer = osmLayer;

/* ── Controls ─────────────────────────────────────── */
L.control.zoom({ position: 'topright' }).addTo(map);

L.control.scale({ position: 'bottomleft', maxWidth: 120, metric: true, imperial: false }).addTo(map);

L.control.attribution({ position: 'bottomright', prefix: 'WebSIG RSK — PFE 2025' }).addTo(map);

/* North arrow */
const NorthArrowControl = L.Control.extend({
  options: { position: 'bottomright' },
  onAdd: function () {
    const div = L.DomUtil.create('div', 'leaflet-control-north-arrow leaflet-bar');
    div.innerHTML = '<svg class="north-arrow-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
      + '<polygon points="12,2 15,10 12,8 9,10" fill="#00b4d8"/>'
      + '<polygon points="12,22 15,14 12,16 9,14" fill="#8899aa"/>'
      + '<text x="12" y="13.5" text-anchor="middle" font-size="5" font-family="Rajdhani,sans-serif" font-weight="700" fill="#e0e0e0">N</text>'
      + '</svg>';
    div.title = 'Nord';
    L.DomEvent.disableClickPropagation(div);
    return div;
  }
});
new NorthArrowControl().addTo(map);

/* MiniMap — optional CDN plugin */
try {
  const miniLayer = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    { subdomains: 'abcd', maxZoom: 19 }
  );
  new L.Control.MiniMap(miniLayer, {
    position: 'bottomright', width: 110, height: 80, zoomLevelOffset: -6,
    toggleDisplay: true, minimized: false,
    aimingRectOptions: { color: '#00b4d8', weight: 1, opacity: 0.8, fillOpacity: 0.1 },
    shadowRectOptions: { color: '#00b4d8', weight: 1, opacity: 0, fillOpacity: 0 }
  }).addTo(map);
} catch (e) { console.warn('MiniMap unavailable:', e.message); }

/* ── Coordinates display ───────────────────────────── */
map.on('mousemove', function (e) {
  const lat = document.getElementById('coord-lat');
  const lon = document.getElementById('coord-lon');
  if (lat) lat.textContent = e.latlng.lat.toFixed(5);
  if (lon) lon.textContent = e.latlng.lng.toFixed(5);
});
map.on('mouseout', function () {
  const lat = document.getElementById('coord-lat');
  const lon = document.getElementById('coord-lon');
  if (lat) lat.textContent = '—';
  if (lon) lon.textContent = '—';
});

/* ── Spinner hide ──────────────────────────────────── */
function hideSpinner() {
  const s = document.getElementById('loading-spinner');
  if (!s || s.style.display === 'none') return;
  s.style.transition = 'opacity 0.5s';
  s.style.opacity = '0';
  setTimeout(function () { s.style.display = 'none'; }, 500);
}
osmLayer.on('load', function () { setTimeout(hideSpinner, 300); });
window.addEventListener('load', function () { setTimeout(hideSpinner, 2000); });
setTimeout(hideSpinner, 5000);

/* ── Export PNG ────────────────────────────────────── */
function exportMapPNG() {
  const btn = document.getElementById('btn-export-png');
  if (btn) { btn.classList.add('active'); btn.querySelector('.btn-label').textContent = 'Export...'; }
  html2canvas(document.getElementById('map'), { useCORS: true, allowTaint: false, scale: 1, logging: false })
    .then(function (canvas) {
      const a = document.createElement('a');
      a.download = 'websig-rsk-carte.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    })
    .catch(function (err) { console.warn('PNG export failed:', err); })
    .finally(function () {
      if (btn) { btn.classList.remove('active'); btn.querySelector('.btn-label').textContent = 'Export PNG'; }
    });
}
window.exportMapPNG = exportMapPNG;

/* ── Geocoder ──────────────────────────────────────── */
function searchLocation(query) {
  if (!query || query.trim().length < 2) return;
  const resultsDiv = document.getElementById('search-results');
  if (resultsDiv) resultsDiv.innerHTML = '<div class="search-result-item">Recherche...</div>';
  fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query) + '&countrycodes=ma&limit=5',
    { headers: { 'Accept-Language': 'fr' } })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!resultsDiv) return;
      resultsDiv.innerHTML = '';
      if (!data.length) {
        resultsDiv.innerHTML = '<div class="search-result-item" style="color:var(--text-dim)">Aucun résultat.</div>';
        return;
      }
      data.forEach(function (item) {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.textContent = item.display_name;
        div.addEventListener('click', function () {
          map.setView([parseFloat(item.lat), parseFloat(item.lon)], 12, { animate: true });
          if (window._searchMarker) map.removeLayer(window._searchMarker);
          window._searchMarker = L.marker([parseFloat(item.lat), parseFloat(item.lon)])
            .addTo(map)
            .bindPopup('<div class="popup-content"><h3>&#x1F4CD; R\xe9sultat</h3><p style="font-size:12px">' + item.display_name + '</p></div>')
            .openPopup();
          resultsDiv.innerHTML = '';
        });
        resultsDiv.appendChild(div);
      });
    })
    .catch(function () {
      if (resultsDiv) resultsDiv.innerHTML = '<div class="search-result-item" style="color:var(--text-dim)">Erreur connexion.</div>';
    });
}
window.searchLocation = searchLocation;

/* ── Base-layer switch ─────────────────────────────── */
function switchBaseLayer(name) {
  if (!baseLayers[name]) return;
  if (window.activeBaseLayer) map.removeLayer(window.activeBaseLayer);
  baseLayers[name].addTo(map);
  baseLayers[name].bringToBack();
  window.activeBaseLayer = baseLayers[name];
}
window.switchBaseLayer = switchBaseLayer;

/* ── Fullscreen ────────────────────────────────────── */
function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen).call(el);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen).call(document);
  }
}
window.toggleFullscreen = toggleFullscreen;

/* ── Globals ───────────────────────────────────────── */
window.map = map;
window.baseLayers = baseLayers;
