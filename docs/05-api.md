# 05 · API

Todas as rotas ficam sob `/api` (o frontend as repassa ao backend na porta 4000). Exceto onde indicado, exigem sessão
(cookie do Better Auth). Perfis são validados no backend. Esta página lista as rotas existentes; formatos de corpo e
resposta estão nos esquemas Zod de cada arquivo em `backend/src/routes/`.

Convenções: `:id` é o identificador do recurso; erros usam o status HTTP e uma mensagem em português.

## Sistema e autenticação

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Processo vivo (sem sessão) |
| GET | `/api/ready` | Confere o banco (sem sessão) |
| GET | `/api/config` | Informa se o autocadastro está aberto (sem sessão) |
| * | `/api/auth/*` | Login, logout, sessão, recuperação de senha (Better Auth) |

## Projetos (`routes/projects.ts`)

| Método | Rota | Descrição |
|---|---|---|
| GET, POST | `/api/projects` | Listar e criar projetos |
| GET, PATCH, DELETE | `/api/projects/:id` | Ler, renomear (ou trocar a fonte) e excluir |
| POST | `/api/projects/:id/dados` | Enviar uma planilha para o projeto |
| GET, POST | `/api/projects/:id/chats` | Listar e criar conversas |
| PATCH, DELETE | `/api/projects/:id/chats/:chatId` | Renomear e excluir conversa |
| GET | `/api/projects/:id/chats/:chatId/messages` | Mensagens da conversa |
| GET, PUT | `/api/projects/:id/panel` | Visualizações salvas do projeto |
| GET, POST | `/api/projects/:id/notes` | Notas do projeto |
| PATCH, DELETE | `/api/projects/:id/notes/:noteId` | Editar e excluir nota |

## Fontes e datasets (`routes/sources.ts`)

Importar, conectar, usar o editor SQL e publicar exigem perfil **analista** ou **administrador**.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/sources` | Fontes e datasets visíveis |
| POST | `/api/sources` | Criar fonte (upload de arquivo ou conexão) |
| POST | `/api/sources/dataset` | Criar dataset a partir de uma consulta |
| POST | `/api/sources/test` | Testar uma conexão |
| GET, PATCH, DELETE | `/api/sources/:id` | Ler, editar e excluir |
| GET | `/api/sources/:id/usage` | Dashboards e projetos que dependem da fonte |
| POST | `/api/sources/:id/publish` | Publicar ou despublicar dataset |
| POST | `/api/sources/:id/refresh` | Atualizar dados importados |
| GET | `/api/sources/:id/preview` | Amostra de uma tabela (`?table=`) |
| GET | `/api/sources/:id/profile` | Perfil das colunas |
| POST | `/api/sources/:id/run` | Executar SQL no editor |
| POST | `/api/sources/:id/query` | Consulta (opcionalmente dentro de um projeto) que gera um resultado |
| POST | `/api/sources/cross/run` | Consulta cruzando fontes |
| GET | `/api/results`, `/api/results/:id` | Consultas recentes (sem linhas) e um resultado completo (`resultId`) |

## Preparação de dados (`routes/prep.ts`)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/prep/run` | Executar as etapas e devolver o resultado |
| POST | `/api/prep/profile` | Perfil de uma coluna após as etapas |
| POST | `/api/prep/values` | Valores distintos de uma coluna |

## Dashboards (`routes/dashboards.ts`)

| Método | Rota | Descrição |
|---|---|---|
| GET, POST | `/api/dashboards` | Listar e criar |
| GET, PUT, DELETE | `/api/dashboards/:id` | Ler, salvar e excluir |
| GET | `/api/dashboards/workspace` | Projetos e visualizações do usuário que podem virar elementos de dashboard |
| POST | `/api/dashboards/data` | Dados de um elemento (modo edição) |
| POST | `/api/dashboards/filter-options` | Opções de um filtro |
| GET, POST | `/api/dashboards/:id/versions` | Histórico e nova versão |
| POST | `/api/dashboards/:id/versions/:versionId/restore` | Restaurar uma versão |
| DELETE | `/api/dashboards/:id/versions/:versionId` | Excluir uma versão |
| GET, POST, PATCH, DELETE | `/api/dashboards/:id/share` | Link público |
| GET, PUT | `/api/dashboards/:id/access` | Acesso por pessoa |
| GET | `/api/dashboards/shared` | Dashboards compartilhados comigo |
| GET | `/api/dashboards/:id/view` e `.../data`, `.../filter-options` (POST) | Leitura por quem recebeu acesso |
| GET | `/api/public/dashboards/:token` e `.../data`, `.../filter-options` (POST) | Leitura pelo link público (sem sessão) |
| GET, POST | `/api/analyses` | Visualizações salvas usadas pelos dashboards |

## Chat (`routes/chat.ts`)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/chat` | Chat do workspace (fluxo em streaming; ferramenta `consultar_dados` no servidor) |
| POST | `/api/chat/dashboard` | Assistente do editor de dashboards |
| POST | `/api/chat/html` | Agente do código de visuais HTML (analista e administrador) |

## Administração (`routes/admin.ts`, só administrador)

| Método | Rota | Descrição |
|---|---|---|
| GET, POST | `/api/admin/users` | Listar e criar usuários |
| POST | `/api/admin/users/:id/access-link` | Novo link de primeiro acesso |
| PATCH, DELETE | `/api/admin/users/:id` | Alterar perfil, ativar e desativar, remover |
| GET | `/api/admin/audit` | Registro de atividades |
