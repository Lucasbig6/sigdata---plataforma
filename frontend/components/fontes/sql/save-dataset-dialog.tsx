"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";

/** Salva o resultado da última consulta executada como dataset do catálogo. */
export const SaveDatasetDialog = ({
  open,
  onOpenChange,
  sql,
  rowCount,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sql: string;
  rowCount: number;
  onSave: (input: { name: string; description: string }) => Promise<void>;
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({ name, description });
      setName("");
      setDescription("");
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar como dataset</DialogTitle>
          <DialogDescription>
            O resultado vira um dataset do catálogo: todos os usuários podem escolhê-lo nos projetos e usá-lo nos
            dashboards. Guarda uma cópia dos dados de agora.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <pre className="max-h-28 overflow-auto rounded-lg bg-muted/60 p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">
            {sql}
          </pre>
          <p className="text-[11px] text-muted-foreground">
            O resultado tem {rowCount.toLocaleString("pt-BR")} linha(s). O dataset guarda o resultado completo, de todas as
            páginas (até 50.000 linhas).
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Nome</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter" && name.trim() && !saving) void submit();
              }}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Descrição (opcional)</span>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              className="min-h-16"
              placeholder="O que este dataset contém e como foi tratado"
            />
          </label>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
