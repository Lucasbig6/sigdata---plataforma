/**
 * Conjunto de dados fictícios para as visualizações do painel SIGDATA.
 *
 * ATENÇÃO: tudo aqui é DEMONSTRAÇÃO. Não é resultado de análise real
 * nem saída do modelo Groq.
 */

export const DEMO_NOTICE = "Dados de demonstração";
export const DEMO_SOURCE = "Conjunto fictício — sem conexão com fontes reais";

export type Kpi = {
  label: string;
  value: string;
  delta: number;
  hint: string;
};

export type SeriesPoint = {
  label: string;
  valor: number;
};

export type Municipio = {
  nome: string;
  indice: number;
  variacao: number;
  receita: number;
};

export type ResumoItem = {
  titulo: string;
  texto: string;
};

export const KPIS: Kpi[] = [
  { label: "Índice geral", value: "74,2", delta: 3.4, hint: "base 0–100" },
  { label: "Receita (R$ mi)", value: "128,6", delta: -1.8, hint: "acumulado no ano" },
  { label: "Cobertura", value: "86%", delta: 5.1, hint: "serviços mapeados" },
  { label: "Atenções", value: "7", delta: 0, hint: "indicadores fora da meta" },
];

export const SERIE_TEMPORAL: SeriesPoint[] = [
  { label: "Jan", valor: 58 },
  { label: "Fev", valor: 61 },
  { label: "Mar", valor: 60 },
  { label: "Abr", valor: 65 },
  { label: "Mai", valor: 67 },
  { label: "Jun", valor: 64 },
  { label: "Jul", valor: 70 },
  { label: "Ago", valor: 72 },
  { label: "Set", valor: 71 },
  { label: "Out", valor: 74 },
  { label: "Nov", valor: 76 },
  { label: "Dez", valor: 74 },
];

export const MUNICIPIOS: Municipio[] = [
  { nome: "Aurora do Norte", indice: 82.4, variacao: 4.2, receita: 31.8 },
  { nome: "Bela Vista do Sul", indice: 79.1, variacao: 2.6, receita: 27.4 },
  { nome: "Campos do Rio", indice: 76.8, variacao: -1.2, receita: 22.9 },
  { nome: "Dourados", indice: 71.5, variacao: 0.8, receita: 19.6 },
  { nome: "Espinhaço", indice: 68.9, variacao: -3.4, receita: 15.2 },
  { nome: "Farol da Serra", indice: 64.3, variacao: 1.9, receita: 11.7 },
];

export const RESUMOS: ResumoItem[] = [
  {
    titulo: "Concentração regional",
    texto: "Os dois maiores municípios concentram 46% do total, com variação positiva no período.",
  },
  {
    titulo: "Série em alta leve",
    texto: "A série mensal sobe de 58 para 74 no ano, com retração apenas em junho.",
  },
  {
    titulo: "Pontos de atenção",
    texto: "Três indicadores seguem abaixo da meta e dois municípios apresentam variação negativa.",
  },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Simula o carregamento do painel (rede/banco de dados inexistentes nesta
 * etapa). Mantenha a assinatura async para evoluir para uma fonte real.
 */
export async function loadDemoData(): Promise<void> {
  await sleep(450);
  if (!KPIS.length || !SERIE_TEMPORAL.length) {
    throw new Error("conjunto de demonstração indisponível");
  }
}
