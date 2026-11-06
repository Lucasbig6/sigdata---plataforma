"use client";

/**
 * Dados enviados direto no projeto (CSV/XLSX), por qualquer perfil: o servidor cria um dataset
 * particular da pessoa e o projeto passa a usá-lo. Nada é publicado nem altera bancos originais.
 */
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useDatasetsStore } from "@/lib/datasets/store";
import type { DataSource } from "@/lib/domain/sources";
import { toast } from "@/lib/feedback";
import { useNotebookId } from "@/lib/use-notebook-id";
import { useNotebooksStore, whenProjectSaved } from "@/lib/notebooks/store";

export const ACCEPTED_DATA_FILES = ".csv,.txt,.xlsx";
const MAX_MB = 50;

export const checkDataFile = (file: File): string | null => {
  if (!/\.(csv|txt|xlsx)$/i.test(file.name)) return "Envie um arquivo .csv ou .xlsx.";
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > MAX_MB * 1024 * 1024) return `O arquivo passa de ${MAX_MB} MB.`;
  return null;
};

export const uploadProjectData = async (projectId: string, file: File): Promise<DataSource> => {
  await whenProjectSaved(projectId);
  const form = new FormData();
  form.set("file", file);
  const { dataset } = await api<{ dataset: DataSource }>(`/api/projects/${projectId}/dados`, { method: "POST", body: form });
  useDatasetsStore.getState().addDataset(dataset);
  // o servidor já ligou o dataset ao projeto; aqui só o estado local acompanha
  useNotebooksStore.getState().setNotebookSource(projectId, dataset.id);
  return dataset;
};

/** Envio pelo projeto aberto, com aviso de sucesso ou erro. */
export const useProjectDataUpload = () => {
  const projectId = useNotebookId();
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined | null) => {
    if (!file || !projectId || busy) return;
    const problem = checkDataFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      const dataset = await uploadProjectData(projectId, file);
      toast.success(`“${dataset.name}” pronta: ${dataset.tables[0]?.rowCount?.toLocaleString("pt-BR") ?? "—"} linha(s). Já pode perguntar.`);
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível enviar o arquivo.");
    } finally {
      setBusy(false);
    }
  };

  return { upload, busy, enabled: Boolean(projectId) };
};
