"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CardSkeletons, EmptyState, ErrorState } from "@/components/sigdata/list-states";
import { RoleGate } from "@/components/sigdata/role-gate";
import { AppHeader } from "@/components/sigdata/app-header";
import { PageHeading } from "@/components/sigdata/page-heading";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";

type Entry = { id: string; at: string; actorName: string; action: string; target: string; detail: string };

const ACTION_LABELS: Record<string, string> = {
  "fonte.importada": "Importou fonte",
  "fonte.conectada": "Conectou banco",
  "fonte.excluida": "Excluiu fonte",
  "dataset.criado": "Criou dataset",
  "dataset.publicado": "Publicou dataset",
  "dataset.despublicado": "Despublicou dataset",
  "usuario.criado": "Criou conta",
  "usuario.perfil": "Mudou perfil",
  "usuario.desativado": "Desativou conta",
  "usuario.reativado": "Reativou conta",
  "usuario.removido": "Removeu conta",
  "usuario.link_de_acesso": "Gerou link de acesso",
  "dashboard.compartilhado": "Compartilhou dashboard",
  "dashboard.link_publico": "Criou link público",
  "dashboard.link_revogado": "Revogou link público",
};

const LogTable = () => {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<Entry[]>("/api/admin/audit?limit=200")
      .then(setEntries)
      .catch((err: Error) => setError(err.message));
  }, []);
  useEffect(load, [load]);

  if (error) return <ErrorState title="Não foi possível carregar as atividades" message={error} onRetry={load} />;
  if (!entries) return <CardSkeletons count={3} className="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1" itemClassName="h-12 rounded-xl" />;
  if (entries.length === 0) return <EmptyState title="Nenhuma atividade registrada ainda" description="Ações sensíveis, como publicar datasets e gerenciar contas, aparecem aqui." />;

  return (
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Quando</th>
            <th className="px-4 py-2.5 font-medium">Quem</th>
            <th className="px-4 py-2.5 font-medium">O quê</th>
            <th className="px-4 py-2.5 font-medium">Alvo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                {new Date(entry.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </td>
              <td className="px-4 py-2.5 text-foreground">{entry.actorName}</td>
              <td className="px-4 py-2.5 text-foreground">{ACTION_LABELS[entry.action] ?? entry.action}</td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {entry.target}
                {entry.detail ? <span className="text-xs"> · {entry.detail}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function ActivityPage() {
  return (
    <RoleGate roles={["admin"]}>
      <div className="min-h-dvh bg-background">
        <AppHeader />
        <main className="px-4 py-8 sm:px-10 sm:py-10 lg:px-30">
          <PageHeading
            title="Atividades"
            description="Registro das ações sensíveis: fontes, datasets, contas e compartilhamentos."
            actions={
              <Button variant="outline" render={<Link href="/admin/usuarios" />} nativeButton={false}>
                Voltar aos usuários
              </Button>
            }
          />
          <LogTable />
        </main>
      </div>
    </RoleGate>
  );
}
