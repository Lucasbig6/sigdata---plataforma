# 03 · Guia de uso

Passo a passo das telas, por perfil. Onde houver uma captura de tela prevista, ela aparece como **📷 Captura** com o
nome do arquivo esperado em `docs/img/` (veja [img/LEIA-ME.md](img/LEIA-ME.md)).

## Acesso

1. Abra o endereço do sistema. Sem sessão, você cai em **Entrar**.
2. Entre com e-mail e senha. Em produção o cadastro é por **convite**: o administrador cria a conta e envia um link de
   primeiro acesso (válido por 24 h) para você definir a senha. Em desenvolvimento o autocadastro fica aberto.
3. Esqueceu a senha? Use a recuperação na tela de entrada.
4. Perfil, nome e senha ficam em **Configurações**.

📷 Captura: `login.png`

## Página inicial: projetos

Cada **projeto** é um espaço de trabalho seu, com conversas, visualizações salvas e notas. Na página inicial você vê os
projetos em cartões ou lista, cria um novo e abre um existente. Atalhos de dados levam direto ao envio de planilha.

📷 Captura: `home-projetos.png`

## Workspace: conversar com os dados

O workspace tem três áreas:

| Área | Para que serve |
|---|---|
| **Esquerda** | Fontes disponíveis (a escolhida fica marcada), detalhes da fonte (tabelas, colunas, amostra) e as conversas do projeto. |
| **Centro** | O chat com o assistente. |
| **Direita (Estúdio)** | Ferramentas, **visualizações salvas**, **dashboards** e **notas** do projeto. |

📷 Captura: `workspace.png`

### Escolher os dados

- Escolha um dataset na lista da esquerda, ou no seletor **Dados** da barra superior.
- Para usar uma planilha sua, envie um CSV ou Excel (até 50 MB). Ela fica só neste projeto. Também dá para
  **arrastar o arquivo** para qualquer lugar do chat.

### Perguntar

- Escreva a pergunta em linguagem natural: "vendas por mês", "top 10 cidades por atendimentos".
- Digite `@` para **citar uma tabela** da fonte do projeto.
- Digite `/` para **atalhos de pedido** (gráfico, tabela, indicador, resumo).
- O assistente consulta os dados, mostra o resultado como gráfico, tabela ou indicador e explica em poucas frases.
- Dá para **trocar o tipo de gráfico** no próprio chat antes de salvar.

### Salvar e organizar

- **Salvar visualização** guarda o resultado no Estúdio.
- O ícone de marcador abaixo de qualquer resposta fixa o texto como **nota** do projeto.
- No Estúdio, edite título, tipo e colunas de uma visualização salva. O assistente faz o mesmo por pedido
  ("troque esse gráfico por barras horizontais").

### Ferramentas do Estúdio

| Ferramenta | O que faz |
|---|---|
| Resumo executivo | O assistente consulta os dados e resume em até 6 tópicos. |
| Insights | Os 3 achados mais relevantes, cada um com número e gráfico. |
| Perguntas sugeridas | Lista de perguntas com base nas colunas do dataset. |
| Qualidade dos dados | Verificação automática (colunas vazias, constantes, identificadores repetidos). Não usa IA. |
| Dashboard | Monta um dashboard com as visualizações salvas, ou pede ao assistente que crie algumas. |

## Dashboards

Em **Dashboards** ficam todos os seus painéis. Abra um para editar, ou crie um novo.

📷 Captura: `dashboards-lista.png`

### Editor

| Área | Função |
|---|---|
| **Esquerda** | Biblioteca: visualizações salvas (arraste ou clique) e elementos (filtros, textos, formas…). |
| **Centro** | A página. Mova e redimensione os elementos; use a barra de cima para alinhar, distribuir e agrupar. |
| **Direita** | Propriedades do elemento selecionado: dados, estilo, posição. Sem seleção, mostra a página, as medidas e as camadas. |

📷 Captura: `dashboard-editor.png`

Passos comuns:

1. **Adicionar** uma visualização ou elemento arrastando-o da biblioteca.
2. **Ligar aos dados**: no painel direito, aba **Dados**, escolha fonte, tabela, dimensão e medida (ou solte uma coluna
   sobre o gráfico).
3. **Filtros**: adicione um filtro de período ou de categoria. Os gráficos reagem; clicar numa categoria filtra os outros.
4. **Drill-down**: no gráfico, defina níveis de detalhe; na visualização, clicar numa categoria abre o próximo nível.
5. **Páginas**: crie várias páginas no rodapé.
6. **Organizar automaticamente** arruma títulos, filtros, indicadores e gráficos.
7. **Salvar** (botão ou Ctrl+S). O **Histórico** permite voltar a versões anteriores.
8. **Visualizar** mostra como o público verá, inclusive o layout para celular.

#### Atalhos do editor

| Atalho | Ação |
|---|---|
| Arrastar no fundo, ou Shift+clique | Selecionar vários elementos |
| Setas (Shift = 10 px) | Mover a seleção |
| Delete | Excluir |
| Ctrl+C / X / V | Copiar, recortar e colar (até entre painéis) |
| Ctrl+D · Ctrl+G · Ctrl+A | Duplicar · agrupar · selecionar tudo |
| Ctrl+Z · Ctrl+Shift+Z | Desfazer · refazer |
| Ctrl+S | Salvar |
| Botão direito | Menu do elemento |

### Assistente do editor

O botão **Assistente** abre um chat que monta o painel por você ("monte um painel com os principais indicadores"). Ele
adiciona gráficos, indicadores, filtros e páginas enquanto você acompanha. Cada pedido é um único passo de desfazer, e nada
é salvo até você salvar.

### Compartilhar

1. Clique em **Compartilhar**.
2. Gere um **link público** (somente leitura, com validade opcional) ou compartilhe com **pessoas logadas** por e-mail, ou com todos os usuários.
3. Quem abre vê a **versão salva**, com dados ao vivo. Salve antes de compartilhar.
4. Revogue o link quando quiser.

📷 Captura: `compartilhar.png`

## Fontes de dados (analista e administrador)

Em **Fontes de dados** você gerencia as origens.

📷 Captura: `fontes-lista.png`

| Tipo | Como funciona |
|---|---|
| CSV, XLSX | Enviado e guardado como tabela. |
| PostgreSQL, MySQL/MariaDB, SQL Server | Consulta ao vivo, sempre em leitura. Use um usuário só de leitura. |
| API REST, Google Sheets (por link) | Importados; "Atualizar dados" busca de novo. |

- **Detalhe da fonte**: tabelas, colunas e tipos, amostra e perfil.
- **Editor SQL**: escreva um `SELECT`/`WITH`, veja os resultados paginados e salve o resultado como **dataset**.
- **Preparar dados**: transformações em etapas, no estilo Power Query (filtrar, renomear, mudar tipos, remover vazios e duplicadas, agrupar, mesclar e acrescentar tabelas…).
- **Publicar**: um dataset em rascunho só aparece para você e para o admin. Ao publicar, todos o usam. Antes de despublicar
  ou excluir, a tela mostra quantos dashboards e projetos serão afetados.

📷 Captura: `editor-sql.png` · `preparar-dados.png`

## Administração (administrador)

- **Usuários** (`/admin/usuarios`): criar contas (a pessoa recebe um link de primeiro acesso), mudar perfil, desativar,
  reativar e remover. Datasets publicados de quem é removido passam para o admin.
- **Atividades** (`/admin/atividades`): registro de ações sobre fontes, datasets, contas, links e compartilhamentos.

📷 Captura: `admin-usuarios.png`

## Dicas

- Se uma resposta parecer estranha, use **Ver consulta** na visualização para conferir o SQL que o assistente executou.
- Prefira datasets publicados e preparados pelos analistas: assim todos analisam os mesmos números.
- Para um painel limpo, salve só as visualizações que você realmente quer e use **Organizar automaticamente** no fim.
