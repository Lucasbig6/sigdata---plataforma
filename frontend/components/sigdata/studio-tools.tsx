"use client";

import { useAISDKChat } from "@assistant-ui/ai-sdk";
import { AlertTriangle, FileText, HelpCircle, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DataSource } from "@/lib/domain/sources";
import { analyzeQuality } from "@/lib/workspace/quality";
import { suggestQuestions } from "@/lib/workspace/suggestions";
import { cn } from "@/lib/utils";

const PROMPTS = {
  resumo:
    "Faça um resumo executivo destes dados em até 6 tópicos: volume, principais números, destaques e pontos de atenção. Consulte os dados antes de citar qualquer valor.",
  insights:
    "Encontre os 3 achados mais relevantes nestes dados (concentrações, variações ou valores atípicos). Para cada um, consulte os dados, mostre o número e crie um gráfico adequado.",
} as const;

type Tool = { id: string; label: string; hint: string; icon: LucideIcon };

const TOOLS: Tool[] = [
  { id: "resumo", label: "Resumo executivo", hint: "Principais números em tópicos", icon: FileText },
  { id: "insights", label: "Insights", hint: "O que mais se destaca nos dados", icon: Sparkles },
  { id: "perguntas", label: "Perguntas sugeridas", hint: "Por onde começar a explorar", icon: HelpCircle },
  { id: "qualidade", label: "Qualidade dos dados", hint: "Vazios, repetidos e suspeitos", icon: ShieldCheck },
];

const SEVERITY_STYLE = {
  alerta: "border-destructive/40 bg-destructive/10 text-destructive",
  atencao: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  info: "border-border bg-muted/40 text-muted-foreground",
} as const;
const SEVERITY_LABEL = { alerta: "Alerta", atencao: "Atenção", info: "Nota" } as const;

/** Ferramentas do Estúdio: geram materiais a partir dos dados do projeto, sem montar nada à mão. */
export const StudioTools = ({ source }: { source: DataSource | null }) => {
  const chat = useAISDKChat();
  const [open, setOpen] = useState<"perguntas" | "qualidade" | null>(null);
  const questions = useMemo(() => (source ? suggestQuestions(source.tables) : []), [source]);
  const issues = useMemo(() => (source ? analyzeQuality(source.tables) : []), [source]);
  const disabled = !source || !chat;

  const ask = (text: string) => void chat?.sendMessage({ text });

  const run = (id: string) => {
    if (id === "resumo" || id === "insights") ask(PROMPTS[id]);
    else setOpen(id as "perguntas" | "qualidade");
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Ferramentas do estúdio">
        {TOOLS.map(({ id, label, hint, icon: Icon }) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => run(id)}
            title={source ? hint : "Escolha um dataset para usar as ferramentas"}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-start text-xs font-medium text-foreground transition-colors outline-none",
              "hover:border-primary/40 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <Icon className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="leading-tight">{label}</span>
          </button>
        ))}
      </div>

      <Dialog open={open === "perguntas"} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Perguntas sugeridas</DialogTitle>
            <DialogDescription>Baseadas nas colunas deste dataset. Clique para perguntar.</DialogDescription>
          </DialogHeader>
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Não há sugestões para este dataset.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {questions.map((question) => (
                <li key={question}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(null);
                      ask(question);
                    }}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-start text-sm text-foreground transition-colors outline-none hover:border-primary/40 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {question}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={open === "qualidade"} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Qualidade dos dados</DialogTitle>
            <DialogDescription>Verificação automática do perfil das colunas de {source?.name}.</DialogDescription>
          </DialogHeader>
          {issues.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-foreground">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              Nenhum problema encontrado: sem colunas vazias, constantes ou identificadores repetidos.
            </p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
              {issues.map((issue, index) => (
                <li key={index} className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                  <span className={cn("mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium", SEVERITY_STYLE[issue.severity])}>
                    {issue.severity === "alerta" ? <AlertTriangle className="size-3" aria-hidden /> : null}
                    {SEVERITY_LABEL[issue.severity]}
                  </span>
                  <span className="min-w-0 text-foreground">
                    {issue.column ? <strong className="font-medium">{issue.table}.{issue.column}</strong> : <strong className="font-medium">{issue.table}</strong>}
                    <span className="block text-xs text-muted-foreground">{issue.message}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
