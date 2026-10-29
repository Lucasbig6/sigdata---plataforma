# SIGDATA — Stack, arquitetura e fluxos

Plataforma de análise de dados que une assistente de IA, exploração de dados, visualização e dashboards num único ambiente organizado por **projetos**. A conversa com a IA produz resultados analíticos reais (consultas, tabelas, gráficos, indicadores) que podem ser ajustados, organizados em dashboards e compartilhados por link público.

## 1. Stack e tecnologias

| Camada | Tecnologias |
|---|---|
| **Frontend** | Next.js 16 (App Router, `proxy.ts`, Turbopack) · React 19 · TypeScript strict · Tailwind CSS v4 (config via `@theme` no CSS) · shadcn/ui + Base UI · Assistant UI (`@assistant-ui/react`, `@assistant-ui/ai-sdk`) · Zustand (estado) · ECharts 6 (gráficos) · react-rnd (arrastar/redimensionar) · html-to-image + jsPDF (exportação) · oxlint/oxfmt |
| **Backend** | Node 24 · Hono (porta 4000) · AI SDK v7 + provedor Groq · Better Auth (e-mail/senha) · Drizzle ORM + PostgreSQL · DuckDB (`@duckdb/node-api`, fixado em 1.5.6-r.2: a 2.0 encerra com SIGILL em CPUs sem AVX2) · `pg` · Zod · ExcelJS (XLSX) · mammoth/unpdf (anexos DOCX/PDF no chat) · tsx |
| **Compartilhado** | `shared/` — TypeScript puro, sem dependências, alias `@shared/*` |
| **Infra de dev** | Docker Compose (Postgres 17, porta 5434, projeto `sigdata-dev`) · `concurrently` para subir tudo com `npm run dev` |

## 2. Estrutura do monorepo

```
sigdata/
├─ frontend/   Next.js — só interface (porta 3000)
├─ backend/    Hono — API, auth, banco, motor analítico, IA (porta 4000)
├─ shared/     tipos de domínio e contratos usados pelos dois lados
├─ docker-compose.yml   Postgres de desenvolvimento
└─ package.json         scripts de orquestração (dev, db:*, typecheck)
```

### Frontend (`frontend/`)

| Pasta | Responsabilidade |
|---|---|
| `app/` | Rotas: `/` (projetos), `/workspace`, `/dashboards`, `/dashboards/[id]`, `/fontes-de-dados` (abas Fontes e Datasets), `/fontes-de-dados/editor` (editor SQL), `/login`, `/compartilhado/[token]` (público) |
| `components/sigdata/` | Shell, sidebar, cards de projeto, painel analítico (`work-panel`), widgets |
| `components/assistant-ui/` | Thread do chat, markdown, raciocínio, ferramentas |
| `components/dashboards/` | Editor: canvas, propriedades, camadas, medidas, histórico de versões, compartilhamento, exportação; `slicers.tsx` (filtros estilo Power BI), `frame-fields.tsx` (moldura/borda), `workspace-library.tsx` (visualizações salvas) |
| `components/charts/` + `lib/charts/` | Renderização ECharts e construção das opções a partir dos dados |
| `components/fontes/` | Cartões de fontes e datasets, nova fonte (diálogo), inspeção de tabelas/colunas; `sql/` = editor SQL (CodeMirror, navegador de tabelas, abas de scripts, grade paginada) |
| `lib/sql-editor/` | Autocomplete do esquema e modelos, separação de instruções, tema e rascunhos dos scripts (só no navegador) |
| `lib/**/store.ts` | Stores Zustand: toda a interface lê/escreve dados de domínio por aqui |
| `lib/api/client.ts` | Único cliente HTTP (`api()`); trata 401 → login e erros em português |
| `proxy.ts` | Redireciona para `/login` sem cookie de sessão |

### Backend (`backend/src/`)

| Arquivo/pasta | Responsabilidade |
|---|---|
| `server.ts` | Monta o app Hono em `/api` e as rotas |
| `auth.ts` | Better Auth sobre Drizzle; sessão de 7 dias; *seed* de conta nova |
| `routes/` | `projects`, `sources` (+ `results`), `dashboards` (+ `analyses`, `public`), `chat` |
| `chat.ts` | Prompt de sistema (com o schema da fonte ativa), ferramenta `consultar_dados`, persistência da conversa |
| `sources/` | `service.ts` (CRUD, ingestão, execução, editor SQL paginado, datasets), `duck.ts` (CSV/XLSX), `pg.ts` (Postgres externo), `sql.ts` (validação), `schemas.ts` |
| `dashboard-data.ts` | Monta SQL dos elementos a partir de *bindings*, filtros (valor único, vários valores com `IN`, intervalo de datas) e medidas; devolve os limites de datas de uma coluna |
| `query-cache.ts` | Cache LRU em memória com deduplicação de consultas simultâneas |
| `crypto.ts` | AES-256-GCM para credenciais de conexões externas |
| `db/schema.ts` + `drizzle/` | Schema Drizzle e migrações |
| `seed.ts` | Fonte de demonstração e dashboards de exemplo para cada conta nova |

### Banco de dados (Postgres)

- **Auth (Better Auth):** `user`, `session`, `account`, `verification`.
- **Domínio:** `projects` (com `source_id` ativa), `messages` (histórico do chat, partes em `jsonb`), `project_panels` (widgets salvos), `data_sources` (metadados, schema em cache, credenciais criptografadas; `definition` = origem e SQL de um dataset), `results` (SQL, colunas, linhas, tempo), `analyses`, `dashboards` (documento em `jsonb` + `share_token`), `dashboard_versions` (histórico restaurável).
- Tudo pertence a um `user_id` e **toda rota filtra por ele**. Documentos ricos ficam em `jsonb`, validados na borda com Zod.

## 3. Arquitetura

```
 Navegador
    │  (só fala com o frontend — mesma origem, cookie de sessão sem CORS)
    ▼
 Next.js :3000 ── páginas, stores Zustand, Assistant UI, ECharts
    │  rewrite  /api/*  →  BACKEND_URL
    ▼
 Hono :4000 /api
    ├─ /auth/*        Better Auth
    ├─ /projects      projetos, mensagens, painel
    ├─ /sources       fontes, tabelas, preview, upload
    ├─ /results       resultados de consultas
    ├─ /chat          streaming da IA (AI SDK + Groq + ferramentas)
    ├─ /dashboards    CRUD, versões, dados ao vivo, compartilhar
    ├─ /analyses      análises salvas
    └─ /public        dashboards por token (sem login)
          │
          ├─► PostgreSQL (Drizzle)   estado da aplicação
          ├─► DuckDB                 CSV/XLSX importados (somente leitura)
          └─► PostgreSQL externo     fonte conectada pelo usuário (READ ONLY)
```

Decisões importantes:

- **Mesma origem via rewrite** (`frontend/next.config.ts`): sem CORS, cookie de sessão simples.
- **Frontend só interface.** Código de servidor nunca fica em `frontend/`; tipos comuns vão para `shared/`.
- **Stores → API.** A interface não usa `localStorage` para dados de domínio; os stores chamam `api()`.
- **Dados não passam pelo navegador antes de salvos:** `consultar_dados` executa no servidor e guarda o resultado; o modelo recebe apenas uma amostra (15 linhas).
- **Ferramentas em dois lugares:** `consultar_dados` roda no servidor; `create_visualization` e as de edição do painel são registradas no navegador (Assistant UI) e executadas no cliente.

## 4. Fluxos principais

### 4.1 Cadastro e sessão
1. Usuário cria conta em `/login` → Better Auth grava `user`/`account`/`session` e define o cookie.
2. Hook `after` de criação chama `seedNewUser`: cria a **fonte de demonstração** consultável e **3 dashboards de exemplo**.
3. `proxy.ts` bloqueia páginas sem cookie (exceto `/login` e `/compartilhado/*`); a validação real é no backend (`requireUser` em toda rota de dados). Um 401 em `api()` redireciona para o login preservando `?next=`.

### 4.2 Adicionar uma fonte de dados
1. **CSV/XLSX:** upload multipart (até 50 MB) → arquivo salvo em `SIGDATA_STORAGE_DIR` → ingestão em DuckDB → schema e perfil das colunas calculados e guardados em `data_sources.tables` (status `processando` → `pronta`/erro).
2. **PostgreSQL externo:** o usuário informa a conexão → teste/introspecção → credenciais criptografadas (AES-256-GCM) em `data_sources.connection`.
3. A tela **Fontes de dados** tem duas abas: *Fontes de dados* (o cadastro abre num diálogo) e *Datasets*; permite inspecionar tabelas, colunas, tipos e prévia (50 linhas).
4. **Editor SQL** (`/fontes-de-dados/editor`, aberto a partir de cada fonte): `POST /api/sources/:id/run` executa uma instrução de leitura e devolve **uma página** (`page`, `pageSize` de 25 a 1000, `count` para o total, contado só na primeira página). Nada é gravado. Ctrl+Enter executa a seleção ou a instrução sob o cursor.
5. **Datasets**: "Salvar como dataset" chama `POST /api/sources/dataset`, que executa a consulta na fonte de origem e materializa o resultado em DuckDB como uma nova fonte (`kind = "dataset"`, até 50.000 linhas, `definition` guarda origem e SQL). Ela aparece na lista de fontes dos projetos e dos dashboards como qualquer outra e pertence só à conta de quem a criou.

### 4.3 Chat com a IA e geração de resultados
1. No workspace, o usuário pergunta algo. O Assistant UI envia `POST /api/chat` com `messages`, as ferramentas do cliente e o `projectId`.
2. O backend valida a sessão, carrega o projeto e a **fonte ativa**, e monta o prompt de sistema com o schema (tabelas/colunas/tipos) e o dialeto SQL.
3. `streamText` (Groq, até 8 passos) deixa o modelo: **consultar** (`consultar_dados`) → corrigir o SQL se falhar → **visualizar** (`create_visualization`, no cliente) → explicar em poucas frases.
4. `consultar_dados` valida o SQL, executa na fonte (DuckDB ou Postgres), grava em `results` e devolve `resultId` + colunas + amostra.
5. A resposta é transmitida em *stream*; ao terminar, `persistConversation` substitui o histórico em `messages` (anexos inline são reduzidos a referência).
6. O gráfico aparece no chat; o usuário decide **Salvar visualização**, que vai para o painel lateral do projeto (`project_panels`). Os dados do gráfico são buscados por `resultId` em `/api/results`.

### 4.4 Painel analítico do workspace
Layout: chat à esquerda, área analítica redimensionável à direita. O usuário alterna entre resultados salvos, edita título/tipo/colunas (manualmente ou pedindo à IA, via `listar_visualizacoes`/`editar_visualizacao`) e pode enviar o que está no painel para um dashboard (`from-workspace.ts`).

### 4.5 Dashboards (editor)
1. Um dashboard é um **documento** (`DashboardDoc`): canvas, páginas, elementos posicionados e medidas calculadas; salvo em `dashboards.doc`.
2. Gráficos, tabelas e indicadores **só entram a partir das visualizações salvas** nas análises (aba *Visualizações* da biblioteca); a aba *Elementos* oferece filtros, textos, imagem, divisor e formas. Cada visualização carrega um *binding* (SQL da consulta de origem) e, nos dashboards antigos, o do construtor (tabela, dimensão, métrica, agregação). Ao renderizar, o frontend chama a API de dados e `dashboard-data.ts` **monta o SQL a partir de nomes validados contra o schema em cache** — nunca texto livre do cliente; medidas passam pelo analisador de `shared/dashboards/expr.ts`.
3. Filtros (segmentações) são estado de visualização: não alteram o documento salvo. Há *Período (data)* (campos, controle deslizante ou atalhos), *Lista suspensa*, *Lista de seleção* e *Blocos*; a lista aceita seleção múltipla (vários valores viram `IN (...)`, até 50) e o clique cruzado em gráficos continua valendo.
4. Gráficos, tabelas, indicadores e filtros têm **moldura** (borda, cantos, fundo, espaçamento, sombra): borda visível por padrão, configurável em "Moldura e borda".
5. Cada salvamento pode gerar uma entrada em `dashboard_versions` (histórico restaurável, com rótulo opcional).
6. Exportação em imagem/PDF no navegador.

### 4.6 Compartilhamento por link público
1. Em "Compartilhar", o backend gera `share_token` (e `shared_at`) no dashboard; remover o token revoga o acesso.
2. Visitantes abrem `/compartilhado/[token]` sem login. O frontend usa `/api/public/dashboards/:token`, `/data` e `/filter-options`.
3. O cache de consultas (`query-cache.ts`: TTL de 30 s, 500 entradas, chave com `updatedAt` da fonte) evita que muitos visitantes gerem consultas idênticas.

### 4.7 Fluxo de desenvolvimento
```bash
npm run setup          # instala raiz, backend e frontend
npm run db:up          # Postgres em Docker
npm run db:migrate     # aplica migrações
npm run dev            # backend :4000 + frontend :3000
```
Mudou o schema? `npm run db:generate` e depois `npm run db:migrate`. `npm run typecheck` valida os dois projetos e `npm test` roda os testes (backend: `node --test` com `tsx`, sem Postgres; frontend: `node --test` nativo sobre `test/*.test.mts`).

## 5. Segurança

- **SQL somente leitura em camadas:** só uma instrução `SELECT/WITH/VALUES/FROM`, sem `;` extra nem comentários que escondam comandos; executada como subconsulta (com quebra de linha antes do `)`, para que um comentário `--` no fim da consulta não a quebre) com `LIMIT`/`OFFSET` e *timeout* de 15 s; resultados do chat guardam até 5000 linhas e o editor SQL pagina o resultado completo.
- **Filtros dos dashboards:** nomes de coluna validados contra o schema em cache; cada valor é escapado como literal; seleção múltipla limitada a 50 valores e 1000 caracteres.
- **DuckDB:** aberto em modo somente leitura, `enable_external_access=false` e `lock_configuration=true`.
- **Postgres externo:** transação `READ ONLY`, `statement_timeout` e `ROLLBACK` sempre. Recomenda-se ainda um usuário só de leitura.
- **Credenciais** de conexões externas criptografadas com `SIGDATA_ENCRYPTION_KEY`.
- **Isolamento por usuário:** toda consulta ao banco filtra por `user_id`; links públicos expõem apenas o dashboard do token.
- **Auth:** senha de 8–128 caracteres, *rate limit* (30 req/min), origens confiáveis configuráveis.

## 6. Configuração (backend/.env)

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Postgres da aplicação |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Segredo e URL pública do **frontend** |
| `TRUSTED_ORIGINS` | Origens extras aceitas (opcional) |
| `SIGDATA_ENCRYPTION_KEY` | Chave de 32 bytes (base64) para credenciais |
| `SIGDATA_STORAGE_DIR` | Pasta de uploads e bancos DuckDB (padrão `./storage`) |
| `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_MAX_OUTPUT_TOKENS` | IA (limite de saída padrão 900 tokens) |
| `QUERY_CACHE_TTL_MS`, `QUERY_CACHE_MAX` | Ajuste do cache de consultas |

No frontend: `BACKEND_URL` (padrão `http://localhost:4000`).
