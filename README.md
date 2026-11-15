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
npm test
```

As configurações locais devem ser baseadas em `.env.example`.

## Banco local

Com Docker em execução, copie `.env.example` para `.env`. Depois use:

```bash
npm run db:up
npm run db:generate
npm run db:migrate
npm run db:check
```

Ao iniciar o backend, as migrations pendentes são aplicadas automaticamente.
O administrador inicial só é criado quando `ALLOW_INITIAL_ADMIN_SEED=true` e
as variáveis `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL` e
`INITIAL_ADMIN_PASSWORD` estão preenchidas. Usuários existentes nunca são
alterados.

Para parar o banco:

```bash
npm run db:down
```
