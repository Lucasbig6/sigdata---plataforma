"use client";

import { useDatasetsStore } from "@/lib/datasets/store";
import { isWorkspaceSource } from "@/lib/domain/sources";
import { useNotebooksStore } from "@/lib/notebooks/store";

/** Dataset ativo do projeto (só datasets prontos valem no workspace). */
export const useActiveDataset = (notebookId: string | null) => {
  const sourceId = useNotebooksStore(
    (state) => state.notebooks.find((notebook) => notebook.id === notebookId)?.sourceId ?? null,
  );
  return useDatasetsStore(
    (state) => state.datasets.find((dataset) => dataset.id === sourceId && isWorkspaceSource(dataset)) ?? null,
  );
};
