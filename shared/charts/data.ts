import type { ChartData } from "./types";

export const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const labelOf = (value: unknown) => (value == null || value === "" ? "—" : String(value));

/**
 * Linhas de uma consulta → categorias + séries.
 * - `ys`: uma série por coluna numérica;
 * - `splitBy`: uma série por valor distinto da coluna (usa só o primeiro `y`;
 *   valores repetidos na mesma célula são somados).
 */
export const buildChartData = (
  rows: Record<string, unknown>[],
  cols: { x: string; ys: string[]; splitBy?: string },
  seriesNames?: string[],
): ChartData => {
  const { x, ys, splitBy } = cols;

  if (splitBy) {
    const y = ys[0];
    const categories: string[] = [];
    const names: string[] = [];
    const cells = new Map<string, number>();
    for (const row of rows) {
      const category = labelOf(row[x]);
      const name = labelOf(row[splitBy]);
      if (!categories.includes(category)) categories.push(category);
      if (!names.includes(name)) names.push(name);
      const value = y ? toNumber(row[y]) : null;
      if (value !== null) {
        const key = `${category}\u0000${name}`;
        cells.set(key, (cells.get(key) ?? 0) + value);
      }
    }
    return {
      categories,
      series: names.map((name) => ({
        name,
        values: categories.map((category) => cells.get(`${category}\u0000${name}`) ?? null),
      })),
    };
  }

  return {
    categories: rows.map((row) => labelOf(row[x])),
    series: ys.map((y, index) => ({
      name: seriesNames?.[index] ?? y,
      values: rows.map((row) => toNumber(row[y])),
    })),
  };
};
