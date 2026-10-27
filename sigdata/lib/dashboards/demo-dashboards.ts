/**
 * Dashboards demonstrativos do SIGDATA.
 *
 * Dados fictícios: servem como exemplo de composição e como conteúdo inicial
 * do editor. Nenhum número aqui representa resultado real.
 */
import { findLibraryItem, createElement } from "./presets";
import { DASHBOARD_SCHEMA_VERSION, CANVAS, type Dashboard, type DashboardElement } from "./types";

type SeedItem = {
  key: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  props?: Record<string, unknown>;
};

const buildElements = (seeds: SeedItem[]): DashboardElement[] =>
  seeds.map((seed, index) => {
    const item = findLibraryItem(seed.key);
    if (!item) throw new Error(`preset inexistente: ${seed.key}`);
    return createElement(item, {
      x: seed.x,
      y: seed.y,
      z: index,
      size: seed.w !== undefined && seed.h !== undefined ? { w: seed.w, h: seed.h } : undefined,
      props: seed.props,
    });
  });

const dataset = (
  categoryField: "periodo" | "municipio",
  valueField: "valor" | "indice" | "receita" | "variacao",
) => ({
  source: "demo",
  ref: "demo",
  categoryField,
  valueField,
});

const DEMO_SEEDS: {
  id: string;
  name: string;
  description: string;
  ageDays: number;
  items: SeedItem[];
}[] = [
  {
    id: "demo-visao-geral",
    name: "Visão geral municipal",
    description:
      "Indicadores sintéticos, evolução mensal e comparativo entre municípios fictícios.",
    ageDays: 2,
    items: [
      {
        key: "title",
        x: 40,
        y: 36,
        w: 720,
        h: 64,
        props: { content: "Visão geral municipal", fontSize: 34 },
      },
      {
        key: "text",
        x: 40,
        y: 112,
        w: 760,
        h: 52,
        props: {
          content: "Dados de demonstração — nenhuma fonte real conectada ao painel.",
          fontSize: 15,
          color: "#9FB0B4",
        },
      },
      {
        key: "kpi",
        x: 40,
        y: 184,
        props: { title: "Índice geral", value: "74,2", description: "base 0–100" },
      },
      {
        key: "kpi",
        x: 300,
        y: 184,
        props: {
          title: "Receita",
          value: "128,6",
          unit: "R$ mi",
          description: "acumulado no ano",
        },
      },
      {
        key: "percent",
        x: 560,
        y: 184,
        props: { title: "Cobertura", value: "86", description: "serviços mapeados" },
      },
      {
        key: "comparison",
        x: 820,
        y: 184,
        w: 300,
        h: 132,
        props: {
          title: "Variação no período",
          value: "+3,4",
          description: "vs. período anterior",
        },
      },
      {
        key: "filter-periodo",
        x: 1300,
        y: 184,
      },
      {
        key: "bar",
        x: 40,
        y: 348,
        w: 740,
        h: 300,
        props: {
          title: "Índice mensal",
          subtitle: "2024 — dados fictícios",
          dataset: dataset("periodo", "valor"),
        },
      },
      {
        key: "line",
        x: 820,
        y: 348,
        w: 740,
        h: 300,
        props: {
          title: "Evolução do índice",
          subtitle: "serie mensal fictícia",
          dataset: dataset("periodo", "valor"),
          color: 3,
        },
      },
      {
        key: "table",
        x: 40,
        y: 672,
        w: 940,
        h: 288,
        props: { title: "Municípios (demonstração)" },
      },
      {
        key: "pie",
        x: 1010,
        y: 672,
        w: 280,
        h: 288,
        props: {
          title: "Composição",
          subtitle: "",
          showTitle: false,
          showLegend: false,
          dataset: dataset("municipio", "indice"),
        },
      },
      {
        key: "text",
        x: 1320,
        y: 672,
        w: 240,
        h: 288,
        props: {
          content:
            "Resumo: os municípios fictícios concentram índices entre 68 e 82. Números ilustrativos, sem vínculo com bases reais.",
          fontSize: 14,
          color: "#9FB0B4",
        },
      },
    ],
  },
  {
    id: "demo-receita-cobertura",
    name: "Receita e cobertura",
    description: "Receita por município, evolução acumulada e filtros demonstrativos.",
    ageDays: 6,
    items: [
      {
        key: "title",
        x: 40,
        y: 36,
        w: 760,
        h: 64,
        props: { content: "Receita e cobertura", fontSize: 34 },
      },
      { key: "filter-municipio", x: 1300, y: 44 },
      {
        key: "bar",
        x: 40,
        y: 160,
        w: 740,
        h: 340,
        props: {
          title: "Receita por município",
          subtitle: "R$ milhões — demonstração",
          dataset: dataset("municipio", "receita"),
        },
      },
      {
        key: "area",
        x: 820,
        y: 160,
        w: 740,
        h: 340,
        props: {
          title: "Índice acumulado",
          dataset: dataset("periodo", "valor"),
          color: 4,
        },
      },
      {
        key: "comparison",
        x: 40,
        y: 540,
        props: {
          title: "Receita no período",
          value: "-1,8",
          unit: "%",
          description: "vs. período anterior",
          delta: -1.8,
        },
      },
      {
        key: "percent",
        x: 360,
        y: 540,
        props: { title: "Cobertura", value: "86", delta: 5.1 },
      },
      {
        key: "shape",
        x: 820,
        y: 540,
        w: 300,
        h: 160,
        props: { shape: "retangulo", radius: 18 },
      },
      {
        key: "divider",
        x: 40,
        y: 730,
        w: 1080,
        h: 24,
      },
      {
        key: "text",
        x: 40,
        y: 772,
        w: 740,
        h: 168,
        props: {
          content:
            "Leitura sugerida: a receita cresce até meados do ano e recua no segundo semestre fictício. Use os filtros para simular recortes — as opções são locais e não consultam fontes externas.",
          fontSize: 16,
        },
      },
      {
        key: "text",
        x: 820,
        y: 730,
        w: 740,
        h: 210,
        props: {
          content:
            "Cobertura de serviços mapeados em base fictícia (86%). Os valores exibidos são ilustrativos e não representam resultados de análise.",
          fontSize: 16,
          color: "#9FB0B4",
        },
      },
    ],
  },
  {
    id: "demo-painel-executivo",
    name: "Painel executivo",
    description: "Síntese para apresentação: KPIs, tendência, composição e tabela.",
    ageDays: 13,
    items: [
      {
        key: "title",
        x: 40,
        y: 36,
        w: 860,
        h: 64,
        props: { content: "Painel executivo", fontSize: 34 },
      },
      {
        key: "text",
        x: 40,
        y: 112,
        w: 860,
        h: 48,
        props: {
          content: "Conjunto fictício para demonstração de composição de painel.",
          fontSize: 15,
          color: "#9FB0B4",
        },
      },
      { key: "kpi", x: 40, y: 184, props: { title: "Índice geral", value: "74,2" } },
      {
        key: "kpi",
        x: 300,
        y: 184,
        props: {
          title: "Receita",
          value: "128,6",
          unit: "R$ mi",
          description: "acumulado",
        },
      },
      {
        key: "percent",
        x: 560,
        y: 184,
        props: { title: "Cobertura", value: "86", delta: 5.1 },
      },
      { key: "filter-categoria", x: 1300, y: 184 },
      {
        key: "line",
        x: 40,
        y: 348,
        w: 940,
        h: 300,
        props: {
          title: "Tendência do índice",
          dataset: dataset("periodo", "valor"),
        },
      },
      {
        key: "pie",
        x: 1010,
        y: 184,
        w: 550,
        h: 464,
        props: {
          title: "Composição por município",
          dataset: dataset("municipio", "indice"),
          showLegend: true,
        },
      },
      {
        key: "table",
        x: 40,
        y: 672,
        w: 940,
        h: 288,
        props: { title: "Detalhamento (demonstração)" },
      },
      { key: "divider", x: 1010, y: 672, w: 550, h: 24 },
      {
        key: "text",
        x: 1010,
        y: 716,
        w: 550,
        h: 244,
        props: {
          content:
            "Painel pronto para apresentação. Altere tamanhos, camadas e propriedades no editor; a pré-visualização esconde todos os controles de edição.",
          fontSize: 16,
        },
      },
    ],
  },
];

const DAY = 24 * 60 * 60 * 1000;

export const createDemoDashboards = (): Dashboard[] =>
  DEMO_SEEDS.map((seed) => {
    const updatedAt = Date.now() - seed.ageDays * DAY;
    return {
      id: seed.id,
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      name: seed.name,
      description: seed.description,
      origin: "demo",
      createdAt: updatedAt - 3 * DAY,
      updatedAt,
      canvas: { ...CANVAS },
      elements: buildElements(seed.items),
    };
  });
