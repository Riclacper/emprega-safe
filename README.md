# EmpregaSafe

Sistema web de verificação de vagas de emprego com foco na identificação de anúncios fraudulentos.

## Stack
- Node.js
- Express
- HTML, CSS e JavaScript
- Persistência local em arquivos JSON

## Funcionalidades
- Dashboard com indicadores
- Análise automática de risco da vaga
- Classificação: Confiável, Suspeita ou Potencialmente fraudulenta
- Histórico de verificações
- Registro de denúncias
- Interface moderna e responsiva

## Como executar
1. Extraia o arquivo ZIP.
2. Abra a pasta no VS Code ou terminal.
3. Rode:

```bash
npm install
npm start
```

4. Acesse no navegador:

```bash
http://localhost:3000
```

## Estrutura
```text
emprega-safe/
├── data/
│   ├── analyses.json
│   └── reports.json
├── public/
│   ├── index.html
│   └── assets/
│       ├── app.js
│       └── style.css
├── package.json
├── README.md
└── server.js
```

## Observações
- Os dados são salvos localmente nos arquivos JSON da pasta `data`.
- Para evoluir o projeto, você pode trocar essa persistência por MongoDB.
- O algoritmo de análise está em `server.js` e pode ser refinado com novas regras.

## Ajustes futuros sugeridos
- autenticação de usuários
- integração com MongoDB
- análise por IA
- upload de evidências
- painel administrativo com permissões
