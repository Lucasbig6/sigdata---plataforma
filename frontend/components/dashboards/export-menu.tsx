"use client";

import { Download, FileImage, FileText, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { exportPage, type ExportFormat } from "@/lib/dashboards/export";
import { useDashboardsStore } from "@/lib/dashboards/store";

/** Baixar a página aberta como PNG ou PDF. Use na visualização (sem grade nem alças). */
export const ExportMenu = ({ className = "", mobileSize }: { className?: string; mobileSize?: { width: number; height: number } }) => {
  const doc = useDashboardsStore((state) => (state.currentId ? (state.dashboards[state.currentId] ?? null) : null));
  const activePageId = useDashboardsStore((state) => state.activePageId);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  if (!doc) return null;

  const run = async (format: ExportFormat) => {
    const node = document.querySelector<HTMLElement>(".sd-canvas");
    if (!node) {
      setError("Página não encontrada na tela.");
      return;
    }
    setBusy(format);
    setError(null);
    try {
      const page = doc.pages?.find((entry) => entry.id === (activePageId ?? doc.pages?.[0]?.id));
      const size = mobileSize ?? { width: doc.canvas.width, height: doc.canvas.height };
      await exportPage(node, {
        format,
        name: page && doc.pages && doc.pages.length > 1 ? `${doc.name} - ${page.name}` : doc.name,
        width: size.width,
        height: size.height,
        background: doc.canvas.background ?? (getComputedStyle(node).backgroundColor || "#ffffff"),
      });
      setOpen(false);
    } catch (err) {
      console.error("[sigdata] exportar:", err);
      setError("Não foi possível exportar. Tente novamente.");
    } finally {
      setBusy(null);
    }
  };

  const item =
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50";

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        title="Exportar a página"
        className="flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 text-xs text-foreground transition-colors hover:bg-muted/60"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Download className="size-3.5" aria-hidden />}
        <span className="hidden sm:inline">Exportar</span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-9 z-50 w-48 rounded-lg border border-border/80 bg-popover p-1 shadow-lg">
          <button type="button" role="menuitem" disabled={busy !== null} className={item} onClick={() => void run("png")}>
            <FileImage className="size-3.5" aria-hidden />
            Imagem (PNG)
          </button>
          <button type="button" role="menuitem" disabled={busy !== null} className={item} onClick={() => void run("pdf")}>
            <FileText className="size-3.5" aria-hidden />
            Documento (PDF)
          </button>
          <p className="px-2 py-1 text-[10px] leading-snug text-muted-foreground">
            Exporta a página aberta{doc.pages && doc.pages.length > 1 ? " (troque de aba para exportar outra)" : ""}.
          </p>
          {error ? <p className="px-2 pb-1 text-[10px] text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
};
