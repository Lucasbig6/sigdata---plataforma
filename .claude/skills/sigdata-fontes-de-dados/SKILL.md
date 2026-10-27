---
name: sigdata-fontes-de-dados
description: Área de Fontes de Dados do SIGDATA — listar fontes conectadas, fluxo de nova conexão (banco relacional, CSV, XLSX) simulado, inspeção de tabelas, colunas, tipos, amostra de dados, relacionamentos e qualidade dos dados, e base para a futura preparação de dados. Use sempre que o pedido envolver fontes, conexões, importação de arquivos, schema, colunas, tipos, perfil/qualidade de dados, relacionamentos ou seleção de fonte no workspace.
---

# Fontes de dados no SIGDATA

As fontes alimentam tudo: o chat pergunta sobre elas, os resultados vêm delas, os painéis dependem delas. A área de fontes precisa responder rápido a três perguntas do usuário: **o que tenho conectado, o que tem dentro e se dá para confiar.**

## Escopo atual

Interface e fluxos simulados. A conexão com banco é um formulário que valida campos e "testa" via serviço mock; não use drivers reais. Para CSV/XLSX, ler o arquivo **no navegador** para gerar prévia e perfil é aceitável e torna o protótipo convincente — mas o arquivo não vai para servidor nenhum. Pergunte antes de adicionar uma dependência de leitura (ex.: Papa Parse para CSV, SheetJS para XLSX), salvo se já estiver no projeto.

## Modelo

```ts
type FonteDados = {
  id: string;
  projetoIds: string[];
  nome: string;
  tipo: "postgres" | "mysql" | "sqlserver" | "csv" | "xlsx";
  status: "conectada" | "erro" | "sincronizando";
  atualizadoEm: string;
  tabelas: Tabela[];
};

type Tabela = { id: string; nome: string; linhas: number; colunas: Coluna[]; relacionamentos?: Relacionamento[] };

type Coluna = {
  nome: string;
  tipo: "texto" | "inteiro" | "decimal" | "data" | "booleano" | "desconhecido";
  nulos: number;          // contagem
  distintos: number;
  exemplos: string[];
  chave?: "primaria" | "estrangeira";
};

type Relacionamento = { deColuna: string; paraTabela: string; paraColuna: string; origem: "declarado" | "inferido" };
```

Ajuste ao que já existir; os tipos ficam em `lib/domain` (skill `sigdata-mock-data`).

## Telas

**Lista de fontes** — tipo (ícone + rótulo), nome, status, nº de tabelas, última atualização, projetos que usam. Ação primária "Conectar fonte". Filtro por tipo.

**Nova fonte** — escolha do tipo, depois:
- Banco: host, porta, banco, usuário, senha (campo mascarado, nunca persistido no mock), SSL. "Testar conexão" com resultado simulado (sucesso/erro com mensagem útil).
- Arquivo: arrastar ou selecionar; para XLSX, escolher planilha(s); prévia das primeiras linhas; confirmação da linha de cabeçalho e do separador (CSV) e dos tipos inferidos.

**Detalhe da fonte** — navegação em duas colunas: lista de tabelas à esquerda (com busca), tabela selecionada à direita com abas:
- *Colunas*: nome, tipo, % nulos, distintos, exemplos, chave.
- *Amostra*: primeiras linhas, rolagem contida.
- *Relacionamentos*: lista (e, se couber, diagrama simples) distinguindo declarados de inferidos.
- *Qualidade*: alertas acionáveis — coluna com muitos nulos, tipo misto, código sem descrição (`st_pedido`), possível duplicidade de chave.

## Integração com o workspace

- O seletor de fonte ativa fica no cabeçalho do workspace; trocar a fonte não apaga a conversa, apenas muda o contexto das próximas perguntas (indique isso).
- "Perguntar sobre esta tabela" no detalhe leva ao workspace do projeto com a fonte e a tabela pré-selecionadas e uma sugestão de pergunta.

## Preparação de dados (futuro)

Não implemente agora, mas não bloqueie: renomear campos, tratar nulos, descrever códigos e criar "visões preparadas" virão depois. Deixe as colunas com espaço para um **apelido** e uma **descrição** opcionais no tipo, e os alertas de qualidade com um lugar natural para uma ação futura ("Corrigir").

## Estados

Nenhuma fonte · fonte com erro de conexão (mensagem + reconectar) · arquivo inválido ou vazio · tabela sem linhas · tabela com centenas de colunas (busca e virtualização simples).
