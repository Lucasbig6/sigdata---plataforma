"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS: [string, string][] = [
  ["Ctrl + Enter", "Executa a seleção ou a instrução sob o cursor"],
  ["Ctrl + Espaço", "Abre as sugestões (tabelas, colunas, funções)"],
  ["Tab / Enter", "Aceita a sugestão; Tab também avança nos campos de um modelo"],
  ["Ctrl + Shift + F", "Formata o SQL (a seleção, ou tudo)"],
  ["Ctrl + /", "Comenta ou descomenta as linhas"],
  ["Ctrl + F", "Busca (Ctrl + H para substituir)"],
  ["Ctrl + Z / Ctrl + Shift + Z", "Desfaz e refaz"],
  ["Tab / Shift + Tab", "Indenta e desindenta"],
];

const TEMPLATES: [string, string][] = [
  ["sel", "SELECT * … LIMIT"],
  ["selc", "contagem por grupo"],
  ["sels", "soma por grupo"],
  ["dist", "valores distintos"],
  ["cte", "WITH (CTE)"],
  ["join / ljoin", "JOIN … ON"],
  ["case", "CASE WHEN"],
  ["nulos", "qualidade: nulos por coluna"],
  ["dup", "linhas duplicadas"],
  ["mes", "série mensal"],
];

export const ShortcutsDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Atalhos e modelos</DialogTitle>
        <DialogDescription>No Mac, use Cmd no lugar de Ctrl.</DialogDescription>
      </DialogHeader>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        {SHORTCUTS.map(([keys, text]) => (
          <div key={keys} className="contents">
            <dt className="font-mono font-medium text-foreground">{keys}</dt>
            <dd className="text-muted-foreground">{text}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-border pt-3">
        <p className="mb-1.5 text-xs font-medium text-foreground">Modelos — digite e pressione Tab</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          {TEMPLATES.map(([key, text]) => (
            <div key={key} className="contents">
              <dt className="font-mono text-primary">{key}</dt>
              <dd className="text-muted-foreground">{text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </DialogContent>
  </Dialog>
);
