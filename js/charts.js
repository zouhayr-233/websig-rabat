/* ===================================================
   WebSIG RSK — charts.js
   Data-driven: charts built from real GeoJSON via appDataReady event.
   Falls back to static values if data fails to load.
   =================================================== */

'use strict';

/* ── Chart.js global defaults ───────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  Chart.defaults.color = '#546e7a';
  Chart.defaults.borderColor = 'rgba(21,101,192,0.12)';
  Chart.defaults.font.family = "'Source Sans Pro', sans-serif";
  Chart.defaults.font.size = 11;

  Chart.register({
    id: 'lightBg',
    beforeDraw: function (chart) {
      var ctx = chart.canvas.getContext('2d');
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, chart.canvas.width, chart.canvas.height);
      ctx.restore();
    }
  });

  /* Annual rain chart: fetch real data from precip_report.json */
  renderAnnualRain();

  /* Wait for GeoJSON layers to finish loading */
  document.addEventListener('appDataReady', function () {
    renderRiskPie(window.appData);
    renderDamChart(window.appData);
    renderWatershedChart(window.appData);
    renderMonthlyRain(window.appData);
  });

  /* Safety fallback: render with static values if data never arrives */
  setTimeout(function () {
    if (!window.appData || !window.appData.dams) {
      renderRiskPie(null);
      renderDamChart(null);
      renderWatershedChart(null);
      renderMonthlyRain(null);
    }
  }, 7000);
});

/* ── Helper: Dam capacity field name varies ─────── */
function _damCap(props) {
  for (var k in props) { if (k.toLowerCase().includes('apacit')) return +props[k] || 0; }
  return 0;
}

/* ── Geo area helper (degrees² → km²) ──────────── */
var _KM2_PER_DEG2 = 111.1 * 111.1 * Math.cos(34 * Math.PI / 180); /* ≈ 10 229 km²/deg² at lat 34° */

/* ══════════════════════════════════════════════════
   1. DOUGHNUT — Flood risk distribution
   ══════════════════════════════════════════════════ */
function renderRiskPie(data) {
  var ctx = document.getElementById('riskPieChart');
  if (!ctx) return;

  var labels  = ['Très élevé', 'Élevé', 'Modéré', 'Faible'];
  var colors  = ['#ef4444', '#f97316', '#fde047', '#4ade80'];
  var areas   = [206, 2060, 2679, 4398]; /* real DEM areas — updated dynamically */

  if (data && data.floodZones) {
    var totals = { very_high: 0, high: 0, moderate: 0, medium: 0, low: 0 };
    data.floodZones.features.forEach(function (f) {
      if (f.properties.background) return; /* skip RSK background feature */
      var code = (f.properties.risk_code || 'low').toLowerCase();
      var area = +f.properties.area_km2 || 0;
      if (code === 'very_high')                        totals.very_high += area;
      else if (code === 'high')                        totals.high     += area;
      else if (code === 'moderate' || code === 'medium') totals.moderate += area;
      else                                             totals.low      += area;
    });
    areas = [
      Math.round(totals.very_high),
      Math.round(totals.high),
      Math.round(totals.moderate),
      Math.round(totals.low)
    ];
  }

  /* Update inline legend */
  var rl = document.getElementById('risk-legend-inline');
  if (rl) {
    rl.innerHTML = labels.map(function(lbl, i) {
      return areas[i] > 0
        ? '<span class="risk-dot" style="background:' + colors[i] + '"></span> '
          + lbl + ' : ' + areas[i].toLocaleString('fr-FR') + ' km²'
        : '';
    }).filter(Boolean).join('&ensp;');
  }

  /* Filter zero slices */
  var fl = { labels: [], colors: [], data: [] };
  areas.forEach(function (v, i) {
    if (v > 0) { fl.labels.push(labels[i]); fl.colors.push(colors[i]); fl.data.push(v); }
  });

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: fl.labels,
      datasets: [{ data: fl.data, backgroundColor: fl.colors,
                   borderColor: '#ffffff', borderWidth: 3, hoverOffset: 8 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (c) {
          return ' ' + c.label + ' : ' + c.parsed.toLocaleString('fr-FR') + ' km²';
        }}}
      }
    }
  });
}
function renderDamChart(data) {
  var ctx = document.getElementById('damLevelChart');
  if (!ctx) return;

  var MAJOR = [
    { name: 'O. El Makhazine', cap: 773 },
    { name: 'Ouljet Es Soltane', cap: 510 },
    { name: 'El Kansera',       cap: 266 },
    { name: 'Sidi Yahya',       cap: 11  },
    { name: 'Rouidat Amont',    cap: 3   }
  ];

  if (data && data.dams) {
    var pairs = data.dams.features.map(function (f) {
      return { name: f.properties.BARRAGE || '?', cap: _damCap(f.properties) };
    }).sort(function (a, b) { return b.cap - a.cap; });
    MAJOR = pairs.slice(0, 5);
  }

  var names = MAJOR.map(function (d) { return d.name; });
  var caps  = MAJOR.map(function (d) { return d.cap; });
  var blues = ['#1e40af','#2563eb','#3b82f6','#60a5fa','#93c5fd'];

  /* Inline plugin: draw capacity values at the end of each bar */
  var barLabelPlugin = {
    id: 'barLabels',
    afterDatasetsDraw: function (chart) {
      var ctx = chart.ctx;
      var meta = chart.getDatasetMeta(0);
      var dataset = chart.data.datasets[0];
      meta.data.forEach(function (bar, i) {
        var val = dataset.data[i];
        if (!val) return;
        var lbl = val >= 1 ? Math.round(val).toLocaleString('fr-FR') + ' Mm³' : val.toFixed(1) + ' Mm³';
        ctx.save();
        ctx.font = 'bold 9px "Source Sans Pro",sans-serif';
        ctx.textBaseline = 'middle';
        /* place label right of bar tip; if bar is too short, still show after */
        var xPos = Math.max(bar.x, chart.chartArea.left) + 5;
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'left';
        ctx.fillText(lbl, xPos, bar.y);
        ctx.restore();
      });
    }
  };

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: names,
      datasets: [{
        label: 'Capacité (Mm³)',
        data: caps,
        backgroundColor: blues,
        borderWidth: 0,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      layout: { padding: { right: 60 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (c) { return '  ' + c.parsed.x.toLocaleString('fr-FR') + ' Mm³'; } }}
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { size: 10 },
                   callback: function (v) { return v + ' Mm³'; } },
          grid: { color: 'rgba(100,116,139,0.1)' },
          border: { display: false }
        },
        y: {
          ticks: { color: '#334155', font: { size: 10, weight: '600' } },
          grid: { display: false },
          border: { display: false }
        }
      }
    },
    plugins: [barLabelPlugin]
  });
}
function renderWatershedChart(data) {
  var ctx = document.getElementById('watershedChart');
  if (!ctx) return;

  var labels = ['Sebou', 'Côtiers Atl.', 'Bouregreg', 'Loukous', 'Drader Souier'];
  var areas  = [37670, 10118, 10050, 3735, 1669];

  if (data && data.watersheds) {
    var pairs = data.watersheds.features.map(function (f) {
      var p   = f.properties;
      var km2 = Math.round((p.SHAPE_Area || p.Shape_Area || 0) * _KM2_PER_DEG2);
      return { name: p.NomSousBas || p.name || '?', km2: km2 };
    }).sort(function (a, b) { return b.km2 - a.km2; });
    labels = pairs.map(function (p) { return p.name; });
    areas  = pairs.map(function (p) { return p.km2; });
  }

  var blues = ['#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd'];

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Superficie (km²)',
        data: areas,
        backgroundColor: blues,
        borderWidth: 0,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (c) {
          return '  ' + c.parsed.x.toLocaleString('fr-FR') + ' km²';
        }}}
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { size: 10 },
                   callback: function (v) { return (v/1000).toFixed(0)+'k km²'; } },
          grid: { color: 'rgba(100,116,139,0.1)' },
          border: { display: false }
        },
        y: {
          ticks: { color: '#334155', font: { size: 10, weight: '600' } },
          grid: { display: false },
          border: { display: false }
        }
      }
    }
  });
}
async function renderMonthlyRain(data) {
  var ctx = document.getElementById('monthlyRainChart');
  if (!ctx) return;

  var monthly = [65, 58, 52, 38, 22, 8, 2, 4, 18, 42, 68, 72]; /* fallback */

  /* Prefer regional means from precip_report.json (12 NASA POWER grid points) */
  var loadedFromReport = false;
  try {
    var res = await fetch('data/precip_report.json');
    if (res.ok) {
      var report = await res.json();
      if (report.monthly_means_mm) {
        var keys = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        monthly = keys.map(function (k) { return Math.round(report.monthly_means_mm[k] || 0); });
        loadedFromReport = true;
      }
    }
  } catch (e) { /* fallback below */ }

  /* Secondary fallback: average station monthly_data */
  if (!loadedFromReport && data && data.stations && data.stations.features.length) {
    var n = data.stations.features.length;
    monthly = new Array(12).fill(0);
    data.stations.features.forEach(function (f) {
      var md = f.properties.monthly_data;
      if (Array.isArray(md)) {
        for (var i = 0; i < 12; i++) monthly[i] += (+md[i] || 0);
      }
    });
    monthly = monthly.map(function (v) { return Math.round(v / n); });
  }

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'],
      datasets: [{
        label: 'Précipitation moyenne (mm)',
        data: monthly,
        backgroundColor: monthly.map(function (v) { return v > 40 ? '#00b4d8' : v > 15 ? '#48cae4' : '#caf0f8'; }),
        borderColor:     monthly.map(function (v) { return v > 40 ? '#0096c7' : v > 15 ? '#00b4d8' : '#90e0ef'; }),
        borderWidth: 1, borderRadius: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (c) { return ' ' + c.parsed.y + ' mm'; } }}
      },
      scales: {
        x: { ticks: { color: '#8899aa' }, grid: { display: false } },
        y: { ticks: { color: '#8899aa', callback: function (v) { return v + ' mm'; } }, grid: { color: 'rgba(136,153,170,0.15)' } }
      }
    }
  });
}

/* ══════════════════════════════════════════════════
   5. LINE — Annual rainfall series 2000–2025 (NASA POWER real data)
   ══════════════════════════════════════════════════ */
async function renderAnnualRain() {
  var ctx = document.getElementById('annualRainChart');
  if (!ctx) return;

  var years = [];
  for (var y = 2000; y <= 2025; y++) years.push(String(y));

  /* Fallback static series (approximate) */
  var annualData = [510,399,615,625,474,329,535,437,716,775,1033,689,558,601,642,324,605,363,990,319,542,473,370,264,388,null];

  /* Load real regional means from precip_report.json */
  try {
    var res = await fetch('data/precip_report.json');
    if (res.ok) {
      var report = await res.json();
      if (report.annual_series && report.annual_series.length) {
        var yearMap = {};
        report.annual_series.forEach(function (entry) { yearMap[entry.year] = Math.round(entry.mean_mm); });
        annualData = years.map(function (y) { return yearMap[+y] !== undefined ? yearMap[+y] : null; });
      }
    }
  } catch (e) { /* use fallback */ }

  /* 5-year moving average (skip nulls) */
  var movAvg = annualData.map(function (_, i, a) {
    if (i < 2 || i > a.length - 3) return null;
    var vals = [a[i-2], a[i-1], a[i], a[i+1], a[i+2]];
    if (vals.some(function(v){ return v === null; })) return null;
    return Math.round(vals.reduce(function(s,v){ return s+v; }, 0) / 5);
  });

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        {
          label: 'Précipitation annuelle (mm)',
          data: annualData,
          borderColor: '#00b4d8',
          backgroundColor: 'rgba(0,180,216,0.08)',
          borderWidth: 1.5,
          pointRadius: annualData.map(function(v){ return v !== null ? 3 : 0; }),
          pointBackgroundColor: '#00b4d8',
          pointHoverRadius: 5,
          fill: true, tension: 0.3,
          spanGaps: false
        },
        {
          label: 'Moy. mobile 5 ans',
          data: movAvg,
          borderColor: '#f4a261',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5,3],
          pointRadius: 0, tension: 0.4,
          spanGaps: false
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8899aa', font: { size: 10 }, boxWidth: 16, padding: 8 } },
        tooltip: { callbacks: { label: function (c) {
          if (c.parsed.y === null) return ' ' + c.dataset.label + ' : données manquantes';
          return ' ' + c.dataset.label + ' : ' + c.parsed.y + ' mm';
        }}}
      },
      scales: {
        x: { ticks: { color: '#8899aa', maxRotation: 45 }, grid: { color: 'rgba(136,153,170,0.1)' } },
        y: { ticks: { color: '#8899aa', callback: function (v) { return v + ' mm'; } }, grid: { color: 'rgba(136,153,170,0.15)' } }
      }
    }
  });
}