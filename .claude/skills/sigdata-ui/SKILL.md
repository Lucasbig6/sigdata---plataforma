---
name: sigdata-ui
description: Identidade visual e convenções de interface do SIGDATA — tema escuro do workspace, tokens de cor no Tailwind v4 (@theme), tipografia, espaçamento, cards de projeto, componentes shadcn e legibilidade de gráficos. Use sempre que for criar ou ajustar qualquer elemento visual do SIGDATA (layout, cores, cards, botões, tabelas, gráficos, estados vazios, animações), mesmo quando o pedido for "deixa mais bonito" ou "arruma o visual".
---

# Interface do SIGDATA

O SIGDATA deve parecer um **ambiente profissional de análise de dados** — algo entre uma IDE, uma ferramenta de IA e uma plataforma de BI — e não um chatbot genérico nem um "admin dashboard" de template. Cada decisão visual existe para ajudar a ler dados e manter o foco no trabalho.

## Antes de estilizar

1. Abra o CSS global e localize os tokens do tema (bloco `@theme` e variáveis em `:root` / `.dark`). **Use os tokens existentes**; crie um novo só se nenhum servir, e crie-o no mesmo lugar.
2. Verifique os componentes em `components/ui/` (shadcn). Reutilize `Button`, `Card`, `Dialog`, `DropdownMenu`, `Tabs`, `Tooltip` etc. antes de criar algo próprio. Para adicionar um novo componente shadcn, use o CLI do projeto em vez de colar código de memória.
3. Tailwind v4: configuração via CSS. Não crie `tailwind.config.js` nem use sintaxe de plugins antigos.

## Direção visual

- **Workspace escuro por padrão.** Superfícies em camadas: fundo da aplicação < painéis < cards/elementos elevados. A diferença entre camadas é sutil (poucos pontos de luminosidade) e reforçada por bordas finas de baixo contraste.
- **Uma cor de destaque principal** para ação primária, foco e seleção. Cores de status (sucesso, alerta, erro) só quando comunicam status. Nada de cor decorativa.
- **Tipografia** legível e com hierarquia clara: títulos de seção discretos, conteúdo em tamanho confortável, números e código em fonte monoespaçada com `tabular-nums` para alinhar valores.
- **Espaçamento** em escala consistente (múltiplos de 4px). Densidade moderada: é uma ferramenta de trabalho, não uma landing page.
- **Bordas e raios** discretos e uniformes; sombras mínimas no tema escuro (prefira borda + mudança de superfície).
- **Animações** curtas (150–250ms), só para dar continuidade (abrir painel, trocar aba, aparecer resultado). Respeite `prefers-reduced-motion`.

## Evitar

- Gradientes chamativos, glassmorphism, brilhos, ícones decorativos.
- Cards com metadados que ninguém usa; mostre o essencial e deixe detalhes em hover, tooltip ou menu.
- Ícones sem função ou sem rótulo acessível (`aria-label` em botões só com ícone).
- Copiar o visual de outro produto (NotebookLM, Power BI, ChatGPT, Claude). Referências servem para conceito e organização, não para pixels.

## Padrões de componente

**Card de projeto (página inicial)** — metáfora de pasta/espaço de trabalho: nome em destaque, uma linha de contexto (descrição curta ou nº de fontes/painéis), data de atualização discreta, menu de ações (`…`) no canto. Grade responsiva. Hover sutil (borda ou superfície), card inteiro clicável, foco visível por teclado. Inclua o card "Novo projeto".

**Cabeçalhos de área** — título curto + ações à direita; nada de subtítulos explicando o óbvio.

**Tabelas de dados** — cabeçalho fixo, números alinhados à direita com `tabular-nums`, linhas com separador fino, rolagem horizontal contida no próprio container.

**Indicadores (KPI)** — rótulo pequeno, valor grande, variação com cor de status e sinal (+/−) para não depender só da cor.

**Estados vazios** — uma frase do que falta + a ação que resolve ("Nenhuma fonte conectada. Conectar fonte"). Sem ilustrações grandes.

## Gráficos

- Paleta categórica derivada dos tokens do tema, testada no fundo escuro; no máximo ~6 séries distinguíveis.
- Eixos e grid em baixo contraste; rótulos legíveis; tooltip com valores formatados (pt-BR: `1.234,56`, datas `dd/mm/aaaa`).
- Títulos que dizem o que o gráfico mostra; legenda só quando há mais de uma série.
- Use a biblioteca de gráficos que o projeto já adotou; se nenhuma existir, proponha uma antes de instalar.

## Checagem final

- Contraste de texto suficiente no tema escuro.
- Funciona com o painel analítico estreito (~360px) e largo.
- Foco de teclado visível em todos os elementos interativos.
- Nenhuma cor hexadecimal solta no JSX: tudo via tokens/classes do tema.
