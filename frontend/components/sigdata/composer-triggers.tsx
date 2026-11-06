"use client";

import {
  unstable_useMentionAdapter,
  unstable_useSlashCommandAdapter,
  useAui,
  type Unstable_SlashCommand,
} from "@assistant-ui/react";
import { BarChart3Icon, GaugeIcon, SparklesIcon, Table2Icon, TableIcon } from "lucide-react";
import { useMemo } from "react";
import { ComposerTriggerPopover } from "@/components/assistant-ui/elements/composer-trigger-popover.aui";
import { useActiveSource } from "@/lib/workspace/use-active-source";

const ICONS = {
  Table: Table2Icon,
  chart: BarChart3Icon,
  kpi: GaugeIcon,
  table: TableIcon,
  summary: SparklesIcon,
};

/** Atalhos que preenchem o campo com um pedido pronto; o usuário completa e envia. */
const SLASH_PROMPTS = [
  { id: "grafico", description: "Pedir um gráfico", icon: "chart", text: "Mostre em um gráfico " },
  { id: "tabela", description: "Pedir uma tabela", icon: "table", text: "Mostre em uma tabela " },
  { id: "indicador", description: "Pedir um indicador (KPI)", icon: "kpi", text: "Mostre como indicador (KPI) " },
  {
    id: "resumir",
    description: "Resumir a conversa até aqui",
    icon: "summary",
    text: "Resuma em poucas frases o que descobrimos até agora.",
  },
] as const;

/**
 * Gatilhos do compositor: `@` cita uma tabela da fonte do projeto e `/` abre atalhos de pedido.
 * Deve ficar dentro de `ComposerPrimitive.Root`.
 */
export const ComposerTriggers = () => {
  const aui = useAui();
  const source = useActiveSource();

  const mention = unstable_useMentionAdapter({
    items: useMemo(
      () =>
        (source?.tables ?? []).map((table) => ({
          id: table.name,
          type: "tabela",
          label: table.name,
          description: `${table.columns.length} colunas`,
          icon: "Table",
        })),
      [source],
    ),
    includeModelContextTools: false,
  });

  const commands = useMemo<readonly Unstable_SlashCommand[]>(
    () =>
      SLASH_PROMPTS.map((command) => ({
        id: command.id,
        description: command.description,
        icon: command.icon,
        // o gatilho é removido logo após executar; escrever depois evita ser apagado junto
        execute: () => setTimeout(() => aui.composer().setText(command.text), 0),
      })),
    [aui],
  );
  const slash = unstable_useSlashCommandAdapter({ commands, removeOnExecute: true });

  return (
    <>
      <ComposerTriggerPopover
        char="@"
        adapter={mention.adapter}
        directive={mention.directive}
        iconMap={ICONS}
        fallbackIcon={Table2Icon}
        emptyCategoriesLabel="Escolha uma fonte de dados para citar tabelas"
        emptyItemsLabel="Nenhuma tabela encontrada"
        backLabel="Voltar"
        loadingLabel="Carregando…"
      />
      <ComposerTriggerPopover
        char="/"
        adapter={slash.adapter}
        action={slash.action}
        iconMap={ICONS}
        fallbackIcon={SparklesIcon}
        emptyItemsLabel="Nenhum atalho encontrado"
        backLabel="Voltar"
      />
    </>
  );
};
