"use client";

import { ArrowLeft, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SigdataSection } from "@/lib/sigdata-store";

const CONTENT: Record<
  Exclude<SigdataSection, "conversa">,
  {
    title: string;
    description: string;
    icon: typeof FolderKanban;
  }
> = {
  projetos: {
    title: "Projetos",
    description: "Organize conversas, painéis e fontes de dados por iniciativa.",
    icon: FolderKanban,
  },
};

export const SectionPlaceholder = ({
  section,
  onBack,
}: {
  section: Exclude<SigdataSection, "conversa">;
  onBack: () => void;
}) => {
  const { title, description, icon: Icon } = CONTENT[section];

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-card text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-xl font-medium text-foreground">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground/70">
          Disponível em uma próxima etapa desta demonstração.
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden />
        Voltar para a conversa
      </Button>
    </div>
  );
};
