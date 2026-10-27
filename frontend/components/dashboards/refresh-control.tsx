"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDashboardData } from "@/lib/dashboards/live-data";

const INTERVALS = [
  { value: 0, label: "Manual" },
  { value: 30, label: "30 s" },
  { value: 60, label: "1 min" },
  { value: 300, label: "5 min" },
];

const timeLabel = (at: number) => new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Atualiza os dados na hora ou em intervalo, e mostra quando foi a última consulta. */
export const RefreshControl = () => {
  const { refresh, refreshKey } = useDashboardData();
  const [seconds, setSeconds] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setUpdatedAt(Date.now());
  }, [refreshKey]);

  useEffect(() => {
    if (seconds === 0) return;
    const timer = setInterval(refresh, seconds * 1000);
    return () => clearInterval(timer);
  }, [seconds, refresh]);

  return (
    <div className="flex items-center gap-1.5">
      <span className="hidden text-[11px] text-muted-foreground md:inline">Dados de {timeLabel(updatedAt)}</span>
      <select
        aria-label="Atualização automática"
        value={seconds}
        onChange={(event) => setSeconds(Number(event.target.value))}
        className="h-8 rounded-md border border-border/70 bg-background px-1.5 text-[11px] text-foreground outline-none"
      >
        {INTERVALS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.value === 0 ? "Atualizar: manual" : `A cada ${option.label}`}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={refresh}
        title="Atualizar dados"
        aria-label="Atualizar dados"
        className="grid size-8 place-items-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <RefreshCw className="size-3.5" aria-hidden />
      </button>
    </div>
  );
};
