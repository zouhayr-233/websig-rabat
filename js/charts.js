/* ===================================================
   WebSIG RSK — charts.js
   All Chart.js visualisations (dark theme)
   =================================================== */

'use strict';

document.addEventListener('DOMContentLoaded', function () {

  /* ----- Global Chart.js defaults (dark theme) ----- */
  Chart.defaults.color = '#e0e0e0';
  Chart.defaults.borderColor = 'rgba(27,45,66,0.8)';
  Chart.defaults.font.family = "'Source Sans Pro', sans-serif";
  Chart.defaults.font.size = 11;

  const darkPlugin = {
    id: 'darkBg',
    beforeDraw: function (chart) {
      const ctx = chart.canvas.getContext('2d');
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#162032';
      ctx.fillRect(0, 0, chart.canvas.width, chart.canvas.height);
      ctx.restore();
    }
  };

  Chart.register(darkPlugin);

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
          data: [245, 890, 1340],
          backgroundColor: ['#e63946', '#f4a261', '#2a9d8f'],
          borderColor: '#162032',
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

  /* --- Horizontal bar: Dam fill levels --- */
  const damLevelCtx = document.getElementById('damLevelChart');
  if (damLevelCtx) {
    const levels = [78, 62, 85];
    new Chart(damLevelCtx, {
      type: 'bar',
      data: {
        labels: ['SMBA', 'Sidi Châhed', 'Al Wahda'],
        datasets: [{
          label: 'Niveau (%)',
          data: levels,
          backgroundColor: levels.map(function (v) {
            return v >= 70 ? 'rgba(42,157,143,0.75)'
              : v >= 40 ? 'rgba(244,162,97,0.75)'
              : 'rgba(230,57,70,0.75)';
          }),
          borderColor: levels.map(function (v) {
            return v >= 70 ? '#2a9d8f' : v >= 40 ? '#f4a261' : '#e63946';
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
              label: function (ctx) { return ' ' + ctx.parsed.x + '%'; }
            }
          }
        },
        scales: {
          x: {
            min: 0,
            max: 100,
            ticks: { color: '#8899aa', callback: function (v) { return v + '%'; } },
            grid: { color: 'rgba(136,153,170,0.15)' }
          },
          y: {
            ticks: { color: '#e0e0e0' },
            grid: { display: false }
          }
        }
      }
    });
  }

  /* --- Polar area: Watershed areas --- */
  const watershedCtx = document.getElementById('watershedChart');
  if (watershedCtx) {
    new Chart(watershedCtx, {
      type: 'polarArea',
      data: {
        labels: ['Bou Regreg', 'Sebou', 'Côtier Nord', 'Côtier Sud'],
        datasets: [{
          data: [6000, 40000, 1200, 800],
          backgroundColor: [
            'rgba(38,70,83,0.75)',
            'rgba(42,157,143,0.75)',
            'rgba(69,123,157,0.75)',
            'rgba(29,53,87,0.75)'
          ],
          borderColor: ['#264653', '#2a9d8f', '#457b9d', '#1d3557'],
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
