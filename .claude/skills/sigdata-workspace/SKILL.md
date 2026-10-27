---
name: sigdata-workspace
description: Arquitetura e evolução do workspace do projeto no SIGDATA — chat com Assistant UI à esquerda, área analítica redimensionável à direita, e a ligação entre mensagens e resultados (gráficos, tabelas, KPIs, consultas). Use sempre que o pedido mexer no chat, na área analítica, no redimensionamento, na exibição de resultados gerados pela IA, em "abrir no painel", em alternar entre resultados, ou na integração Groq/Assistant UI.
---

# Workspace do projeto

O workspace é o coração do SIGDATA. A ideia central: **a conversa produz resultados analíticos, e esses resultados vivem como objetos próprios** na área direita — podem ser examinados, ajustados, alternados e salvos em painéis. Não é um gráfico estático colado ao lado de um chatbot.

## Fluxo de referência

1. Usuário abre um projeto.
2. Seleciona uma fonte de dados disponível.
3. Pergunta em linguagem natural.
4. A IA responde em texto e, quando faz sentido, gera um **resultado**.
5. O resultado aparece na área analítica.
6. Usuário ajusta (tipo de gráfico, campos, filtros) ou pede alteração no chat.
7. Salva o resultado em um painel.
8. Compartilha o painel.

Toda mudança no workspace deve deixar esse fluxo mais curto ou mais claro.

## Modelo: o "resultado analítico"

Trate cada saída da IA como um objeto com identidade, não como HTML dentro da mensagem:

```ts
type ResultadoAnalitico = {
  id: string;
  projetoId: string;
  mensagemId: string;          // de onde veio na conversa
  fonteId?: string;
  titulo: string;
  tipo: "grafico" | "tabela" | "kpi" | "consulta";
  consulta?: { linguagem: "sql"; texto: string };
  visualizacao?: ConfigVisualizacao;   // tipo de gráfico, eixos, séries
  dados: LinhaDados[];                 // mock por enquanto
  criadoEm: string;
  versao: number;                      // incrementa a cada ajuste
};
```

Ajuste os nomes ao que já existir no código, mas mantenha a ideia: id estável, origem rastreável (mensagem), configuração separada dos dados. Os tipos ficam na camada de dados (skill `sigdata-mock-data`).

## Ligação chat ↔ área analítica

- Mensagens que geraram resultado mostram um **cartão compacto** (título, tipo, botão "Ver na área analítica"). Clicar ativa o resultado à direita.
- A área analítica mostra o **resultado ativo** e permite alternar entre os resultados da conversa (abas, lista ou seletor — escolha o que couber no espaço).
- O resultado ativo destaca, de forma discreta, a mensagem de origem no chat.
- Ajustes feitos na área analítica geram nova versão do resultado; não reescrevem silenciosamente o histórico.
- Estado compartilhado (resultados, resultado ativo, fonte selecionada) mora em um contexto/store do workspace — não em props descendo pela árvore nem dentro de componentes do Assistant UI.

## Assistant UI e IA

- Inspecione como o runtime do Assistant UI está configurado antes de alterar. Use os pontos de extensão da biblioteca (componentes de mensagem customizados, tool UIs / renderização de tool calls) para exibir resultados, em vez de parsear texto da resposta.
- O formato natural é: a IA chama uma "ferramenta" (ex.: `gerar_visualizacao`) cujo argumento é a configuração do resultado; a UI dessa tool cria o `ResultadoAnalitico` e o cartão na mensagem.
- Enquanto não houver backend real, um **modo mock** deve produzir resultados plausíveis a partir de perguntas de exemplo, para que o fluxo seja demonstrável sem chave de API. Mantenha o Groq atrás da mesma interface, para trocar um pelo outro sem mexer na UI.
- Chaves de API nunca no cliente; chamadas ao provedor ficam em route handlers / server actions já existentes.

## Layout e redimensionamento

- Duas áreas com divisor arrastável; preserve o tamanho escolhido (localStorage com try/catch) por projeto ou globalmente, conforme já estiver no código.
- Limites mínimos para ambas as áreas; opção de recolher a área analítica e de expandi-la (foco no resultado).
- Abaixo de ~1024px, troque para alternância por abas (Chat | Análise) em vez de duas colunas espremidas.
- Cabeçalho do workspace: nome do projeto, seletor de fonte de dados ativa, acesso a Painéis e Fontes sem perder a conversa aberta.

## Área analítica como superfície de trabalho

Ela deve ter barra própria de ações para o resultado ativo: trocar tipo de visualização, ver dados (tabela), ver consulta, copiar, **salvar em painel** (abre seletor de painel ou cria um novo). A organização livre de vários elementos dentro dela é evolução futura: deixe o componente preparado para receber uma lista de resultados, mas não implemente um editor de layout aqui — isso é da skill `sigdata-paineis`.

## Estados que precisam existir

Sem fonte selecionada · conversa vazia (com sugestões de perguntas baseadas na fonte) · IA respondendo · resultado sem dados · erro do provedor (mensagem clara + tentar de novo) · nenhum resultado ativo na área analítica.
