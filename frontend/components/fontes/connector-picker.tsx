"use client";

import { Database, FileSpreadsheet, Globe, Sheet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveSqlKind } from "@/lib/domain/sources";

export type ConnectorMode = "arquivo" | LiveSqlKind | "api" | "gsheets";

export type Connector = { id: ConnectorMode; label: string; description: string; icon: typeof Database };

export const CONNECTOR_GROUPS: { title: string; connectors: Connector[] }[] = [
  {
    title: "Arquivos",
    connectors: [
      { id: "arquivo", label: "Arquivo CSV / XLSX", description: "Envie uma planilha; cada aba do Excel vira uma tabela.", icon: FileSpreadsheet },
    ],
  },
  {
    title: "Bancos de dados",
    connectors: [
      { id: "postgresql", label: "PostgreSQL", description: "Consulta ao vivo, somente leitura.", icon: Database },
      { id: "mysql", label: "MySQL / MariaDB", description: "Consulta ao vivo, somente leitura.", icon: Database },
      { id: "sqlserver", label: "SQL Server", description: "Consulta ao vivo com usuário só de leitura.", icon: Database },
    ],
  },
  {
    title: "Serviços na web",
    connectors: [
      { id: "api", label: "API REST", description: "Importa os dados de um endereço JSON.", icon: Globe },
      { id: "gsheets", label: "Google Sheets", description: "Importa uma planilha compartilhada por link.", icon: Sheet },
    ],
  },
];

export const connectorOf = (id: ConnectorMode): Connector =>
  CONNECTOR_GROUPS.flatMap((group) => group.connectors).find((connector) => connector.id === id)!;

/** Primeira etapa do modal "Nova fonte": um card para cada tipo de conector. */
export const ConnectorPicker = ({ onPick }: { onPick: (id: ConnectorMode) => void }) => (
  <div className="flex flex-col gap-4">
    {CONNECTOR_GROUPS.map((group) => (
      <section key={group.title} aria-label={group.title} className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">{group.title}</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {group.connectors.map((connector) => (
            <li key={connector.id}>
              <button
                type="button"
                onClick={() => onPick(connector.id)}
                className={cn(
                  "flex h-full w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-start shadow-sm outline-none transition-colors",
                  "hover:border-primary/50 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50",
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/60 text-primary">
                  <connector.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{connector.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{connector.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    ))}
  </div>
);
