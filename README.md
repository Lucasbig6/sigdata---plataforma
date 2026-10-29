# SIGDATA

Plataforma de análise de dados: chat com IA que consulta fontes reais (CSV, XLSX,
PostgreSQL), painel de visualizações por projeto e editor de dashboards compartilháveis.

## Estrutura

```
sigdata-dev/
├─ frontend/          Next.js 16 — só interface (porta 3000)
├─ backend/           Node + Hono — API, autenticação, banco, motor analítico, IA (porta 4000)
├─ shared/            tipos de domínio e dados de demonstração usados pelos dois (TS puro)
├─ docker-compose.yml Postgres de desenvolvimento (porta 5434)
└─ package.json       scripts que orquestram tudo
```

O navegador só fala com o frontend. O Next.js repassa `/api/*` para o backend
(`rewrites` em `frontend/next.config.ts`), então frontend e API ficam na mesma origem e
o cookie de sessão funciona sem CORS.

## Rodando localmente

Pré-requisitos: Node 24+ e Docker Desktop aberto.

```bash
npm run setup                          # instala raiz, backend e frontend
cp backend/.env.example backend/.env   # preencha os segredos e a GROQ_API_KEY
cp frontend/.env.example frontend/.env.local
npm run db:up                          # Postgres 17 (projeto compose "sigdata-dev")
npm run db:migrate                     # cria as tabelas
npm run dev                            # sobe backend (4000) e frontend (3000)
```

Abra http://localhost:3000 e crie uma conta. Cada conta nova recebe uma fonte de
demonstração consultável e três dashboards de exemplo.

## Onde fica cada coisa

| Quero mexer em… | Pasta |
|---|---|
| Telas, componentes, estilos | `frontend/app`, `frontend/components` |
| Estado da interface (stores Zustand) e chamadas à API | `frontend/lib/**/store.ts`, `frontend/lib/api/client.ts` |
| Redirecionamento para login | `frontend/proxy.ts` |
| Rotas da API | `backend/src/routes/*.ts` (montadas em `backend/src/server.ts`) |
| Login / sessão | `backend/src/auth.ts` (Better Auth) |
| Tabelas do banco e migrações | `backend/src/db/schema.ts`, `backend/drizzle/` |
| Fontes de dados, DuckDB, Postgres externo, datasets | `backend/src/sources/` |
| Editor SQL (frontend) | `frontend/components/fontes/sql/`, `frontend/lib/sql-editor/` |
| Testes automatizados | `backend/test/`, `frontend/test/` |
| Chat: prompt, ferramenta `consultar_dados`, salvamento da conversa | `backend/src/chat.ts`, `backend/src/routes/chat.ts` |
| Tipos usados nos dois lados | `shared/` (alias `@shared/*`) |

## Segurança das consultas

- Só uma instrução `SELECT`/`WITH` por vez, executada como subconsulta com `LIMIT`.
- DuckDB aberto somente-leitura, sem acesso a arquivos/extensões e com configuração travada.
- Postgres externo em transação `READ ONLY` com `statement_timeout` (15 s) e `ROLLBACK`.
  Use um usuário só de leitura mesmo assim.
- Senhas de conexões externas criptografadas com AES-256-GCM (`SIGDATA_ENCRYPTION_KEY`).

## Scripts (na raiz)

| Script | Uso |
|---|---|
| `npm run dev` | backend + frontend juntos |
| `npm run dev:backend` / `dev:frontend` | só um dos lados |
| `npm run db:up` / `db:down` | sobe/derruba o Postgres |
| `npm run db:generate` | gera migração após alterar `backend/src/db/schema.ts` |
| `npm run db:migrate` | aplica migrações |
| `npm run db:studio` | Drizzle Studio |
| `npm run typecheck` | checa tipos dos dois projetos |
| `npm test` | testes do backend e do frontend |
