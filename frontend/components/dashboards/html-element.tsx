"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isBindingReady, useBindingData, useDashboardData } from "@/lib/dashboards/live-data";
import { useDashboardsStore } from "@/lib/dashboards/store";
import type { DashboardElement } from "@/lib/dashboards/types";
import { RefreshingDot } from "./data-state";
import { useHtmlRuntime } from "@/lib/dashboards/html-runtime";
import { FILTER_VALUE_MAX } from "@shared/dashboards/data";
import {
  buildSandboxDoc,
  HTML_MESSAGE_TAG,
  HTML_THEME_VARS,
  type HtmlPayload,
  type HtmlSelectMessage,
  type HtmlTheme,
} from "@shared/dashboards/html-sandbox";

/** Lê as cores do tema atual para repassá-las ao iframe (o código do autor as usa como `--sd-*`). */
const readTheme = (): HtmlTheme => {
  const style = getComputedStyle(document.documentElement);
  const theme: HtmlTheme = { dark: document.documentElement.classList.contains("dark") };
  for (const name of HTML_THEME_VARS) {
    const value = style.getPropertyValue(`--${name}`).trim();
    if (value) theme[name] = value;
  }
  return theme;
};

/**
 * Visual personalizado: HTML, CSS e JS do autor rodando num iframe isolado. O iframe só recebe
 * as linhas da ligação por mensagem e não tem acesso à sessão, aos cookies nem à API.
 */
export const HtmlElement = ({
  element,
  empty,
  interactive = false,
}: {
  element: DashboardElement & { type: "html" };
  /** Aceita o mouse mesmo no editor (a prévia da janela de código). */
  interactive?: boolean;
  /** Mostrado enquanto não há código (o editor orienta; a visualização fica vazia). */
  empty?: React.ReactNode;
}) => {
  const { html, css, js, binding } = element.props;
  const ctx = useDashboardData();
  const live = useBindingData(element.id, binding, { ignoreFilters: element.props.ignoreFilters });
  const isLive = isBindingReady(binding);
  const preview = useDashboardsStore((state) => state.preview);
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(0);

  const doc = useMemo(() => buildSandboxDoc({ html, css, js }), [html, css, js]);
  const hasCode = Boolean(html.trim() || js.trim());

  const selection = ctx.picks[element.id] ?? null;
  const payload = useMemo<Omit<HtmlPayload, "theme">>(() => {
    const none = { columns: [], rows: [], selection };
    if (!isLive) return { status: "ready", ...none };
    if (live.status === "error") return { status: "error", error: live.error, ...none };
    if (live.status === "ready" || live.status === "loading") {
      return live.data
        ? { status: "ready", columns: live.data.columns.map((column) => column.name), rows: live.data.rows, selection, filtered: ctx.hasActiveFilters }
        : { status: "loading", ...none };
    }
    return { status: "loading", ...none };
  }, [isLive, live, selection, ctx.hasActiveFilters]);

  const send = () => {
    frame.current?.contentWindow?.postMessage({ [HTML_MESSAGE_TAG]: 1, type: "data", ...payload, theme: readTheme() }, "*");
  };
  const sendRef = useRef(send);
  sendRef.current = send;
  const pickRef = useRef(ctx.pick);
  pickRef.current = ctx.pick;

  // o documento avisa quando termina de carregar (e a cada recarga do código)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as ({ [HTML_MESSAGE_TAG]?: number; type?: string } & Partial<HtmlSelectMessage>) | null;
      if (event.source !== frame.current?.contentWindow || data?.[HTML_MESSAGE_TAG] !== 1) return;
      if (data.type === "ready") {
        useHtmlRuntime.getState().clear(element.id);
        setLoaded((count) => count + 1);
        sendRef.current();
      } else if (data.type === "error") {
        const message = (data as { message?: unknown }).message;
        if (typeof message === "string") useHtmlRuntime.getState().push(element.id, message.slice(0, 300));
      } else if (data.type === "select" && typeof data.column === "string" && data.column.length <= 256) {
        // o código só escolhe o valor; quem confere a coluna é o provedor (cliente) e o servidor
        const value = typeof data.value === "string" && data.value.length <= FILTER_VALUE_MAX ? data.value : null;
        pickRef.current(element.id, data.column, value);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // dados novos (atualização, filtros) ou troca de tema chegam ao iframe já carregado
  useEffect(() => {
    if (loaded > 0) sendRef.current();
  }, [payload, loaded]);
  useEffect(() => {
    const observer = new MutationObserver(() => sendRef.current());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  if (!hasCode) {
    return <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">{empty}</div>;
  }

  return (
    <>
    <RefreshingDot state={live} />
    <iframe
      ref={frame}
      title={element.props.title || "Visual personalizado"}
      srcDoc={doc}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      allow=""
      className="h-full w-full border-0 bg-transparent"
      // no editor o iframe não captura o mouse: arrastar e redimensionar continuam funcionando
      style={{ pointerEvents: preview || interactive ? "auto" : "none", colorScheme: "normal" }}
    />
    </>
  );
};
