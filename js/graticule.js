'use strict';
/* ===================================================
   WebSIG RSK — graticule.js
   Toggleable coordinate grid + cartographic neatline frame,
   in the style of a printed map layout (QGIS composer).
   ─────────────────────────────────────────────────── */
(function () {
  function niceStep(zoom) {
    if (zoom <= 7)  return 1;
    if (zoom <= 9)  return 0.5;
    if (zoom <= 10) return 0.25;
    if (zoom <= 11) return 0.1;
    return 0.05;
  }

  function formatDMS(deg, isLat) {
    var hemi = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
    var abs = Math.abs(deg);
    var d = Math.floor(abs + 1e-9);
    var m = Math.round((abs - d) * 60);
    if (m === 60) { m = 0; d += 1; }
    return d + '°' + (m ? m + "'" : '') + hemi;
  }

  var overlay, frame, active = false;

  function ensureNodes() {
    if (overlay) return;
    var mapEl = document.getElementById('map');
    frame = document.createElement('div');
    frame.id = 'graticule-frame';
    mapEl.appendChild(frame);
    overlay = document.createElement('div');
    overlay.id = 'graticule-overlay';
    mapEl.appendChild(overlay);
  }

  function redraw() {
    if (!active || !window.map) return;
    ensureNodes();
    var map = window.map;
    var size = map.getSize();
    var w = size.x, h = size.y;
    var bounds = map.getBounds();
    var step = niceStep(map.getZoom());

    var south = bounds.getSouth(), north = bounds.getNorth();
    var west  = bounds.getWest(),  east  = bounds.getEast();
    var midLat = (south + north) / 2, midLon = (west + east) / 2;

    var lonStart = Math.ceil(west / step) * step;
    var latStart = Math.ceil(south / step) * step;
    var html = '';
    var i, lon, lat, x, y;

    for (i = 0, lon = lonStart; lon <= east && i < 40; lon += step, i++) {
      x = map.latLngToContainerPoint([midLat, lon]).x;
      if (x < 0 || x > w) continue;
      var lonLbl = formatDMS(lon, false);
      html += '<div class="grat-line grat-v" style="left:' + x + 'px"></div>'
        + '<div class="grat-tick grat-tick-top" style="left:' + x + 'px"></div>'
        + '<div class="grat-tick grat-tick-bottom" style="left:' + x + 'px"></div>'
        + '<div class="grat-label grat-label-top" style="left:' + x + 'px">' + lonLbl + '</div>'
        + '<div class="grat-label grat-label-bottom" style="left:' + x + 'px">' + lonLbl + '</div>';
    }
    for (i = 0, lat = latStart; lat <= north && i < 40; lat += step, i++) {
      y = map.latLngToContainerPoint([lat, midLon]).y;
      if (y < 0 || y > h) continue;
      var latLbl = formatDMS(lat, true);
      html += '<div class="grat-line grat-h" style="top:' + y + 'px"></div>'
        + '<div class="grat-tick grat-tick-left" style="top:' + y + 'px"></div>'
        + '<div class="grat-tick grat-tick-right" style="top:' + y + 'px"></div>'
        + '<div class="grat-label grat-label-left" style="top:' + y + 'px">' + latLbl + '</div>'
        + '<div class="grat-label grat-label-right" style="top:' + y + 'px">' + latLbl + '</div>';
    }
    overlay.innerHTML = html;
  }

  function setActive(state) {
    active = state;
    ensureNodes();
    document.getElementById('map').classList.toggle('graticule-active', active);
    if (active) redraw();
  }

  function toggle() { setActive(!active); return active; }

  window.WebSIGGraticule = { toggle: toggle, redraw: redraw, isActive: function () { return active; } };

  (function bindMapEvents() {
    if (!window.map) { setTimeout(bindMapEvents, 300); return; }
    window.map.on('moveend zoomend resize', redraw);
  })();
})();
