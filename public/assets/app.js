let classificationChartInstance = null;
let timelineChartInstance = null;

const state = {
  analyses: [],
  reports: [],
  stats: null,
  selectedAnalysis: null
};

const elements = {
  apiStatus: document.getElementById('apiStatus'),
  metricsGrid: document.getElementById('metricsGrid'),
  classificationChart: document.getElementById('classificationChart'),
  latestAnalyses: document.getElementById('latestAnalyses'),
  riskReasons: document.getElementById('riskReasons'),
  historyTable: document.getElementById('historyTable'),
  historySearch: document.getElementById('historySearch'),
  analysisForm: document.getElementById('analysisForm'),
  resultPanel: document.getElementById('resultPanel'),
  resultEmpty: document.getElementById('resultEmpty'),
  resultContent: document.getElementById('resultContent'),
  reportForm: document.getElementById('reportForm'),
  reportList: document.getElementById('reportList'),
  toast: document.getElementById('toast')
};

const API_BASE =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://SEU-BACKEND.onrender.com';

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Falha na comunicação com a API.');
  }

  return response.json();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value) {
  return new Date(value).toLocaleString('pt-BR');
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 3000);
}

function calculateRiskIndex(analyses) {
  if (!analyses.length) return 0;
  const total = analyses.reduce((sum, a) => sum + Number(a.score || 0), 0);
  const avg = total / analyses.length;
  return Math.round(avg);
}

function buildMetricCards(stats) {
  const riskIndex = calculateRiskIndex(state.analyses);

  const cards = [
    { label: 'Total de análises', value: stats.total, tone: 'bg-primary' },
    { label: 'Confiáveis', value: stats.safe, tone: 'bg-safe' },
    { label: 'Suspeitas', value: stats.suspicious, tone: 'bg-medium' },
    { label: 'Fraudulentas', value: stats.fraudulent, tone: 'bg-high' },
    {
      label: 'Índice de risco',
      value: `${riskIndex}/100`,
      tone: riskIndex <= 30 ? 'bg-safe' : riskIndex <= 60 ? 'bg-medium' : 'bg-high'
    }
  ];

  elements.metricsGrid.innerHTML = cards.map(card => `
    <article class="metric-card">
      <p>${escapeHtml(card.label)}</p>
      <div class="value">${escapeHtml(card.value)}</div>
      <div class="progress-track">
        <div class="progress-bar ${card.tone}" style="width: 100%"></div>
      </div>
    </article>
  `).join('');
}

function renderClassificationChart(analyses = []) {
  const canvas = document.getElementById('classificationChart');
  if (!canvas) return;

  const confiaveis = analyses.filter(item => {
    const classification = String(item.classification || '').toLowerCase();
    return classification === 'confiável' || classification === 'confiavel';
  }).length;

  const suspeitas = analyses.filter(item => {
    const classification = String(item.classification || '').toLowerCase();
    return classification === 'suspeita';
  }).length;

  const fraudulentas = analyses.filter(item => {
    const classification = String(item.classification || '').toLowerCase();
    return (
      classification === 'fraudulenta' ||
      classification === 'potencialmente fraudulenta' ||
      classification === 'alto risco'
    );
  }).length;

  const total = confiaveis + suspeitas + fraudulentas;

  if (classificationChartInstance) {
    classificationChartInstance.destroy();
  }

  const centerTextPlugin = {
    id: 'centerTextPlugin',
    beforeDraw(chart) {
      const { width, height, ctx } = chart;
      ctx.save();

      ctx.font = '700 28px Inter';
      ctx.fillStyle = '#e8eefb';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(total), width / 2, height / 2 - 8);

      ctx.font = '500 12px Inter';
      ctx.fillStyle = '#98a4c0';
      ctx.fillText('análises', width / 2, height / 2 + 18);

      ctx.restore();
    }
  };

  classificationChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Confiáveis', 'Suspeitas', 'Fraudulentas'],
      datasets: [{
        data: [confiaveis, suspeitas, fraudulentas],
        backgroundColor: ['#35c997', '#f7b84b', '#ff7070'],
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '74%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#e8eefb',
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            boxWidth: 10,
            boxHeight: 10,
            font: {
              family: 'Inter',
              size: 13,
              weight: '600'
            }
          }
        },
        tooltip: {
          backgroundColor: '#111d33',
          titleColor: '#ffffff',
          bodyColor: '#d7e1f5',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 12,
          displayColors: true
        }
      }
    },
    plugins: [centerTextPlugin]
  });
}

function renderTimelineChart(analyses = []) {
  const canvas = document.getElementById('timelineChart');
  if (!canvas) return;

  const counts = {};

  analyses.forEach(item => {
    const day = new Date(item.createdAt).toLocaleDateString('pt-BR');
    counts[day] = (counts[day] || 0) + 1;
  });

  const sortedDays = Object.keys(counts)
    .map(day => day.split('/').reverse().join('-'))
    .sort();

  const labels = sortedDays.map(day => {
    const [year, month, date] = day.split('-');
    return `${date}/${month}/${year}`;
  });

  const data = sortedDays.map(day => {
    const [year, month, date] = day.split('-');
    const label = `${date}/${month}/${year}`;
    return counts[label] || 0;
  });

  if (timelineChartInstance) {
    timelineChartInstance.destroy();
  }

  timelineChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Análises realizadas',
        data,
        borderColor: '#5b8cff',
        backgroundColor: 'rgba(91,140,255,0.18)',
        borderWidth: 3,
        tension: 0.45,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#5b8cff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#e8eefb'
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#98a4c0',
            maxRotation: 30,
            minRotation: 0
          },
          grid: {
            color: 'rgba(255,255,255,0.05)'
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            precision: 0,
            color: '#98a4c0'
          },
          grid: {
            color: 'rgba(255,255,255,0.05)'
          }
        }
      }
    }
  });
}

function buildReasons() {
  const reasonCounter = new Map();

  state.analyses.forEach(item => {
    const reasons = Array.isArray(item.reasons) ? item.reasons : [];

    reasons.forEach(reason => {
      const lower = String(reason).toLowerCase().trim();

      const ignoredPatterns = [
        'nenhum sinal crítico',
        'descrição compatível',
        'empresa identificada',
        'empresa claramente identificada',
        'empresa legítima e identificada',
        'sem solicitação de pagamentos',
        'sem sinais evidentes de fraude',
        'sem cobrança indevida'
      ];

      if (ignoredPatterns.some(pattern => lower.includes(pattern))) {
        return;
      }

      reasonCounter.set(reason, (reasonCounter.get(reason) || 0) + 1);
    });
  });

  const sorted = [...reasonCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (!sorted.length) {
    elements.riskReasons.innerHTML = `
      <div class="reason-item">
        <strong>Sem alertas</strong>
        <span>As novas análises aparecerão aqui.</span>
      </div>
    `;
    return;
  }

  elements.riskReasons.innerHTML = sorted.map(([reason, qty]) => `
    <div class="reason-item">
      <strong>${escapeHtml(`${qty} ocorrência(s)`)}</strong>
      <span>${escapeHtml(reason)}</span>
    </div>
  `).join('');
}

function buildAnalysesTable(target, analyses) {
  if (!analyses.length) {
    target.innerHTML = `
      <div class="empty-state">
        <div>
          <h3>Nenhum registro encontrado</h3>
          <p>Quando houver análises, elas aparecerão aqui.</p>
        </div>
      </div>
    `;
    return;
  }

  target.innerHTML = `
    <table class="analysis-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Vaga</th>
          <th>Empresa</th>
          <th>Risco</th>
          <th>Pontuação</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${analyses.map(item => `
          <tr>
            <td>${escapeHtml(formatDate(item.createdAt))}</td>
            <td>${escapeHtml(item.title)}</td>
            <td>${escapeHtml(item.company || 'Não informada')}</td>
            <td><span class="badge ${escapeHtml(item.badge)}">${escapeHtml(item.classification)}</span></td>
            <td>${escapeHtml(item.score)}</td>
            <td><button class="btn btn-ghost js-view-analysis" data-id="${escapeHtml(item.id)}">Ver</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderResult(analysis) {
  state.selectedAnalysis = analysis;
  elements.resultEmpty.classList.add('hidden');
  elements.resultContent.classList.remove('hidden');

  const scoreClass =
    analysis.score <= 30 ? 'score-safe'
      : analysis.score <= 60 ? 'score-medium'
        : 'score-high';

  const riskLabel =
    analysis.score <= 30 ? 'Baixo risco'
      : analysis.score <= 60 ? 'Médio risco'
        : 'Alto risco';

  const reasons = Array.isArray(analysis.reasons) ? analysis.reasons : [];

  elements.resultContent.innerHTML = `
    <div class="result-card">
      <div class="result-score result-score-enhanced">
        <div class="score-ring ${escapeHtml(scoreClass)}" style="--score:${Number(analysis.score) || 0}">
          <div class="score-ring-inner">
            <strong>${escapeHtml(analysis.score)}</strong>
            <span>${escapeHtml(riskLabel)}</span>
          </div>
        </div>

        <div class="result-summary">
          <span class="badge ${escapeHtml(analysis.badge)}">${escapeHtml(analysis.classification)}</span>
          <h3 style="margin: 10px 0 6px;">${escapeHtml(analysis.title)}</h3>
          <p style="margin: 0; color: var(--muted);">${escapeHtml(analysis.company || 'Empresa não informada')}</p>
          <p class="result-helper">
            O sistema calculou a pontuação com base em critérios de risco, confiabilidade da empresa, padrão da remuneração e sinais textuais da vaga.
          </p>
          ${analysis.salary ? `<p style="margin: 0; color: var(--muted);">${escapeHtml(formatMoney(analysis.salary))}</p>` : ''}
        </div>
      </div>

      <div>
        <strong>Recomendação</strong>
        <p style="color: var(--muted);">${escapeHtml(analysis.recommendation)}</p>
      </div>

      <div>
        <strong>Motivos identificados</strong>
        <div class="reason-list">
          ${reasons.map(reason => `
            <div class="reason-item">
              <span>${escapeHtml(reason)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="form-actions">
        <button class="btn btn-primary" id="quickReportBtn">Denunciar esta vaga</button>
      </div>
    </div>
  `;

  const quickReportBtn = document.getElementById('quickReportBtn');
  if (quickReportBtn) {
    quickReportBtn.addEventListener('click', () => {
      document.querySelector('[data-target="reports-section"]').click();
      document.getElementById('reportCompany').value = analysis.company || '';
      document.getElementById('reportLink').value = analysis.link || '';
      document.getElementById('reportReason').value = `Denúncia vinculada à análise ${analysis.id}`;
      showToast('Dados da análise enviados para o formulário de denúncia.');
    });
  }
}

function renderReports() {
  if (!state.reports.length) {
    elements.reportList.innerHTML = `
      <div class="empty-state">
        <div>
          <h3>Sem denúncias</h3>
          <p>As denúncias registradas aparecerão aqui.</p>
        </div>
      </div>
    `;
    return;
  }

  elements.reportList.innerHTML = state.reports.map(item => `
    <article class="report-item">
      <strong>${escapeHtml(item.reason)}</strong>
      <p>${escapeHtml(item.company || 'Empresa não informada')}</p>
      <p>${escapeHtml(item.details || 'Sem detalhes adicionais.')}</p>
      <span>${escapeHtml(formatDate(item.createdAt))}</span>
    </article>
  `).join('');
}

function findAnalysisById(id) {
  return state.analyses.find(item => item.id === id);
}

function bindDynamicActions() {
  document.querySelectorAll('.js-view-analysis').forEach(button => {
    button.addEventListener('click', () => {
      const analysis = findAnalysisById(button.dataset.id);
      if (!analysis) return;

      document.querySelector('[data-target="analyze-section"]').click();
      renderResult(analysis);
    });
  });
}

function renderAll() {
  if (!state.stats) return;

  buildMetricCards(state.stats);
  renderClassificationChart(state.analyses);
  renderTimelineChart(state.analyses);
  buildReasons();
  buildAnalysesTable(elements.latestAnalyses, state.analyses.slice(0, 5));
  buildAnalysesTable(elements.historyTable, state.analyses);
  renderReports();
  bindDynamicActions();
}

async function loadAll() {
  try {
    const [health, analyses, reports, stats] = await Promise.all([
      api('/api/health'),
      api('/api/analyses'),
      api('/api/reports'),
      api('/api/stats')
    ]);

    elements.apiStatus.textContent = health.message;
    state.analyses = analyses;
    state.reports = reports;
    state.stats = stats;
    renderAll();
  } catch (error) {
    elements.apiStatus.textContent = 'API indisponível';
    showToast(error.message);
  }
}

function setupNavigation() {
  const links = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.page-section');

  links.forEach(link => {
    link.addEventListener('click', () => {
      links.forEach(item => item.classList.remove('active'));
      sections.forEach(section => section.classList.remove('active'));

      link.classList.add('active');
      document.getElementById(link.dataset.target).classList.add('active');
    });
  });
}

function setupForms() {
  elements.analysisForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Analisando...';

    const formData = new FormData(elements.analysisForm);
    const payload = Object.fromEntries(formData.entries());

    try {
      const analysis = await api('/api/analyze', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showToast('Vaga analisada com sucesso.');
      state.analyses.unshift(analysis);
      state.stats = await api('/api/stats');
      renderResult(analysis);
      renderAll();
      elements.analysisForm.reset();
    } catch (error) {
      showToast(error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  elements.reportForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(elements.reportForm);
    const payload = Object.fromEntries(formData.entries());

    if (state.selectedAnalysis) {
      payload.analysisId = state.selectedAnalysis.id;
    }

    try {
      const report = await api('/api/report', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showToast('Denúncia registrada com sucesso.');
      state.reports.unshift(report);
      state.stats = await api('/api/stats');
      renderAll();
      elements.reportForm.reset();
    } catch (error) {
      showToast(error.message);
    }
  });

  elements.historySearch.addEventListener('input', () => {
    const query = elements.historySearch.value.trim().toLowerCase();

    const filtered = state.analyses.filter(item =>
      String(item.title || '').toLowerCase().includes(query) ||
      String(item.company || '').toLowerCase().includes(query)
    );

    buildAnalysesTable(elements.historyTable, filtered);
    bindDynamicActions();
  });
}

setupNavigation();
setupForms();
loadAll();