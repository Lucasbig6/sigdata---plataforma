/**
 * Aparência do editor: usa os tokens do app (claro/escuro automáticos) e as
 * cores de sintaxe definidas em globals.css (`--sql-*`).
 */
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

const MONO = 'ui-monospace, "JetBrains Mono", "Fira Code", SFMono-Regular, Menlo, Consolas, monospace';

const theme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    backgroundColor: "var(--card)",
    color: "var(--foreground)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: MONO, lineHeight: "1.65", overflow: "auto" },
  ".cm-content": { caretColor: "var(--foreground)", padding: "6px 0" },
  ".cm-line": { padding: "0 12px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)", borderLeftWidth: "2px" },
  ".cm-gutters": {
    backgroundColor: "var(--muted)",
    color: "var(--muted-foreground)",
    border: "none",
    borderRight: "1px solid var(--border)",
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 10px 0 14px", minWidth: "36px" },
  ".cm-activeLine": { backgroundColor: "color-mix(in oklch, var(--primary) 7%, transparent)" },
  ".cm-activeLineGutter": {
    backgroundColor: "color-mix(in oklch, var(--primary) 12%, var(--muted))",
    color: "var(--foreground)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklch, var(--primary) 30%, transparent) !important",
  },
  ".cm-matchingBracket": {
    backgroundColor: "color-mix(in oklch, var(--primary) 25%, transparent)",
    outline: "1px solid color-mix(in oklch, var(--primary) 55%, transparent)",
  },
  ".cm-selectionMatch": { backgroundColor: "color-mix(in oklch, var(--primary) 18%, transparent)" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },

  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground, var(--foreground))",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    boxShadow: "0 8px 24px rgb(0 0 0 / 0.18)",
    overflow: "hidden",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": { fontFamily: MONO, fontSize: "12px", maxHeight: "16rem" },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": { padding: "3px 10px", display: "flex", alignItems: "center" },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "color-mix(in oklch, var(--primary) 18%, transparent)",
    color: "var(--foreground)",
  },
  ".cm-completionDetail": { marginLeft: "auto", paddingLeft: "16px", fontStyle: "normal", opacity: 0.6, fontSize: "11px" },
  ".cm-completionMatchedText": { textDecoration: "none", fontWeight: "700", color: "var(--primary)" },
  ".cm-completionIcon": { opacity: 0.7 },

  ".cm-panels": {
    backgroundColor: "var(--muted)",
    color: "var(--foreground)",
    borderBottom: "1px solid var(--border)",
    fontFamily: "inherit",
  },
  ".cm-panel.cm-search": { padding: "6px 10px", fontSize: "12px" },
  ".cm-panel.cm-search input, .cm-panel.cm-search button": {
    fontSize: "12px",
    borderRadius: "6px",
    border: "1px solid var(--border)",
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
    padding: "2px 8px",
  },
  ".cm-panel.cm-search label": { fontSize: "11px" },
  ".cm-searchMatch": { backgroundColor: "color-mix(in oklch, var(--ring) 30%, transparent)" },
  ".cm-searchMatch-selected": { backgroundColor: "color-mix(in oklch, var(--ring) 55%, transparent)" },
});

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: "var(--sql-keyword)", fontWeight: "600" },
  { tag: [t.string, t.special(t.string)], color: "var(--sql-string)" },
  { tag: [t.number, t.bool, t.null], color: "var(--sql-number)" },
  { tag: [t.lineComment, t.blockComment, t.comment], color: "var(--sql-comment)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.standard(t.name)], color: "var(--sql-func)" },
  { tag: [t.typeName, t.className], color: "var(--sql-type)" },
  { tag: [t.operator, t.punctuation, t.paren, t.separator], color: "var(--sql-op)" },
]);

export const sqlEditorTheme = [theme, syntaxHighlighting(highlight)];
