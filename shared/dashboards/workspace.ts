/** Visualizações salvas nos workspaces dos projetos, oferecidas ao editor de dashboards. */
import type { ResultColumn } from "../domain/sources";
import type { PanelWidget } from "../panel";

export type WorkspaceVisual = {
  /** Sem os dados pesados (série, tabela...) quando `live` existe. */
  widget: PanelWidget;
  /** Consulta de origem: permite ligar o elemento ao vivo à fonte. */
  live: { sourceId: string; sql: string; columns: ResultColumn[] } | null;
};

export type WorkspaceProject = {
  id: string;
  title: string;
  sourceId: string | null;
  visuals: WorkspaceVisual[];
};
