/**
 * Tipos de domínio de fontes de dados e resultados analíticos.
 * Compartilhados entre cliente e servidor (sem dependências de React ou Node).
 */

export type SourceKind = "demo" | "csv" | "xlsx" | "postgresql" | "dataset";

/** Como um dataset foi criado: a consulta feita pelo analista sobre uma fonte. */
export type DatasetDefinition = {
  sourceId: string;
  sourceName: string;
  sql: string;
  rowCount: number;
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
  /** Schemas a inspecionar; vazio = todos os não-sistema. */
  schemas?: string[];
};

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
  dataset: "Dataset",
};

/**
 * O workspace (chat) trabalha só com datasets prontos, preparados pelo analista
 * no editor SQL; fontes brutas (arquivos, bancos, demonstração) ficam na área de
 * Fontes de dados.
 */
export const isWorkspaceSource = (source: { kind: SourceKind; status: SourceStatus }) =>
  source.kind === "dataset" && source.status === "pronta";

/**
 * Fontes oferecidas ao montar painéis: datasets prontos com tabelas. `keepId`
 * mantém a fonte que um elemento já usa (ligações antigas a fontes brutas
 * continuam editáveis, mas não são oferecidas para ligações novas).
 */
export const panelSources = <T extends { id: string; kind: SourceKind; status: SourceStatus; tables: unknown[] }>(
  sources: T[],
  keepId?: string | null,
) =>
  sources.filter(
    (source) =>
      source.tables.length > 0 &&
      (isWorkspaceSource(source) || (source.id === keepId && source.status === "pronta")),
  );

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
