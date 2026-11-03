"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DataSource } from "@/lib/domain/sources";
import { Field, Select } from "./form-fields";

/** "Obter dados": abre uma consulta nova sobre uma tabela de qualquer fonte pronta (a origem só é lida). */
export const NewQueryDialog = ({
  open,
  sources,
  defaultSourceId,
  onClose,
  onCreate,
}: {
  open: boolean;
  sources: DataSource[];
  defaultSourceId: string | null;
  onClose: () => void;
  onCreate: (input: { sourceId: string; table: string; name: string }) => void;
}) => {
  const [sourceId, setSourceId] = useState("");
  const [table, setTable] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    const first = sources.find((source) => source.id === defaultSourceId) ?? sources[0];
    setSourceId(first?.id ?? "");
    setTable(first?.tables[0]?.name ?? "");
    setName("");
  }, [open, sources, defaultSourceId]);

  const source = sources.find((entry) => entry.id === sourceId);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Obter dados</DialogTitle>
          <DialogDescription>
            Abre uma consulta sobre uma tabela. As fontes originais só são lidas: nada é gravado nelas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label="Fonte de dados">
            <Select
              value={sourceId}
              options={sources.map((entry) => ({ value: entry.id, label: entry.name }))}
              onChange={(id) => {
                setSourceId(id);
                setTable(sources.find((entry) => entry.id === id)?.tables[0]?.name ?? "");
              }}
              placeholder={sources.length === 0 ? "Nenhuma fonte pronta" : undefined}
            />
          </Field>
          <Field label="Tabela">
            <Select value={table} options={(source?.tables ?? []).map((entry) => ({ value: entry.name, label: entry.name }))} onChange={setTable} />
          </Field>
          <Field label="Nome da consulta (opcional)">
            <Input value={name} maxLength={120} placeholder={table} onChange={(event) => setName(event.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!sourceId || !table} onClick={() => onCreate({ sourceId, table, name })}>
            Abrir consulta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
