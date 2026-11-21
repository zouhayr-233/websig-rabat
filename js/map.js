'use strict';
/* ===================================================
   WebSIG RSK — map.js
   Leaflet map, WGS84 data, Web Mercator display (standard)
   =================================================== */

/* Guard: if Leaflet CDN failed to load, abort gracefully */
if (typeof L === 'undefined') {
  console.error('[map] Leaflet not loaded — check CDN.');
  document.getElementById('loading-spinner').style.display = 'none';
  throw new Error('Leaflet missing');
}

/* ── 1. Map init ───────────────────────────────────
   CRS: EPSG:3857 (Web Mercator) for display.
   All GeoJSON data is in WGS84 (EPSG:4326) — Leaflet
   handles the conversion automatically.
   ─────────────────────────────────────────────────── */
const map = L.map('map', {
  center: [34.10, -6.40],
  zoom: 9,
  zoomControl: false
});

/* ── 2. Base layers ────────────────────────────────── */
const osmLayer = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }
);

const satLayer = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19, attribution: '&copy; Esri' }
);

const terrainLayer = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19, attribution: '&copy; Esri' }
);

/* Fond « Nuit » : Esri World Dark Gray Base, sans clé et sans étiquettes.
   (CARTO Dark Matter, utilisé jusqu'ici, renvoie désormais pour toutes ses
   tuiles une image « API KEY REQUIRED ».) Données jusqu'au zoom 16 :
   au-delà, Leaflet agrandit les tuiles du zoom 16. */
const ESRI_DARK_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const ESRI_DARK_ATTR = 'Tuiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; contributeurs OpenStreetMap';
const darkLayer = L.tileLayer(ESRI_DARK_URL, { maxNativeZoom: 16, maxZoom: 20, attribution: ESRI_DARK_ATTR });

/* Add OSM as default */
osmLayer.addTo(map);

const baseLayers = {
  'OpenStreetMap': osmLayer,
  'Satellite':     satLayer,
  'Terrain':       terrainLayer,
  'Nuit':          darkLayer
};

/* Garde-fou : si plus de 6 tuiles d'un fond échouent, message discret
   « Ce fond de carte est momentanément indisponible » (rien d'autre). */
const BASEMAP_ERROR_LIMIT = 6;
Object.keys(baseLayers).forEach(function (name) {
  const lyr = baseLayers[name];
  lyr._tileErrors = 0;
  lyr.on('tileerror', function () {
    lyr._tileErrors++;
    if (lyr._tileErrors > BASEMAP_ERROR_LIMIT && window.activeBaseLayer === lyr) {
      const msg = document.getElementById('basemap-error-msg');
      if (msg) msg.classList.add('visible');
    }
  });
});
window.activeBaseLayer = osmLayer;

/* ── 3. Controls ───────────────────────────────────── */
/* Zoom en haut à gauche : la barre de boutons des panneaux se place juste dessous */
L.control.zoom({ position: 'topleft' }).addTo(map);
L.control.attribution({ position: 'bottomright', prefix: 'WebSIG RSK | PFE 2025' }).addTo(map);

/* Graphic bar scale — classic cartographic style (alternating segments) */
const GraphicScale = L.Control.extend({
  options: { position: 'bottomleft', maxWidth: 130 },
  onAdd: function (map) {
    const div = L.DomUtil.create('div', 'leaflet-control-graphic-scale');
    this._div = div; this._map = map;
    map.on('moveend zoomend resize', this._update, this);
    this._update();
    return div;
  },
  onRemove: function (map) { map.off('moveend zoomend resize', this._update, this); },
  _niceNumber: function (num) {
    const pow10 = Math.pow(10, Math.floor(Math.log(num) / Math.LN10));
    const d = num / pow10;
    const nice = d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1;
    return nice * pow10;
  },
  _update: function () {
    const map = this._map, maxWidth = this.options.maxWidth;
    const y = map.getSize().y / 2;
    const maxMeters = map.distance(
      map.containerPointToLatLng([0, y]),
      map.containerPointToLatLng([maxWidth, y])
    );
    const meters = this._niceNumber(maxMeters);
    const px = Math.round(maxWidth * (meters / maxMeters));
    const half = px % 2 === 0 ? px / 2 : Math.round(px / 2);
    const label = meters >= 1000 ? (meters / 1000) + ' km' : meters + ' m';
    const halfLabel = meters >= 1000 ? (meters / 2000) : (meters / 2);

    this._div.innerHTML =
      '<div class="gscale-bar" style="width:' + px + 'px">'
      + '<span class="gscale-seg dark"  style="width:' + half + 'px"></span>'
      + '<span class="gscale-seg light" style="width:' + (px - half) + 'px"></span>'
      + '</div>'
      + '<div class="gscale-labels" style="width:' + px + 'px">'
      + '<span>0</span><span>' + halfLabel + '</span><span>' + label + '</span>'
      + '</div>';
  }
});
new GraphicScale().addTo(map);

/* North arrow — compass rose badge, top-right (la colonne de gauche porte le zoom et la barre de boutons) */
const NorthArrow = L.Control.extend({
  options: { position: 'topright' },
  onAdd() {
    const d = L.DomUtil.create('div', 'leaflet-control-north-arrow');
    d.innerHTML = '<svg viewBox="0 0 32 32" width="32" height="32" xmlns="http://www.w3.org/2000/svg">'
      + '<circle cx="16" cy="16" r="14.5" fill="#ffffff" stroke="#16213e" stroke-width="1.3"/>'
      + '<circle cx="16" cy="16" r="11.5" fill="none" stroke="#16213e" stroke-width="0.6" opacity="0.5"/>'
      + '<polygon points="16,4 19.5,16 16,13.4 12.5,16" fill="#16213e"/>'
      + '<polygon points="16,28 19.5,16 16,18.6 12.5,16" fill="#aab0bd"/>'
      + '<text x="16" y="9.6" text-anchor="middle" font-size="6.2" font-weight="700" font-family="Arial,sans-serif" fill="#16213e">N</text>'
      + '</svg>';
    L.DomEvent.disableClickPropagation(d);
    return d;
  }
});
try { new NorthArrow().addTo(map); } catch(e) {}

/* MiniMap — optional */
try {
  new L.Control.MiniMap(
    L.tileLayer(ESRI_DARK_URL, { maxNativeZoom: 16, attribution: '' }),
    { position: 'bottomright', width: 110, height: 80, zoomLevelOffset: -6, toggleDisplay: true }
  ).addTo(map);
} catch(e) { console.warn('[map] MiniMap unavailable'); }

/* ── 4. Invalidate size — three passes ────────────── */
setTimeout(function () { map.invalidateSize(); }, 200);
setTimeout(function () { map.invalidateSize(); }, 600);
setTimeout(function () { map.invalidateSize(); }, 1500);
map.whenReady(function () { map.invalidateSize(); });

/* ── 4b. Prevent Leaflet from capturing events on overlaid UI elements ── */
setTimeout(function () {
  var legend = document.getElementById('map-legend-float');
  var title  = document.getElementById('map-region-title');
  [legend, title].forEach(function (el) {
    if (!el) return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    /* Mobile: stop touch events from reaching Leaflet map handlers */
    L.DomEvent.on(el, 'touchstart touchmove touchend', L.DomEvent.stopPropagation);
  });
}, 500);

/* ── 5. Coordinates display ────────────────────────── */
function updateCoordsDisplay(latlng) {
  const la = document.getElementById('coord-lat');
  const lo = document.getElementById('coord-lon');
  if (la) la.textContent = latlng.lat.toFixed(5);
  if (lo) lo.textContent = latlng.lng.toFixed(5);
}
function clearCoordsDisplay() {
  const la = document.getElementById('coord-lat');
  const lo = document.getElementById('coord-lon');
  if (la) la.textContent = '—';
  if (lo) lo.textContent = '—';
}
map.on('mousemove', function (e) { updateCoordsDisplay(e.latlng); });
map.on('mouseout',  clearCoordsDisplay);

/* Touch devices don't fire 'mousemove': read the finger position directly
   from the touch event and convert it to a lat/lon via the map container. */
map.getContainer().addEventListener('touchstart', handleMapTouch, { passive: true });
map.getContainer().addEventListener('touchmove',  handleMapTouch, { passive: true });
function handleMapTouch(ev) {
  if (!ev.touches || !ev.touches.length) return;
  const touch = ev.touches[0]; /* Touch has clientX/clientY, same shape Leaflet expects */
  const point = map.mouseEventToContainerPoint(touch);
  updateCoordsDisplay(map.containerPointToLatLng(point));
}

/* ── 6. Spinner hide ───────────────────────────────── */
function hideSpinner() {
  const s = document.getElementById('loading-spinner');
  if (s) { s.style.opacity = '0'; setTimeout(function () { s.style.display = 'none'; }, 400); }
}
osmLayer.once('load', function () { setTimeout(hideSpinner, 300); });
window.addEventListener('load',     function () { setTimeout(hideSpinner, 1500); });
setTimeout(hideSpinner, 5000);

/* ── 7. Geocoder ───────────────────────────────────── */
/* RSK bounding box for bounded search */
var RSK_BBOX = '33.16,-7.13,35.02,-5.31';

function removeSearchMarker() {
  if (window._sm) { map.removeLayer(window._sm); window._sm = null; }
}
window.removeSearchMarker = removeSearchMarker;

function searchLocation(query) {
  if (!query || query.trim().length < 2) return;
  const div = document.getElementById('search-results');
  if (div) div.innerHTML = '<div class="search-result-item">Recherche...</div>';
  /* bounded=1 + viewbox restrict results to RSK area first, fallback to all Morocco */
  var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=8'
    + '&countrycodes=ma&addressdetails=1'
    + '&viewbox=' + RSK_BBOX + '&bounded=0'
    + '&q=' + encodeURIComponent(query);
  fetch(url, { headers: { 'Accept-Language': 'fr' } })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!div) return;
      div.innerHTML = '';
      if (!data.length) { div.innerHTML = '<div class="search-result-item" style="color:var(--text-dim)">Aucun résultat.</div>'; return; }
      /* Sort: items inside RSK bbox first */
      data.sort(function (a, b) {
        function inRSK(d) { var lat=+d.lat, lon=+d.lon; return lat>=33.16&&lat<=35.02&&lon>=-7.13&&lon<=-5.31; }
        return (inRSK(b)?1:0) - (inRSK(a)?1:0);
      });
      data.forEach(function (item) {
        const el = document.createElement('div');
        el.className = 'search-result-item';
        var addr = item.address || {};
        var shortName = addr.city || addr.town || addr.village || addr.county || item.display_name.split(',')[0];
        var detail = [addr.state, addr.country].filter(Boolean).join(', ');
        el.innerHTML = '<b style="font-size:12px">' + shortName + '</b>'
          + (detail ? '<br><span style="font-size:10px;color:#666">' + detail + '</span>' : '');
        el.onclick = function () {
          map.setView([+item.lat, +item.lon], 14, { animate: true });
          removeSearchMarker();
          var btn = document.createElement('button');
          btn.textContent = '✕ Supprimer cette marque';
          btn.style.cssText = 'margin-top:6px;padding:3px 10px;background:#ef4444;color:white;border:none;border-radius:3px;cursor:pointer;font-size:11px;display:block';
          btn.addEventListener('click', function () { removeSearchMarker(); });
          var content = document.createElement('div');
          content.style.cssText = 'font-size:12px;max-width:260px;word-break:break-word';
          content.textContent = item.display_name;
          content.appendChild(btn);
          window._sm = L.marker([+item.lat, +item.lon])
            .addTo(map)
            .bindPopup(L.popup({ maxWidth: 300 }).setContent(content))
            .openPopup();
          div.innerHTML = '';
        };
        div.appendChild(el);
      });
    }).catch(function () { if (div) div.innerHTML = ''; });
}
window.searchLocation = searchLocation;

/* ── 8. Base-layer switch ──────────────────────────── */
function switchBaseLayer(name) {
  if (!baseLayers[name]) return;
  if (window.activeBaseLayer) map.removeLayer(window.activeBaseLayer);
  /* nouveau fond : on efface le message d'indisponibilité du précédent */
  const msg = document.getElementById('basemap-error-msg');
  if (msg) msg.classList.toggle('visible', baseLayers[name]._tileErrors > BASEMAP_ERROR_LIMIT);
  baseLayers[name].addTo(map);
  baseLayers[name].bringToBack();
  window.activeBaseLayer = baseLayers[name];
}
window.switchBaseLayer = switchBaseLayer;

/* ── 9. Fullscreen ─────────────────────────────────── */
function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || function(){}).call(el);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || function(){}).call(document);
  }
}
window.toggleFullscreen = toggleFullscreen;

/* ── 10. Export PNG ────────────────────────────────── */
function exportMapPNG() {
  if (typeof html2canvas === 'undefined') { alert('html2canvas not loaded'); return; }
  html2canvas(document.getElementById('map'), { useCORS: true, scale: 1 })
    .then(function (c) { const a = document.createElement('a'); a.download = 'websig-rsk.png'; a.href = c.toDataURL(); a.click(); })
    .catch(function (e) { console.warn('Export failed:', e); });
}
window.exportMapPNG = exportMapPNG;

/* ── Globals ───────────────────────────────────────── */
window.map = map;
window.baseLayers = baseLayers;
