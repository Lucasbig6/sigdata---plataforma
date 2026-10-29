"use client";

import {
  acceptCompletion,
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab, toggleComment } from "@codemirror/commands";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder,
} from "@codemirror/view";
import { useEffect, useRef } from "react";
import { buildSchema, extraCompletions } from "@/lib/sql-editor/completions";
import { statementAt } from "@/lib/sql-editor/statements";
import { sqlEditorTheme } from "@/lib/sql-editor/theme";
import type { DataSource } from "@/lib/domain/sources";

export type EditorHandle = {
  insert: (text: string) => void;
  focus: () => void;
  /** Substitui o trecho selecionado (ou o documento todo) e devolve o texto antigo. */
  replace: (transform: (text: string) => string) => void;
  getDoc: () => string;
  /** O que "Executar" roda: a seleção ou a instrução sob o cursor. */
  getRunnable: () => string;
};

type Props = {
  /** Muda ao trocar de aba: recarrega o documento e zera o histórico de desfazer. */
  docKey: string;
  value: string;
  source: DataSource | null;
  onChange: (value: string) => void;
  /** Texto a executar: seleção, ou a instrução sob o cursor. */
  onRun: (text: string) => void;
  onFormat: () => void;
  onCursor: (line: number, col: number) => void;
  handleRef: React.MutableRefObject<EditorHandle | null>;
};

const languageCompartment = new Compartment();

const languageFor = (source: DataSource | null) =>
  sql({ dialect: PostgreSQL, schema: buildSchema(source), upperCaseKeywords: true });

/** Editor SQL (CodeMirror 6): realce, autocomplete do esquema, modelos, busca e atalhos. */
export const CodeEditor = ({ docKey, value, source, onChange, onRun, onFormat, onCursor, handleRef }: Props) => {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // callbacks atuais, sem recriar o editor a cada render
  const cb = useRef({ onChange, onRun, onFormat, onCursor });
  cb.current = { onChange, onRun, onFormat, onCursor };
  const lastKey = useRef(docKey);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const makeState = useRef<((doc: string) => EditorState) | null>(null);
  // um estado por aba: preserva cursor e histórico de desfazer de cada script
  const states = useRef(new Map<string, EditorState>());

  useEffect(() => {
    if (!host.current) return;
    const runCurrent = (v: EditorView) => {
      const { from, to, head } = v.state.selection.main;
      const text =
        from !== to ? v.state.sliceDoc(from, to) : (statementAt(v.state.doc.toString(), head)?.text ?? "");
      cb.current.onRun(text);
      return true;
    };

    const make = (doc: string) =>
      EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        EditorState.tabSize.of(2),
        placeholder("SELECT ... FROM ...   (Ctrl+Espaço para sugestões, Ctrl+Enter para executar)"),
        languageCompartment.of(languageFor(sourceRef.current)),
        EditorState.languageData.of(() => [{ autocomplete: extraCompletions }]),
        autocompletion({ activateOnTyping: true, maxRenderedOptions: 60, icons: true }),
        keymap.of([
          { key: "Mod-Enter", run: runCurrent, preventDefault: true },
          {
            key: "Mod-Shift-f",
            run: () => {
              cb.current.onFormat();
              return true;
            },
            preventDefault: true,
          },
          { key: "Mod-/", run: toggleComment },
          { key: "Tab", run: acceptCompletion },
          ...closeBracketsKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...defaultKeymap,
          indentWithTab,
        ]),
        sqlEditorTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) cb.current.onChange(update.state.doc.toString());
          if (update.selectionSet || update.docChanged) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            cb.current.onCursor(line.number, head - line.from + 1);
          }
        }),
      ],
      });
    makeState.current = make;
    const v = new EditorView({ state: make(value), parent: host.current });
    view.current = v;

    handleRef.current = {
      insert: (text) => {
        const { from, to } = v.state.selection.main;
        v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
        v.focus();
      },
      focus: () => v.focus(),
      getDoc: () => v.state.doc.toString(),
      getRunnable: () => {
        const { from, to, head } = v.state.selection.main;
        return from !== to ? v.state.sliceDoc(from, to) : (statementAt(v.state.doc.toString(), head)?.text ?? "");
      },
      replace: (transform) => {
        const { from, to } = v.state.selection.main;
        const whole = from === to;
        const start = whole ? 0 : from;
        const end = whole ? v.state.doc.length : to;
        v.dispatch({ changes: { from: start, to: end, insert: transform(v.state.sliceDoc(start, end)) } });
      },
    };

    return () => {
      handleRef.current = null;
      v.destroy();
      view.current = null;
    };
    // o editor é criado uma vez; props mudam via refs e efeitos abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // esquema novo (troca de fonte ou schema atualizado)
  useEffect(() => {
    view.current?.dispatch({ effects: languageCompartment.reconfigure(languageFor(source)) });
  }, [source]);

  // troca de aba ou texto alterado de fora (formatar, reabrir do histórico)
  useEffect(() => {
    const v = view.current;
    if (!v || !makeState.current) return;
    if (lastKey.current !== docKey) {
      states.current.set(lastKey.current, v.state);
      lastKey.current = docKey;
      v.setState(states.current.get(docKey) ?? makeState.current(value));
      v.dispatch({ effects: languageCompartment.reconfigure(languageFor(sourceRef.current)) });
    }
    const current = v.state.doc.toString();
    if (current !== value) {
      v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [docKey, value]);

  return <div ref={host} className="h-full min-h-0 [&_.cm-editor]:h-full" />;
};
