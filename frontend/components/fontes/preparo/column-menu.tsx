"use client";

import { ArrowDownAZ, ArrowUpAZ, Calendar, ChevronDown, Hash, ToggleLeft, Type } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnKind, ColumnProfile, ResultColumn } from "@/lib/domain/sources";
import type { Step, StepType } from "@/lib/domain/transform";
import type { StepDialogMode } from "./step-dialog";

const KIND_ICONS: Record<ColumnKind, typeof Type> = {
  numero: Hash,
  texto: Type,
  data: Calendar,
  booleano: ToggleLeft,
  outro: Type,
};

const nf = new Intl.NumberFormat("pt-BR");

const withId = <T extends Omit<Step, "id">>(step: T) => ({ ...step, id: crypto.randomUUID() }) as unknown as Step;

/** Cabeçalho de coluna da grade: tipo, qualidade e atalhos para as etapas mais comuns. */
export const ColumnHeader = ({
  column,
  profile,
  selected,
  onSelect,
  onOpen,
  onAdd,
}: {
  column: ResultColumn;
  profile: ColumnProfile | undefined;
  selected: boolean;
  onSelect: () => void;
  onOpen: (mode: StepDialogMode) => void;
  onAdd: (step: Step) => void;
}) => {
  const Icon = KIND_ICONS[column.kind];
  const open = (type: StepType, preset: Partial<Step>) => () => onOpen({ kind: "new", type, preset });
  const name = column.name;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Ações da coluna ${name}`}
        aria-pressed={selected}
        onClick={onSelect}
        className={`-mx-3 -my-1.5 flex w-[calc(100%+1.5rem)] min-w-24 flex-col gap-1 rounded px-3 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${selected ? "bg-primary/15" : ""}`}
      >
        <span className="flex items-center gap-1.5">
          <Icon className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate font-semibold">{name}</span>
          <ChevronDown className="ms-auto size-3 shrink-0 text-muted-foreground" aria-hidden />
        </span>
        {profile ? (
          <span className="flex flex-col gap-0.5 font-sans text-[10px] font-normal text-muted-foreground">
            <span className="h-1 overflow-hidden rounded-full bg-border" title={`${profile.nulosPct}% de nulos`}>
              <span className="block h-full bg-amber-500" style={{ width: `${Math.min(100, profile.nulosPct)}%` }} />
            </span>
            <span className="tabular-nums">
              {profile.nulos > 0 ? `${nf.format(profile.nulos)} nulos · ` : ""}
              {profile.distintos != null ? `${nf.format(profile.distintos)} distintos` : ""}
            </span>
          </span>
        ) : (
          <span className="font-sans text-[10px] font-normal text-muted-foreground">{column.dbType.toLowerCase()}</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 font-sans">
        <DropdownMenuItem onClick={open("filtrar_valores", { column: name })}>Filtrar por valores…</DropdownMenuItem>
        <DropdownMenuItem onClick={open("filtrar", { column: name })}>Filtrar linhas…</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd(withId({ type: "ordenar", column: name, dir: "asc" }))}>
          <ArrowDownAZ aria-hidden /> Ordenar crescente
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd(withId({ type: "ordenar", column: name, dir: "desc" }))}>
          <ArrowUpAZ aria-hidden /> Ordenar decrescente
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={open("renomear", { from: name })}>Renomear…</DropdownMenuItem>
        <DropdownMenuItem onClick={open("tipo", { column: name })}>Mudar tipo…</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd(withId({ type: "remover", columns: [name] }))}>Remover coluna</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={open("preencher", { column: name })}>Preencher nulos…</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd(withId({ type: "remover_nulos", columns: [name] }))}>
          Remover linhas com nulos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd(withId({ type: "duplicadas", columns: [name] }))}>
          Remover duplicadas por esta coluna
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={open("agrupar", { by: [name] })}>Agrupar por esta coluna…</DropdownMenuItem>
        <DropdownMenuItem onClick={open("dinamizar", { column: name })}>Dinamizar esta coluna…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
