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

/**
 * `public`: só leitura, a partir da versão salva. `token` identifica o link público; para quem está
 * logado e recebeu o dashboard, `basePath` aponta para a rota autenticada (`/api/dashboards/:id/view`).
 */
type Mode = { kind: "private" } | { kind: "public"; token: string; basePath?: string };

const viewerBase = (mode: { token: string; basePath?: string }) =>
  mode.basePath ?? `/api/public/dashboards/${encodeURIComponent(mode.token)}`;

type FilterElement = DashboardElement & { type: "filter" };

/** Gráfico que filtra os demais ao clicar numa categoria (filtro cruzado, como no Power BI). */
type Selector = { id: string; binding: FilterBinding };

/** Visual personalizado (HTML) que filtra os demais: o código escolhe coluna e valor. */
type HtmlSelector = { id: string; sourceId: string; table: string; columns: string[] };
type HtmlPick = { column: string; value: string };

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
  /** Seleções feitas por visuais personalizados (um por elemento). */
  picks: Record<string, HtmlPick>;
  htmlSelectors: HtmlSelector[];
  /** Escolhe coluna e valor num visual personalizado; `null` limpa. Repetir a mesma escolha remove. */
  pick: (elementId: string, column: string, value: string | null) => void;
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

  const htmlSelectors = useMemo<HtmlSelector[]>(
    () =>
      elements.flatMap((el) => {
        if (el.type !== "html" || el.hidden) return [];
        const binding = el.props.binding;
        if (binding?.mode !== "builder" || !binding.table) return [];
        return [{ id: el.id, sourceId: binding.sourceId, table: binding.table, columns: (binding.columns ?? []).filter(Boolean) }];
      }),
    [elements],
  );
  const [picks, setPicks] = useState<Record<string, HtmlPick>>({});

  const pick = useCallback(
    (elementId: string, column: string, value: string | null) =>
      setPicks((current) => {
        const selector = htmlSelectors.find((entry) => entry.id === elementId);
        if (!selector || value === null || value === "") {
          if (!(elementId in current)) return current;
          const { [elementId]: _removed, ...rest } = current;
          return rest;
        }
        // só colunas que o próprio visual recebe (ligação com colunas escolhidas = só elas)
        if (selector.columns.length > 0 && !selector.columns.includes(column)) return current;
        const same = current[elementId]?.column === column && current[elementId]?.value === value;
        if (same) {
          const { [elementId]: _removed, ...rest } = current;
          return rest;
        }
        return { ...current, [elementId]: { column, value } };
      }),
    [htmlSelectors],
  );

  const toggleSelection = useCallback(
    (elementId: string, value: string) =>
      setValues((current) => ({ ...current, [elementId]: current[elementId] === value ? "" : value })),
    [],
  );

  // ao sair da pré-visualização as seleções de gráficos deixam de valer
  useEffect(() => {
    if (interactive) return;
    setPicks((current) => (Object.keys(current).length === 0 ? current : {}));
    setValues((current) => {
      const ids = new Set(selectors.map((selector) => selector.id));
      const kept = Object.fromEntries(Object.entries(current).filter(([id]) => !ids.has(id)));
      return Object.keys(kept).length === Object.keys(current).length ? current : kept;
    });
  }, [interactive, selectors]);

  const hasActiveFilters =
    filterElements.some((el) => (values[el.id] ?? el.props.value ?? "") !== "") ||
    (interactive && (selectors.some((selector) => Boolean(values[selector.id])) || Object.keys(picks).length > 0));

  const clearAll = useCallback(() => {
    setValues(Object.fromEntries(filterElements.map((el) => [el.id, ""])));
    setPicks({});
  }, [filterElements]);

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
      picks,
      htmlSelectors,
      pick,
      hasActiveFilters,
      clearAll,
      refreshKey,
      refresh,
    }),
    [mode, values, setValue, filterElements, interactive, selectors, toggleSelection, picks, htmlSelectors, pick, hasActiveFilters, clearAll, refreshKey, refresh],
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

/** Drill-down: nível exibido e os valores já escolhidos nos níveis anteriores (coluna + valor). */
export type DrillState = { dimension?: string; path: { column: string; value: string }[] };

export const useBindingData = (
  elementId: string,
  binding: DataBinding | undefined,
  options: { ignoreFilters?: boolean; drill?: DrillState } = {},
) => {
  const ctx = useCtx();
  const ready = isBindingReady(binding);
  const drill = options.drill && options.drill.path.length > 0 ? options.drill : null;

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
    // visuais personalizados que filtram (o próprio visual enxerga todos os dados e só destaca a escolha)
    const fromHtml = ctx.interactive
      ? ctx.htmlSelectors.flatMap((selector) => {
          const chosen = ctx.picks[selector.id];
          return chosen && selector.id !== elementId && selector.sourceId === binding.sourceId && selector.table === binding.table
            ? [{ id: selector.id, binding: { sourceId: selector.sourceId, table: selector.table, column: chosen.column }, value: chosen.value, byName: false, range: false, column: chosen.column }]
            : [];
        })
      : [];
    // níveis já atravessados no drill-down deste gráfico
    const fromDrill = binding.mode === "builder" && binding.table
      ? (drill?.path ?? []).map((step) => ({
          id: elementId,
          binding: { sourceId: binding.sourceId, table: binding.table as string, column: step.column },
          value: step.value,
          byName: false,
          range: false,
          column: step.column,
        }))
      : [];
    return [...fromFilters, ...fromCharts, ...fromHtml, ...fromDrill].filter((entry) => entry.value !== "");
  }, [ctx, binding, ready, elementId, options.ignoreFilters, drill]);

  // no nível de detalhe a dimensão do gráfico troca; o resto da ligação é o mesmo
  const levelBinding = useMemo(
    () => (binding && drill?.dimension && binding.mode === "builder" ? { ...binding, dimension: drill.dimension } : binding),
    [binding, drill?.dimension],
  );

  let key: string | null = null;
  let load: () => Promise<BindingData> = () => Promise.reject(new Error("sem ligação"));

  if (ready) {
    if (ctx.mode.kind === "public") {
      const token = ctx.mode.token;
      const base = viewerBase(ctx.mode);
      const publicFilters: PublicFilter[] = filters.map((entry) => ({
        elementId: entry.id,
        value: entry.value,
        ...("column" in entry && typeof entry.column === "string" && { column: entry.column }),
      }));
      key = JSON.stringify(["pub", token, elementId, publicFilters, drill?.dimension ?? null, ctx.refreshKey]);
      load = () =>
        api<BindingData>(`${base}/data`, {
          method: "POST",
          json: { elementId, filters: publicFilters, ...(drill?.dimension && { dimension: drill.dimension }) },
        });
    } else {
      const active: ActiveFilter[] = filters.map((entry) => ({
        ...entry.binding,
        value: entry.value,
        ...(entry.byName && { byName: true }),
        ...(entry.range && { range: true }),
      }));
      key = JSON.stringify(["priv", levelBinding, active, ctx.refreshKey]);
      // depois de "Atualizar", o servidor também ignora o cache dele
      const fresh = ctx.refreshKey > 0;
      load = () =>
        api<BindingData>("/api/dashboards/data", { method: "POST", json: { binding: levelBinding, filters: active, fresh } });
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
      const base = viewerBase(ctx.mode);
      key = JSON.stringify(["pub-opt", token, element.id, ctx.refreshKey]);
      load = () =>
        api<FilterOptions>(`${base}/filter-options`, {
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
