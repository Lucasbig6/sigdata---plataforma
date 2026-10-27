# SIGDATA

Plataforma de análise de dados: chat com IA que consulta fontes reais (CSV, XLSX,
PostgreSQL), painel de visualizações por projeto e editor de dashboards compartilháveis.

## Rodando localmente

Pré-requisitos: Node 24+, Docker Desktop.

```bash
npm install
cp .env.example .env.local   # preencha BETTER_AUTH_SECRET, SIGDATA_ENCRYPTION_KEY e GROQ_API_KEY
npm run db:up                # Postgres 17 em localhost:5434 (projeto compose "sigdata-dev")
npm run db:migrate           # cria as tabelas
npm run dev
```

Abra http://localhost:3000, crie uma conta em **Criar conta**. Cada conta nova recebe uma
fonte de demonstração consultável ("Indicadores municipais") e três dashboards de exemplo.

## Arquitetura

| Camada | Onde | O quê |
|---|---|---|
| Autenticação | `lib/server/auth.ts`, `app/api/auth/[...all]`, `proxy.ts` | Better Auth (e-mail e senha), sessão por cookie. `proxy.ts` redireciona para `/login`; cada rota valida a sessão com `requireUser()`. |
| Banco | `lib/server/db/schema.ts`, `drizzle/` | Postgres + Drizzle. Tudo pertence a um `user_id`. |
| Motor analítico | `lib/server/sources/` | Arquivos viram um DuckDB por fonte em `storage/sources/<id>/`; Postgres externo é consultado direto. |
| API | `app/api/**` | Projetos, mensagens, painel, fontes, resultados, análises, dashboards, compartilhamento. |
| Chat | `app/api/chat/route.ts`, `lib/server/chat.ts` | Groq via AI SDK. A IA recebe o schema da fonte ativa e usa a ferramenta `consultar_dados` (servidor); gráficos referenciam o `resultId`. A conversa é salva no fim de cada resposta. |
| Cliente | `lib/api/client.ts`, stores em `lib/**/store.ts` | Stores Zustand com atualização otimista chamando a API. |

### Segurança das consultas

- Só uma instrução `SELECT`/`WITH` por vez, executada como subconsulta com `LIMIT`.
- DuckDB aberto somente-leitura, sem acesso a arquivos/extensões e com configuração travada.
- Postgres externo em transação `READ ONLY` com `statement_timeout` (15 s) e `ROLLBACK`.
  Use um usuário só de leitura mesmo assim.
- Senhas de conexões externas criptografadas com AES-256-GCM (`SIGDATA_ENCRYPTION_KEY`).

### Compartilhamento

No editor de dashboard, **Compartilhar → Gerar link público** cria `/compartilhado/<token>`
(somente leitura, versão salva). **Revogar link** invalida o token na hora.

## Scripts

| Script | Uso |
|---|---|
| `npm run db:up` / `db:down` | sobe/derruba o Postgres de desenvolvimento |
| `npm run db:generate` | gera migração após alterar `lib/server/db/schema.ts` |
| `npm run db:migrate` | aplica migrações |
| `npm run db:studio` | Drizzle Studio para inspecionar o banco |
