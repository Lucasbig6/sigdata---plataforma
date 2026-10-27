---
name: sigdata-mock-data
description: Como criar e organizar dados simulados no SIGDATA — tipos de domínio (projeto, fonte, tabela, coluna, resultado, painel), repositórios/serviços com interface assíncrona e fixtures realistas, para que os mocks possam ser trocados por APIs reais depois. Use sempre que uma tela precisar de dados, quando for criar um tipo de domínio, adicionar exemplos, simular latência/erro, ou quando alguém sugerir chamar banco/API real numa tarefa de interface.
---

# Dados simulados no SIGDATA

O protótipo roda com dados mockados, mas a interface precisa ser construída **como se já houvesse uma API**. Assim, quando o backend existir, troca-se a implementação do serviço e as telas continuam iguais. O erro a evitar é espalhar arrays literais dentro de componentes.

## Estrutura

Siga o que já existir no repositório; se não houver nada, use:

```
lib/
  domain/            # tipos de domínio (sem dependência de React)
    projeto.ts
    fonte.ts
    resultado.ts
    painel.ts
  data/
    index.ts         # exporta os serviços usados pela UI
    projetos.ts      # interface + implementação mock
    fontes.ts
    paineis.ts
  mocks/
    fixtures/        # dados de exemplo
    delay.ts         # latência e erros simulados
```

## Regras

1. **Componentes não importam fixtures.** Importam serviços de `lib/data`.
2. **Serviços são assíncronos** (`Promise`), mesmo no mock — o código da UI já nasce lidando com carregamento e erro.
3. **Tipos de domínio são a fonte da verdade.** Ficam em `lib/domain`, sem `any`, sem tipos de bibliotecas de UI. Datas como string ISO.
4. **Latência configurável**: um helper `delay()` com tempo pequeno (200–600ms) e uma forma de forçar erro (ex.: variável de ambiente ou flag de desenvolvimento) para testar estados de erro.
5. **Mutações funcionam em memória** (criar projeto, renomear, salvar painel) e, quando o fluxo exigir persistência entre recargas, em `localStorage` encapsulado no serviço, com try/catch. A UI não sabe onde os dados estão.
6. **Ids estáveis e determinísticos** nas fixtures (`proj_vendas`, `fonte_crm`) para links e testes previsíveis; ids novos via `crypto.randomUUID()`.
7. Nada de backend real, ORM ou driver de banco nesta camada enquanto o escopo for interface.

## Exemplo de serviço

```ts
// lib/data/projetos.ts
import type { Projeto, NovoProjeto } from "@/lib/domain/projeto";
import { projetosFixture } from "@/lib/mocks/fixtures/projetos";
import { delay } from "@/lib/mocks/delay";

export interface ProjetosService {
  listar(): Promise<Projeto[]>;
  obter(id: string): Promise<Projeto | null>;
  criar(dados: NovoProjeto): Promise<Projeto>;
}

let projetos = [...projetosFixture];

export const projetosService: ProjetosService = {
  async listar() { await delay(); return projetos; },
  async obter(id) { await delay(); return projetos.find(p => p.id === id) ?? null; },
  async criar(dados) {
    await delay();
    const novo: Projeto = { ...dados, id: crypto.randomUUID(), atualizadoEm: new Date().toISOString() };
    projetos = [novo, ...projetos];
    return novo;
  },
};
```

Adapte ao padrão de data fetching do projeto (Server Components chamando o serviço, hooks no cliente, ou a lib de cache que já estiver em uso).

## Fixtures realistas

Dados plausíveis tornam a validação de UX honesta — layouts quebram com nomes longos, valores grandes e nulos, e é melhor descobrir isso agora.

- Contexto brasileiro: nomes, cidades, valores em R$, datas recentes.
- 3–6 projetos com temas distintos (ex.: Vendas regionais, Atendimento ao cliente, Indicadores de saúde municipal, Financeiro).
- Fontes de cada tipo: banco relacional (com várias tabelas e chaves), CSV, XLSX.
- Colunas com tipos variados, alguns nulos, códigos não óbvios (`cod_mun`, `st_pedido`) — isso alimenta a futura preparação de dados.
- Inclua casos de borda: projeto sem fontes, tabela vazia, nome muito longo, número muito grande.
- Para o chat em modo mock: um mapa de perguntas de exemplo → `ResultadoAnalitico` com dados coerentes com a fonte.

Para conjuntos maiores (séries temporais), gere com uma função determinística (seed fixa) em vez de colar centenas de linhas.
