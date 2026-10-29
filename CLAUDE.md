# SIGDATA

Plataforma de análise de dados que integra assistente de IA, exploração de dados, visualização e dashboards em um único ambiente de trabalho organizado por projetos.

O SIGDATA **não é um chatbot genérico** nem uma coleção de dashboards estáticos: a conversa com a IA produz resultados analíticos (consultas, tabelas, gráficos, indicadores) que podem ser examinados, ajustados, organizados em painéis e compartilhados.

## Estado atual

Monorepo com dois serviços (ver `README.md` na raiz, tabela "Onde fica cada coisa"):

- `frontend/` — Next.js, só interface. Repassa `/api/*` para o backend (mesma origem).
- `backend/` — Node + Hono na porta 4000: login (Better Auth + plugin admin), Postgres (Drizzle), fontes reais (CSV/XLSX via DuckDB, PostgreSQL externo), chat com a ferramenta `consultar_dados`, dashboards com link público.
- `shared/` — tipos de domínio e dados de demonstração, TypeScript puro sem dependências (alias `@shared/*`).

Perfis cumulativos (`shared/domain/roles.ts`): **usuário** (projetos, workspace, painéis), **analista** (+ fontes, editor SQL, datasets), **admin** (+ contas, em `/admin`). Fontes e datasets são um catálogo comum; workspace e painéis só oferecem datasets (`isWorkspaceSource` / `panelSources` em `shared/domain/sources.ts`); projetos e painéis são de cada usuário. Rota restrita no backend: `handle(fn, { role: "analista" })`; no frontend, `useCan(...)` esconde e `RoleGate` bloqueia a página. Sem cadastro público — primeiro admin com `npm run admin:create`.

Na raiz: `npm run db:up` (Postgres em Docker, porta 5434, projeto compose `sigdata-dev`) e `npm run dev` (sobe os dois).

Tarefas de interface usam os stores (`frontend/lib/**/store.ts`), que chamam a API — não acesse `localStorage` para dados de domínio. Código de servidor nunca vai no `frontend/`. Tipo usado pelos dois lados vai em `shared/`. Mudou o schema? `npm run db:generate` e `npm run db:migrate`.

## Stack

Frontend: Next.js 16 (App Router, `proxy.ts`) · React · TypeScript strict · Tailwind CSS v4 · shadcn/ui · Assistant UI.
Backend: Hono · AI SDK v7 + Groq · Better Auth · Drizzle + Postgres · DuckDB.

Antes de alterar configurações (Next, Tailwind, cache, navegação), inspecione o código existente. Não presuma versões antigas: Tailwind v4 usa configuração via CSS (`@theme`), não `tailwind.config.js` tradicional.

## Áreas da aplicação

- **Página inicial** — projetos em cards no estilo pasta/espaço de trabalho.
- **Workspace do projeto** — estilo NotebookLM: Fontes (datasets) à esquerda, notebook no centro (células de IA = mensagens do chat; células SQL em `notebook_cells`, intercaladas por `afterMessageId`; consultas do agente viram nós SQL), Estúdio redimensionável à direita. Código em `frontend/components/workspace/`.
- **Fontes de dados** — conexões, CSV/XLSX, inspeção de tabelas, colunas e tipos.
- **Painéis** — composição de visualizações, layout ajustável, salvar e compartilhar.

## Princípios (em ordem)

1. Experiência do usuário — cada funcionalidade resolve um problema real.
2. Consistência — reutilize padrões visuais e técnicos existentes.
3. Modularidade — sem páginas monolíticas; separe componentes, estado e lógica.
4. Interações funcionais — nada de botões decorativos, mesmo com mocks.
5. Evolução incremental — passos pequenos e verificáveis.
6. Preparação para integração — mocks substituíveis por APIs sem refatoração grande.

## Skills do projeto

- `sigdata-feature` — fluxo para implementar qualquer mudança.
- `sigdata-ui` — identidade visual e convenções de componentes.
- `sigdata-workspace` — chat + área analítica e a ligação entre eles.
- `sigdata-mock-data` — camada de dados simulados com contratos tipados.
- `sigdata-paineis` — dashboards: layout, edição, salvar, compartilhar.
- `sigdata-fontes-de-dados` — gerenciamento e inspeção de fontes.
