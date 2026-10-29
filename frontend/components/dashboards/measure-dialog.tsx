"use client";

import { Loader2, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api/client";
import { defaultSource } from "@/lib/dashboards/auto-binding";
import { formatNumber } from "@/lib/dashboards/format";
import { useDashboardsStore } from "@/lib/dashboards/store";
import type { BindingData } from "@shared/dashboards/data";
import { compileMeasure } from "@shared/dashboards/expr";
import type { DashboardMeasure } from "@shared/dashboards/types";
import { useDatasetsStore } from "@/lib/datasets/store";
import { panelSources } from "@/lib/domain/sources";
import { inputCls } from "./panel-ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixa a tabela (ao criar a partir de um elemento); ausente = o usuário escolhe. */
  sourceId?: string;
  table?: string;
  /** Edita uma medida existente. */
  initial?: DashboardMeasure;
  onSaved?: (measure: DashboardMeasure) => void;
};

const EXAMPLES = [
  "sum(receita) - sum(custo)",
  "(sum(receita) - sum(custo)) / sum(receita) * 100",
  "round(avg(preco * quantidade), 2)",
  "countd(cliente) / count(*)",
];

/** Criar ou editar uma medida calculada (expressão validada e testada na fonte). */
export const MeasureDialog = ({ open, onOpenChange, sourceId, table, initial, onSaved }: Props) => {
  const datasets = useDatasetsStore((state) => state.datasets);
  const addMeasure = useDashboardsStore((state) => state.addMeasure);
  const updateMeasure = useDashboardsStore((state) => state.updateMeasure);
  const ready = panelSources(datasets, sourceId);

  const [name, setName] = useState("");
  const [expr, setExpr] = useState("");
  const [pickedSource, setPickedSource] = useState("");
  const [pickedTable, setPickedTable] = useState("");
  const [test, setTest] = useState<{ status: "idle" | "running" | "ok" | "error"; text: string }>({
    status: "idle",
    text: "",
  });

  // reinicia o formulário a cada abertura
  useEffect(() => {
    if (!open) return;
    const source = ready.find((entry) => entry.id === (initial?.sourceId ?? sourceId)) ?? defaultSource(datasets);
    setName(initial?.name ?? "");
    setExpr(initial?.expr ?? "");
    setPickedSource(source?.id ?? "");
    setPickedTable(initial?.table ?? table ?? source?.tables[0]?.name ?? "");
    setTest({ status: "idle", text: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const source = ready.find((entry) => entry.id === pickedSource);
  const tableDef = source?.tables.find((entry) => entry.name === pickedTable);
  const locked = Boolean(sourceId && table) || Boolean(initial);

  const compiled = useMemo(
    () =>
      tableDef && expr.trim()
        ? compileMeasure(
            expr,
            tableDef.columns.map((c) => ({ name: c.name, kind: c.kind })),
            (id) => JSON.stringify(id),
          )
        : null,
    [expr, tableDef],
  );
  const error = compiled && !compiled.ok ? compiled.error : null;
  const canSave = Boolean(name.trim() && source && tableDef && compiled?.ok);

  const runTest = async () => {
    if (!source || !tableDef || !compiled?.ok) return;
    setTest({ status: "running", text: "" });
    try {
      const out = await api<BindingData>("/api/dashboards/data", {
        method: "POST",
        json: {
          binding: {
            sourceId: source.id,
            mode: "builder",
            table: tableDef.name,
            calc: { name: name.trim() || "Medida", expr },
          },
          fresh: true,
        },
      });
      const value = Number(out.rows[0]?.valor);
      setTest({
        status: "ok",
        text: Number.isFinite(value) ? `Resultado: ${formatNumber(value, "numero", 2)}` : "Resultado vazio (sem linhas).",
      });
    } catch (err) {
      setTest({ status: "error", text: (err as Error).message });
    }
  };

  const save = () => {
    if (!canSave || !source || !tableDef) return;
    const data = { name: name.trim(), sourceId: source.id, table: tableDef.name, expr: expr.trim() };
    if (initial) {
      updateMeasure(initial.id, data);
      onSaved?.({ id: initial.id, ...data });
    } else {
      const id = addMeasure(data);
      onSaved?.({ id, ...data });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar medida" : "Nova medida calculada"}</DialogTitle>
          <DialogDescription>
            Combine colunas com agregações. Fica disponível para qualquer gráfico, tabela ou indicador desta tabela.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Nome</span>
            <input className={inputCls} value={name} maxLength={80} placeholder="Ex.: Margem %" onChange={(e) => setName(e.target.value)} />
          </label>

          {!locked ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">Fonte</span>
                <select
                  className={`${inputCls} cursor-pointer`}
                  value={pickedSource}
                  onChange={(e) => {
                    setPickedSource(e.target.value);
                    setPickedTable(ready.find((s) => s.id === e.target.value)?.tables[0]?.name ?? "");
                  }}
                >
                  {ready.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">Tabela</span>
                <select className={`${inputCls} cursor-pointer`} value={pickedTable} onChange={(e) => setPickedTable(e.target.value)}>
                  {source?.tables.map((entry) => (
                    <option key={entry.name} value={entry.name}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Tabela: <span className="font-mono text-foreground">{pickedTable}</span>
            </p>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Expressão</span>
            <textarea
              className={`${inputCls} min-h-20 resize-y font-mono text-[12px] ${error ? "border-destructive" : ""}`}
              spellCheck={false}
              value={expr}
              placeholder={EXAMPLES[0]}
              onChange={(e) => {
                setExpr(e.target.value);
                setTest({ status: "idle", text: "" });
              }}
            />
          </label>
          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}

          {tableDef ? (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">Colunas (clique para inserir)</span>
              <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
                {tableDef.columns.map((column) => (
                  <button
                    key={column.name}
                    type="button"
                    onClick={() => setExpr((current) => `${current}${current && !/[\s(]$/.test(current) ? " " : ""}${/^[\p{L}_][\p{L}\p{N}_]*$/u.test(column.name) ? column.name : `"${column.name}"`}`)}
                    className="rounded-md border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-foreground transition-colors hover:bg-muted/60"
                    title={column.kind}
                  >
                    {column.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Exemplos</span>
            <div className="flex flex-col gap-0.5">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setExpr(example)}
                  className="rounded px-1.5 py-0.5 text-left font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  {example}
                </button>
              ))}
            </div>
            <p className="text-[10px] leading-snug text-muted-foreground">
              Funções: sum, avg, min, max, count, countd (distintos), round, abs. Operadores: + − × ÷ e parênteses.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={!compiled?.ok || test.status === "running"} onClick={() => void runTest()}>
              {test.status === "running" ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
              Testar na fonte
            </Button>
            {test.status === "ok" ? <span className="text-xs text-primary">{test.text}</span> : null}
            {test.status === "error" ? <span className="line-clamp-2 text-xs text-destructive">{test.text}</span> : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!canSave} onClick={save}>
            {initial ? "Salvar medida" : "Criar medida"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
