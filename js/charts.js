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

  /* Annual rain chart doesn't depend on GeoJSON — render immediately */
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

  /* 4 classes matching GIS image: very_high=red high=orange moderate=yellow low=green */
  var labels  = ['Tres eleve', 'Eleve', 'Modere', 'Faible'];
  var colors  = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a'];
  var riskData = [0, 2451, 308, 618];

  if (data && data.floodZones) {
    var totals = { very_high: 0, high: 0, moderate: 0, low: 0 };
    data.floodZones.features.forEach(function (f) {
      var code = (f.properties.risk_code || 'low').toLowerCase();
      if (code === 'very_high') totals.very_high += (+f.properties.area_km2 || 0);
      else if (code === 'high') totals.high += (+f.properties.area_km2 || 0);
      else if (code === 'moderate' || code === 'medium') totals.moderate += (+f.properties.area_km2 || 0);
      else totals.low += (+f.properties.area_km2 || 0);
    });
    riskData = [Math.round(totals.very_high), Math.round(totals.high), Math.round(totals.moderate), Math.round(totals.low)];
    var rl = document.getElementById('risk-legend-inline');
    if (rl) {
      var clrs = ['#dc2626','#ea580c','#ca8a04','#16a34a'];
      var lbsl = ['Très élevé', 'Élevé', 'Modéré', 'Faible'];
      rl.innerHTML = riskData.map(function(v,i){
        return v > 0 ? '<span class="risk-dot" style="background:'+clrs[i]+'"></span> '+lbsl[i]+' : '+v.toLocaleString('fr-FR')+' km²' : '';
      }).filter(Boolean).join('&ensp;');
    }
    var fl = {labels:[],colors:[],data:[]};
    riskData.forEach(function(v,i){ if(v>0){fl.labels.push(labels[i]);fl.colors.push(colors[i]);fl.data.push(v);} });
    labels = fl.labels; colors = fl.colors; riskData = fl.data;
  }

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{ data: riskData, backgroundColor: colors, borderColor: '#ffffff', borderWidth: 3, hoverOffset: 8 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (c) { return ' ' + c.label + ' : ' + c.parsed.toLocaleString('fr-FR') + ' km²'; } }}
      }
    }
  });
}
function renderDamChart(data) {
  var ctx = document.getElementById('damLevelChart');
  if (!ctx) return;

  /* Fallback static */
  var caps  = [773, 510, 266, 11, 3, 1.3, 1, 0.9, 0.7, 0.2];
  var names = ['O. El Makhazine','Ouljet Es Soltane','El Kansera',
               'Sidi Yahya','Rouidat Amont','Aïn Koreima',
               'Bouknadil','Had Laghoualem','Arid','Aït Lambrabtiya'];

  if (data && data.dams) {
    var pairs = data.dams.features.map(function (f) {
      return { name: f.properties.BARRAGE || '?', cap: _damCap(f.properties) };
    });
    pairs.sort(function (a, b) { return b.cap - a.cap; });
    names = pairs.map(function (p) { return p.name; });
    caps  = pairs.map(function (p) { return p.cap; });
  }

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: names,
      datasets: [{
        label: 'Capacité (Mm³)',
        data: caps,
        backgroundColor: caps.map(function (v) {
          return v >= 100 ? 'rgba(42,157,143,0.75)' : v >= 10 ? 'rgba(69,123,157,0.75)' : 'rgba(136,153,170,0.55)';
        }),
        borderColor: caps.map(function (v) {
          return v >= 100 ? '#2a9d8f' : v >= 10 ? '#457b9d' : '#8899aa';
        }),
        borderWidth: 1, borderRadius: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (c) { return ' ' + c.parsed.x + ' Mm³'; } }}
      },
      scales: {
        x: { ticks: { color: '#8899aa', callback: function (v) { return v + ' Mm³'; } }, grid: { color: 'rgba(136,153,170,0.15)' } },
        y: { ticks: { color: '#546e7a', font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

/* ══════════════════════════════════════════════════
   3. POLAR AREA — Watershed areas
   ══════════════════════════════════════════════════ */
function renderWatershedChart(data) {
  var ctx = document.getElementById('watershedChart');
  if (!ctx) return;

  var labels = ['Sebou', 'Côtiers Atlantiques', 'Bouregreg', 'Loukous', 'Drader Souier'];
  var areas  = [37670, 10118, 10050, 3735, 1669]; /* static fallback */

  if (data && data.watersheds) {
    var pairs = data.watersheds.features.map(function (f) {
      var p    = f.properties;
      var name = p.NomSousBas || p.name || '?';
      var km2  = Math.round((p.SHAPE_Area || p.Shape_Area || 0) * _KM2_PER_DEG2);
      return { name: name, km2: km2 };
    });
    pairs.sort(function (a, b) { return b.km2 - a.km2; });
    labels = pairs.map(function (p) { return p.name; });
    areas  = pairs.map(function (p) { return p.km2; });
  }

  var colors  = ['rgba(42,157,143,0.75)','rgba(38,70,83,0.75)','rgba(69,123,157,0.75)','rgba(29,53,87,0.75)','rgba(168,218,220,0.75)','rgba(78,205,196,0.75)'];
  var borders = ['#2a9d8f','#264653','#457b9d','#1d3557','#a8dadc','#4ecdc4'];

  new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels: labels,
      datasets: [{
        data: areas,
        backgroundColor: colors.slice(0, areas.length),
        borderColor: borders.slice(0, areas.length),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8899aa', font: { size: 10 }, boxWidth: 12, padding: 8 } },
        tooltip: { callbacks: { label: function (c) { return ' ' + c.label + ' : ' + c.parsed.r.toLocaleString('fr-FR') + ' km²'; } }}
      },
      scales: { r: { ticks: { display: false }, grid: { color: 'rgba(136,153,170,0.15)' } } }
    }
  });
}

/* ══════════════════════════════════════════════════
   4. BAR — Monthly avg rain (average across stations)
   ══════════════════════════════════════════════════ */
function renderMonthlyRain(data) {
  var ctx = document.getElementById('monthlyRainChart');
  if (!ctx) return;

  var monthly = [65, 58, 52, 38, 22, 8, 2, 4, 18, 42, 68, 72]; /* fallback */

  if (data && data.stations && data.stations.features.length) {
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
   5. LINE — Annual rainfall series 2000–2023 (fixed DMN series)
   ══════════════════════════════════════════════════ */
function renderAnnualRain() {
  var ctx = document.getElementById('annualRainChart');
  if (!ctx) return;

  var years = [];
  for (var y = 2000; y <= 2023; y++) years.push(String(y));

  var annualData = [432,518,391,612,478,543,389,502,461,678,354,598,512,445,623,387,542,495,618,372,534,481,557,420];

  var movAvg = annualData.map(function (_, i, a) {
    if (i < 2 || i > a.length - 3) return null;
    return Math.round((a[i-2]+a[i-1]+a[i]+a[i+1]+a[i+2]) / 5);
  });

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        { label: 'Précipitation annuelle (mm)', data: annualData,
          borderColor: '#00b4d8', backgroundColor: 'rgba(0,180,216,0.08)',
          borderWidth: 1.5, pointRadius: 3, pointBackgroundColor: '#00b4d8',
          pointHoverRadius: 5, fill: true, tension: 0.3 },
        { label: 'Moy. mobile 5 ans', data: movAvg,
          borderColor: '#f4a261', backgroundColor: 'transparent',
          borderWidth: 2, borderDash: [5,3], pointRadius: 0, tension: 0.4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8899aa', font: { size: 10 }, boxWidth: 16, padding: 8 } },
        tooltip: { callbacks: { label: function (c) {
          if (c.parsed.y === null) return '';
          return ' ' + c.dataset.label + ' : ' + c.parsed.y + ' mm';
        }}}
      },
      scales: {
        x: { ticks: { color: '#8899aa', maxRotation: 45 }, grid: { color: 'rgba(136,153,170,0.1)' } },
        y: { ticks: { color: '#8899aa', callback: function (v) { return v + ' mm'; } }, grid: { color: 'rgba(136,153,170,0.15)' } }
      }
    }
  });
}
