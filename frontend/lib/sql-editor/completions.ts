/**
 * Autocomplete do editor SQL: tabelas e colunas da fonte (com tipo e
 * contagem), funções comuns do DuckDB/PostgreSQL e modelos prontos (digite
 * `sel`, `selc`, `join`, `cte`… e pressione Tab).
 */
import { snippetCompletion, type Completion, type CompletionContext, type CompletionSource } from "@codemirror/autocomplete";
import type { SQLNamespace } from "@codemirror/lang-sql";
import type { DataSource, SourceColumn } from "@/lib/domain/sources";

const SIMPLE_IDENT = /^[a-z_][a-z0-9_]*$/;

const quoteIfNeeded = (name: string) => (SIMPLE_IDENT.test(name) ? name : `"${name.replaceAll('"', '""')}"`);

const columnCompletion = (column: SourceColumn): Completion => ({
  label: column.name,
  apply: quoteIfNeeded(column.name),
  type: "property",
  detail: column.dbType.toLowerCase(),
  boost: 2,
});

/** Esquema para o `lang-sql`: `tabela.` lista as colunas; `schema.tabela` também funciona. */
export const buildSchema = (source: DataSource | null): SQLNamespace => {
  const root: Record<string, SQLNamespace> = {};
  for (const table of source?.tables ?? []) {
    const columns = table.columns.map(columnCompletion);
    const path = table.name.split(".");
    // dentro de "schema." só entra o nome da tabela; sem schema, o nome inteiro
    const short = path[path.length - 1];
    const node: SQLNamespace = {
      self: {
        label: short,
        apply: quoteIfNeeded(short),
        type: "class",
        detail: table.rowCount != null ? `${table.rowCount.toLocaleString("pt-BR")} linhas` : "tabela",
        boost: 4,
      },
      children: columns,
    };
    if (path.length === 1) {
      root[table.name] = node;
      continue;
    }
    // schema.tabela: aninha para que `schema.` sugira as tabelas
    let level = root;
    for (const part of path.slice(0, -1)) {
      const existing = level[part];
      level[part] = existing && !Array.isArray(existing) && !("self" in existing) ? existing : {};
      level = level[part] as Record<string, SQLNamespace>;
    }
    level[path[path.length - 1]] = node;
  }
  return root;
};

const fn = (label: string, template: string, detail: string) =>
  snippetCompletion(template, { label, type: "function", detail, boost: -1 });

const FUNCTIONS: Completion[] = [
  fn("SUM", "SUM(${coluna})", "soma"),
  fn("AVG", "AVG(${coluna})", "média"),
  fn("COUNT", "COUNT(${*})", "contagem"),
  fn("MIN", "MIN(${coluna})", "mínimo"),
  fn("MAX", "MAX(${coluna})", "máximo"),
  fn("MEDIAN", "MEDIAN(${coluna})", "mediana"),
  fn("STDDEV", "STDDEV(${coluna})", "desvio padrão"),
  fn("ROUND", "ROUND(${valor}, ${2})", "arredonda"),
  fn("COALESCE", "COALESCE(${valor}, ${0})", "primeiro não nulo"),
  fn("NULLIF", "NULLIF(${a}, ${b})", "nulo se iguais"),
  fn("CAST", "CAST(${valor} AS ${tipo})", "converte tipo"),
  fn("TRY_CAST", "TRY_CAST(${valor} AS ${tipo})", "converte sem erro"),
  fn("DATE_TRUNC", "DATE_TRUNC('${month}', ${coluna})", "trunca data"),
  fn("EXTRACT", "EXTRACT(${year} FROM ${coluna})", "parte da data"),
  fn("LOWER", "LOWER(${texto})", "minúsculas"),
  fn("UPPER", "UPPER(${texto})", "maiúsculas"),
  fn("TRIM", "TRIM(${texto})", "remove espaços"),
  fn("SUBSTR", "SUBSTR(${texto}, ${1}, ${3})", "trecho do texto"),
  fn("REPLACE", "REPLACE(${texto}, '${de}', '${para}')", "substitui"),
  fn("CONCAT", "CONCAT(${a}, ${b})", "junta textos"),
  fn("LENGTH", "LENGTH(${texto})", "tamanho"),
  fn("STRING_AGG", "STRING_AGG(${coluna}, '${, }')", "junta valores"),
  fn("ROW_NUMBER", "ROW_NUMBER() OVER (PARTITION BY ${grupo} ORDER BY ${coluna})", "numera linhas"),
  fn("RANK", "RANK() OVER (ORDER BY ${coluna} DESC)", "ranking"),
  fn("LAG", "LAG(${coluna}) OVER (ORDER BY ${data})", "valor anterior"),
  fn("LEAD", "LEAD(${coluna}) OVER (ORDER BY ${data})", "próximo valor"),
  fn("CURRENT_DATE", "CURRENT_DATE", "data de hoje"),
];

const snippet = (label: string, template: string, detail: string) =>
  snippetCompletion(template, { label, type: "text", detail, boost: 1 });

const SNIPPETS: Completion[] = [
  snippet("sel", "SELECT *\nFROM ${tabela}\nLIMIT ${100};", "SELECT * … LIMIT"),
  snippet("selc", "SELECT ${coluna}, COUNT(*) AS total\nFROM ${tabela}\nGROUP BY ${coluna}\nORDER BY total DESC;", "contagem por grupo"),
  snippet("sels", "SELECT ${coluna}, SUM(${valor}) AS total\nFROM ${tabela}\nGROUP BY ${coluna}\nORDER BY total DESC;", "soma por grupo"),
  snippet("dist", "SELECT DISTINCT ${coluna}\nFROM ${tabela}\nORDER BY 1;", "valores distintos"),
  snippet("join", "JOIN ${tabela} ON ${a.id} = ${b.id}", "JOIN … ON"),
  snippet("ljoin", "LEFT JOIN ${tabela} ON ${a.id} = ${b.id}", "LEFT JOIN … ON"),
  snippet("cte", "WITH ${base} AS (\n  SELECT ${*}\n  FROM ${tabela}\n)\nSELECT *\nFROM ${base};", "WITH (CTE)"),
  snippet("case", "CASE\n  WHEN ${condicao} THEN ${valor}\n  ELSE ${outro}\nEND", "CASE WHEN"),
  snippet("nulos", "SELECT COUNT(*) AS total, COUNT(${coluna}) AS preenchidos,\n  COUNT(*) - COUNT(${coluna}) AS nulos\nFROM ${tabela};", "qualidade: nulos"),
  snippet("dup", "SELECT ${coluna}, COUNT(*) AS vezes\nFROM ${tabela}\nGROUP BY ${coluna}\nHAVING COUNT(*) > 1\nORDER BY vezes DESC;", "duplicados"),
  snippet("mes", "SELECT DATE_TRUNC('month', ${data}) AS mes, SUM(${valor}) AS total\nFROM ${tabela}\nGROUP BY 1\nORDER BY 1;", "série mensal"),
];

/** Funções e modelos, oferecidos junto com as palavras-chave e o esquema. */
export const extraCompletions: CompletionSource = (context: CompletionContext) => {
  const word = context.matchBefore(/\w+/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  // depois de "tabela." só interessam as colunas
  if (context.state.sliceDoc(Math.max(0, word.from - 1), word.from) === ".") return null;
  return { from: word.from, options: [...SNIPPETS, ...FUNCTIONS], validFor: /^\w*$/ };
};
