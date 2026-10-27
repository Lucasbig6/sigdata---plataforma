---
name: sigdata-feature
description: Fluxo de trabalho para implementar qualquer funcionalidade, tela, componente ou ajuste no frontend do SIGDATA (Next.js + Tailwind v4 + shadcn + Assistant UI). Use sempre que o pedido envolver criar, alterar, refatorar ou corrigir algo na interface do SIGDATA — páginas, navegação, workspace, painéis, fontes de dados — mesmo que o usuário não peça explicitamente um "plano".
---

# Implementando uma funcionalidade no SIGDATA

O SIGDATA é um protótipo de frontend que valida a experiência de um ambiente analítico com IA. O maior risco não é falta de código, e sim código que quebra decisões existentes, cresce em páginas monolíticas ou gera elementos visuais sem função. Este fluxo existe para evitar isso.

## 1. Entender antes de escrever

- Identifique **qual problema do usuário** o pedido resolve (navegação, análise ou organização). Se não resolver nenhum, questione antes de implementar.
- Inspecione o código relacionado: rotas em `app/`, componentes existentes, providers de estado, tokens de tema no CSS global. Procure algo reutilizável antes de criar.
- Confira `package.json` para as versões reais de Next, React, Tailwind e Assistant UI. Não presuma APIs de versões antigas.
- Leia as configurações (`next.config.*`, CSS global com `@theme`, `components.json`) antes de mexer nelas, e só mexa se a tarefa exigir. O projeto tem decisões próprias de cache e navegação que não são óbvias.

## 2. Delimitar o escopo

- Tarefa visual = interface + estado local + mocks. Não crie rotas de API, ORM, conexões reais ou autenticação, a menos que o pedido seja explicitamente sobre isso.
- Divida mudanças grandes em etapas que deixem o app funcionando entre uma e outra, e diga ao usuário quais são.
- O que ficar deliberadamente para depois recebe um comentário `// TODO(sigdata): ...` curto e é mencionado na resposta.

## 3. Implementar

- **Componentes**: uma responsabilidade por componente; arquivos de página apenas compõem. Agrupe componentes de domínio por área (`components/workspace/`, `components/paineis/`, `components/fontes/`, `components/projetos/`), seguindo a convenção que já existir no repositório se for diferente.
- **Tipos**: TypeScript strict, sem `any`. Tipos de domínio vêm da camada de dados (skill `sigdata-mock-data`).
- **Estado**: o mais local possível. Suba para contexto/store só quando duas áreas precisarem dele (ex.: chat e área analítica).
- **Server vs client**: `"use client"` só onde há interatividade; páginas e layouts continuam Server Components quando possível.
- **Visual**: siga a skill `sigdata-ui`.
- **Toda interação responde**: botões, menus, seletores e redimensionadores fazem algo coerente — atualizar estado mockado, navegar, abrir um diálogo. Se a função ainda não existe, mostre um aviso claro ("Disponível em breve") em vez de deixar o clique sem reação.
- Telas que exibem dados cobrem os estados **vazio, carregando e erro**.

## 4. Verificar

Rode o que o projeto oferecer:

```bash
npx tsc --noEmit
npm run lint      # se existir
npm run build     # garante que App Router e cache não quebraram
```

Depois percorra o fluxo como usuário: a navegação preserva o contexto (projeto aberto, fonte selecionada, resultado ativo)? O que aparece com a lista vazia? A área analítica funciona estreita e larga?

## 5. Reportar

Em poucas linhas: o que mudou, arquivos principais, o que ficou mockado e o próximo passo natural. Não cole o código inteiro na resposta.
