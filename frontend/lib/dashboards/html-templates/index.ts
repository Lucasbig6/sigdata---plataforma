/**
 * Modelos prontos do visual HTML personalizado. Cada um traz HTML, CSS e JS completos e uma
 * dica do que a ligação de dados precisa ter. O JS usa `String.raw` e evita crase e `${`,
 * para o texto chegar ao editor exatamente como está aqui.
 */
import { BRASIL_GEO } from "./brasil-geo";

export type HtmlTemplate = {
  id: string;
  label: string;
  /** O que a tabela ligada precisa ter para o modelo funcionar. */
  needs: string;
  html: string;
  css: string;
  js: string;
};

/* ------------------------------------------------------------------ mapa */

const MAPA_JS = String.raw`// Mapa do Brasil por estado: cor pela medida, dica ao passar o mouse e clique que filtra o painel.
// Aceita a sigla (SP) ou o nome (São Paulo) na coluna do estado; soma a medida por estado.
var NOMES = {};
Object.keys(MAPA.ufs).forEach(function (sigla) { NOMES[norm(MAPA.ufs[sigla].n)] = sigla; });
function norm(t) { return String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function ufDe(v) {
  if (v === null || v === undefined) return null;
  var s = String(v).trim().toUpperCase();
  return MAPA.ufs[s] ? s : NOMES[norm(v)] || null;
}
var nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
var compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

var svg = document.getElementById("mapa");
var dica = document.getElementById("dica");
var NS = "http://www.w3.org/2000/svg";
svg.setAttribute("viewBox", "0 0 " + MAPA.w + " " + MAPA.h);
var caminhos = {};
Object.keys(MAPA.ufs).forEach(function (sigla, i) {
  var p = document.createElementNS(NS, "path");
  p.setAttribute("d", MAPA.ufs[sigla].d);
  p.setAttribute("class", "uf");
  p.style.animationDelay = i * 22 + "ms";
  p.addEventListener("mousemove", function (e) { mostrar(sigla, e); });
  p.addEventListener("mouseleave", function () { dica.style.opacity = 0; });
  p.addEventListener("click", function () { clicar(sigla); });
  svg.appendChild(p);
  caminhos[sigla] = p;
});

var atual = { chave: null, rotulos: {}, valores: {} };

function detectar(d) {
  var valor = d.columns.find(function (c) {
    return d.rows.some(function (r) { return typeof r[c] === "number"; });
  });
  var chave = null, melhor = 0;
  d.columns.forEach(function (c) {
    if (c === valor) return;
    var n = d.rows.filter(function (r) { return ufDe(r[c]); }).length;
    if (n > melhor) { melhor = n; chave = c; }
  });
  return { chave: chave, valor: valor };
}

function mostrar(sigla, e) {
  var v = atual.valores[sigla];
  dica.innerHTML = "";
  var nome = document.createElement("strong");
  nome.textContent = MAPA.ufs[sigla].n + " (" + sigla + ")";
  var num = document.createElement("span");
  num.textContent = v === undefined ? "sem dados" : nf.format(v);
  dica.append(nome, num);
  var caixa = document.getElementById("app").getBoundingClientRect();
  dica.style.left = Math.min(e.clientX - caixa.left + 12, caixa.width - 150) + "px";
  dica.style.top = Math.max(e.clientY - caixa.top - 40, 4) + "px";
  dica.style.opacity = 1;
}

function clicar(sigla) {
  if (atual.chave && atual.rotulos[sigla] !== undefined) sigdata.select(atual.chave, atual.rotulos[sigla]);
}

sigdata.onData(function (d) {
  var info = detectar(d);
  var aviso = document.getElementById("aviso");
  if (d.status !== "ready" || !info.chave) {
    aviso.textContent = d.status === "error" ? d.error : d.status === "loading" ? "Carregando…" : "Ligue uma tabela com uma coluna de estado (sigla ou nome) e uma numérica.";
    aviso.style.display = "block";
  } else {
    aviso.style.display = "none";
  }

  var valores = {}, rotulos = {};
  if (info.chave) {
    d.rows.forEach(function (r) {
      var uf = ufDe(r[info.chave]);
      if (!uf) return;
      if (rotulos[uf] === undefined) rotulos[uf] = String(r[info.chave]);
      valores[uf] = (valores[uf] || 0) + (info.valor ? Number(r[info.valor]) || 0 : 1);
    });
  }
  atual = { chave: info.chave, rotulos: rotulos, valores: valores };

  var lista = Object.keys(valores).map(function (k) { return valores[k]; });
  var min = Math.min.apply(null, lista), max = Math.max.apply(null, lista);
  var escolhida = d.selection && d.selection.column === info.chave ? ufDe(d.selection.value) : null;

  Object.keys(caminhos).forEach(function (sigla) {
    var p = caminhos[sigla], v = valores[sigla];
    if (v === undefined) {
      p.style.fill = "var(--sd-border)";
      p.style.opacity = escolhida ? 0.35 : 0.7;
    } else {
      var t = max === min ? 1 : (v - min) / (max - min);
      p.style.fill = "color-mix(in oklab, var(--sd-primary) " + Math.round(18 + t * 82) + "%, var(--sd-panel))";
      p.style.opacity = escolhida && sigla !== escolhida ? 0.35 : 1;
    }
    p.classList.toggle("sel", sigla === escolhida);
    p.style.cursor = v === undefined ? "default" : "pointer";
  });

  document.getElementById("min").textContent = lista.length ? compacto.format(min) : "";
  document.getElementById("max").textContent = lista.length ? compacto.format(max) : "";
});`;

const MAPA: HtmlTemplate = {
  id: "mapa-brasil",
  label: "Mapa do Brasil (animado, filtra o painel)",
  needs: "Uma coluna de estado (sigla ou nome) e uma coluna numérica. Clicar num estado filtra os outros elementos.",
  html: `<div id="app">
  <svg id="mapa" role="img" aria-label="Mapa do Brasil por estado"></svg>
  <div id="dica"></div>
  <div id="aviso"></div>
  <div id="legenda"><span id="min"></span><i></i><span id="max"></span></div>
</div>`,
  css: `#app { position: relative; height: 100%; display: flex; align-items: center; justify-content: center; padding: 8px; box-sizing: border-box; }
#mapa { width: 100%; height: 100%; }
.uf { stroke: var(--sd-panel); stroke-width: 1; stroke-linejoin: round;
  transition: fill .6s ease, opacity .3s, stroke-width .15s;
  transform-box: fill-box; transform-origin: center; animation: entra .5s ease-out both; }
.uf:hover { stroke: var(--sd-foreground); stroke-width: 2; }
.uf.sel { stroke: var(--sd-foreground); stroke-width: 2.5; }
@keyframes entra { from { opacity: 0; transform: scale(.94); } }
#dica { position: absolute; pointer-events: none; opacity: 0; transition: opacity .15s;
  background: var(--sd-panel); color: var(--sd-foreground); border: 1px solid var(--sd-border);
  border-radius: 8px; padding: 6px 10px; font-size: 12px; display: flex; flex-direction: column; gap: 2px;
  box-shadow: 0 4px 14px rgb(0 0 0 / .15); }
#dica span { font-variant-numeric: tabular-nums; color: var(--sd-muted-foreground); }
#aviso { position: absolute; inset: auto 12px 12px 12px; text-align: center; font-size: 12px; color: var(--sd-muted-foreground); display: none; }
#legenda { position: absolute; left: 12px; bottom: 12px; display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--sd-muted-foreground); }
#legenda i { width: 80px; height: 8px; border-radius: 4px;
  background: linear-gradient(90deg, color-mix(in oklab, var(--sd-primary) 18%, var(--sd-panel)), var(--sd-primary)); }
@media (prefers-reduced-motion: reduce) { .uf { animation: none; transition: none; } }`,
  js: `var MAPA = ${JSON.stringify(BRASIL_GEO)};\n${MAPA_JS}`,
};

/* --------------------------------------------------------------- ranking */

const RANKING: HtmlTemplate = {
  id: "ranking",
  label: "Ranking em barras (clique filtra o painel)",
  needs: "Uma coluna de texto e uma numérica. Mostra as 10 maiores; clicar numa barra filtra os outros elementos.",
  html: `<div id="app">
  <h3 id="titulo"></h3>
  <div id="lista"></div>
</div>`,
  css: `#app { padding: 14px; height: 100%; box-sizing: border-box; overflow: auto; }
h3 { margin: 0 0 10px; font-size: 14px; }
.linha { display: grid; grid-template-columns: 38% 1fr auto; gap: 10px; align-items: center; padding: 3px 4px; border-radius: 6px; cursor: pointer; }
.linha:hover { background: color-mix(in oklab, var(--sd-primary) 8%, transparent); }
.linha.sel { background: color-mix(in oklab, var(--sd-primary) 14%, transparent); }
.nome { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trilho { height: 10px; border-radius: 5px; background: var(--sd-border); overflow: hidden; }
.barra { height: 100%; border-radius: 5px; background: var(--sd-chart-3); transition: width .5s ease; }
.topo .barra { background: var(--sd-primary); }
.valor { font-variant-numeric: tabular-nums; color: var(--sd-muted-foreground); font-size: 12px; }
.vazio { color: var(--sd-muted-foreground); padding: 8px 0; }`,
  js: String.raw`var fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
var anterior = {};

sigdata.onData(function (d) {
  var lista = document.getElementById("lista");
  if (d.status === "error") { lista.textContent = d.error; return; }
  if (d.status === "loading") { lista.textContent = "Carregando…"; return; }

  // primeira coluna de texto = rótulo; primeira numérica = valor
  var amostra = d.rows[0] || {};
  var colValor = d.columns.find(function (c) { return typeof amostra[c] === "number"; });
  var colNome = d.columns.find(function (c) { return typeof amostra[c] !== "number"; });
  if (!colValor || !colNome) {
    lista.innerHTML = '<div class="vazio">Ligue uma tabela com uma coluna de texto e uma numérica.</div>';
    return;
  }
  document.getElementById("titulo").textContent = colValor + " por " + colNome;

  var linhas = d.rows.slice().sort(function (a, b) { return b[colValor] - a[colValor]; }).slice(0, 10);
  var max = Math.max.apply(null, linhas.map(function (r) { return r[colValor]; })) || 1;
  var escolhido = d.selection && d.selection.column === colNome ? d.selection.value : null;

  lista.innerHTML = "";
  linhas.forEach(function (r, i) {
    var nomeTxt = String(r[colNome]);
    var linha = document.createElement("div");
    linha.className = "linha" + (i === 0 ? " topo" : "") + (nomeTxt === escolhido ? " sel" : "");
    linha.addEventListener("click", function () { sigdata.select(colNome, nomeTxt); });

    var nome = document.createElement("div");
    nome.className = "nome";
    nome.textContent = nomeTxt;
    nome.title = nomeTxt;

    var trilho = document.createElement("div");
    trilho.className = "trilho";
    var barra = document.createElement("div");
    barra.className = "barra";
    // a barra parte da largura anterior (ou de zero) e anima até a nova
    barra.style.width = (anterior[nomeTxt] || 0) + "%";
    var alvo = Math.max((r[colValor] / max) * 100, 1);
    requestAnimationFrame(function () { requestAnimationFrame(function () { barra.style.width = alvo + "%"; }); });
    anterior[nomeTxt] = alvo;
    trilho.appendChild(barra);

    var valor = document.createElement("div");
    valor.className = "valor";
    valor.textContent = fmt.format(r[colValor]);

    linha.append(nome, trilho, valor);
    lista.appendChild(linha);
  });
});`,
};

/* --------------------------------------------------------------- Chart.js */

const CHARTJS: HtmlTemplate = {
  id: "chartjs",
  label: "Gráfico com Chart.js (biblioteca da CDN)",
  needs: "Uma coluna de texto e uma numérica. Carrega o Chart.js do jsDelivr; clicar numa barra filtra o painel.",
  html: `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<div class="caixa"><canvas id="c"></canvas></div>`,
  css: `.caixa { position: relative; height: 100%; padding: 10px; box-sizing: border-box; }`,
  js: String.raw`var grafico = null;

function cor(nome, reserva) {
  var v = getComputedStyle(document.documentElement).getPropertyValue("--sd-" + nome).trim();
  return v || reserva;
}

sigdata.onData(function (d) {
  if (d.status !== "ready" || typeof Chart === "undefined") return;
  var amostra = d.rows[0] || {};
  var colValor = d.columns.find(function (c) { return typeof amostra[c] === "number"; });
  var colNome = d.columns.find(function (c) { return typeof amostra[c] !== "number"; });
  if (!colValor || !colNome) return;

  var rotulos = d.rows.map(function (r) { return String(r[colNome]); });
  var escolhido = d.selection && d.selection.column === colNome ? d.selection.value : null;
  var base = cor("chart-3", "#3b82f6");
  var cores = rotulos.map(function (r) { return escolhido && r !== escolhido ? cor("border", "#cbd5e1") : base; });
  var texto = cor("muted-foreground", "#64748b");

  if (grafico) grafico.destroy();
  grafico = new Chart(document.getElementById("c"), {
    type: "bar",
    data: { labels: rotulos, datasets: [{ label: colValor, data: d.rows.map(function (r) { return r[colValor]; }), backgroundColor: cores, borderRadius: 4 }] },
    options: {
      maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: texto }, grid: { display: false } }, y: { ticks: { color: texto }, grid: { color: cor("border", "#e2e8f0") } } },
      onClick: function (e, elementos) {
        if (elementos.length) sigdata.select(colNome, rotulos[elementos[0].index]);
      },
    },
  });
});`,
};

/* ----------------------------------------------------------------- cartões */

const CARTOES: HtmlTemplate = {
  id: "cartoes",
  label: "Cartões com contagem animada",
  needs: "Uma coluna de texto e uma numérica. Cada linha vira um cartão; o número sobe até o valor.",
  html: `<div id="grade"></div>`,
  css: `#grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; padding: 12px; box-sizing: border-box; height: 100%; overflow: auto; align-content: start; }
.cartao { border: 1px solid var(--sd-border); border-radius: 12px; padding: 12px 14px; background: var(--sd-panel);
  animation: sobe .5s ease-out both; cursor: pointer; transition: border-color .2s, transform .2s; }
.cartao:hover { border-color: var(--sd-primary); transform: translateY(-2px); }
.cartao.sel { border-color: var(--sd-primary); box-shadow: 0 0 0 1px var(--sd-primary); }
.rotulo { font-size: 11px; color: var(--sd-muted-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.numero { font-size: 24px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; color: var(--sd-primary); }
@keyframes sobe { from { opacity: 0; transform: translateY(8px); } }
@media (prefers-reduced-motion: reduce) { .cartao { animation: none; } }`,
  js: String.raw`var fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
var ultimo = {};

function contar(el, de, ate) {
  var inicio = null, duracao = 700;
  function passo(t) {
    if (inicio === null) inicio = t;
    var p = Math.min((t - inicio) / duracao, 1);
    var suave = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt.format(de + (ate - de) * suave);
    if (p < 1) requestAnimationFrame(passo);
  }
  requestAnimationFrame(passo);
}

sigdata.onData(function (d) {
  var grade = document.getElementById("grade");
  if (d.status !== "ready") { grade.textContent = d.status === "error" ? d.error : "Carregando…"; return; }
  var amostra = d.rows[0] || {};
  var colValor = d.columns.find(function (c) { return typeof amostra[c] === "number"; });
  var colNome = d.columns.find(function (c) { return typeof amostra[c] !== "number"; });
  if (!colValor || !colNome) { grade.textContent = "Ligue uma tabela com uma coluna de texto e uma numérica."; return; }
  var escolhido = d.selection && d.selection.column === colNome ? d.selection.value : null;

  grade.innerHTML = "";
  d.rows.slice(0, 24).forEach(function (r, i) {
    var nome = String(r[colNome]);
    var cartao = document.createElement("div");
    cartao.className = "cartao" + (nome === escolhido ? " sel" : "");
    cartao.style.animationDelay = i * 40 + "ms";
    cartao.addEventListener("click", function () { sigdata.select(colNome, nome); });
    var rotulo = document.createElement("div");
    rotulo.className = "rotulo";
    rotulo.textContent = nome;
    var numero = document.createElement("div");
    numero.className = "numero";
    cartao.append(rotulo, numero);
    grade.appendChild(cartao);
    contar(numero, ultimo[nome] || 0, r[colValor]);
    ultimo[nome] = r[colValor];
  });
});`,
};

export const HTML_TEMPLATES: HtmlTemplate[] = [MAPA, RANKING, CHARTJS, CARTOES];
