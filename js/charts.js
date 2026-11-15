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

  /* Statistiques de référence (rapport) : indépendantes des couches */
  loadStatistiques().then(function (stats) {
    renderStatCards(stats);
    renderRiskPie(stats);
    renderDamChart(stats);
  });

  /* Wait for GeoJSON layers to finish loading */
  document.addEventListener('appDataReady', function () {
    renderWatershedChart(window.appData);
    renderAquiferChart(window.appData);
    renderMonthlyRain(window.appData);
    renderStationsTable(window.appData);
  });

  /* Safety fallback: render with static values if data never arrives */
  setTimeout(function () {
    if (!window.appData || !window.appData.dams) {
      renderWatershedChart(null);
      renderAquiferChart(null);
      renderMonthlyRain(null);
      renderStationsTable(null);
    }
  }, 7000);
});

/* ── Geo area helper (degrees² → km²) ──────────── */
var _KM2_PER_DEG2 = 111.1 * 111.1 * Math.cos(34 * Math.PI / 180); /* ≈ 10 229 km²/deg² at lat 34° */

/* ══════════════════════════════════════════════════
   STATISTIQUES DE RÉFÉRENCE — json/statistiques.json
   Chiffres du rapport (superficies calculées sur le raster classé,
   indicateurs synthétiques). Rien n'est recalculé dans le navigateur.
   ══════════════════════════════════════════════════ */
var _statsPromise = null;
function loadStatistiques() {
  if (!_statsPromise) {
    _statsPromise = fetch('json/statistiques.json?v=20261115')
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function (e) { console.warn('[charts] statistiques.json:', e.message); return null; });
  }
  return _statsPromise;
}

function _fmtInt(v) { return (v == null) ? 'n.d.' : (+v).toLocaleString('fr-FR'); }
function _fmtPct(v) {
  return (v == null) ? 'n.d.' : (+v).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
}

/* Indicateurs synthétiques en haut de l'onglet */
function renderStatCards(stats) {
  var ind = (stats && stats.indicateurs) || {};
  var map = {
    'stat-dams':     ind.barrages,
    'stat-capacity': ind.capacite_totale_mm3,
    'stat-rivers':   ind.reseau_hydrographique_km,
    'stat-stations': ind.stations_pluviometriques
  };
  Object.keys(map).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.textContent = _fmtInt(map[id]);
  });
}

/* ══════════════════════════════════════════════════
   1. HORIZONTAL BAR — Susceptibilité aux inondations (modèle GTB)
   Ordre : très faible (en haut) vers très élevée, couleurs des classes
   de la carte. Libellé de fin de barre toujours visible, même pour les
   petites classes.
   ══════════════════════════════════════════════════ */
function renderRiskPie(stats) {
  var ctx = document.getElementById('riskBarChart');
  if (!ctx) return;

  var susc = stats && stats.susceptibilite;
  var classes = (susc && Array.isArray(susc.classes)) ? susc.classes.slice().sort(function (a, b) { return a.classe - b.classe; }) : [];
  if (!classes.length) {
    ctx.replaceWith(Object.assign(document.createElement('p'), {
      className: 'legend-empty', textContent: 'Données indisponibles (n.d.) — json/statistiques.json'
    }));
    return;
  }

  var labels = classes.map(function (c) { return c.libelle; });
  var colors = classes.map(function (c) { return c.couleur; });
  var areas  = classes.map(function (c) { return c.superficie_km2; });
  var pcts   = classes.map(function (c) { return c.part_pct; });

  /* Légende sous le graphique + phrase de synthèse */
  var rl = document.getElementById('risk-legend-inline');
  if (rl) {
    rl.innerHTML = classes.map(function (c) {
      return '<span class="risk-item"><span class="risk-dot" style="background:' + c.couleur + '"></span> '
        + c.libelle + ' : ' + _fmtInt(c.superficie_km2) + ' km² (' + _fmtPct(c.part_pct) + ')</span>';
    }).join(' ')
      + '<span class="risk-item">Total classé : ' + _fmtInt(susc.classe_km2) + ' km²</span>';
  }
  var hi = susc.elevee_ou_tres_elevee || {};
  var sent = document.getElementById('risk-summary');
  if (sent) {
    sent.textContent = 'Susceptibilité élevée ou très élevée : ' + _fmtInt(hi.superficie_km2)
      + ' km², soit ' + _fmtPct(hi.part_pct) + ' de la région.';
  }

  var endLabelPlugin = {
    id: 'riskBarLabels',
    afterDatasetsDraw: function (chart) {
      var c = chart.ctx;
      var meta = chart.getDatasetMeta(0);
      meta.data.forEach(function (bar, i) {
        var lbl = _fmtInt(areas[i]) + ' km² (' + _fmtPct(pcts[i]) + ')';
        c.save();
        c.font = 'bold 11px "Source Sans Pro",sans-serif';
        c.textBaseline = 'middle';
        c.textAlign = 'left';
        c.fillStyle = '#334155';
        c.fillText(lbl, Math.max(bar.x, chart.chartArea.left) + 6, bar.y);
        c.restore();
      });
    }
  };

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ data: areas, backgroundColor: colors, borderWidth: 0, borderRadius: 4, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      layout: { padding: { right: 118 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (c) {
          return ' ' + c.label + ' : ' + _fmtInt(c.parsed.x) + ' km² (' + _fmtPct(pcts[c.dataIndex]) + ')';
        }}}
      },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 10 },
                      callback: function (v) { return v.toLocaleString('fr-FR') + ' km²'; } },
             grid: { color: 'rgba(100,116,139,0.1)' }, border: { display: false } },
        y: { ticks: { color: '#334155', font: { size: 11, weight: '600' } },
             grid: { display: false }, border: { display: false } }
      }
    },
    plugins: [endLabelPlugin]
  });
}
/* ══════════════════════════════════════════════════
   2. BARRES — Capacité des barrages par agence de bassin (Mm³)
   Liste de référence des onze ouvrages du rapport (json/statistiques.json),
   y compris Koudiat Bourna qui n'est pas encore cartographié.
   ══════════════════════════════════════════════════ */
function renderDamChart(stats) {
  var ctx = document.getElementById('damLevelChart');
  if (!ctx) return;

  var b = stats && stats.barrages;
  var ouvrages = (b && Array.isArray(b.ouvrages)) ? b.ouvrages : [];
  if (!ouvrages.length) {
    ctx.replaceWith(Object.assign(document.createElement('p'), {
      className: 'legend-empty', textContent: 'Données indisponibles (n.d.) — json/statistiques.json'
    }));
    return;
  }

  /* Somme par agence, dans l'ordre de la liste des agences */
  var order = (b.agences || []).map(function (a) { return a.sigle; });
  var totals = {};
  ouvrages.forEach(function (o) {
    if (order.indexOf(o.agence) === -1) order.push(o.agence);
    totals[o.agence] = (totals[o.agence] || 0) + (+o.capacite_mm3 || 0);
  });
  var counts = {};
  ouvrages.forEach(function (o) { counts[o.agence] = (counts[o.agence] || 0) + 1; });
  var names = order;
  var caps  = order.map(function (a) { return totals[a]; });
  var blues = ['#1e40af', '#3b82f6', '#93c5fd'];

  /* Inline plugin: draw capacity values at the end of each bar */
  var barLabelPlugin = {
    id: 'barLabels',
    afterDatasetsDraw: function (chart) {
      var c = chart.ctx;
      var meta = chart.getDatasetMeta(0);
      meta.data.forEach(function (bar, i) {
        c.save();
        c.font = 'bold 10px "Source Sans Pro",sans-serif';
        c.textBaseline = 'middle';
        c.textAlign = 'left';
        c.fillStyle = '#334155';
        c.fillText(_fmtInt(caps[i]) + ' Mm³', Math.max(bar.x, chart.chartArea.left) + 5, bar.y);
        c.restore();
      });
    }
  };

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: names,
      datasets: [{ label: 'Capacité (Mm³)', data: caps, backgroundColor: blues, borderWidth: 0, borderRadius: 6, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      layout: { padding: { right: 70 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (c) {
          var a = names[c.dataIndex];
          return '  ' + _fmtInt(c.parsed.x) + ' Mm³ (' + counts[a] + ' ouvrage' + (counts[a] > 1 ? 's' : '') + ')';
        }}}
      },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 10 }, callback: function (v) { return _fmtInt(v) + ' Mm³'; } },
             grid: { color: 'rgba(100,116,139,0.1)' }, border: { display: false } },
        y: { ticks: { color: '#334155', font: { size: 11, weight: '600' } }, grid: { display: false }, border: { display: false } }
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

/* ══════════════════════════════════════════════════
   NAPPES SOUTERRAINES — surface par nappe (données réelles
   aquifers.geojson, champ AREA_KM2). 6e graphique du tableau de
   bord, demandé en complément des 5 graphiques existants.
   ══════════════════════════════════════════════════ */
function renderAquiferChart(data) {
  var ctx = document.getElementById('aquiferChart');
  if (!ctx) return;

  var labels = [], areas = [];
  if (data && data.aquifers) {
    var pairs = data.aquifers.features.map(function (f) {
      var p = f.properties || {};
      return { name: p.NOM_NAPPE || p.Nom_Nappe || '?', km2: +p.AREA_KM2 || 0 };
    }).sort(function (a, b) { return b.km2 - a.km2; });
    labels = pairs.map(function (p) { return p.name; });
    areas  = pairs.map(function (p) { return p.km2; });
  }

  if (!labels.length) {
    /* Pas de donnée reelle disponible : on l'affiche honnetement, sans
       inventer de chiffres de repli. */
    ctx.replaceWith(Object.assign(document.createElement('p'), {
      className: 'legend-empty', textContent: 'Données indisponibles (n.d.)'
    }));
    return;
  }

  var greens = ['#084c8d','#0d5b9e','#0c6e84','#0b6b50','#3d6b10','#3a3daa','#6a2090'];

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ label: 'Superficie (km²)', data: areas, backgroundColor: greens, borderWidth: 0, borderRadius: 6, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (c) { return '  ' + c.parsed.x.toLocaleString('fr-FR') + ' km²'; } } }
      },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 10 }, callback: function (v) { return v.toLocaleString('fr-FR') + ' km²'; } },
             grid: { color: 'rgba(100,116,139,0.1)' }, border: { display: false } },
        y: { ticks: { color: '#334155', font: { size: 10, weight: '600' } }, grid: { display: false }, border: { display: false } }
      }
    }
  });
}

/* ══════════════════════════════════════════════════
   TABLE — Précipitations par station (donnees reelles
   rain_stations_real.geojson), remplace l'ancien tableau code en dur
   dont les valeurs ne correspondaient pas au fichier source.
   ══════════════════════════════════════════════════ */
function renderStationsTable(data) {
  var tbody = document.getElementById('stations-table-body');
  if (!tbody) return;

  if (!data || !data.stations || !data.stations.features.length) {
    tbody.innerHTML = '<tr><td colspan="4">Données indisponibles (n.d.)</td></tr>';
    return;
  }

  tbody.innerHTML = data.stations.features.map(function (f) {
    var p = f.properties || {};
    var annual = (p.annual_rainfall != null) ? Math.round(p.annual_rainfall).toLocaleString('fr-FR') : 'n.d.';
    var alt    = (p.altitude != null) ? p.altitude : 'n.d.';
    return '<tr><td>' + (p.name || p.city || '—') + '</td><td>' + alt + '</td><td>' + annual + '</td><td>' + (p.network || 'n.d.') + '</td></tr>';
  }).join('');
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