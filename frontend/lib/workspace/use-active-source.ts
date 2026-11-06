"use client";

import { useEffect } from "react";
import { useDatasetsStore } from "@/lib/datasets/store";
import { useNotebooksStore } from "@/lib/notebooks/store";
import { useNotebookId } from "@/lib/use-notebook-id";

/** Fonte de dados pronta ligada ao projeto aberto no workspace (ou `null`). */
export const useActiveSource = () => {
  const notebookId = useNotebookId();
  const sourceId = useNotebooksStore(
    (state) => state.notebooks.find((notebook) => notebook.id === notebookId)?.sourceId ?? null,
  );
  const hydrateDatasets = useDatasetsStore((state) => state.hydrate);
  const datasets = useDatasetsStore((state) => state.datasets);

  useEffect(() => {
    hydrateDatasets();
  }, [hydrateDatasets]);

  return datasets.find((dataset) => dataset.id === sourceId && dataset.status === "pronta") ?? null;
};
