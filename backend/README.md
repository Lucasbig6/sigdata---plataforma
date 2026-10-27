# SIGDATA — backend

API em Node + Hono (porta 4000, prefixo `/api`): autenticação (Better Auth), Postgres
(Drizzle), motor analítico (DuckDB para arquivos, `pg` para Postgres externo) e chat (AI SDK + Groq).

```
src/
├─ server.ts        monta as rotas
├─ routes/          projects, sources/results, dashboards/analyses/public, chat
├─ auth.ts          Better Auth
├─ db/              schema + conexão
├─ sources/         ingestão CSV/XLSX, DuckDB, Postgres externo, SQL somente-leitura
├─ chat.ts          prompt com schema da fonte, ferramenta consultar_dados, persistência
└─ seed/            conteúdo inicial de cada conta nova
```

Veja o README da raiz para setup.
