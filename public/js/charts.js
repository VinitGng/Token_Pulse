// public/js/charts.js
// Chart.js visualizations for LLM spend, token breakdowns, and team attributions

let timelineChart = null;
let teamDonutChart = null;
let modelTokensChart = null;
let featureCostsChart = null;

const THEME_COLORS = [
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#3b82f6', // Blue
  '#ec4899'  // Pink
];

// Initialize and update all dashboard charts
export function updateDashboardCharts(analytics) {
  renderTimelineChart(analytics.time_series || []);
  renderTeamDonutChart(analytics.by_team || []);
  renderModelTokensChart(analytics.by_model || []);
  renderFeatureCostsChart(analytics.by_feature || []);
}

// 1. Timeline Chart (Spend over time)
function renderTimelineChart(timeSeriesData) {
  const ctx = document.getElementById('chart-timeline');
  if (!ctx) return;

  const labels = timeSeriesData.map(d => d.time_label || 'Time');
  const costData = timeSeriesData.map(d => d.total_cost || 0);

  if (timelineChart) {
    timelineChart.destroy();
  }

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.length > 0 ? labels : ['No data'],
      datasets: [{
        label: 'Spend ($ USD)',
        data: costData.length > 0 ? costData : [0],
        borderColor: '#6366f1',
        borderWidth: 2.5,
        backgroundColor: gradient,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#6366f1',
        pointRadius: 3,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#94a3b8',
          bodyColor: '#f8fafc',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => ` Spend: $${Number(ctx.raw).toFixed(5)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#64748b', font: { size: 10, family: 'JetBrains Mono' }, maxRotation: 45 }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: {
            color: '#64748b',
            font: { size: 10, family: 'JetBrains Mono' },
            callback: (v) => `$${Number(v).toFixed(3)}`
          }
        }
      }
    }
  });
}

// 2. Team Donut Chart (Spend share)
function renderTeamDonutChart(byTeamData) {
  const ctx = document.getElementById('chart-team-donut');
  if (!ctx) return;

  const hasData = byTeamData && byTeamData.length > 0 && byTeamData.some(t => (t.total_cost || 0) > 0);
  const labels = hasData ? byTeamData.map(t => t.team) : ['No Spend in Window'];
  const data = hasData ? byTeamData.map(t => t.total_cost) : [1];

  if (teamDonutChart) {
    teamDonutChart.destroy();
  }

  teamDonutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: hasData ? THEME_COLORS.slice(0, Math.max(1, labels.length)) : ['rgba(255, 255, 255, 0.08)'],
        borderColor: '#0f1523',
        borderWidth: 3,
        hoverOffset: hasData ? 6 : 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#94a3b8',
            font: { size: 11, family: 'Inter' },
            boxWidth: 12,
            padding: 10
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => hasData ? ` ${ctx.label}: $${Number(ctx.raw).toFixed(4)}` : ' No spend in this period'
          }
        }
      }
    }
  });
}

// 3. Model Tokens Chart (Stacked Prompt vs Completion)
function renderModelTokensChart(byModelData) {
  const ctx = document.getElementById('chart-model-tokens');
  if (!ctx) return;

  const hasData = byModelData && byModelData.length > 0 && byModelData.some(m => (m.prompt_tokens || 0) > 0 || (m.completion_tokens || 0) > 0);
  const labels = hasData ? byModelData.map(m => m.model) : ['No token activity'];
  const promptTokens = hasData ? byModelData.map(m => m.prompt_tokens) : [0];
  const completionTokens = hasData ? byModelData.map(m => m.completion_tokens) : [0];

  if (modelTokensChart) {
    modelTokensChart.destroy();
  }

  modelTokensChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Prompt Tokens (Input)',
          data: promptTokens,
          backgroundColor: '#06b6d4',
          borderRadius: 4
        },
        {
          label: 'Completion Tokens (Output)',
          data: completionTokens,
          backgroundColor: '#a855f7',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: '#64748b', font: { size: 10, family: 'JetBrains Mono' } }
        },
        y: {
          stacked: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#64748b',
            font: { size: 10, family: 'JetBrains Mono' },
            callback: (v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 10 }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString()} tokens`
          }
        }
      }
    }
  });
}

// 4. Feature Costs Chart (Horizontal bar)
function renderFeatureCostsChart(byFeatureData) {
  const ctx = document.getElementById('chart-feature-costs');
  if (!ctx) return;

  const topFeatures = (byFeatureData || []).slice(0, 8);
  const hasData = topFeatures.length > 0 && topFeatures.some(f => (f.total_cost || 0) > 0);
  const labels = hasData ? topFeatures.map(f => f.feature) : ['No feature spend'];
  const costs = hasData ? topFeatures.map(f => f.total_cost) : [0];

  if (featureCostsChart) {
    featureCostsChart.destroy();
  }

  featureCostsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Cost ($ USD)',
        data: costs,
        backgroundColor: '#10b981',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => ` Spend: $${Number(ctx.raw).toFixed(5)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#64748b',
            font: { size: 10, family: 'JetBrains Mono' },
            callback: (v) => `$${Number(v).toFixed(3)}`
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11, family: 'Inter' } }
        }
      }
    }
  });
}
