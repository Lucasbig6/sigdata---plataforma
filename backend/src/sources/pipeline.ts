import type { ColumnKind, ColumnProfile, SourceTable } from "@shared/domain/sources";
import { STEP_LABELS, type AggFn, type FilterValue, type Step, type TargetType } from "@shared/domain/transform";
import { HttpError } from "../http";
import { quoteIdent, quoteQualified } from "./sql";

/** Motor que vai executar o SQL gerado; os tipos mudam entre os dois. */
export type Engine = "duckdb" | "postgres";

export type PipelineColumn = { name: string; kind: ColumnKind };

export type CompiledPipeline = {
  /** `WITH e0 AS (...), e1 AS (...) SELECT * FROM eN`, pronto para executar. */
  sql: string;
  /** SQL de cada etapa (a ordenação aparece como `ORDER BY ...`), para a barra de fórmula. */
  stepSql: string[];
  /** Colunas que o resultado tem depois da última etapa. */
  columns: PipelineColumn[];
};

export const MAX_PIPELINE_STEPS = 50;
const MAX_NAME_LENGTH = 128;
const MAX_TEXT_VALUE = 1000;
const MAX_PIVOT_VALUES = 50;

export type PipelineError = HttpError & { stepIndex: number | null };

/**
 * Erro de uma etapa específica (índice a partir de 0), para a tela marcar a etapa com problema.
 * É uma função, e não `class extends HttpError`, porque `http` participa de um ciclo de imports
 * e a classe ainda não existe quando este módulo é avaliado.
 */
export const pipelineError = (stepIndex: number | null, message: string): PipelineError =>
  Object.assign(new HttpError(422, message), { stepIndex });

const isPipelineError = (error: unknown): error is PipelineError =>
  error instanceof HttpError && "stepIndex" in error;

const CAST_TYPES: Record<Engine, Record<TargetType, string>> = {
  duckdb: { numero: "DOUBLE", texto: "VARCHAR", data: "DATE", booleano: "BOOLEAN" },
  postgres: { numero: "DOUBLE PRECISION", texto: "VARCHAR", data: "DATE", booleano: "BOOLEAN" },
};

const SQL_COMPARISON = { "=": "=", ">": ">", ">=": ">=", "<": "<", "<=": "<=" } as const;

const DATE_LITERAL = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$/;

const quoteList = (names: string[]) => names.map(quoteIdent).join(", ");

const stringLiteral = (value: string) => {
  if (value.includes("\0")) throw new Error("O valor tem um caractere inválido.");
  if (value.length > MAX_TEXT_VALUE) throw new Error(`O valor passa de ${MAX_TEXT_VALUE} caracteres.`);
  return `'${value.replaceAll("'", "''")}'`;
};

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

const findColumn = (columns: PipelineColumn[], name: string) => {
  const found = columns.find((column) => column.name === name);
  if (!found) throw new Error(`A coluna "${name}" não existe neste ponto.`);
  return found;
};

const requireColumns = (columns: PipelineColumn[], names: string[]) => {
  const unique = [...new Set(names)];
  for (const name of unique) findColumn(columns, name);
  return unique;
};

/** Valor digitado convertido ao tipo da coluna, como literal SQL. */
const literalFor = (column: PipelineColumn, value: FilterValue): string => {
  if (column.kind === "numero") {
    const number = typeof value === "number" ? value : Number(String(value).replace(",", "."));
    if (!Number.isFinite(number)) throw new Error(`"${value}" não é um número.`);
    return String(number);
  }
  if (column.kind === "booleano") {
    const text = String(value).toLowerCase();
    if (!["true", "false"].includes(text)) throw new Error("Use verdadeiro ou falso.");
    return text.toUpperCase();
  }
  if (column.kind === "data") {
    const text = String(value).trim();
    if (!DATE_LITERAL.test(text)) throw new Error(`"${text}" não é uma data (use AAAA-MM-DD).`);
    return stringLiteral(text);
  }
  return stringLiteral(String(value));
};

/** Condição de uma etapa "filtrar", com o valor convertido ao tipo da coluna. */
const filterCondition = (step: Extract<Step, { type: "filtrar" }>, column: PipelineColumn) => {
  const ref = quoteIdent(column.name);
  if (step.op === "nulo") return `${ref} IS NULL`;
  if (step.op === "nao_nulo") return `${ref} IS NOT NULL`;
  if (step.value === undefined || step.value === "") throw new Error("Informe o valor do filtro.");

  if (step.op === "contem") {
    const pattern = stringLiteral(`%${escapeLike(String(step.value))}%`);
    return `CAST(${ref} AS VARCHAR) ILIKE ${pattern} ESCAPE '\\'`;
  }

  if (step.op !== "=" && step.op !== "!=" && column.kind === "booleano") {
    throw new Error("Colunas verdadeiro/falso só aceitam igual ou diferente.");
  }
  const literal = literalFor(column, step.value);

  const target = column.kind === "outro" ? `CAST(${ref} AS VARCHAR)` : ref;
  // "diferente de" inclui as linhas nulas, como a pessoa espera de "não é X"
  if (step.op === "!=") return `${target} IS DISTINCT FROM ${literal}`;
  return `${target} ${SQL_COMPARISON[step.op]} ${literal}`;
};

type Order = { column: string; dir: "asc" | "desc" };

type State = {
  columns: PipelineColumn[];
  /** Ordenação pedida pela última etapa "ordenar"; aplicada no SELECT final. */
  order: Order | null;
};

/**
 * Aplica uma etapa: devolve o SELECT da nova CTE (ou `null` quando a etapa
 * só muda a ordenação) e o novo estado das colunas.
 */
type Context = {
  engine: Engine;
  tables: SourceTable[];
  /** Resultado de outras consultas, já carregado como tabela (só existe na execução em memória). */
  queryTables: Record<string, SourceTable>;
};

const checkNewName = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Informe o nome da coluna.");
  if (trimmed.length > MAX_NAME_LENGTH) throw new Error(`O nome passa de ${MAX_NAME_LENGTH} caracteres.`);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(trimmed)) throw new Error("O nome tem caracteres inválidos.");
  return trimmed;
};

/** Expressão SQL e tipo resultante de uma agregação. */
const aggregate = (fn: AggFn, column: PipelineColumn | null, engine: Engine, refSql?: string) => {
  const number = CAST_TYPES[engine].numero;
  if (fn === "contagem") {
    return { sql: column ? `COUNT(${refSql ?? quoteIdent(column.name)})` : "COUNT(*)", kind: "numero" as ColumnKind };
  }
  if (!column) throw new Error("Escolha a coluna a resumir.");
  const ref = refSql ?? quoteIdent(column.name);
  switch (fn) {
    case "soma":
    case "media":
      if (column.kind !== "numero") throw new Error(`"${column.name}" não é numérica: mude o tipo antes de somar ou tirar a média.`);
      return { sql: `CAST(${fn === "soma" ? "SUM" : "AVG"}(${ref}) AS ${number})`, kind: "numero" as ColumnKind };
    case "minimo":
    case "maximo":
      if (column.kind === "booleano" || column.kind === "outro") throw new Error(`Não há mínimo/máximo para "${column.name}".`);
      return { sql: `${fn === "minimo" ? "MIN" : "MAX"}(${ref})`, kind: column.kind };
    case "distintos":
      return { sql: `COUNT(DISTINCT ${ref})`, kind: "numero" as ColumnKind };
  }
};

const uniqueNames = (names: string[]) => {
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) throw new Error(`Há duas colunas chamadas "${name}".`);
    seen.add(key);
  }
};

const orderSql = (order: Order) => `${quoteIdent(order.column)} ${order.dir === "desc" ? "DESC" : "ASC"} NULLS LAST`;

const assertFreeName = (columns: PipelineColumn[], name: string) => {
  if (columns.some((column) => column.name.toLowerCase() === name.toLowerCase())) throw new Error(`Já existe uma coluna "${name}".`);
};

/** Valor fixo digitado (texto, número ou verdadeiro/falso) como literal SQL e tipo. */
const valueLiteral = (value: FilterValue): { sql: string; kind: ColumnKind } =>
  typeof value === "number"
    ? { sql: String(Number.isFinite(value) ? value : 0), kind: "numero" }
    : typeof value === "boolean"
      ? { sql: value ? "TRUE" : "FALSE", kind: "booleano" }
      : { sql: stringLiteral(value), kind: "texto" };

const applyStep = (
  step: Step,
  previous: string,
  state: State,
  { engine, tables, queryTables }: Context,
): { body: string | null; state: State } => {
  const { columns } = state;
  switch (step.type) {
    case "filtrar": {
      const column = findColumn(columns, step.column);
      return { body: `SELECT * FROM ${previous} WHERE ${filterCondition(step, column)}`, state };
    }
    case "renomear": {
      findColumn(columns, step.from);
      const to = step.to.trim();
      if (!to) throw new Error("Informe o novo nome.");
      if (to.length > MAX_NAME_LENGTH) throw new Error(`O nome passa de ${MAX_NAME_LENGTH} caracteres.`);
      // eslint-disable-next-line no-control-regex
      if (/[\u0000-\u001f]/.test(to)) throw new Error("O nome tem caracteres inválidos.");
      const clash = columns.some((column) => column.name !== step.from && column.name.toLowerCase() === to.toLowerCase());
      if (clash) throw new Error(`Já existe uma coluna "${to}".`);
      const list = columns
        .map((column) => (column.name === step.from ? `${quoteIdent(column.name)} AS ${quoteIdent(to)}` : quoteIdent(column.name)))
        .join(", ");
      return {
        body: `SELECT ${list} FROM ${previous}`,
        state: {
          columns: columns.map((column) => (column.name === step.from ? { ...column, name: to } : column)),
          order: state.order?.column === step.from ? { ...state.order, column: to } : state.order,
        },
      };
    }
    case "remover": {
      const names = requireColumns(columns, step.columns);
      if (names.length === 0) throw new Error("Escolha ao menos uma coluna.");
      const kept = columns.filter((column) => !names.includes(column.name));
      if (kept.length === 0) throw new Error("Não é possível remover todas as colunas.");
      return {
        body: `SELECT ${quoteList(kept.map((column) => column.name))} FROM ${previous}`,
        state: {
          columns: kept,
          // a ordenação some junto com a coluna que a definia
          order: state.order && names.includes(state.order.column) ? null : state.order,
        },
      };
    }
    case "tipo": {
      findColumn(columns, step.column);
      const type = CAST_TYPES[engine][step.to];
      if (!type) throw new Error("Tipo inválido.");
      // no DuckDB o que não converte vira nulo; no Postgres a conversão falha com o motivo
      const cast = engine === "duckdb" ? "TRY_CAST" : "CAST";
      const list = columns
        .map((column) =>
          column.name === step.column
            ? `${cast}(${quoteIdent(column.name)} AS ${type}) AS ${quoteIdent(column.name)}`
            : quoteIdent(column.name),
        )
        .join(", ");
      return {
        body: `SELECT ${list} FROM ${previous}`,
        state: {
          columns: columns.map((column) => (column.name === step.column ? { ...column, kind: step.to } : column)),
          order: state.order,
        },
      };
    }
    case "ordenar": {
      findColumn(columns, step.column);
      return { body: null, state: { columns, order: { column: step.column, dir: step.dir } } };
    }
    case "remover_nulos": {
      const names = requireColumns(columns, step.columns);
      if (names.length === 0) throw new Error("Escolha ao menos uma coluna.");
      const where = names.map((name) => `${quoteIdent(name)} IS NOT NULL`).join(" AND ");
      return { body: `SELECT * FROM ${previous} WHERE ${where}`, state };
    }
    case "duplicadas": {
      // lista vazia = linha inteira
      const names = step.columns.length === 0 ? columns.map((column) => column.name) : requireColumns(columns, step.columns);
      const all = quoteList(columns.map((column) => column.name));
      return {
        body:
          `SELECT ${all} FROM (SELECT ${all}, ROW_NUMBER() OVER (PARTITION BY ${quoteList(names)}) AS sigdata_rn__ ` +
          `FROM ${previous}) AS sigdata_d WHERE sigdata_rn__ = 1`,
        state,
      };
    }
    case "preencher": {
      const column = findColumn(columns, step.column);
      if (step.value === "") throw new Error("Informe o valor de preenchimento.");
      const list = columns
        .map((entry) =>
          entry.name === step.column
            ? `COALESCE(${quoteIdent(entry.name)}, ${literalFor(column, step.value)}) AS ${quoteIdent(entry.name)}`
            : quoteIdent(entry.name),
        )
        .join(", ");
      return { body: `SELECT ${list} FROM ${previous}`, state };
    }
    case "agrupar": {
      const by = requireColumns(columns, step.by);
      if (step.aggregations.length === 0 && by.length === 0) throw new Error("Escolha colunas para agrupar ou um resumo.");
      const parts = by.map(quoteIdent);
      const outColumns: PipelineColumn[] = by.map((name) => findColumn(columns, name));
      for (const aggregation of step.aggregations) {
        const column = aggregation.column === null ? null : findColumn(columns, aggregation.column);
        const name = checkNewName(aggregation.as);
        const { sql, kind } = aggregate(aggregation.fn, column, engine);
        parts.push(`${sql} AS ${quoteIdent(name)}`);
        outColumns.push({ name, kind });
      }
      uniqueNames(outColumns.map((column) => column.name));
      const groupBy = by.length > 0 ? ` GROUP BY ${quoteList(by)}` : "";
      return {
        body: `SELECT ${parts.join(", ")} FROM ${previous}${groupBy}`,
        // a ordenação anterior não vale depois de agrupar (só sobrevive se a coluna continuar)
        state: { columns: outColumns, order: state.order && by.includes(state.order.column) ? state.order : null },
      };
    }
    case "mesclar": {
      const right = step.query ? queryTables[step.query] : tables.find((entry) => entry.name === step.table);
      if (!right) {
        throw new Error(step.query ? "A consulta escolhida não está disponível (ela não pode depender desta)." : `A tabela "${step.table}" não existe nesta fonte.`);
      }
      if (step.on.length === 0) throw new Error("Escolha ao menos um par de colunas para casar as tabelas.");
      const keys = step.on.map((pair) => {
        const left = findColumn(columns, pair.left);
        const other = right.columns.find((entry) => entry.name === pair.right);
        if (!other) throw new Error(`A coluna "${pair.right}" não existe em "${right.name}".`);
        if (left.kind !== other.kind) {
          throw new Error(`"${left.name}" (${left.kind}) e "${other.name}" (${other.kind}) têm tipos diferentes: mude o tipo de uma delas antes.`);
        }
        return { left, right: other };
      });
      const keyNames = new Set(keys.map((key) => key.right.name));
      const wanted = step.columns.length === 0 ? right.columns.filter((entry) => !keyNames.has(entry.name)) : step.columns.map((name) => {
        const found = right.columns.find((entry) => entry.name === name);
        if (!found) throw new Error(`A coluna "${name}" não existe em "${right.name}".`);
        return found;
      });
      const coalesceKeys = step.kind === "direita" || step.kind === "completa";
      const selectParts = columns.map((column) => {
        const key = coalesceKeys ? keys.find((entry) => entry.left.name === column.name) : undefined;
        return key
          ? `COALESCE(l.${quoteIdent(column.name)}, r.${quoteIdent(key.right.name)}) AS ${quoteIdent(column.name)}`
          : `l.${quoteIdent(column.name)}`;
      });
      const taken = new Set(columns.map((column) => column.name.toLowerCase()));
      const brought: PipelineColumn[] = [];
      for (const column of wanted) {
        let name = column.name;
        if (taken.has(name.toLowerCase())) name = `${column.name} (${right.name})`;
        let n = 2;
        while (taken.has(name.toLowerCase())) name = `${column.name} (${right.name} ${n++})`;
        taken.add(name.toLowerCase());
        brought.push({ name, kind: column.kind });
        selectParts.push(`r.${quoteIdent(column.name)} AS ${quoteIdent(name)}`);
      }
      const join = { esquerda: "LEFT JOIN", interna: "INNER JOIN", direita: "RIGHT JOIN", completa: "FULL OUTER JOIN" }[step.kind];
      const on = keys.map((key) => `l.${quoteIdent(key.left.name)} = r.${quoteIdent(key.right.name)}`).join(" AND ");
      return {
        body: `SELECT ${selectParts.join(", ")} FROM ${previous} AS l ${join} ${quoteQualified(right.name)} AS r ON ${on}`,
        // juntar não garante a ordem das linhas
        state: { columns: [...columns, ...brought], order: null },
      };
    }
    case "escolher": {
      const names = requireColumns(columns, step.columns);
      if (names.length === 0) throw new Error("Escolha ao menos uma coluna.");
      return {
        body: `SELECT ${quoteList(names)} FROM ${previous}`,
        state: {
          columns: names.map((name) => findColumn(columns, name)),
          order: state.order && names.includes(state.order.column) ? state.order : null,
        },
      };
    }
    case "limitar": {
      if (!Number.isInteger(step.n) || step.n < 1 || step.n > 1_000_000) throw new Error("Use um número inteiro entre 1 e 1.000.000.");
      // o corte segue a ordenação pedida até aqui
      const order = state.order ? ` ORDER BY ${orderSql(state.order)}` : "";
      const tail = step.mode === "manter" ? `LIMIT ${step.n}` : `OFFSET ${step.n}`;
      return { body: `SELECT * FROM ${previous}${order} ${tail}`, state };
    }
    case "dividir": {
      const column = findColumn(columns, step.column);
      const delimiter = step.delimiter;
      if (!delimiter) throw new Error("Informe o separador.");
      if (!Number.isInteger(step.parts) || step.parts < 2 || step.parts > 10) throw new Error("Divida em 2 a 10 partes.");
      const kept = step.removeOriginal ? columns.filter((entry) => entry.name !== column.name) : columns;
      const taken = new Set(kept.map((entry) => entry.name.toLowerCase()));
      const created: PipelineColumn[] = [];
      const parts: string[] = [];
      for (let i = 1; i <= step.parts; i++) {
        let name = `${column.name}.${i}`;
        for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${column.name}.${i} (${n})`;
        taken.add(name.toLowerCase());
        created.push({ name, kind: "texto" });
        parts.push(`NULLIF(split_part(CAST(${quoteIdent(column.name)} AS VARCHAR), ${stringLiteral(delimiter)}, ${i}), '') AS ${quoteIdent(name)}`);
      }
      return {
        body: `SELECT ${[...kept.map((entry) => quoteIdent(entry.name)), ...parts].join(", ")} FROM ${previous}`,
        state: {
          columns: [...kept, ...created],
          order: state.order && state.order.column === column.name && step.removeOriginal ? null : state.order,
        },
      };
    }
    case "substituir": {
      const column = findColumn(columns, step.column);
      if (column.kind !== "texto") throw new Error(`"${column.name}" não é texto: mude o tipo para texto antes de substituir.`);
      if (!step.find) throw new Error("Informe o valor a procurar.");
      const list = columns
        .map((entry) =>
          entry.name === column.name
            ? `REPLACE(${quoteIdent(entry.name)}, ${stringLiteral(step.find)}, ${stringLiteral(step.with)}) AS ${quoteIdent(entry.name)}`
            : quoteIdent(entry.name),
        )
        .join(", ");
      return { body: `SELECT ${list} FROM ${previous}`, state };
    }
    case "condicional": {
      const column = findColumn(columns, step.column);
      const name = checkNewName(step.name);
      assertFreeName(columns, name);
      const condition = filterCondition({ id: step.id, type: "filtrar", column: step.column, op: step.op, value: step.value }, column);
      const thenValue = valueLiteral(step.then);
      const otherwise = valueLiteral(step.otherwise);
      if (thenValue.kind !== otherwise.kind) throw new Error("Os dois resultados devem ser do mesmo tipo (texto, número ou verdadeiro/falso).");
      return {
        body: `SELECT *, CASE WHEN ${condition} THEN ${thenValue.sql} ELSE ${otherwise.sql} END AS ${quoteIdent(name)} FROM ${previous}`,
        state: { columns: [...columns, { name, kind: thenValue.kind }], order: state.order },
      };
    }
    case "indice": {
      const name = checkNewName(step.name);
      assertFreeName(columns, name);
      if (step.start !== 0 && step.start !== 1) throw new Error("O índice começa em 0 ou 1.");
      const over = state.order ? `ORDER BY ${orderSql(state.order)}` : "";
      return {
        body: `SELECT *, ROW_NUMBER() OVER (${over}) - 1 + ${step.start} AS ${quoteIdent(name)} FROM ${previous}`,
        state: { columns: [...columns, { name, kind: "numero" }], order: state.order },
      };
    }
    case "calcular": {
      const name = checkNewName(step.name);
      assertFreeName(columns, name);
      const left = findColumn(columns, step.left);
      if (left.kind !== "numero") throw new Error(`"${left.name}" não é numérica.`);
      let right: string;
      if ("column" in step.right) {
        const other = findColumn(columns, step.right.column);
        if (other.kind !== "numero") throw new Error(`"${other.name}" não é numérica.`);
        right = quoteIdent(other.name);
      } else {
        if (!Number.isFinite(step.right.value)) throw new Error("Informe um número válido.");
        right = String(step.right.value);
      }
      if (!["+", "-", "*", "/"].includes(step.op)) throw new Error("Operação inválida.");
      // divisão por zero vira nulo (o Postgres falharia); a esquerda em ponto flutuante evita divisão inteira
      const divisor = step.op === "/" ? `NULLIF(${right}, 0)` : right;
      return {
        body: `SELECT *, CAST(${quoteIdent(left.name)} AS ${CAST_TYPES[engine].numero}) ${step.op} ${divisor} AS ${quoteIdent(name)} FROM ${previous}`,
        state: { columns: [...columns, { name, kind: "numero" }], order: state.order },
      };
    }
    case "texto": {
      const column = findColumn(columns, step.column);
      if (column.kind !== "texto") throw new Error(`"${column.name}" não é texto.`);
      const fn = { maiusculas: "UPPER", minusculas: "LOWER", aparar: "TRIM" }[step.fn];
      if (!fn) throw new Error("Formatação inválida.");
      const list = columns
        .map((entry) => (entry.name === column.name ? `${fn}(${quoteIdent(entry.name)}) AS ${quoteIdent(entry.name)}` : quoteIdent(entry.name)))
        .join(", ");
      return { body: `SELECT ${list} FROM ${previous}`, state };
    }
    case "data_parte": {
      const column = findColumn(columns, step.column);
      if (column.kind !== "data") throw new Error(`"${column.name}" não é uma data.`);
      const field = { ano: "YEAR", mes: "MONTH", dia: "DAY", trimestre: "QUARTER", dia_semana: "ISODOW" }[step.part];
      if (!field) throw new Error("Parte da data inválida.");
      const name = checkNewName(step.name.trim() || `${column.name} (${step.part})`);
      assertFreeName(columns, name);
      return {
        body: `SELECT *, CAST(EXTRACT(${field} FROM ${quoteIdent(column.name)}) AS BIGINT) AS ${quoteIdent(name)} FROM ${previous}`,
        state: { columns: [...columns, { name, kind: "numero" }], order: state.order },
      };
    }
    case "arredondar": {
      const column = findColumn(columns, step.column);
      if (column.kind !== "numero") throw new Error(`"${column.name}" não é numérica.`);
      if (!Number.isInteger(step.digits) || step.digits < 0 || step.digits > 10) throw new Error("Use de 0 a 10 casas decimais.");
      const list = columns
        .map((entry) =>
          entry.name === column.name
            ? `CAST(ROUND(CAST(${quoteIdent(entry.name)} AS DECIMAL(38,10)), ${step.digits}) AS ${CAST_TYPES[engine].numero}) AS ${quoteIdent(entry.name)}`
            : quoteIdent(entry.name),
        )
        .join(", ");
      return { body: `SELECT ${list} FROM ${previous}`, state };
    }
    case "filtrar_valores": {
      const column = findColumn(columns, step.column);
      const values = [...new Set(step.values)];
      if (values.length === 0) throw new Error("Marque ao menos um valor.");
      if (values.length > 500) throw new Error("Escolha no máximo 500 valores.");
      const ref = column.kind === "outro" ? `CAST(${quoteIdent(column.name)} AS VARCHAR)` : quoteIdent(column.name);
      const list = values.map((value) => literalFor(column, value)).join(", ");
      // "excluir" mantém as linhas nulas, que não são nenhum dos valores marcados
      const where = step.mode === "incluir" ? `${ref} IN (${list})` : `(${ref} IS NULL OR ${ref} NOT IN (${list}))`;
      return { body: `SELECT * FROM ${previous} WHERE ${where}`, state };
    }
    case "acrescentar": {
      if (engine !== "duckdb") throw new Error("Acrescentar só funciona na execução em memória.");
      const other = queryTables[step.query];
      if (!other) throw new Error("A consulta escolhida não está disponível (ela não pode depender desta).");
      const merged = [...columns];
      for (const column of other.columns) {
        if (!merged.some((entry) => entry.name.toLowerCase() === column.name.toLowerCase())) merged.push({ name: column.name, kind: column.kind });
      }
      return {
        body: `SELECT * FROM ${previous} UNION ALL BY NAME SELECT * FROM ${quoteQualified(other.name)}`,
        state: { columns: merged, order: null },
      };
    }
    case "dinamizar": {
      const pivot = findColumn(columns, step.column);
      const valueColumn = findColumn(columns, step.value);
      const by = requireColumns(columns, step.by);
      const values = [...new Set(step.values)];
      if (values.length === 0) throw new Error("Escolha ao menos um valor para virar coluna.");
      if (values.length > MAX_PIVOT_VALUES) throw new Error(`Dinamize no máximo ${MAX_PIVOT_VALUES} valores por vez.`);
      if (by.includes(pivot.name) || by.includes(valueColumn.name) || pivot.name === valueColumn.name) {
        throw new Error("A coluna dinamizada, a de valores e as que ficam como linhas devem ser diferentes.");
      }
      const outColumns: PipelineColumn[] = by.map((name) => findColumn(columns, name));
      const parts = by.map(quoteIdent);
      const pivotText = `CAST(${quoteIdent(pivot.name)} AS VARCHAR)`;
      for (const value of values) {
        const name = checkNewName(value === "" ? "(vazio)" : value);
        // a agregação roda só sobre as linhas daquele valor
        const onlyThisValue = `CASE WHEN ${pivotText} = ${stringLiteral(value)} THEN ${quoteIdent(valueColumn.name)} END`;
        const { sql, kind } = aggregate(step.fn, valueColumn, engine, onlyThisValue);
        parts.push(`${sql} AS ${quoteIdent(name)}`);
        outColumns.push({ name, kind });
      }
      uniqueNames(outColumns.map((column) => column.name));
      const groupBy = by.length > 0 ? ` GROUP BY ${quoteList(by)}` : "";
      return {
        body: `SELECT ${parts.join(", ")} FROM ${previous}${groupBy}`,
        state: { columns: outColumns, order: state.order && by.includes(state.order.column) ? state.order : null },
      };
    }
  }
};

/**
 * Compila a lista de etapas em uma única consulta SQL de leitura.
 * Nomes de colunas passam por `quoteIdent` e valores viram literais escapados;
 * nada vindo do usuário é concatenado cru.
 */
export const compilePipeline = (
  table: SourceTable,
  steps: Step[],
  engine: Engine,
  /** Tabelas da mesma fonte, para mesclar. */
  tables: SourceTable[] = [table],
  /** Resultado de outras consultas já carregado como tabela, para mesclar e acrescentar. */
  queryTables: Record<string, SourceTable> = {},
  /** Posição da primeira etapa na lista completa (quando só uma parte é compilada). */
  firstIndex = 0,
): CompiledPipeline => {
  if (steps.length > MAX_PIPELINE_STEPS) {
    throw pipelineError(null, `Use no máximo ${MAX_PIPELINE_STEPS} etapas.`);
  }
  const ids = new Set<string>();
  for (const step of steps) {
    if (ids.has(step.id)) throw pipelineError(null, "Há etapas com o mesmo identificador.");
    ids.add(step.id);
  }

  let state: State = {
    columns: table.columns.map((column) => ({ name: column.name, kind: column.kind })),
    order: null,
  };
  const ctes = [`e0 AS (SELECT ${quoteList(state.columns.map((column) => column.name))} FROM ${quoteQualified(table.name)})`];
  let last = "e0";
  const stepSql: string[] = [];

  steps.forEach((step, index) => {
    try {
      const applied = applyStep(step, last, state, { engine, tables, queryTables });
      state = applied.state;
      stepSql.push(applied.body ?? `ORDER BY ${orderSql(applied.state.order!)}`);
      if (applied.body) {
        last = `e${ctes.length}`;
        ctes.push(`${last} AS (${applied.body})`);
      }
    } catch (error) {
      if (isPipelineError(error)) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      throw pipelineError(index + firstIndex, `Etapa ${index + firstIndex + 1} (${STEP_LABELS[step.type]}): ${reason}`);
    }
  });

  const order = state.order ? ` ORDER BY ${orderSql(state.order)}` : "";
  return { sql: `WITH ${ctes.join(",\n")}\nSELECT * FROM ${last}${order}`, stepSql, columns: state.columns };
};

/** Consulta única que mede nulos, distintos, mínimo, máximo e média de cada coluna do resultado. */
export const profileSql = (pipelineSql: string, columns: PipelineColumn[], engine: Engine) => {
  const parts = ["COUNT(*) AS total"];
  columns.forEach((column, i) => {
    const ref = quoteIdent(column.name);
    parts.push(`COUNT(${ref}) AS c${i}`, `COUNT(DISTINCT ${ref}) AS d${i}`);
    if (column.kind === "numero" || column.kind === "data") {
      parts.push(`CAST(MIN(${ref}) AS VARCHAR) AS mn${i}`, `CAST(MAX(${ref}) AS VARCHAR) AS mx${i}`);
    }
    if (column.kind === "numero") parts.push(`CAST(AVG(${ref}) AS ${CAST_TYPES[engine].numero}) AS av${i}`);
  });
  return `SELECT ${parts.join(", ")} FROM (${pipelineSql}\n) AS sigdata_p`;
};

/** Converte a linha devolvida por `profileSql` em um perfil por coluna. */
export const readProfile = (columns: PipelineColumn[], row: Record<string, unknown>) => {
  const total = Number(row.total ?? 0);
  const profiles: Record<string, ColumnProfile> = {};
  columns.forEach((column, i) => {
    const nulos = total - Number(row[`c${i}`] ?? 0);
    profiles[column.name] = {
      nulos,
      nulosPct: total > 0 ? Math.round((nulos / total) * 10000) / 100 : 0,
      distintos: row[`d${i}`] == null ? null : Number(row[`d${i}`]),
      min: row[`mn${i}`] == null ? null : String(row[`mn${i}`]),
      max: row[`mx${i}`] == null ? null : String(row[`mx${i}`]),
      media: row[`av${i}`] == null ? null : Number(row[`av${i}`]),
    };
  });
  return { total, profiles };
};
