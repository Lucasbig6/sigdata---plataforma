"use client";

import { Loader2, RefreshCw, Zap } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { draftFromVisual } from "@/lib/dashboards/from-workspace";
import { useDashboardsStore } from "@/lib/dashboards/store";
import { WIDGET_ICON } from "@/components/sigdata/widget-icons";
import type { WorkspaceProject, WorkspaceVisual } from "@shared/dashboards/workspace";

/** MIME do drag de uma visualização do workspace para o canvas. */
export const VISUAL_MIME = "application/x-sigdata-visual";

/** Visualizações já carregadas, por `projeto:widget` (o drag só leva a chave). */
const registry = new Map<string, { visual: WorkspaceVisual; projectTitle: string }>();

const keyOf = (projectId: string, visual: WorkspaceVisual) => `${projectId}:${visual.widget.id}`;

/** Adiciona uma visualização do workspace ao painel aberto. */
export const useAddVisual = () => {
  const addElement = useDashboardsStore((state) => state.addElement);
  return useCallback(
    (key: string, placement?: { x?: number; y?: number }) => {
      const entry = registry.get(key);
      const draft = entry ? draftFromVisual(entry.visual, entry.projectTitle) : null;
      if (!draft) return false;
      return addElement(draft.item, placement, draft.props) !== null;
    },
    [addElement],
  );
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; projects: WorkspaceProject[] };

export const WorkspaceLibrary = () => {
  const addVisual = useAddVisual();
  const [state, setState] = useState<State>({ status: "loading" });
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    setState({ status: "loading" });
    api<WorkspaceProject[]>("/api/dashboards/workspace")
      .then((projects) => {
        registry.clear();
        for (const project of projects) {
          for (const visual of project.visuals) {
            registry.set(keyOf(project.id, visual), { visual, projectTitle: project.title });
          }
        }
        setState({ status: "ready", projects });
      })
      .catch((error: Error) => setState({ status: "error", message: error.message }));
  }, []);

  useEffect(load, [load]);

  const add = (key: string, title: string) => {
    setNote(addVisual(key) ? `"${title}" adicionado à página.` : "Não foi possível adicionar esta visualização.");
  };

  if (state.status === "loading") {
    return (
      <p className="flex items-center gap-2 p-3 text-[11px] text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Carregando visualizações…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-2 p-3">
        <p className="text-[11px] text-destructive">{state.message}</p>
        <button type="button" onClick={load} className="text-[11px] text-primary hover:underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (state.projects.length === 0) {
    return (
      <div className="space-y-2 p-3 text-[11px] leading-snug text-muted-foreground">
        <p>Nenhuma visualização salva nos seus projetos.</p>
        <p>
          Peça um gráfico, tabela ou indicador no chat de um{" "}
          <Link href="/" className="text-primary hover:underline">
            projeto
          </Link>{" "}
          e ele aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] leading-snug text-muted-foreground">
          Clique ou arraste. <Zap className="inline size-3 text-primary" aria-hidden /> = ao vivo na fonte.
        </p>
        <button
          type="button"
          onClick={load}
          aria-label="Recarregar visualizações"
          title="Recarregar"
          className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          <RefreshCw className="size-3" aria-hidden />
        </button>
      </div>
      {note ? <p className="rounded-md bg-muted/50 px-2 py-1 text-[10px] text-foreground">{note}</p> : null}
      {state.projects.map((project) => (
        <section key={project.id}>
          <p className="mb-1.5 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {project.title}
          </p>
          <ul className="space-y-1">
            {project.visuals.map((visual) => {
              const key = keyOf(project.id, visual);
              const Icon = WIDGET_ICON[visual.widget.kind];
              return (
                <li key={key}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(VISUAL_MIME, key);
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => add(key, visual.widget.title)}
                    title={visual.live ? "Ligada à fonte: atualiza com os dados" : "Cópia dos dados salvos no workspace"}
                    className="group flex w-full items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-2 py-1.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/50"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted/70 text-primary group-hover:bg-primary/10">
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
                      {visual.widget.title}
                    </span>
                    {visual.live ? <Zap className="size-3 shrink-0 text-primary" aria-label="Ao vivo" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};
