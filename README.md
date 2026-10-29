# SIGDATA

<p align="center">
  <img src="./assets/sigdata-logo.svg" alt="SIGDATA" width="320" />
</p>

> Plataforma de análise de dados com chat por IA, painel de visualizações por projeto
> e editor de dashboards compartilháveis.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](#)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](#)
[![Hono](https://img.shields.io/badge/Hono-4-E36002?logo=hono&logoColor=white)](#)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=black)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](#)

---

## Visão geral

O SIGDATA permite que usuários conversem com uma IA para consultar fontes reais de dados
(CSV, XLSX e PostgreSQL), transformem resultados em visualizações e montem dashboards
interativos compartilháveis por link público.

O navegador fala apenas com o **frontend**. O Next.js repassa `/api/*` para o backend,
mantendo frontend e API na mesma origem, o que simplifica o uso de cookies de sessão.

```text
Navegador ──► Next.js (3000) ──► Hono API (4000) ──► Postgres / DuckDB / Groq
```

## Principais funcionalidades

- **Chat analítico com IA** usando Groq, com ferramenta `consultar_dados` e histórico persistido.
- **Fontes de dados por projeto**: upload de CSV/XLSX e conexão a PostgreSQL externo.
- **Visualizações salvas**: gráficos, KPIs, tabelas e indicadores gerados no chat.
- **Editor de dashboards**: canvas livre, páginas, filtros, zoom, camadas e compartilhamento.
- **Dashboards públicos** via link, com renderização protegida por token.
- **Autenticação completa** com Better Auth (e-mail/senha e sessão por cookie).
- **Seed automático** com fonte de demonstração e dashboards de exemplo para novas contas.

## Stack técnica

### Frontend

| Tecnologia | Uso |
|---|---|
| Next.js 16 + React | Interface e roteamento |
| TypeScript | Tipagem estática |
| Tailwind CSS v4 | Estilização |
| shadcn/ui | Componentes base |
| Zustand | Estado da interface |
| Assistant UI | Chat com IA |
| ECharts | Gráficos |

### Backend

| Tecnologia | Uso |
|---|---|
| Node.js + TypeScript | Runtime da API |
| Hono | Servidor HTTP e rotas |
| Drizzle ORM | Acesso ao banco e migrações |
| PostgreSQL | Banco principal |
| Better Auth | Autenticação e sessões |
| Vercel AI SDK + Groq | Chat e respostas com IA |
| DuckDB | Consulta analítica de CSV/XLSX |
| ExcelJS / mammoth / unpdf | Leitura de arquivos |
| Zod | Validação na borda |

### Compartilhado

A pasta `shared/` contém tipos de domínio e dados de demonstração usados por frontend e
backend, importados via alias `@shared/*`.

## Estrutura

```text
sigdata-dev/
├─ frontend/          Next.js 16 — interface (porta 3000)
├─ backend/           Node + Hono — API, auth, banco, motor analítico, IA (porta 4000)
├─ shared/            tipos de domínio e dados de demonstração (TS puro)
├─ docker-compose.yml Postgres de desenvolvimento (porta 5434)
└─ package.json       scripts que orquestram tudo
```

## Arquitetura

```text
Navegador
  └─► Next.js (frontend)
        └─► /api/* (rewrite)
              └─► Hono (backend)
                    ├─► PostgreSQL (Drizzle)
                    ├─► DuckDB (CSV/XLSX)
                    └─► Groq (IA)
```

O backend concentra autenticação, persistência, consultas a fontes, geração de análises
e o chat com IA. O frontend é responsável pela experiência visual e pelo estado da
interface.

## Rodando localmente

### Pré-requisitos

- Node.js 24+
- Docker Desktop

### Instalação

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

### Variáveis de ambiente

#### Backend (`backend/.env`)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORT` | Não | Porta da API (padrão: `4000`) |
| `DATABASE_URL` | Sim | URL do Postgres |
| `BETTER_AUTH_SECRET` | Sim | Segredo do Better Auth |
| `BETTER_AUTH_URL` | Sim | URL pública do frontend (`http://localhost:3000`) |
| `TRUSTED_ORIGINS` | Não | Origens extras aceitas, separadas por vírgula |
| `SIGDATA_ENCRYPTION_KEY` | Sim | Chave AES-256-GCM para credenciais externas |
| `SIGDATA_STORAGE_DIR` | Não | Pasta de arquivos e bancos DuckDB (padrão: `./storage`) |
| `GROQ_API_KEY` | Sim | Chave da API Groq |
| `GROQ_MODEL` | Não | Modelo Groq (padrão documentado no `.env.example`) |
| `GROQ_MAX_OUTPUT_TOKENS` | Não | Limite de tokens de saída |

#### Frontend (`frontend/.env.local`)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `BACKEND_URL` | Não | URL do backend (padrão: `http://localhost:4000`) |

## Banco de dados

O Postgres roda via Docker Compose na porta `5434`.

```bash
npm run db:up        # sobe o banco
npm run db:down      # derruba o banco
npm run db:generate  # gera migração após alterar backend/src/db/schema.ts
npm run db:migrate   # aplica migrações
npm run db:studio    # abre o Drizzle Studio
```

## Scripts

| Script | Uso |
|---|---|
| `npm run dev` | backend + frontend juntos |
| `npm run dev:backend` | apenas o backend |
| `npm run dev:frontend` | apenas o frontend |
| `npm run db:up` / `db:down` | sobe/derruba o Postgres |
| `npm run db:generate` | gera migração |
| `npm run db:migrate` | aplica migrações |
| `npm run db:studio` | Drizzle Studio |
| `npm run typecheck` | checa tipos do backend e frontend |
| `npm test` | testes do backend e do frontend |

## Onde mexer

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

## Build e verificação

```bash
npm run typecheck
```

Para build do frontend:

```bash
npm --prefix frontend run build
```

## Solução de problemas

- **Porta em uso**: altere `PORT` no backend ou a porta do frontend.
- **Banco não conecta**: confirme `npm run db:up` e a `DATABASE_URL`.
- **Erro de autenticação**: verifique `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` e origens confiáveis.
- **IA não responde**: confirme `GROQ_API_KEY` e o modelo configurado.
- **Upload/consulta de arquivos falha**: verifique permissões da pasta de storage e a configuração do DuckDB.

## Licença

Projeto privado. Ajuste esta seção conforme a licença desejada.
