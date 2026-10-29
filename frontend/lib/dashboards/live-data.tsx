"use client";

/**
 * Dados ao vivo dos elementos do dashboard.
 *
 * - `DashboardDataProvider` define de onde vêm os dados (editor autenticado ou
 *   link público) e guarda os valores escolhidos nos filtros (estado de
 *   visualização: não altera o documento salvo).
 * - `useBindingData` / `useFilterOptions` buscam no backend com cache curto.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api/client";
import { buildChartData } from "@shared/charts/data";
import type { ChartData } from "@shared/charts/types";
import type { SeriesPoint } from "@/lib/demo-data";
import type {
  ActiveFilter,
  BindingData,
  FilterOptions,
  PublicFilter,
} from "@shared/dashboards/data";
import type {
  DashboardElement,
  DataBinding,
  FilterBinding,
  NumberFormat,
} from "@shared/dashboards/types";

type Mode = { kind: "private" } | { kind: "public"; token: string };

type FilterElement = DashboardElement & { type: "filter" };

/** Gráfico que filtra os demais ao clicar numa categoria (filtro cruzado, como no Power BI). */
type Selector = { id: string; binding: FilterBinding };

type Ctx = {
  mode: Mode;
  /** Valor escolhido em cada elemento de filtro ("" = todos). */
  values: Record<string, string>;
  setValue: (elementId: string, value: string) => void;
  filterElements: FilterElement[];
  /** Cliques em gráficos filtram os outros elementos (visualização e link público). */
  interactive: boolean;
  selectors: Selector[];
  /** Clicar de novo na mesma categoria remove o filtro. */
  toggleSelection: (elementId: string, value: string) => void;
  hasActiveFilters: boolean;
  clearAll: () => void;
  /** Incrementa para forçar nova busca de todos os elementos. */
  refreshKey: number;
  refresh: () => void;
};

const DashboardDataContext = createContext<Ctx | null>(null);

export const DashboardDataProvider = ({
  mode,
  elements,
  interactive = false,
  children,
}: {
  mode: Mode;
  elements: DashboardElement[];
  interactive?: boolean;
  children: ReactNode;
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const filterElements = useMemo(
    () => elements.filter((el): el is FilterElement => el.type === "filter" && !el.hidden),
    [elements],
  );

  const selectors = useMemo<Selector[]>(
    () =>
      elements.flatMap((el) => {
        if (el.type !== "chart" || el.hidden || el.props.crossFilter === false) return [];
        const binding = el.props.binding;
        if (binding?.mode !== "builder" || !binding.table || !binding.dimension) return [];
        return [{ id: el.id, binding: { sourceId: binding.sourceId, table: binding.table, column: binding.dimension } }];
      }),
    [elements],
  );

  const toggleSelection = useCallback(
    (elementId: string, value: string) =>
      setValues((current) => ({ ...current, [elementId]: current[elementId] === value ? "" : value })),
    [],
  );

  // ao sair da pré-visualização as seleções de gráficos deixam de valer
  useEffect(() => {
    if (interactive) return;
    setValues((current) => {
      const ids = new Set(selectors.map((selector) => selector.id));
      const kept = Object.fromEntries(Object.entries(current).filter(([id]) => !ids.has(id)));
      return Object.keys(kept).length === Object.keys(current).length ? current : kept;
    });
  }, [interactive, selectors]);

  const hasActiveFilters =
    filterElements.some((el) => (values[el.id] ?? el.props.value ?? "") !== "") ||
    (interactive && selectors.some((selector) => Boolean(values[selector.id])));

  const clearAll = useCallback(
    () => setValues(Object.fromEntries(filterElements.map((el) => [el.id, ""]))),
    [filterElements],
  );

  const setValue = useCallback(
    (elementId: string, value: string) => setValues((current) => ({ ...current, [elementId]: value })),
    [],
  );

  const refresh = useCallback(() => {
    cache.clear();
    setRefreshKey((key) => key + 1);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      values,
      setValue,
      filterElements,
      interactive,
      selectors,
      toggleSelection,
      hasActiveFilters,
      clearAll,
      refreshKey,
      refresh,
    }),
    [mode, values, setValue, filterElements, interactive, selectors, toggleSelection, hasActiveFilters, clearAll, refreshKey, refresh],
  );

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
};

const useCtx = (): Ctx => {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) throw new Error("DashboardDataProvider ausente.");
  return ctx;
};

export const useDashboardData = useCtx;

/** Valor efetivo de um filtro: o escolhido na visualização ou o padrão salvo. */
export const filterValueOf = (ctx: Pick<Ctx, "values">, element: FilterElement) =>
  ctx.values[element.id] ?? element.props.value ?? "";

/* ------------------------------------------------------------------ cache */

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; promise: Promise<unknown> }>();

const cached = <T,>(key: string, load: () => Promise<T>): Promise<T> => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise as Promise<T>;
  const promise = load();
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
};

export type LoadState<T> =
  | { status: "idle" }
  | { status: "loading"; data?: T }
  | { status: "ready"; data: T }
  | { status: "error"; error: string };

const useAsync = <T,>(key: string | null, load: () => Promise<T>): LoadState<T> => {
  const [state, setState] = useState<LoadState<T>>({ status: "idle" });
  useEffect(() => {
    if (!key) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    // mantém o dado anterior visível enquanto recarrega (evita "piscar")
    setState((current) => ({
      status: "loading",
      data: current.status === "ready" ? current.data : current.status === "loading" ? current.data : undefined,
    }));
    cached(key, load)
      .then((data) => !cancelled && setState({ status: "ready", data }))
      .catch((error: Error) => !cancelled && setState({ status: "error", error: error.message }));
    return () => {
      cancelled = true;
    };
    // `load` é derivado da própria chave
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
};

/** Ligação completa o suficiente para consultar? */
export const isBindingReady = (binding: DataBinding | undefined): binding is DataBinding => {
  if (!binding?.sourceId) return false;
  if (binding.mode === "sql") return Boolean(binding.sql?.trim());
  return Boolean(binding.table);
};

export const useBindingData = (
  elementId: string,
  binding: DataBinding | undefined,
  options: { ignoreFilters?: boolean } = {},
) => {
  const ctx = useCtx();
  const ready = isBindingReady(binding);

  // filtros dos elementos de filtro + seleções de outros gráficos (mesma fonte e tabela)
  const filters = useMemo(() => {
    if (!ready || binding.mode !== "builder" || options.ignoreFilters) return [];
    const fromFilters = ctx.filterElements.flatMap((el) => {
      const fb = el.props.binding;
      if (!fb) return [];
      const global = el.props.global === true;
      // filtro global: vale para qualquer tabela; o servidor ignora as que não têm a coluna
      if (!global && !(fb.sourceId === binding.sourceId && fb.table === binding.table)) return [];
      return [
        {
          id: el.id,
          binding: fb,
          value: filterValueOf(ctx, el),
          byName: global,
          range: el.props.mode === "range",
        },
      ];
    });
    const fromCharts = ctx.interactive
      ? ctx.selectors.flatMap((selector) =>
          selector.id !== elementId &&
          selector.binding.sourceId === binding.sourceId &&
          selector.binding.table === binding.table
            ? [{ id: selector.id, binding: selector.binding, value: ctx.values[selector.id] ?? "", byName: false, range: false }]
            : [],
        )
      : [];
    return [...fromFilters, ...fromCharts].filter((entry) => entry.value !== "");
  }, [ctx, binding, ready, elementId, options.ignoreFilters]);

  let key: string | null = null;
  let load: () => Promise<BindingData> = () => Promise.reject(new Error("sem ligação"));

  if (ready) {
    if (ctx.mode.kind === "public") {
      const token = ctx.mode.token;
      const publicFilters: PublicFilter[] = filters.map((entry) => ({ elementId: entry.id, value: entry.value }));
      key = JSON.stringify(["pub", token, elementId, publicFilters, ctx.refreshKey]);
      load = () =>
        api<BindingData>(`/api/public/dashboards/${token}/data`, {
          method: "POST",
          json: { elementId, filters: publicFilters },
        });
    } else {
      const active: ActiveFilter[] = filters.map((entry) => ({
        ...entry.binding,
        value: entry.value,
        ...(entry.byName && { byName: true }),
        ...(entry.range && { range: true }),
      }));
      key = JSON.stringify(["priv", binding, active, ctx.refreshKey]);
      // depois de "Atualizar", o servidor também ignora o cache dele
      const fresh = ctx.refreshKey > 0;
      load = () =>
        api<BindingData>("/api/dashboards/data", { method: "POST", json: { binding, filters: active, fresh } });
    }
  }

  return useAsync(key, load);
};

export const useFilterOptions = (element: FilterElement) => {
  const ctx = useCtx();
  const binding = element.props.binding;
  let key: string | null = null;
  let load: () => Promise<FilterOptions> = () => Promise.resolve({ options: [] });
  if (binding?.sourceId && binding.table && binding.column && (element.props.mode !== "range" || element.props.rangeDisplay === "deslizante")) {
    if (ctx.mode.kind === "public") {
      const token = ctx.mode.token;
      key = JSON.stringify(["pub-opt", token, element.id, ctx.refreshKey]);
      load = () =>
        api<FilterOptions>(`/api/public/dashboards/${token}/filter-options`, {
          method: "POST",
          json: { elementId: element.id },
        });
    } else {
      key = JSON.stringify(["opt", binding, ctx.refreshKey]);
      load = () => api<FilterOptions>("/api/dashboards/filter-options", { method: "POST", json: { binding } });
    }
  }
  return useAsync(key, load);
};

/* -------------------------------------------------------------- conversões */

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Colunas x/y efetivas (builder sempre devolve label/valor). */
export const axesOf = (binding: DataBinding, data: BindingData) => {
  if (binding.mode === "builder") return { x: "label", y: "valor" };
  const names = data.columns.map((c) => c.name);
  const x = binding.x && names.includes(binding.x) ? binding.x : (data.columns.find((c) => c.kind !== "numero")?.name ?? names[0]);
  const y =
    binding.y && names.includes(binding.y)
      ? binding.y
      : (data.columns.find((c) => c.kind === "numero" && c.name !== x)?.name ?? names[1]);
  return { x, y };
};

export const toSeries = (binding: DataBinding, data: BindingData): SeriesPoint[] => {
  const { x, y } = axesOf(binding, data);
  return data.rows.map((row) => ({ label: String(row[x] ?? "—"), valor: toNumber(row[y]) ?? 0 }));
};

/** Dados do gráfico: várias séries (colunas Y extras ou "dividir por") quando configurado. */
export const toChartData = (binding: DataBinding, data: BindingData): ChartData => {
  const names = data.columns.map((c) => c.name);
  if (binding.mode === "builder") {
    const label = binding.calc?.name ?? binding.measure ?? "Contagem";
    return buildChartData(
      data.rows,
      { x: "label", ys: ["valor"], splitBy: names.includes("serie") ? "serie" : undefined },
      [label],
    );
  }
  const { x, y } = axesOf(binding, data);
  const extra = (binding.ys ?? []).filter((name) => names.includes(name) && name !== y);
  const splitBy = binding.splitBy && names.includes(binding.splitBy) ? binding.splitBy : undefined;
  return buildChartData(data.rows, { x, ys: [y, ...(splitBy ? [] : extra)], splitBy });
};

/** Valor numérico do KPI (primeira linha). */
export const toKpiValue = (binding: DataBinding, data: BindingData): number | null => {
  const row = data.rows[0];
  if (!row) return null;
  if (binding.mode === "builder") return toNumber(row.valor);
  const col =
    binding.y && binding.y in row ? binding.y : data.columns.find((c) => c.kind === "numero")?.name;
  return col ? toNumber(row[col]) : null;
};

export { formatNumber } from "./format";
