/**
 * Gera as malhas do mapa (frontend/public/geo) a partir da API de malhas e localidades do IBGE.
 * Uso: node frontend/scripts/build-geo.mjs
 * Saída: br-uf.json e br-municipios.json (GeoJSON simplificado, qualidade mínima) com
 * `properties` enxutas: UF { code, sigla, name }, município { code, name, uf }.
 */
import { writeFile } from "node:fs/promises";

const IBGE = "https://servicodados.ibge.gov.br/api";
const OUT = new URL("../public/geo/", import.meta.url);
const json = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} em ${url}`);
  return response.json();
};
const round = (coords) => (typeof coords[0] === "number" ? coords.map((n) => Math.round(n * 1e3) / 1e3) : coords.map(round));
const slim = (geo, props) => ({
  type: "FeatureCollection",
  features: geo.features.map((f) => ({
    type: "Feature",
    properties: props(f.properties.codarea),
    geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
  })),
});

const estados = await json(`${IBGE}/v1/localidades/estados`);
const ufByCode = new Map(estados.map((e) => [String(e.id), e]));
const ufGeo = await json(`${IBGE}/v3/malhas/paises/BR?intrarregiao=UF&qualidade=minima&formato=application/vnd.geo+json`);
await writeFile(
  new URL("br-uf.json", OUT),
  JSON.stringify(slim(ufGeo, (code) => ({ code, sigla: ufByCode.get(code).sigla, name: ufByCode.get(code).nome }))),
);

const municipios = await json(`${IBGE}/v1/localidades/municipios`);
const munByCode = new Map(municipios.map((m) => [String(m.id), m]));
const munGeo = await json(`${IBGE}/v3/malhas/paises/BR?intrarregiao=municipio&qualidade=minima&formato=application/vnd.geo+json`);
await writeFile(
  new URL("br-municipios.json", OUT),
  JSON.stringify(
    slim(munGeo, (code) => {
      const m = munByCode.get(code);
      return { code, name: m?.nome ?? code, uf: m?.microrregiao?.mesorregiao?.UF?.sigla ?? m?.["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla ?? "" };
    }),
  ),
);
console.log("ok");
