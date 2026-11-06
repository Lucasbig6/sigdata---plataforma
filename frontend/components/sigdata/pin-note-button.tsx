"use client";

import { useAuiState } from "@assistant-ui/react";
import { Check, StickyNote } from "lucide-react";
import { useState } from "react";
import { TooltipIconButton } from "@/components/assistant-ui/elements/tooltip-icon-button";
import { toast } from "@/lib/feedback";
import { useNotesStore } from "@/lib/notes/store";
import { useNotebookId } from "@/lib/use-notebook-id";

type Part = { type?: string; text?: string; args?: { resultId?: string } };

/** Fixa o texto da resposta como nota do projeto, citando a consulta de origem quando houver. */
export const PinNoteButton = () => {
  const notebookId = useNotebookId();
  const parts = useAuiState((state) => state.message.content) as readonly Part[];
  const add = useNotesStore((state) => state.add);
  const [done, setDone] = useState(false);

  const text = parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n\n")
    .trim();
  const resultId = parts.find((part) => part.args?.resultId)?.args?.resultId ?? null;
  if (!notebookId || !text) return null;

  return (
    <TooltipIconButton
      tooltip={done ? "Fixada nas notas" : "Fixar como nota"}
      onClick={() => {
        if (done) return;
        add(notebookId, { title: text.split("\n")[0]!.replace(/[#*_`]/g, "").slice(0, 80), body: text, resultId })
          .then(() => {
            setDone(true);
            toast.success("Resposta fixada nas notas do projeto.");
          })
          .catch((error: Error) => toast.error(error.message));
      }}
    >
      {done ? <Check /> : <StickyNote />}
    </TooltipIconButton>
  );
};
