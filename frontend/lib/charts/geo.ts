"use client";

/**
 * Malhas dos mapas (IBGE, em `public/geo`) e o casamento entre o que está nos dados
 * (sigla, nome ou código do IBGE) e a região desenhada. As malhas são carregadas sob
 * demanda e registradas no ECharts uma única vez.
 */
import { useEffect, useState } from "react";
import { loadEcharts } from "./echarts";
import type { ChartStyle, ChartType } from "@shared/charts/types";

export type GeoScope = "uf" | "municipio";

type Props = { code: string; name: string; sigla?: string; uf?: string };
type Feature = { properties: Props; geometry: { type: string; coordinates: unknown } };
type Collection = { type: "FeatureCollection"; features: Feature[] };

export type GeoBundle = {
  scope: GeoScope;
  /** Nome do mapa registrado no ECharts. */
  mapName: string;
  /** Chave da região (sigla da UF ou código do município) para um valor dos dados; null = sem correspondência. */
  resolve: (value: string) => string | null;
  /** Nome para exibir. */
  label: (key: string) => string;
  /** [longitude, latitude] do centro da região. */
  center: (key: string) => [number, number] | null;
};

export const isMapType = (type: ChartType) => type === "map" || type === "mapbubbles";

const FILES: Record<GeoScope, string> = { uf: "/geo/br-uf.json", municipio: "/geo/br-municipios.json" };

const norm = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const downloads = new Map<GeoScope, Promise<Collection>>();
const fetchCollection = (scope: GeoScope) => {
  let pending = downloads.get(scope);
  if (!pending) {
    pending = fetch(FILES[scope]).then((response) => {
      if (!response.ok) throw new Error(`Não foi possível carregar o mapa (${response.status}).`);
      return response.json() as Promise<Collection>;
    });
    pending.catch(() => downloads.delete(scope));
    downloads.set(scope, pending);
  }
  return pending;
};

/** Centro do retângulo que envolve o maior polígono da região. */
const centerOf = (geometry: Feature["geometry"]): [number, number] => {
  const polygons = (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates) as number[][][][];
  let best: number[][] = polygons[0][0];
  for (const polygon of polygons) if (polygon[0].length > best.length) best = polygon[0];
  const xs = best.map((p) => p[0]);
  const ys = best.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};

const bundles = new Map<string, Promise<GeoBundle>>();

/** Carrega (uma vez) a malha, registra no ECharts e monta os índices de busca. `region` = sigla de UF que restringe os municípios. */
export const loadGeo = (scope: GeoScope, region?: string): Promise<GeoBundle> => {
  const uf = scope === "municipio" ? region?.trim().toUpperCase() : undefined;
  const id = `${scope}:${uf ?? ""}`;
  let pending = bundles.get(id);
  if (!pending) {
    pending = build(scope, uf, id);
    pending.catch(() => bundles.delete(id));
    bundles.set(id, pending);
  }
  return pending;
};

const build = async (scope: GeoScope, uf: string | undefined, mapName: string): Promise<GeoBundle> => {
  const [collection, echarts] = await Promise.all([fetchCollection(scope), loadEcharts()]);
  const features = uf ? collection.features.filter((f) => f.properties.uf === uf) : collection.features;

  const keyOf = (p: Props) => (scope === "uf" ? (p.sigla as string) : p.code);
  const labels = new Map<string, string>();
  const centers = new Map<string, [number, number]>();
  const byName = new Map<string, string>();
  const byCode = new Map<string, string>();
  const byNameUf = new Map<string, string>();

  for (const feature of features) {
    const p = feature.properties;
    const key = keyOf(p);
    labels.set(key, scope === "uf" ? p.name : `${p.name} (${p.uf})`);
    centers.set(key, centerOf(feature.geometry));
    byCode.set(p.code, key);
    if (scope === "municipio") byCode.set(p.code.slice(0, 6), key); // códigos de 6 dígitos (sem o verificador)
    else byName.set(norm(p.sigla as string), key);
    if (!byName.has(norm(p.name))) byName.set(norm(p.name), key); // nome repetido em várias UFs: vale o primeiro
    if (scope === "municipio") byNameUf.set(`${norm(p.name)}|${norm(p.uf as string)}`, key);
  }

  // o ECharts casa pelo `name`: a chave curta (sigla/código); o nome de exibição fica no índice
  echarts.registerMap(mapName, {
    type: "FeatureCollection",
    features: features.map((f) => ({ ...f, properties: { name: keyOf(f.properties) } })),
  } as never);

  const resolve = (value: string): string | null => {
    const text = value.trim();
    if (!text) return null;
    const direct = byCode.get(text.replace(/\D/g, "").length === text.length ? text : "");
    if (direct) return direct;
    if (scope === "municipio") {
      // "Campinas - SP", "Campinas/SP", "Campinas (SP)"
      const match = text.match(/^(.*?)\s*[-/(,]\s*([A-Za-z]{2})\)?$/);
      if (match) {
        const withUf = byNameUf.get(`${norm(match[1])}|${norm(match[2])}`);
        if (withUf) return withUf;
      }
    }
    return byName.get(norm(text)) ?? null;
  };

  return {
    scope,
    mapName,
    resolve,
    label: (key) => labels.get(key) ?? key,
    center: (key) => centers.get(key) ?? null,
  };
};

/** Tipo de malha mais provável para os valores: UF se a maioria for estado, senão município. */
const detectScope = async (values: string[]): Promise<GeoScope> => {
  const states = await loadGeo("uf");
  const sample = values.slice(0, 60).filter((value) => value.trim());
  if (sample.length === 0) return "uf";
  const hits = sample.filter((value) => states.resolve(value)).length;
  return hits / sample.length >= 0.5 ? "uf" : "municipio";
};

export type GeoState = { bundle: GeoBundle | null; error: string | null };

/** Malha do mapa para o gráfico (ou null enquanto carrega / quando o tipo não é mapa). */
export const useGeo = (type: ChartType, style: ChartStyle | undefined, categories: string[]): GeoState => {
  const wanted = isMapType(type);
  const scopeStyle = style?.mapScope ?? "auto";
  const region = style?.mapRegion;
  const [state, setState] = useState<GeoState>({ bundle: null, error: null });
  // as categorias só decidem o escopo no modo automático
  const sampleKey = scopeStyle === "auto" ? categories.slice(0, 60).join("\u0001") : "";

  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    const sample = sampleKey ? sampleKey.split("\u0001") : [];
    void (async () => {
      try {
        const scope = scopeStyle === "auto" ? await detectScope(sample) : scopeStyle;
        const bundle = await loadGeo(scope, region);
        if (!cancelled) setState({ bundle, error: null });
      } catch (error) {
        if (!cancelled) setState({ bundle: null, error: (error as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wanted, scopeStyle, region, sampleKey]);

  return state;
};
