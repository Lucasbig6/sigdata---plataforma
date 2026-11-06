import type { DatasetDefinition } from "@shared/domain/sources";
import { toTableName } from "@shared/domain/sources";
import { HttpError } from "../http";
import {
  assertReady,
  createDatasetFromPlan,
  execute,
  getSourceRow,
  runPage,
  type PageInput,
  type SourceRow,
} from "./service";
import { openScratch, type Scratch } from "./scratch";
import { assertReadOnlySql, quoteQualified } from "./sql";

/**
 * Cruzamento de fontes no editor SQL. As tabelas citadas no SQL são copiadas das origens
 * (somente leitura, até MAX_CROSS_ROWS linhas cada) para uma área em memória, onde cada fonte
 * vira um esquema com o seu apelido: `apelido.tabela`. Nada é gravado nas fontes originais.
 */
export const MAX_CROSS_ROWS = 50_000;
export const MAX_CROSS_SOURCES = 6;
export const MAX_CROSS_TABLES = 12;

type Prepared = {
  sql: string;
  scratch: Scratch;
  origin: SourceRow;
  sources: NonNullable<DatasetDefinition["crossSources"]>;
};

/** Texto da consulta sem aspas nem maiúsculas, para achar nomes de tabela citados. */
const searchable = (sql: string) => sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replaceAll('"', "").toLowerCase();

const mentions = (text: string, alias: string, table: string) => {
  const name = `${alias}.${table.toLowerCase()}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9_])${name}($|[^a-z0-9_])`).test(text);
};

const prepare = async (userId: string, sourceIds: string[], rawSql: string): Promise<Prepared> => {
  const ids = [...new Set(sourceIds)];
  if (ids.length < 2) throw new HttpError(422, "Escolha ao menos duas fontes para cruzar.");
  if (ids.length > MAX_CROSS_SOURCES) throw new HttpError(422, `Cruze no máximo ${MAX_CROSS_SOURCES} fontes por vez.`);
  const sql = assertReadOnlySql(rawSql);

  const rows = await Promise.all(ids.map((id) => getSourceRow(userId, id)));
  rows.forEach(assertReady);
  const taken = new Set<string>();
  const sources = rows.map((row) => ({ alias: toTableName(row.name, taken), sourceId: row.id, sourceName: row.name }));

  const text = searchable(sql);
  const wanted = rows.flatMap((row, index) =>
    row.tables.filter((table) => mentions(text, sources[index]!.alias, table.name)).map((table) => ({ row, alias: sources[index]!.alias, table })),
  );
  if (wanted.length === 0) {
    throw new HttpError(
      422,
      `Cite as tabelas com o apelido da fonte, por exemplo ${sources[0]!.alias}.${rows[0]!.tables[0]?.name ?? "tabela"}. Apelidos: ${sources.map((s) => s.alias).join(", ")}.`,
    );
  }
  if (wanted.length > MAX_CROSS_TABLES) throw new HttpError(422, `Use no máximo ${MAX_CROSS_TABLES} tabelas na mesma consulta.`);

  const scratch = await openScratch();
  try {
    for (const { row, alias, table } of wanted) {
      const out = await execute(row, `SELECT * FROM ${quoteQualified(table.name)}`, MAX_CROSS_ROWS);
      if (out.truncated) {
        throw new HttpError(
          413,
          `"${row.name}.${table.name}" tem mais de ${MAX_CROSS_ROWS.toLocaleString("pt-BR")} linhas. Para cruzar fontes, reduza essa tabela antes (filtre ou agregue em Preparar dados e salve como dataset).`,
        );
      }
      await scratch.load(table.name, out.columns, out.rows, alias);
    }
  } catch (error) {
    scratch.close();
    throw error;
  }
  return { sql, scratch, origin: rows[0]!, sources };
};

/** Prévia paginada de uma consulta que cruza fontes. */
export const runCrossQuery = async (userId: string, input: PageInput & { sourceIds: string[]; sql: string }) => {
  const { sql, scratch } = await prepare(userId, input.sourceIds, input.sql);
  try {
    return await runPage(scratch.execute, sql, input);
  } finally {
    scratch.close();
  }
};

/** Salva o resultado do cruzamento como dataset (uma cópia: nenhuma origem é alterada). */
export const createDatasetFromCross = async (
  userId: string,
  input: { sourceIds: string[]; sql: string; name: string; description: string },
) => {
  const { sql, scratch, origin, sources } = await prepare(userId, input.sourceIds, input.sql);
  try {
    return await createDatasetFromPlan(userId, {
      workspace: undefined,
      name: input.name,
      description: input.description,
      sql,
      origin,
      exec: scratch.execute,
      crossSources: sources,
    });
  } finally {
    scratch.close();
  }
};
