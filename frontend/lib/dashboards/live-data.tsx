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

type Ctx = {
  mode: Mode;
  /** Valor escolhido em cada elemento de filtro ("" = todos). */
  values: Record<string, string>;
  setValue: (elementId: string, value: string) => void;
  filterElements: FilterElement[];
  /** Incrementa para forçar nova busca de todos os elementos. */
  refreshKey: number;
  refresh: () => void;
};

const DashboardDataContext = createContext<Ctx | null>(null);

export const DashboardDataProvider = ({
  mode,
  elements,
  children,
}: {
  mode: Mode;
  elements: DashboardElement[];
  children: ReactNode;
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const filterElements = useMemo(
    () => elements.filter((el): el is FilterElement => el.type === "filter" && !el.hidden),
    [elements],
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
    () => ({ mode, values, setValue, filterElements, refreshKey, refresh }),
    [mode, values, setValue, filterElements, refreshKey, refresh],
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

export const useBindingData = (elementId: string, binding: DataBinding | undefined) => {
  const ctx = useCtx();
  const ready = isBindingReady(binding);

  const filters = useMemo(() => {
    if (!ready || binding.mode !== "builder") return [];
    return ctx.filterElements
      .filter((el) => el.props.binding?.sourceId === binding.sourceId && el.props.binding.table === binding.table)
      .map((el) => ({ el, value: filterValueOf(ctx, el) }))
      .filter((entry) => entry.value !== "");
  }, [ctx, binding, ready]);

  let key: string | null = null;
  let load: () => Promise<BindingData> = () => Promise.reject(new Error("sem ligação"));

  if (ready) {
    if (ctx.mode.kind === "public") {
      const token = ctx.mode.token;
      const publicFilters: PublicFilter[] = filters.map(({ el, value }) => ({ elementId: el.id, value }));
      key = JSON.stringify(["pub", token, elementId, publicFilters, ctx.refreshKey]);
      load = () =>
        api<BindingData>(`/api/public/dashboards/${token}/data`, {
          method: "POST",
          json: { elementId, filters: publicFilters },
        });
    } else {
      const active: ActiveFilter[] = filters.map(({ el, value }) => ({
        ...(el.props.binding as FilterBinding),
        value,
      }));
      key = JSON.stringify(["priv", binding, active, ctx.refreshKey]);
      load = () => api<BindingData>("/api/dashboards/data", { method: "POST", json: { binding, filters: active } });
    }
  }

  return useAsync(key, load);
};

export const useFilterOptions = (element: FilterElement) => {
  const ctx = useCtx();
  const binding = element.props.binding;
  let key: string | null = null;
  let load: () => Promise<FilterOptions> = () => Promise.resolve({ options: [] });
  if (binding?.sourceId && binding.table && binding.column) {
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

/** Valor numérico do KPI (primeira linha). */
export const toKpiValue = (binding: DataBinding, data: BindingData): number | null => {
  const row = data.rows[0];
  if (!row) return null;
  if (binding.mode === "builder") return toNumber(row.valor);
  const col =
    binding.y && binding.y in row ? binding.y : data.columns.find((c) => c.kind === "numero")?.name;
  return col ? toNumber(row[col]) : null;
};

export const formatNumber = (value: number | null, format: NumberFormat = "numero", decimals = 1) => {
  if (value === null) return "—";
  const digits = Math.min(Math.max(decimals, 0), 4);
  switch (format) {
    case "moeda":
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: digits,
        minimumFractionDigits: Math.min(digits, 2),
      }).format(value);
    case "percentual":
      return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value)}%`;
    case "compacto":
      return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: digits }).format(value);
    default:
      return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value);
  }
};

