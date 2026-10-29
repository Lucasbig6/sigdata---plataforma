"use client";

import Link from "next/link";
import { useDatasetsStore } from "@/lib/datasets/store";
import type { DataBinding } from "@/lib/dashboards/types";

/**
 * Origem dos dados de uma visualização vinda do workspace: somente leitura.
 * Quem quer outros dados volta ao workspace, ajusta a análise e salva de novo.
 */
export const DataSummary = ({ binding }: { binding: DataBinding }) => {
  const source = useDatasetsStore((state) => state.datasets.find((entry) => entry.id === binding.sourceId));
  const columns = [binding.x && `X: ${binding.x}`, binding.y && `Y: ${binding.y}`, binding.splitBy && `Séries: ${binding.splitBy}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/30 p-2.5">
      <p className="text-[11px] text-muted-foreground">
        Fonte: <strong className="font-medium text-foreground">{source?.name ?? "fonte removida"}</strong>
      </p>
      {binding.sql ? (
        <pre className="max-h-40 overflow-auto rounded-md bg-background/70 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-foreground">
          {binding.sql}
        </pre>
      ) : null}
      {columns ? <p className="text-[10px] text-muted-foreground">{columns}</p> : null}
      <p className="text-[10px] leading-snug text-muted-foreground">
        Os dados vêm da visualização salva no workspace e atualizam ao vivo. Para mudar a consulta, ajuste a análise no{" "}
        <Link href="/" className="text-primary hover:underline">
          projeto
        </Link>{" "}
        e arraste a visualização de novo.
      </p>
    </div>
  );
};

export const NoDataNote = () => (
  <p className="rounded-lg border border-dashed border-border px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
    Este elemento usa dados de demonstração. Para dados reais, arraste uma visualização salva da aba{" "}
    <strong className="font-medium text-foreground">Visualizações</strong>.
  </p>
);
