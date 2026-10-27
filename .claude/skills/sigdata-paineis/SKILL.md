---
name: sigdata-paineis
description: Construção da área de Painéis (dashboards) do SIGDATA — canvas livre com tamanho de página, edição de layout (mover, redimensionar), modo visualização vs edição, elementos ligados a dados ao vivo, filtros, salvar resultados do workspace em um painel, personalização de cada elemento e compartilhamento por link público. Use sempre que o pedido envolver dashboards, painéis, widgets, layout arrastável, "salvar no painel", compartilhar análise ou personalizar visualizações.
---

# Painéis no SIGDATA

Um painel é uma **composição de resultados analíticos** (gráficos, tabelas, KPIs, textos) organizada visualmente. A meta é a liberdade de composição de uma ferramenta de BI com a simplicidade de edição de uma ferramenta de design: arrastar, redimensionar, ajustar — sem formulários pesados.

## Modelo (implementado)

Tipos em `shared/dashboards/types.ts` (fonte da verdade, usados pelo frontend e pelo backend):

- `Dashboard` = `{ id, name, description, canvas: { width, height }, elements[] }` — canvas **livre** em px lógicos; zoom é só `scale` na exibição.
- `DashboardElement` = `{ id, type, x, y, w, h, z, hidden, props }`, tipos: chart, table, kpi/percent/comparison, text/title, image, divider, shape, filter.
- Dados ao vivo: `props.binding: DataBinding` em gráfico/tabela/indicador — `mode: "builder"` (tabela, agrupar por, medida, agregação, ordem, limite; o **backend** monta o SQL validando nomes contra o schema da fonte) ou `mode: "sql"` (SQL somente-leitura do autor, eixos x/y).
- Filtro: `props.binding: FilterBinding` (fonte, tabela, coluna). Filtra elementos em modo builder da **mesma fonte e tabela**; o valor escolhido é estado de visualização (`DashboardDataProvider`), o valor salvo é só o padrão.
- `props.dataset` (demo/análise salva) é legado: continua funcionando quando não há `binding`.

## Modos

- **Visualização** (padrão): limpo, sem alças, interações de leitura (tooltip, filtro, expandir elemento).
- **Edição**: alças de redimensionar, arrastar pelo cabeçalho do elemento, menu por elemento (editar, duplicar, remover), barra para adicionar elemento. Indicação clara de que está editando e de alterações não salvas.
- Botões **Salvar** e **Descartar**; aviso ao sair com alterações pendentes.

## Layout

- Canvas livre (não grade de colunas): posição/tamanho em px lógicos, sobreposição controlada por `z`.
- Tamanho da página por predefinições (`PAGE_PRESETS`: 16:9, Full HD, A4, Carta…) ou personalizado; ao reduzir, `setCanvasSize` reposiciona/encolhe elementos.
- Grade visível e "encaixar na grade" (8 px) são preferências do editor, não do documento.
- Arrastar não é o único caminho: setas movem, painel Layout tem X/Y/L/A, barra flutuante tem duplicar/camadas/ocultar/excluir.

## Personalização de elemento

Painel lateral (ou popover) com o essencial: título, tipo de visualização, campos/séries, formato de número, cores dentro da paleta do tema, mostrar/ocultar legenda. Pré-visualização ao vivo. Não exponha dezenas de opções: comece com o que muda a leitura do dado.

## Do workspace para o painel

"Salvar em painel" no workspace abre um seletor: painéis existentes do projeto + "Novo painel". Ao salvar, o elemento entra na primeira posição livre com tamanho padrão por tipo (KPI pequeno, gráfico médio, tabela larga) e um aviso com atalho "Abrir painel".

## Compartilhamento (real)

- `ShareDialog` liga/desliga o link público (`POST/DELETE /api/dashboards/:id/share`) → `/compartilhado/<token>`.
- A página pública mostra a **versão salva**, com dados consultados ao vivo nas fontes do dono; visitantes só escolhem valores dos filtros salvos.
- Rotas públicas (`/api/public/dashboards/:token/...`) executam apenas ligações que estão no documento salvo e só para elementos do tipo certo — nunca aceite SQL, binding ou coluna vindos do visitante.

## Estados

Projeto sem painéis (CTA para criar ou salvar do workspace) · painel vazio em edição (sugere adicionar) · elemento cujo resultado de origem não existe mais (continua funcionando com a cópia; só o link de origem some) · link compartilhado inválido.
