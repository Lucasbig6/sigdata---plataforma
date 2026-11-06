"use client";

import { Check, ChevronDown, Database, Loader2, Upload } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DATASET_KIND_LABELS, isAnalysisDataset, useDatasetsStore } from "@/lib/datasets/store";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { useNotebookId } from "@/lib/use-notebook-id";
import { useActiveSource } from "@/lib/workspace/use-active-source";
import { ACCEPTED_DATA_FILES, useProjectDataUpload } from "@/lib/workspace/upload-data";

/** "Dados": mostra o dataset do projeto e deixa trocar ou enviar uma planilha, sem sair do workspace. */
export const DataPicker = ({ className }: { className?: string }) => {
  const notebookId = useNotebookId();
  const active = useActiveSource();
  const datasets = useDatasetsStore((state) => state.datasets).filter(isAnalysisDataset);
  const hydrate = useDatasetsStore((state) => state.hydrate);
  const setNotebookSource = useNotebooksStore((state) => state.setNotebookSource);
  const { upload, busy } = useProjectDataUpload();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => hydrate(), [hydrate]);

  if (!notebookId) return null;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_DATA_FILES}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          void upload(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className={`max-w-48 gap-1.5 rounded-full ${className ?? ""}`} aria-label="Dados do projeto" />
          }
        >
          {busy ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : <Database className="size-4 shrink-0 text-primary" aria-hidden />}
          <span className="min-w-0 truncate">{active ? active.name : "Escolher dados"}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {datasets.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum dataset disponível ainda.</p>
          ) : (
            datasets.map((dataset) => (
              <DropdownMenuItem key={dataset.id} onClick={() => setNotebookSource(notebookId, dataset.id)} className="gap-2">
                <span className="grid size-4 shrink-0 place-items-center">
                  {dataset.id === active?.id ? <Check className="size-3.5 text-primary" aria-hidden /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{dataset.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {dataset.published ? "Publicado" : "Só seu"} · {DATASET_KIND_LABELS[dataset.kind]}
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => fileRef.current?.click()} className="gap-2">
            <Upload className="size-4 shrink-0" aria-hidden />
            Enviar planilha (CSV ou Excel)…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
