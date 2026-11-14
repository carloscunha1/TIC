# TIC — Sistema de Gestão

Sistema web de gestão da Conveniência do Posto Paulo VI.

## Stack inicial

- Backend: Node.js 24.15.0, TypeScript e Express.
- Frontend: React, TypeScript e Vite.
- Banco local: PostgreSQL 16 via Docker Compose e Prisma.
- Gerenciador de pacotes: npm.

## Estrutura

```text
tic/
├── backend/
├── frontend/
└── README.md
```

## Desenvolvimento

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

Verificações disponíveis:

```bash
npm run typecheck
npm run build
```

As configurações locais devem ser baseadas em `.env.example`.

## Banco local

Com Docker em execução, copie `.env.example` para `.env` e use:

```bash
npm run db:up
npm run db:generate
npm run db:migrate
npm run db:check
```

Para parar o banco:

```bash
npm run db:down
```
