---
name: sigdata-paineis
description: Construção da área de Painéis (dashboards) do SIGDATA — grade de widgets, edição de layout (mover, redimensionar), modo visualização vs edição, salvar resultados do workspace em um painel, personalização de cada elemento e compartilhamento por link (simulado). Use sempre que o pedido envolver dashboards, painéis, widgets, layout arrastável, "salvar no painel", compartilhar análise ou personalizar visualizações.
---

# Painéis no SIGDATA

Um painel é uma **composição de resultados analíticos** (gráficos, tabelas, KPIs, textos) organizada visualmente. A meta é a liberdade de composição de uma ferramenta de BI com a simplicidade de edição de uma ferramenta de design: arrastar, redimensionar, ajustar — sem formulários pesados.

## Modelo

```ts
type Painel = {
  id: string;
  projetoId: string;
  nome: string;
  descricao?: string;
  elementos: ElementoPainel[];
  atualizadoEm: string;
  compartilhamento: { publico: boolean; token?: string };
};

type ElementoPainel = {
  id: string;
  tipo: "grafico" | "tabela" | "kpi" | "texto";
  resultadoId?: string;          // origem no workspace, quando houver
  titulo: string;
  layout: { x: number; y: number; w: number; h: number };  // em unidades de grade
  config: ConfigVisualizacao;    // cópia ajustável, independente do resultado original
};
```

O elemento guarda uma **cópia da configuração** do resultado: editar o painel não altera a conversa, e vice-versa. Guarde `resultadoId` para rastrear a origem ("Abrir conversa de origem").

## Modos

- **Visualização** (padrão): limpo, sem alças, interações de leitura (tooltip, filtro, expandir elemento).
- **Edição**: alças de redimensionar, arrastar pelo cabeçalho do elemento, menu por elemento (editar, duplicar, remover), barra para adicionar elemento. Indicação clara de que está editando e de alterações não salvas.
- Botões **Salvar** e **Descartar**; aviso ao sair com alterações pendentes.

## Layout

- Grade de 12 colunas com altura de linha fixa; posições em unidades de grade (independe da tela).
- Elementos não se sobrepõem; ao soltar, compacta para cima.
- Responsivo: em telas estreitas, empilha em uma coluna na ordem (y, x) em modo visualização; edição de layout pode ser restrita a telas largas.
- Antes de escrever lógica de drag-and-drop do zero, verifique se o projeto já tem uma biblioteca de grade/arrastar. Se não, proponha uma (ex.: `react-grid-layout` ou `dnd-kit`) explicando o motivo, e confirme antes de instalar.
- Teclado: elemento selecionado pode ser movido com setas em modo edição, ou pelo menos reposicionado via menu — arrastar não deve ser o único caminho.

## Personalização de elemento

Painel lateral (ou popover) com o essencial: título, tipo de visualização, campos/séries, formato de número, cores dentro da paleta do tema, mostrar/ocultar legenda. Pré-visualização ao vivo. Não exponha dezenas de opções: comece com o que muda a leitura do dado.

## Do workspace para o painel

"Salvar em painel" no workspace abre um seletor: painéis existentes do projeto + "Novo painel". Ao salvar, o elemento entra na primeira posição livre com tamanho padrão por tipo (KPI pequeno, gráfico médio, tabela larga) e um aviso com atalho "Abrir painel".

## Compartilhamento (simulado)

- Diálogo "Compartilhar": alternar link público, gerar token, copiar link (`/p/<token>`), indicar que é somente leitura.
- A rota pública renderiza o painel em modo visualização, sem navegação do app.
- Persistência via serviço mock (skill `sigdata-mock-data`); nada de autenticação real nesta fase — deixe `TODO(sigdata)` onde permissões entrarão.

## Estados

Projeto sem painéis (CTA para criar ou salvar do workspace) · painel vazio em edição (sugere adicionar) · elemento cujo resultado de origem não existe mais (continua funcionando com a cópia; só o link de origem some) · link compartilhado inválido.
