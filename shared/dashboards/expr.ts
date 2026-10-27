/**
 * Medidas calculadas: uma expressão pequena e segura sobre colunas de uma tabela.
 *
 *   sum(receita) - sum(custo)
 *   sum(lucro) / sum(receita) * 100
 *   round(avg(preco * quantidade), 2)
 *   countd(cliente) / count(*)
 *
 * O texto NUNCA vira SQL direto: é analisado, cada coluna é validada contra o
 * schema e o SQL é gerado a partir da árvore (identificadores entre aspas,
 * números só como literais, funções de uma lista fixa).
 */

export type ExprColumn = { name: string; kind: string };

export type CompileResult = { ok: true; sql: string } | { ok: false; error: string };

type Node =
  | { t: "num"; v: number }
  | { t: "col"; name: string }
  | { t: "star" }
  | { t: "neg"; x: Node }
  | { t: "bin"; op: "+" | "-" | "*" | "/"; l: Node; r: Node }
  | { t: "agg"; fn: "sum" | "avg" | "min" | "max" | "count" | "countd"; x: Node }
  | { t: "round"; x: Node; digits: number }
  | { t: "abs"; x: Node };

type Token =
  | { k: "num"; v: number }
  | { k: "id"; v: string }
  | { k: "quoted"; v: string }
  | { k: "op"; v: string };

export const EXPR_MAX_LENGTH = 300;
const MAX_DEPTH = 16;

class ExprError extends Error {}

const AGGS = new Set(["sum", "avg", "min", "max", "count", "countd"]);
const NUMERIC_AGGS = new Set(["sum", "avg"]);

const tokenize = (text: string): Token[] => {
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if ("+-*/(),".includes(ch)) {
      out.push({ k: "op", v: ch });
      i++;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(text[i + 1] ?? ""))) {
      const m = /^(\d+(\.\d+)?|\.\d+)/.exec(text.slice(i));
      if (!m) throw new ExprError("Número inválido.");
      out.push({ k: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (ch === '"' || ch === "[") {
      const close = ch === '"' ? '"' : "]";
      const end = text.indexOf(close, i + 1);
      if (end < 0) throw new ExprError("Nome de coluna sem fechamento.");
      out.push({ k: "quoted", v: text.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    const m = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(text.slice(i));
    if (m) {
      out.push({ k: "id", v: m[0] });
      i += m[0].length;
      continue;
    }
    throw new ExprError(`Caractere não permitido: "${ch}".`);
  }
  return out;
};

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek = () => this.tokens[this.pos];
  private isOp = (v: string) => {
    const t = this.peek();
    return t?.k === "op" && t.v === v;
  };
  private expectOp(v: string) {
    if (!this.isOp(v)) throw new ExprError(`Esperado "${v}".`);
    this.pos++;
  }

  parseAll(): Node {
    const node = this.expr(0, false);
    if (this.pos < this.tokens.length) throw new ExprError("Expressão incompleta ou com símbolo sobrando.");
    return node;
  }

  private expr(depth: number, inAgg: boolean): Node {
    if (depth > MAX_DEPTH) throw new ExprError("Expressão complexa demais.");
    let left = this.term(depth, inAgg);
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.peek() as { v: "+" | "-" }).v;
      this.pos++;
      left = { t: "bin", op, l: left, r: this.term(depth, inAgg) };
    }
    return left;
  }

  private term(depth: number, inAgg: boolean): Node {
    let left = this.unary(depth, inAgg);
    while (this.isOp("*") || this.isOp("/")) {
      const op = (this.peek() as { v: "*" | "/" }).v;
      this.pos++;
      left = { t: "bin", op, l: left, r: this.unary(depth, inAgg) };
    }
    return left;
  }

  private unary(depth: number, inAgg: boolean): Node {
    if (this.isOp("-")) {
      this.pos++;
      return { t: "neg", x: this.unary(depth + 1, inAgg) };
    }
    return this.primary(depth, inAgg);
  }

  private primary(depth: number, inAgg: boolean): Node {
    const token = this.peek();
    if (!token) throw new ExprError("Expressão incompleta.");
    if (token.k === "num") {
      this.pos++;
      return { t: "num", v: token.v };
    }
    if (token.k === "op" && token.v === "(") {
      this.pos++;
      const inner = this.expr(depth + 1, inAgg);
      this.expectOp(")");
      return inner;
    }
    if (token.k === "quoted") {
      this.pos++;
      if (!inAgg) throw new ExprError(`Use uma função sobre a coluna, ex.: sum("${token.v}").`);
      return { t: "col", name: token.v };
    }
    if (token.k === "id") {
      this.pos++;
      const name = token.v.toLowerCase();
      if (this.isOp("(")) return this.call(name, token.v, depth, inAgg);
      if (!inAgg) throw new ExprError(`Use uma função sobre a coluna, ex.: sum(${token.v}).`);
      return { t: "col", name: token.v };
    }
    throw new ExprError(`Símbolo inesperado: "${(token as { v: string }).v}".`);
  }

  private call(name: string, original: string, depth: number, inAgg: boolean): Node {
    this.expectOp("(");
    if (AGGS.has(name)) {
      if (inAgg) throw new ExprError("Não é possível usar uma função de agregação dentro de outra.");
      if (name === "count" && this.isOp("*")) {
        this.pos++;
        this.expectOp(")");
        return { t: "agg", fn: "count", x: { t: "star" } };
      }
      const x = this.expr(depth + 1, true);
      this.expectOp(")");
      return { t: "agg", fn: name as "sum", x };
    }
    if (name === "abs") {
      const x = this.expr(depth + 1, inAgg);
      this.expectOp(")");
      return { t: "abs", x };
    }
    if (name === "round") {
      const x = this.expr(depth + 1, inAgg);
      let digits = 0;
      if (this.isOp(",")) {
        this.pos++;
        const t = this.peek();
        if (t?.k !== "num" || !Number.isInteger(t.v) || t.v < 0 || t.v > 6) {
          throw new ExprError("round: as casas decimais devem ser um número inteiro de 0 a 6.");
        }
        digits = t.v;
        this.pos++;
      }
      this.expectOp(")");
      return { t: "round", x, digits };
    }
    throw new ExprError(`Função desconhecida: ${original}. Use sum, avg, min, max, count, countd, round ou abs.`);
  }
}

const resolveColumn = (name: string, columns: ExprColumn[]): ExprColumn => {
  const exact = columns.find((c) => c.name === name);
  if (exact) return exact;
  const loose = columns.filter((c) => c.name.toLowerCase() === name.toLowerCase());
  if (loose.length === 1) return loose[0];
  throw new ExprError(
    loose.length > 1 ? `Coluna "${name}" é ambígua.` : `Coluna "${name}" não existe nesta tabela.`,
  );
};

const hasAgg = (node: Node): boolean => {
  switch (node.t) {
    case "agg":
      return true;
    case "bin":
      return hasAgg(node.l) || hasAgg(node.r);
    case "neg":
    case "abs":
    case "round":
      return hasAgg(node.x);
    default:
      return false;
  }
};

/** Compila a expressão em SQL seguro. `quote` coloca um identificador entre aspas. */
export const compileMeasure = (
  text: string,
  columns: ExprColumn[],
  quote: (identifier: string) => string,
): CompileResult => {
  try {
    const source = text.trim();
    if (!source) throw new ExprError("Escreva uma expressão, ex.: sum(receita) - sum(custo).");
    if (source.length > EXPR_MAX_LENGTH) throw new ExprError(`Expressão longa demais (máx. ${EXPR_MAX_LENGTH}).`);
    const ast = new Parser(tokenize(source)).parseAll();
    if (!hasAgg(ast)) throw new ExprError("Use ao menos uma agregação (sum, avg, count...).");

    const gen = (node: Node, numericOnly: boolean): string => {
      switch (node.t) {
        case "num":
          return Number.isFinite(node.v) ? String(node.v) : "0";
        case "star":
          return "*";
        case "col": {
          const column = resolveColumn(node.name, columns);
          if (numericOnly && column.kind !== "numero") {
            throw new ExprError(`A coluna "${column.name}" não é numérica.`);
          }
          return quote(column.name);
        }
        case "neg":
          return `(-${gen(node.x, numericOnly)})`;
        case "bin": {
          const l = gen(node.l, numericOnly);
          const r = gen(node.r, numericOnly);
          return node.op === "/" ? `(${l} * 1.0 / NULLIF(${r}, 0))` : `(${l} ${node.op} ${r})`;
        }
        case "agg": {
          if (node.x.t === "star") return "count(*)";
          const inner = gen(node.x, NUMERIC_AGGS.has(node.fn) || node.x.t === "bin" || node.x.t === "neg");
          return node.fn === "countd" ? `count(DISTINCT ${inner})` : `${node.fn}(${inner})`;
        }
        case "round":
          return `round(CAST(${gen(node.x, false)} AS NUMERIC), ${node.digits})`;
        case "abs":
          return `abs(${gen(node.x, false)})`;
      }
    };
    return { ok: true, sql: gen(ast, false) };
  } catch (error) {
    if (error instanceof ExprError) return { ok: false, error: error.message };
    return { ok: false, error: "Expressão inválida." };
  }
};
