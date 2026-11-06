/**
 * Tipos de domínio de fontes de dados e resultados analíticos.
 * Compartilhados entre cliente e servidor (sem dependências de React ou Node).
 */

import type { Workspace } from "./transform";

export type SourceKind =
  | "demo"
  | "csv"
  | "xlsx"
  | "postgresql"
  | "mysql"
  | "sqlserver"
  | "api"
  | "gsheets"
  | "dataset";

/** Bancos consultados ao vivo na origem (somente leitura); o resto é copiado para o DuckDB. */
export const LIVE_SQL_KINDS = ["postgresql", "mysql", "sqlserver"] as const;
export type LiveSqlKind = (typeof LIVE_SQL_KINDS)[number];
export const isLiveSqlKind = (kind: SourceKind): kind is LiveSqlKind =>
  (LIVE_SQL_KINDS as readonly string[]).includes(kind);

/** Fontes importadas de um endereço: guardam a configuração para "Atualizar dados". */
export const isRemoteImportKind = (kind: SourceKind) => kind === "api" || kind === "gsheets";

/** Como um dataset foi criado: a consulta feita pelo analista sobre uma fonte. */
export type DatasetDefinition = {
  sourceId: string;
  sourceName: string;
  sql: string;
  rowCount: number;
  /** Consultas e etapas, quando o dataset foi montado na preparação de dados. */
  workspace?: Workspace;
  /** Fontes cruzadas no editor SQL (apelido usado no SQL → fonte), quando houve cruzamento. */
  crossSources?: { alias: string; sourceId: string; sourceName: string }[];
};

export type SourceStatus = "processando" | "pronta" | "erro";

/** Tipo simplificado usado pela interface e pela IA. */
export type ColumnKind = "numero" | "texto" | "data" | "booleano" | "outro";

export type ColumnProfile = {
  nulos: number;
  /** Percentual de nulos (0–100). */
  nulosPct: number;
  distintos: number | null;
  min: string | null;
  max: string | null;
  media: number | null;
};

export type SourceColumn = {
  name: string;
  /** Tipo nativo do motor (ex.: BIGINT, VARCHAR, numeric). */
  dbType: string;
  kind: ColumnKind;
  profile?: ColumnProfile;
};

export type SourceTable = {
  /** Nome qualificado usado em SQL (ex.: `vendas` ou `public.vendas`). */
  name: string;
  rowCount: number | null;
  columns: SourceColumn[];
};

export type DataSource = {
  id: string;
  name: string;
  description: string;
  kind: SourceKind;
  status: SourceStatus;
  error: string | null;
  fileName: string | null;
  fileSize: number | null;
  /** Host/banco da conexão externa, sem senha. */
  connectionLabel: string | null;
  /** Só em datasets (kind "dataset"). */
  definition: DatasetDefinition | null;
  /** Dataset publicado: visível para todos os usuários. Só datasets são publicados. */
  published: boolean;
  tables: SourceTable[];
  createdAt: string;
  updatedAt: string;
};

export type PostgresConnectionInput = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  /** Valida o certificado TLS do servidor (padrão: sim). Desligue só para certificados autoassinados. */
  sslVerify?: boolean;
  /** Schemas a inspecionar; vazio = todos os não-sistema. */
  schemas?: string[];
};

/** Conexão com MySQL/MariaDB ou SQL Server: mesmos campos do Postgres. */
export type SqlConnectionInput = PostgresConnectionInput;

export type ApiHeader = { name: string; value: string };

export type ApiConnectionInput = {
  url: string;
  headers: ApiHeader[];
  /** Caminho até a lista de registros na resposta (ex.: `data.items`); vazio = a própria resposta. */
  recordsPath: string;
  pagination:
    | { type: "none" }
    | { type: "page"; param: string; start: number; sizeParam?: string; size?: number }
    | { type: "next"; path: string };
  maxPages: number;
};

export type GSheetsConnectionInput = { url: string };

/** SELECT de amostra de uma tabela, no dialeto da fonte (o T-SQL não tem LIMIT). */
export const sampleSql = (kind: SourceKind, table: string, rows = 100) =>
  kind === "sqlserver" ? `SELECT TOP ${rows} *\nFROM ${table}` : `SELECT *\nFROM ${table}\nLIMIT ${rows}`;

/** Pedido de conexão (testar ou criar): o tipo decide o formato da configuração. */
export type ConnectionRequest =
  | { kind: LiveSqlKind; connection: SqlConnectionInput }
  | { kind: "api"; connection: ApiConnectionInput }
  | { kind: "gsheets"; connection: GSheetsConnectionInput };

export type ResultColumn = {
  name: string;
  dbType: string;
  kind: ColumnKind;
};

export type AnalyticResult = {
  id: string;
  title: string;
  sql: string;
  sourceId: string | null;
  columns: ResultColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  durationMs: number;
  createdAt: string;
};

export type TablePreview = {
  table: string;
  columns: ResultColumn[];
  rows: Record<string, unknown>[];
};

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  demo: "Demonstração",
  csv: "CSV",
  xlsx: "Excel",
  postgresql: "PostgreSQL",
  mysql: "MySQL / MariaDB",
  sqlserver: "SQL Server",
  api: "API REST",
  gsheets: "Google Sheets",
  dataset: "Dataset",
};

/** Classifica um tipo nativo (DuckDB ou Postgres) em uma categoria da interface. */
export const kindFromDbType = (dbType: string): ColumnKind => {
  const t = dbType.toUpperCase();
  if (/^(TINY|SMALL|BIG|HUGE|U)?INT|INTEGER|DECIMAL|NUMERIC|DOUBLE|FLOAT|REAL|SERIAL|MONEY/.test(t))
    return "numero";
  if (/BOOL/.test(t)) return "booleano";
  if (/DATE|TIME|INTERVAL/.test(t)) return "data";
  if (/CHAR|TEXT|STRING|UUID|ENUM|NAME/.test(t)) return "texto";
  return "outro";
};

/** Nome seguro (tabela ou apelido de fonte) a partir de um nome de arquivo/aba/fonte. */
export const toTableName = (raw: string, taken: Set<string>): string => {
  const base =
    raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "tabela";
  let name = /^[0-9]/.test(base) ? `t_${base}` : base;
  let n = 2;
  while (taken.has(name)) name = `${base}_${n++}`;
  taken.add(name);
  return name;
};
