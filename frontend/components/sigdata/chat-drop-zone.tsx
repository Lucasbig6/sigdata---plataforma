"use client";

import { FileSpreadsheet } from "lucide-react";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { useProjectDataUpload } from "@/lib/workspace/upload-data";

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");

/** Solte uma planilha (CSV/XLSX) em qualquer ponto do chat: ela vira os dados do projeto. */
export const ChatDropZone = ({ children }: { children: ReactNode }) => {
  const { upload, busy, enabled } = useProjectDataUpload();
  const [over, setOver] = useState(false);
  // dragenter/leave disparam também nos filhos: o contador evita o overlay piscar
  const depth = useRef(0);

  if (!enabled) return <>{children}</>;

  return (
    <div
      className="relative flex min-h-0 min-w-0 flex-1 flex-col"
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(event) => {
        if (hasFiles(event)) event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (!hasFiles(event)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current = 0;
        setOver(false);
        void upload(event.dataTransfer.files[0]);
      }}
    >
      {children}
      {over || busy ? (
        <div className="pointer-events-none absolute inset-2 z-30 grid place-items-center rounded-2xl border-2 border-dashed border-primary/60 bg-background/85 text-center">
          <div className="flex flex-col items-center gap-2 px-6">
            <FileSpreadsheet className="size-8 text-primary" aria-hidden />
            <p className="text-sm font-medium text-foreground">{busy ? "Lendo a planilha…" : "Solte a planilha aqui"}</p>
            <p className="text-xs text-muted-foreground">CSV ou Excel. Os dados ficam só no seu projeto.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};
