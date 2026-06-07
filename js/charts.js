/* ===================================================
   WebSIG RSK — charts.js
   All Chart.js visualisations (dark theme)
   =================================================== */

'use strict';

document.addEventListener('DOMContentLoaded', function () {

  /* ----- Global Chart.js defaults (light professional theme) ----- */
  Chart.defaults.color = '#546e7a';
  Chart.defaults.borderColor = 'rgba(21,101,192,0.12)';
  Chart.defaults.font.family = "'Source Sans Pro', sans-serif";
  Chart.defaults.font.size = 11;

  const lightPlugin = {
    id: 'lightBg',
    beforeDraw: function (chart) {
      const ctx = chart.canvas.getContext('2d');
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, chart.canvas.width, chart.canvas.height);
      ctx.restore();
    }
  };

  Chart.register(lightPlugin);

  /* ======================================================
     TAB 1 — STATISTIQUES
     ====================================================== */

  /* --- Doughnut: Flood risk distribution --- */
  const riskPieCtx = document.getElementById('riskPieChart');
  if (riskPieCtx) {
    new Chart(riskPieCtx, {
      type: 'doughnut',
      data: {
        labels: ['Risque élevé', 'Risque moyen', 'Risque faible'],
        datasets: [{
          data: [2451, 308, 618],
          backgroundColor: ['#c62828', '#e65100', '#2e7d32'],
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ' ' + ctx.label + ': ' + ctx.parsed.toLocaleString('fr-FR') + ' km²';
              }
            }
          }
        }
      }
    });
  }

  /* --- Horizontal bar: Dam capacities (real data) --- */
  const damLevelCtx = document.getElementById('damLevelChart');
  if (damLevelCtx) {
    const capacities = [773, 510, 266, 11, 3, 1.3, 1, 0.9, 0.7, 0.2];
    const damNames   = ['O. El Makhazine','Ouljet Es Soltane','El Kansera',
                        'Sidi Yahya','Rouidat Amont','Aïn Koreima',
                        'Bouknadil','Had Laghoualem','Arid','Aït Lambrabtiya'];
    new Chart(damLevelCtx, {
      type: 'bar',
      data: {
        labels: damNames,
        datasets: [{
          label: 'Capacité (Mm³)',
          data: capacities,
          backgroundColor: capacities.map(function (v) {
            return v >= 100 ? 'rgba(42,157,143,0.75)'
              : v >= 10  ? 'rgba(69,123,157,0.75)'
              : 'rgba(136,153,170,0.55)';
          }),
          borderColor: capacities.map(function (v) {
            return v >= 100 ? '#2a9d8f' : v >= 10 ? '#457b9d' : '#8899aa';
          }),
          borderWidth: 1,
          borderRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) { return ' ' + ctx.parsed.x + ' Mm³'; }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#8899aa', callback: function (v) { return v + ' Mm³'; } },
            grid: { color: 'rgba(136,153,170,0.15)' }
          },
          y: {
            ticks: { color: '#546e7a', font: { size: 10 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  /* --- Polar area: Watershed areas (real data from SHAPE_Area) --- */
  const watershedCtx = document.getElementById('watershedChart');
  if (watershedCtx) {
    new Chart(watershedCtx, {
      type: 'polarArea',
      data: {
        labels: ['Sebou', 'Côtiers Atlantiques', 'Bouregreg', 'Loukous', 'Drader Souier'],
        datasets: [{
          data: [37670, 10118, 10050, 3735, 1669],
          backgroundColor: [
            'rgba(42,157,143,0.75)',
            'rgba(38,70,83,0.75)',
            'rgba(69,123,157,0.75)',
            'rgba(29,53,87,0.75)',
            'rgba(168,218,220,0.75)'
          ],
          borderColor: ['#2a9d8f', '#264653', '#457b9d', '#1d3557', '#a8dadc'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#8899aa',
              font: { size: 10 },
              boxWidth: 12,
              padding: 8
            }
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ' ' + ctx.label + ': ' + ctx.parsed.r.toLocaleString('fr-FR') + ' km²';
              }
            }
          }
        },
        scales: {
          r: {
            ticks: { display: false },
            grid: { color: 'rgba(136,153,170,0.15)' }
          }
        }
      }
    });
  }

  /* ======================================================
     TAB 2 — PRÉCIPITATIONS
     ====================================================== */

  /* --- Bar chart: Monthly averages for RSK region --- */
  const monthlyRainCtx = document.getElementById('monthlyRainChart');
  if (monthlyRainCtx) {
    const monthlyData = [65, 58, 52, 38, 22, 8, 2, 4, 18, 42, 68, 72];
    new Chart(monthlyRainCtx, {
      type: 'bar',
      data: {
        labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
                 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
        datasets: [{
          label: 'Précipitation moyenne (mm)',
          data: monthlyData,
          backgroundColor: monthlyData.map(function (v) {
            return v > 40 ? '#00b4d8' : v > 15 ? '#48cae4' : '#caf0f8';
          }),
          borderColor: monthlyData.map(function (v) {
            return v > 40 ? '#0096c7' : v > 15 ? '#00b4d8' : '#90e0ef';
          }),
          borderWidth: 1,
          borderRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) { return ' ' + ctx.parsed.y + ' mm'; }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#8899aa' },
            grid: { display: false }
          },
          y: {
            ticks: {
              color: '#8899aa',
              callback: function (v) { return v + ' mm'; }
            },
            grid: { color: 'rgba(136,153,170,0.15)' }
          }
        }
      }
    });
  }

  /* --- Line chart: Annual rainfall series 2000–2023 --- */
  const annualRainCtx = document.getElementById('annualRainChart');
  if (annualRainCtx) {
    const years = [];
    for (let y = 2000; y <= 2023; y++) years.push(y.toString());

    /* Realistic interannual variability for RSK */
    const annualData = [
      432, 518, 391, 612, 478, 543,
      389, 502, 461, 678, 354, 598,
      512, 445, 623, 387, 542, 495,
      618, 372, 534, 481, 557, 420
    ];

    /* 5-year moving average */
    const movAvg = annualData.map(function (_, i, arr) {
      if (i < 2 || i > arr.length - 3) return null;
      return Math.round((arr[i - 2] + arr[i - 1] + arr[i] + arr[i + 1] + arr[i + 2]) / 5);
    });

    new Chart(annualRainCtx, {
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
            pointRadius: 3,
            pointBackgroundColor: '#00b4d8',
            pointHoverRadius: 5,
            fill: true,
            tension: 0.3
          },
          {
            label: 'Moy. mobile 5 ans',
            data: movAvg,
            borderColor: '#f4a261',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 3],
            pointRadius: 0,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#8899aa', font: { size: 10 }, boxWidth: 16, padding: 8 }
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                if (ctx.parsed.y === null) return '';
                return ' ' + ctx.dataset.label + ': ' + ctx.parsed.y + ' mm';
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#8899aa', maxRotation: 45 },
            grid: { color: 'rgba(136,153,170,0.1)' }
          },
          y: {
            ticks: {
              color: '#8899aa',
              callback: function (v) { return v + ' mm'; }
            },
            grid: { color: 'rgba(136,153,170,0.15)' }
          }
        }
      }
    });
  }

}); /* end DOMContentLoaded */
