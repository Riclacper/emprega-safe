const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const ANALYSES_FILE = path.join(DATA_DIR, 'analyses.json');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:5501',
    'http://127.0.0.1:5501',
    'https://SEU-SITE.netlify.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function ensureFile(filePath, defaultValue) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
  }
}

function readJson(filePath, fallback = []) {
  ensureFile(filePath, fallback);

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Erro ao ler JSON em ${filePath}:`, error.message);
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function sanitizeText(value, maxLength = 5000) {
  return String(value || '').trim().slice(0, maxLength);
}

function isValidUrl(url) {
  if (!url) return true;

  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function buildReasons(payload) {
  const title = normalize(payload.title);
  const company = normalize(payload.company);
  const description = normalize(payload.description);
  const contact = normalize(payload.contact);
  const link = normalize(payload.link);
  const salary = Number(payload.salary || 0);

  let score = 0;
  const reasons = [];

  const paymentTerms = [
    'taxa',
    'pagamento',
    'pix',
    'deposito',
    'boleto',
    'curso obrigatorio',
    'investimento inicial'
  ];

  const sensitiveTerms = [
    'cpf',
    'rg',
    'foto do cartao',
    'cartao de credito',
    'senha',
    'conta bancaria'
  ];

  const urgencyTerms = [
    'urgente',
    'contratacao imediata',
    'ganhos garantidos',
    'sem experiencia e salario alto',
    'lucro rapido'
  ];

  const suspiciousDomains = ['bit.ly', 'tinyurl', 'encurtador', 'wa.me', 't.me'];
  const fakeEmailDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'];

  const fullText = `${title} ${company} ${description} ${contact} ${link}`;

  if (paymentTerms.some((term) => fullText.includes(term))) {
    score += 35;
    reasons.push('Há indício de cobrança, pagamento ou transferência para participar do processo seletivo.');
  }

  if (
    !company ||
    company.length < 3 ||
    ['empresa confidencial', 'nao informado', 'não informado', 'sigilosa'].includes(company)
  ) {
    score += 20;
    reasons.push('A empresa não está claramente identificada.');
  }

  if (salary >= 12000) {
    score += 15;
    reasons.push('A remuneração informada está muito acima do padrão comum e exige validação adicional.');
  }

  if (sensitiveTerms.some((term) => fullText.includes(term))) {
    score += 18;
    reasons.push('A vaga solicita dados pessoais sensíveis antes de uma validação formal da empresa.');
  }

  if (urgencyTerms.some((term) => fullText.includes(term))) {
    score += 12;
    reasons.push('O texto usa gatilhos de urgência ou promessas irreais para pressionar o candidato.');
  }

  if (!link || suspiciousDomains.some((domain) => link.includes(domain))) {
    score += 10;
    reasons.push('O link informado é ausente ou usa encurtadores/canais menos confiáveis.');
  }

  if (contact && !contact.includes('@') && !/^\+?\d{10,13}$/.test(contact.replace(/\D/g, ''))) {
    score += 6;
    reasons.push('O contato informado não segue um padrão profissional claro.');
  }

  if (contact.includes('@')) {
    const domain = contact.split('@')[1] || '';
    if (fakeEmailDomains.includes(domain)) {
      score += 8;
      reasons.push('O recrutamento usa e-mail genérico em vez de domínio corporativo.');
    }
  }

  const grammarSignals = ['!!!', 'clique agora', 'apenas hoje', 'sem entrevista', 'aprovacao imediata'];
  if (grammarSignals.some((term) => fullText.includes(term))) {
    score += 8;
    reasons.push('O texto contém sinais de informalidade excessiva e possível apelo enganoso.');
  }

  if (description.length < 60) {
    score += 6;
    reasons.push('A descrição da vaga é curta demais e fornece poucas informações verificáveis.');
  }

  if (score <= 25) {
    return {
      score,
      classification: 'Confiável',
      badge: 'baixo',
      reasons: reasons.length
        ? reasons
        : ['Nenhum sinal crítico foi identificado na análise automática inicial.'],
      recommendation:
        'Ainda assim, confirme CNPJ, domínio da empresa e contato oficial antes de enviar documentos.'
    };
  }

  if (score <= 55) {
    return {
      score,
      classification: 'Suspeita',
      badge: 'medio',
      reasons,
      recommendation:
        'Valide a empresa em canais oficiais e não compartilhe dados sensíveis sem confirmação documental.'
    };
  }

  return {
    score,
    classification: 'Potencialmente fraudulenta',
    badge: 'alto',
    reasons,
    recommendation:
      'Evite avançar no contato, não realize pagamentos e confirme a legitimidade em canais oficiais.'
  };
}

function validateAnalysisPayload(payload) {
  const title = sanitizeText(payload.title, 150);
  const company = sanitizeText(payload.company, 150);
  const description = sanitizeText(payload.description, 5000);
  const contact = sanitizeText(payload.contact, 150);
  const link = sanitizeText(payload.link, 500);
  const salaryRaw = sanitizeText(payload.salary, 50);

  if (!title) {
    return { valid: false, message: 'Título da vaga é obrigatório.' };
  }

  if (title.length < 3) {
    return { valid: false, message: 'Título da vaga deve ter pelo menos 3 caracteres.' };
  }

  if (!description) {
    return { valid: false, message: 'Descrição da vaga é obrigatória.' };
  }

  if (description.length < 20) {
    return { valid: false, message: 'Descrição da vaga muito curta para análise.' };
  }

  if (link && !isValidUrl(link)) {
    return { valid: false, message: 'Informe um link válido começando com http:// ou https://.' };
  }

  let salary = 0;
  if (salaryRaw) {
    salary = Number(String(salaryRaw).replace(',', '.'));
    if (Number.isNaN(salary) || salary < 0) {
      return { valid: false, message: 'Salário inválido.' };
    }
  }

  return {
    valid: true,
    payload: {
      title,
      company,
      description,
      contact,
      link,
      salary
    }
  };
}

function validateReportPayload(payload) {
  const analysisId = sanitizeText(payload.analysisId, 80);
  const company = sanitizeText(payload.company, 150);
  const link = sanitizeText(payload.link, 500);
  const reason = sanitizeText(payload.reason, 250);
  const details = sanitizeText(payload.details, 3000);

  if (!reason) {
    return { valid: false, message: 'Informe o motivo da denúncia.' };
  }

  if (reason.length < 5) {
    return { valid: false, message: 'O motivo da denúncia está muito curto.' };
  }

  if (link && !isValidUrl(link)) {
    return { valid: false, message: 'Informe um link válido para a denúncia.' };
  }

  return {
    valid: true,
    payload: {
      analysisId: analysisId || null,
      company: company || 'Não informada',
      link,
      reason,
      details
    }
  };
}

function createAnalysis(payload) {
  const result = buildReasons(payload);

  return {
    id: `ANL-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    title: payload.title,
    company: payload.company,
    salary: Number(payload.salary || 0),
    contact: payload.contact,
    link: payload.link,
    description: payload.description,
    ...result
  };
}

app.get('/api/health', (_, res) => {
  res.json({ ok: true, message: 'EmpregaSafe em execução.' });
});

app.get('/api/analyses', (_, res) => {
  const analyses = readJson(ANALYSES_FILE, []);
  res.json(analyses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.get('/api/reports', (_, res) => {
  const reports = readJson(REPORTS_FILE, []);
  res.json(reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.get('/api/stats', (_, res) => {
  const analyses = readJson(ANALYSES_FILE, []);
  const reports = readJson(REPORTS_FILE, []);

  const stats = analyses.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.classification === 'Confiável') acc.safe += 1;
      if (item.classification === 'Suspeita') acc.suspicious += 1;
      if (item.classification === 'Potencialmente fraudulenta') acc.fraudulent += 1;
      return acc;
    },
    { total: 0, safe: 0, suspicious: 0, fraudulent: 0 }
  );

  res.json({
    ...stats,
    reports: reports.length,
    companiesFlagged: new Set(reports.map((r) => normalize(r.company)).filter(Boolean)).size
  });
});

app.post('/api/analyze', (req, res) => {
  const validation = validateAnalysisPayload(req.body);

  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  const analyses = readJson(ANALYSES_FILE, []);
  const analysis = createAnalysis(validation.payload);

  analyses.push(analysis);
  writeJson(ANALYSES_FILE, analyses);

  return res.status(201).json(analysis);
});

app.post('/api/report', (req, res) => {
  const validation = validateReportPayload(req.body);

  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  const reports = readJson(REPORTS_FILE, []);
  const report = {
    id: `REP-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    ...validation.payload
  };

  reports.push(report);
  writeJson(REPORTS_FILE, reports);

  return res.status(201).json(report);
});

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureFile(ANALYSES_FILE, [
  {
    id: 'ANL-1001',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    title: 'Assistente Administrativo Home Office',
    company: 'Grupo Solidez',
    salary: 3200,
    contact: 'recrutamento@gruposolidez.com.br',
    link: 'https://gruposolidez.com.br/vagas/assistente-adm',
    description:
      'Vaga com atividades administrativas, atendimento por e-mail, suporte em planilhas e contato com equipe interna.',
    score: 12,
    classification: 'Confiável',
    badge: 'baixo',
    reasons: ['Nenhum sinal crítico foi identificado na análise automática inicial.'],
    recommendation:
      'Ainda assim, confirme CNPJ, domínio da empresa e contato oficial antes de enviar documentos.'
  },
  {
    id: 'ANL-1002',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    title: 'Digitador Urgente Sem Experiência',
    company: 'Empresa Confidencial',
    salary: 14500,
    contact: 'selecaovagas2026@gmail.com',
    link: 'https://bit.ly/vaga-digitador-urgente',
    description:
      'Contratação imediata. Ganhos garantidos. Enviar CPF e pagar taxa de treinamento por PIX ainda hoje.',
    score: 88,
    classification: 'Potencialmente fraudulenta',
    badge: 'alto',
    reasons: [
      'Há indício de cobrança, pagamento ou transferência para participar do processo seletivo.',
      'A empresa não está claramente identificada.',
      'A remuneração informada está muito acima do padrão comum e exige validação adicional.',
      'A vaga solicita dados pessoais sensíveis antes de uma validação formal da empresa.',
      'O texto usa gatilhos de urgência ou promessas irreais para pressionar o candidato.',
      'O link informado é ausente ou usa encurtadores/canais menos confiáveis.',
      'O recrutamento usa e-mail genérico em vez de domínio corporativo.'
    ],
    recommendation:
      'Evite avançar no contato, não realize pagamentos e confirme a legitimidade em canais oficiais.'
  }
]);

ensureFile(REPORTS_FILE, []);

app.listen(PORT, () => {
  console.log(`EmpregaSafe rodando em http://localhost:${PORT}`);
});