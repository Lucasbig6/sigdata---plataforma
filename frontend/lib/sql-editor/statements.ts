/**
 * Separação de instruções SQL por `;`, ignorando os que estão dentro de
 * strings, identificadores entre aspas e comentários. O editor executa a
 * instrução sob o cursor (como DBeaver), já que o servidor aceita uma por vez.
 */

export type Statement = { from: number; to: number; text: string };

export const splitStatements = (sql: string): Statement[] => {
  const out: Statement[] = [];
  let start = 0;
  let i = 0;

  const push = (end: number) => {
    const raw = sql.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const text = raw.trim();
    // trechos só com comentários não são instruções
    const code = text.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (code) out.push({ from: start + lead, to: start + lead + text.length, text });
  };

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
    } else if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
    } else if (ch === "'" || ch === '"') {
      i++;
      while (i < sql.length) {
        if (sql[i] === ch) {
          // aspas dobradas ('') continuam dentro do literal
          if (sql[i + 1] === ch) i += 2;
          else break;
        } else i++;
      }
      i++;
    } else if (ch === ";") {
      push(i);
      i++;
      start = i;
    } else {
      i++;
    }
  }
  push(sql.length);
  return out;
};

/** Instrução em que o cursor está; entre duas instruções vale a anterior. */
export const statementAt = (sql: string, pos: number): Statement | null => {
  const all = splitStatements(sql);
  if (all.length === 0) return null;
  const inside = all.find((s) => pos >= s.from && pos <= s.to + 1);
  if (inside) return inside;
  const before = [...all].reverse().find((s) => s.to < pos);
  return before ?? all[0];
};
