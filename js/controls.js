/* ===================================================
   WebSIG RSK — controls.js
   UI interactions: checkboxes, tabs, sidebar, toolbar,
   measure tools, legend, modal, fullscreen
   =================================================== */

'use strict';

/* ---- Wait for DOM + layers ---- */
document.addEventListener('DOMContentLoaded', function () {

  /* ==================================================
     BASE LAYER RADIO BUTTONS
     ================================================== */
  document.querySelectorAll('input[name="base-layer"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (window.switchBaseLayer) {
        window.switchBaseLayer(this.value);
      }
    });
  });

  /* ==================================================
     OVERLAY LAYER CHECKBOXES
     ================================================== */
  document.querySelectorAll('.layer-checkbox').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const name = this.dataset.layer;
      const layers = window.overlayLayers || {};

      if (!layers[name]) {
        /* Layer not yet loaded — queue the toggle */
        document.addEventListener('layerReady', function handler(e) {
          if (e.detail.name === name) {
            document.removeEventListener('layerReady', handler);
            if (cb.checked) {
              window.map.addLayer(layers[name]);
            }
            updateLegend();
          }
        });
        return;
      }

      if (this.checked) {
        window.map.addLayer(layers[name]);
      } else {
        window.map.removeLayer(layers[name]);
      }
      updateLegend();
    });
  });

  /* ==================================================
     ZOOM-TO-LAYER BUTTONS
     ================================================== */
  document.querySelectorAll('.layer-zoom-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      const name = this.dataset.layer;
      const layers = window.overlayLayers || {};
      if (layers[name] && layers[name].getBounds) {
        try {
          const bounds = layers[name].getBounds();
          if (bounds.isValid()) {
            window.map.fitBounds(bounds, { padding: [30, 30], animate: true });
          }
        } catch (err) {
          console.warn('fitBounds failed for', name);
        }
      }
    });
  });

  /* ==================================================
     COLLAPSIBLE LAYER GROUPS
     ================================================== */
  document.querySelectorAll('.layer-group-header').forEach(function (header) {
    header.addEventListener('click', function () {
      const group = this.closest('.layer-group');
      if (group) group.classList.toggle('collapsed');
    });
  });

  /* ==================================================
     SIDEBAR COLLAPSE TOGGLE
     ================================================== */
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', function () {
      sidebar.classList.toggle('collapsed');
      this.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
      setTimeout(function () { window.map.invalidateSize(); }, 320);
    });
  }

  /* ==================================================
     RIGHT PANEL COLLAPSE TOGGLE
     ================================================== */
  const rightToggle = document.getElementById('right-panel-toggle');
  const rightPanel = document.getElementById('right-panel');

  if (rightToggle && rightPanel) {
    rightToggle.addEventListener('click', function () {
      rightPanel.classList.toggle('collapsed');
      this.textContent = rightPanel.classList.contains('collapsed') ? '◀' : '▶';
      setTimeout(function () { window.map.invalidateSize(); }, 320);
    });
  }

  /* ==================================================
     RIGHT PANEL TAB SWITCHING
     ================================================== */
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const tabId = 'tab-' + this.dataset.tab;

      document.querySelectorAll('.tab-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      document.querySelectorAll('.tab-content').forEach(function (c) {
        c.classList.remove('active');
      });

      this.classList.add('active');
      const tabEl = document.getElementById(tabId);
      if (tabEl) tabEl.classList.add('active');
    });
  });

  /* ==================================================
     SEARCH BAR
     ================================================== */
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');

  if (searchInput) {
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        if (window.searchLocation) window.searchLocation(this.value.trim());
      }
      if (e.key === 'Escape') {
        const resultsDiv = document.getElementById('search-results');
        if (resultsDiv) resultsDiv.innerHTML = '';
      }
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', function () {
      if (searchInput && window.searchLocation) {
        window.searchLocation(searchInput.value.trim());
      }
    });
  }

  /* Close results when clicking outside */
  document.addEventListener('click', function (e) {
    const searchSection = document.querySelector('.search-section');
    if (searchSection && !searchSection.contains(e.target)) {
      const resultsDiv = document.getElementById('search-results');
      if (resultsDiv) resultsDiv.innerHTML = '';
    }
  });

  /* ==================================================
     TOOLBAR BUTTONS
     ================================================== */
  const btnExport = document.getElementById('btn-export-png');
  if (btnExport) {
    btnExport.addEventListener('click', function () {
      if (window.exportMapPNG) window.exportMapPNG();
    });
  }

  const btnFullscreen = document.getElementById('btn-fullscreen');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', function () {
      if (window.toggleFullscreen) window.toggleFullscreen();
    });
    document.addEventListener('fullscreenchange', function () {
      const isFS = !!document.fullscreenElement;
      btnFullscreen.querySelector('.btn-label').textContent = isFS ? 'Quitter' : 'Plein écran';
      btnFullscreen.querySelector('.btn-icon').textContent = isFS ? '⛶' : '⛶';
    });
  }

  const btnInfo = document.getElementById('btn-info');
  if (btnInfo) {
    btnInfo.addEventListener('click', function () {
      openInfoModal();
    });
  }

  /* ==================================================
     MEASURE TOOLS (Leaflet.draw)
     ================================================== */
  const measureGroup = new L.FeatureGroup().addTo(window.map);
  let measureMode = null;
  let currentDrawHandler = null;

  const drawOptions = {
    distance: {
      polyline: {
        shapeOptions: { color: '#00b4d8', weight: 2, dashArray: '5,5' },
        showLength: true,
        metric: true,
        feet: false
      }
    },
    area: {
      polygon: {
        shapeOptions: { color: '#f4a261', weight: 2, fillOpacity: 0.15 },
        showArea: true,
        metric: true
      }
    }
  };

  function startMeasure(mode) {
    stopMeasure();
    measureMode = mode;

    const btn = mode === 'distance'
      ? document.getElementById('btn-measure-distance')
      : document.getElementById('btn-measure-area');
    if (btn) btn.classList.add('active');

    const clearBtn = document.getElementById('btn-clear-measure');
    if (clearBtn) clearBtn.style.display = 'flex';

    if (mode === 'distance') {
      currentDrawHandler = new L.Draw.Polyline(window.map, drawOptions.distance.polyline);
    } else {
      currentDrawHandler = new L.Draw.Polygon(window.map, drawOptions.area.polygon);
    }
    currentDrawHandler.enable();
    window.map.getContainer().style.cursor = 'crosshair';
  }

  function stopMeasure() {
    if (currentDrawHandler) {
      currentDrawHandler.disable();
      currentDrawHandler = null;
    }
    measureMode = null;
    window.map.getContainer().style.cursor = '';
    document.querySelectorAll('#btn-measure-distance, #btn-measure-area').forEach(function (b) {
      b.classList.remove('active');
    });
  }

  function clearMeasures() {
    stopMeasure();
    measureGroup.clearLayers();
    const resultDiv = document.getElementById('measure-result');
    if (resultDiv) resultDiv.style.display = 'none';
    const clearBtn = document.getElementById('btn-clear-measure');
    if (clearBtn) clearBtn.style.display = 'none';
  }

  const btnDist = document.getElementById('btn-measure-distance');
  if (btnDist) {
    btnDist.addEventListener('click', function () {
      if (measureMode === 'distance') {
        stopMeasure();
      } else {
        startMeasure('distance');
      }
    });
  }

  const btnArea = document.getElementById('btn-measure-area');
  if (btnArea) {
    btnArea.addEventListener('click', function () {
      if (measureMode === 'area') {
        stopMeasure();
      } else {
        startMeasure('area');
      }
    });
  }

  const btnClear = document.getElementById('btn-clear-measure');
  if (btnClear) {
    btnClear.addEventListener('click', clearMeasures);
  }

  /* Handle draw:created */
  window.map.on('draw:created', function (e) {
    measureGroup.addLayer(e.layer);
    stopMeasure();

    let resultText = '';
    if (e.layerType === 'polyline') {
      let totalMeters = 0;
      const latlngs = e.layer.getLatLngs();
      for (let i = 1; i < latlngs.length; i++) {
        totalMeters += latlngs[i - 1].distanceTo(latlngs[i]);
      }
      if (totalMeters >= 1000) {
        resultText = '📏 Distance : ' + (totalMeters / 1000).toFixed(3) + ' km';
      } else {
        resultText = '📏 Distance : ' + Math.round(totalMeters) + ' m';
      }
    } else if (e.layerType === 'polygon') {
      const area = L.GeometryUtil.geodesicArea(e.layer.getLatLngs()[0]);
      if (area >= 1000000) {
        resultText = '⬡ Superficie : ' + (area / 1000000).toFixed(4) + ' km²';
      } else {
        resultText = '⬡ Superficie : ' + Math.round(area) + ' m²';
      }
    }

    if (resultText) {
      const resultDiv = document.getElementById('measure-result');
      if (resultDiv) {
        resultDiv.textContent = resultText;
        resultDiv.style.display = 'block';
        setTimeout(function () {
          if (resultDiv) resultDiv.style.display = 'none';
        }, 8000);
      }
    }
  });

  /* ==================================================
     INFO MODAL
     ================================================== */
  function openInfoModal() {
    const modal = document.getElementById('info-modal');
    if (modal) modal.style.display = 'flex';
  }

  function closeInfoModal() {
    const modal = document.getElementById('info-modal');
    if (modal) modal.style.display = 'none';
  }

  const modalOverlay = document.getElementById('info-modal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function (e) {
      if (e.target === this) closeInfoModal();
    });
  }

  const modalClose = document.getElementById('modal-close-btn');
  if (modalClose) modalClose.addEventListener('click', closeInfoModal);

  const modalOk = document.getElementById('modal-ok-btn');
  if (modalOk) modalOk.addEventListener('click', closeInfoModal);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeInfoModal();
  });

  /* ==================================================
     MOBILE HAMBURGER MENU
     ================================================== */
  const mobileMenu = document.getElementById('btn-mobile-menu');
  if (mobileMenu && sidebar) {
    mobileMenu.addEventListener('click', function () {
      sidebar.classList.toggle('collapsed');
    });
  }

  /* ==================================================
     DYNAMIC LEGEND
     ================================================== */
  window.updateLegend = updateLegend;

  function updateLegend() {
    const container = document.getElementById('legend-content');
    if (!container) return;

    const activeCheckboxes = Array.from(
      document.querySelectorAll('.layer-checkbox:checked')
    ).map(function (cb) { return cb.dataset.layer; });

    if (activeCheckboxes.length === 0) {
      container.innerHTML = '<p class="legend-empty">Activez une couche pour voir sa légende.</p>';
      return;
    }

    let html = '';

    if (activeCheckboxes.includes('Bassins versants')) {
      html += buildLegendGroup('Bassins versants', [
        { color: '#264653', border: '#00b4d8', label: 'Bassin du Bou Regreg' },
        { color: '#2a9d8f', border: '#00b4d8', label: 'Bassin du Sebou' },
        { color: '#457b9d', border: '#00b4d8', label: 'Bassin côtier Nord' },
        { color: '#1d3557', border: '#00b4d8', label: 'Bassin côtier Sud' }
      ], 'polygon');
    }

    if (activeCheckboxes.includes('Oueds / Rivières')) {
      html += buildLegendGroup('Oueds / Rivières', [
        { color: '#0077b6', height: 4, label: 'Oued principal (ordre ≥ 6)' },
        { color: '#0096c7', height: 2.5, label: 'Oued secondaire (ordre 3–5)' },
        { color: '#00b4d8', height: 1.5, label: 'Cours d\'eau mineur (ordre 1–2)' }
      ], 'line');
    }

    if (activeCheckboxes.includes('Barrages')) {
      html += buildLegendGroup('Barrages', [
        { icon: '🏗️', label: 'Barrage / retenue' }
      ], 'icon');
    }

    if (activeCheckboxes.includes('Stations pluviométriques')) {
      html += buildLegendGroup('Stations pluviométriques', [
        { icon: '🌧', label: 'Station pluviométrique' }
      ], 'icon');
    }

    if (activeCheckboxes.includes('Zones de risque')) {
      html += buildLegendGroup('Risque d\'inondation', [
        { color: '#e63946', label: 'Risque élevé' },
        { color: '#f4a261', label: 'Risque moyen' },
        { color: '#2a9d8f', label: 'Risque faible' }
      ], 'polygon');
    }

    if (activeCheckboxes.includes('Limites administratives')) {
      html += buildLegendGroup('Limites administratives', [
        { color: '#e0e0e0', border: '#e0e0e0', dashed: true, label: 'Limite de province/préfecture' }
      ], 'line');
    }

    container.innerHTML = html || '<p class="legend-empty">Activez une couche pour voir sa légende.</p>';
  }

  function buildLegendGroup(title, items, type) {
    let inner = '';
    items.forEach(function (item) {
      if (type === 'polygon') {
        const borderColor = item.border || item.color;
        inner += `<div class="legend-item">
          <span class="legend-color" style="background:${item.color};border:2px solid ${borderColor};opacity:0.75"></span>
          <span>${item.label}</span>
        </div>`;
      } else if (type === 'line') {
        const h = item.height || 2;
        const dash = item.dashed ? 'border-top: ' + h + 'px dashed ' + item.color : 'background:' + item.color + ';height:' + h + 'px';
        inner += `<div class="legend-item">
          <span class="legend-line" style="${dash}"></span>
          <span>${item.label}</span>
        </div>`;
      } else if (type === 'icon') {
        inner += `<div class="legend-item">
          <span style="font-size:16px;line-height:1">${item.icon}</span>
          <span>${item.label}</span>
        </div>`;
      }
    });

    return `<div class="legend-group">
      <div class="legend-group-title">${title}</div>
      ${inner}
    </div>`;
  }

  /* Listen for layer ready events to auto-update legend */
  document.addEventListener('layerReady', function () {
    updateLegend();
  });

  /* ==================================================
     TABLE SORTING (precipitation tab)
     ================================================== */
  document.querySelectorAll('.data-table th').forEach(function (th, index) {
    th.addEventListener('click', function () {
      const table = this.closest('table');
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      let asc = !this.dataset.asc;
      this.dataset.asc = asc ? '1' : '';

      rows.sort(function (a, b) {
        const aVal = a.querySelectorAll('td')[index].textContent.trim();
        const bVal = b.querySelectorAll('td')[index].textContent.trim();
        const aNum = parseFloat(aVal.replace(/\s/g, '').replace(',', '.'));
        const bNum = parseFloat(bVal.replace(/\s/g, '').replace(',', '.'));

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return asc ? aNum - bNum : bNum - aNum;
        }
        return asc ? aVal.localeCompare(bVal, 'fr') : bVal.localeCompare(aVal, 'fr');
      });

      rows.forEach(function (row) { tbody.appendChild(row); });

      document.querySelectorAll('.data-table th').forEach(function (t) {
        t.style.color = '';
      });
      th.style.color = 'var(--accent-water)';
    });
  });

}); /* end DOMContentLoaded */
