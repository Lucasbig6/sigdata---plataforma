/**
 * Resultados de consulta no navegador: busca (com cache) e conversão para os
 * formatos de widget (série, indicadores, tabela).
 */
import { api } from "@/lib/api/client";
import type { Kpi } from "@/lib/demo-data";
import type { AnalyticResult } from "@/lib/domain/sources";
import { isChartKind } from "@shared/panel";
import { buildChartData } from "@shared/charts/data";
import type { GenericTable, WidgetData, WidgetKind } from "@/lib/panel/store";

const cache = new Map<string, Promise<AnalyticResult>>();

export const fetchResult = (id: string) => {
  let pending = cache.get(id);
  if (!pending) {
    pending = api<AnalyticResult>(`/api/results/${id}`);
    pending.catch(() => cache.delete(id));
    cache.set(id, pending);
  }
  return pending;
};

const MAX_SERIES_POINTS = 200;
const MAX_TABLE_ROWS = 500;

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Escolhe colunas padrão quando a IA não informa x/y. */
const pickColumns = (result: AnalyticResult, x?: string, y?: string) => {
  const names = result.columns.map((column) => column.name);
  const xCol = x && names.includes(x) ? x : (result.columns.find((c) => c.kind !== "numero")?.name ?? names[0]);
  const yCol =
    y && names.includes(y)
      ? y
      : (result.columns.find((c) => c.kind === "numero" && c.name !== xCol)?.name ?? names[1]);
  return { xCol, yCol };
};

/** Colunas escolhidas para um gráfico (além de x e y). */
export type ChartColumns = { x?: string; y?: string; ys?: string[]; splitBy?: string };

/** Valida se o resultado serve para o tipo pedido; devolve mensagem de erro ou null. */
export const checkResultFor = (result: AnalyticResult, kind: WidgetKind, cols: ChartColumns = {}) => {
  const { x, y, ys, splitBy } = cols;
  const names = result.columns.map((column) => column.name);
  if (x && !names.includes(x)) return `coluna x "${x}" não existe no resultado (${names.join(", ")}).`;
  if (y && !names.includes(y)) return `coluna y "${y}" não existe no resultado (${names.join(", ")}).`;
  const missing = [...(ys ?? []), ...(splitBy ? [splitBy] : [])].find((name) => !names.includes(name));
  if (missing) return `coluna "${missing}" não existe no resultado (${names.join(", ")}).`;
  if (result.rows.length === 0) return "o resultado não tem linhas.";
  if (isChartKind(kind)) {
    const { yCol } = pickColumns(result, x, y);
    if (!yCol || !result.rows.some((row) => toNumber(row[yCol]) !== null)) {
      return "gráficos precisam de uma coluna y numérica.";
    }
  }
  return null;
};

export const widgetDataFromResult = (
  result: AnalyticResult,
  kind: WidgetKind,
  cols: ChartColumns = {},
): WidgetData => {
  const { x, y, ys, splitBy } = cols;
  const { xCol, yCol } = pickColumns(result, x, y);

  if (isChartKind(kind)) {
    const names = result.columns.map((column) => column.name);
    const extra = (ys ?? []).filter((name) => names.includes(name) && name !== yCol);
    const split = splitBy && names.includes(splitBy) && splitBy !== xCol ? splitBy : undefined;
    const chart = buildChartData(result.rows.slice(0, MAX_SERIES_POINTS * 5), {
      x: xCol,
      ys: split ? [yCol] : [yCol, ...extra],
      splitBy: split,
    });
    return {
      resultId: result.id,
      xCol,
      yCol,
      ...(extra.length > 0 && !split && { ysCols: extra }),
      ...(split && { splitBy: split }),
      chart,
    };
  }

  if (kind === "kpi") {
    const row = result.rows[0] ?? {};
    const columns = y ? result.columns.filter((c) => c.name === y) : result.columns;
    const kpis: Kpi[] = columns.slice(0, 4).map((column) => {
      const n = toNumber(row[column.name]);
      return {
        label: column.name,
        value: n !== null ? nf.format(n) : String(row[column.name] ?? "—"),
        delta: 0,
        hint: result.title,
      };
    });
    return { resultId: result.id, ...(y && { yCol: y }), kpis };
  }

  const table: GenericTable = {
    columns: result.columns.map((column) => column.name),
    rows: result.rows.slice(0, MAX_TABLE_ROWS),
  };
  return { resultId: result.id, table };
};
