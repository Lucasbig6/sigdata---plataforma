"use client";

import { Code2, Database, Plus, Table2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { NewSourceForm } from "@/components/fontes/new-source-form";
import { SourceDetail } from "@/components/fontes/source-detail";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SourceTile } from "@/components/fontes/source-tile";
import { AppHeader } from "@/components/sigdata/app-header";
import { PageHeading } from "@/components/sigdata/page-heading";
import { useDatasetsStore, type Dataset, type SourceUsage } from "@/lib/datasets/store";
import { cn } from "@/lib/utils";
import { confirmAction, toast } from "@/lib/feedback";
import { RoleGate } from "@/components/sigdata/role-gate";
import { DATA_ROLES } from "@shared/roles";
import { CardSkeletons, EmptyState, ErrorState } from "@/components/sigdata/list-states";
import { Button } from "@/components/ui/button";

type TabId = "fontes" | "datasets";

const TabBar = ({
  active,
  counts,
  onChange,
}: {
  active: TabId;
  counts: Record<TabId, number>;
  onChange: (tab: TabId) => void;
}) => (
  <div role="tablist" aria-label="Fontes e datasets" className="mb-6 flex gap-1 border-b border-border">
    {(
      [
        { id: "fontes", label: "Fontes de dados", icon: Database },
        { id: "datasets", label: "Datasets", icon: Table2 },
      ] as const
    ).map((tab) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        id={`aba-${tab.id}`}
        aria-selected={active === tab.id}
        aria-controls={`painel-${tab.id}`}
        onClick={() => onChange(tab.id)}
        className={cn(
          "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
          active === tab.id
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        <tab.icon className="size-4" aria-hidden />
        {tab.label}
        <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          {counts[tab.id]}
        </span>
      </button>
    ))}
  </div>
);

const TileGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
);

/** Frase com o impacto real; sem dados de uso, cai no aviso genérico. */
const usageText = (usage: SourceUsage | null, fallback: string) =>
  usage && usage.dashboards + usage.projects > 0
    ? `Está em uso por ${usage.dashboards} dashboard(s) e ${usage.projects} projeto(s)${
        usage.people > 0 ? `, de ${usage.people} outra(s) pessoa(s)` : ""
      }. Eles deixam de funcionar.`
    : fallback;

function FontesDeDadosContent() {
  const hydrated = useDatasetsStore((state) => state.hydrated);
  const loadError = useDatasetsStore((state) => state.error);
  const hydrate = useDatasetsStore((state) => state.hydrate);
  const reload = useDatasetsStore((state) => state.reload);
  const datasets = useDatasetsStore((state) => state.datasets);
  const removeDataset = useDatasetsStore((state) => state.removeDataset);
  const setPublished = useDatasetsStore((state) => state.setPublished);
  const usageOf = useDatasetsStore((state) => state.usageOf);

  const router = useRouter();
  const tab: TabId = useSearchParams().get("aba") === "datasets" ? "datasets" : "fontes";
  const changeTab = (next: TabId) => {
    setSelectedId(null);
    router.replace(next === "datasets" ? "/fontes-de-dados?aba=datasets" : "/fontes-de-dados", { scroll: false });
  };

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const selected = datasets.find((dataset) => dataset.id === selectedId) ?? null;
  const sources = datasets.filter((dataset) => dataset.kind !== "dataset");
  const saved = datasets.filter((dataset) => dataset.kind === "dataset");

  const renderTile = (dataset: Dataset) => (
    <SourceTile
      key={dataset.id}
      dataset={dataset}
      selected={dataset.id === selectedId}
      onInspect={() => setSelectedId(dataset.id === selectedId ? null : dataset.id)}
      onTogglePublish={() => {
        const next = !dataset.published;
        void (next ? Promise.resolve(null) : usageOf(dataset.id).catch(() => null))
          .then((usage) =>
            confirmAction({
              title: next ? `Publicar "${dataset.name}"?` : `Despublicar "${dataset.name}"?`,
              description: next
                ? "Todos os usuários passam a ver e usar este dataset em projetos e dashboards."
                : usageText(usage, "Dashboards e projetos de outras pessoas que o usam deixam de funcionar até ele ser publicado de novo."),
              confirmLabel: next ? "Publicar" : "Despublicar",
              destructive: !next,
            }),
          )
          .then((ok) => {
          if (!ok) return;
          setPublished(dataset.id, next, true)
            .then(() => toast.success(next ? "Dataset publicado." : "Dataset voltou a rascunho."))
            .catch((error: Error) => toast.error(error.message));
        });
      }}
      onRemove={() => {
        const kind = dataset.definition ? "dataset" : "fonte";
        void usageOf(dataset.id)
          .catch(() => null)
          .then((usage) =>
            confirmAction({
              title: `Excluir ${kind === "dataset" ? "o dataset" : "a fonte"} "${dataset.name}"?`,
              description: usageText(usage, "Projetos que a usam ficarão sem fonte."),
              confirmLabel: "Excluir",
              destructive: true,
            }),
          )
          .then((ok) => {
          if (!ok) return;
          setRemoveError(null);
          if (selectedId === dataset.id) setSelectedId(null);
          removeDataset(dataset.id, true)
            .then(() => toast.success(`${kind === "dataset" ? "Dataset excluído" : "Fonte excluída"}.`))
            .catch((error: Error) => setRemoveError(error.message));
        });
      }}
    />
  );

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />

      <main className="px-4 py-8 sm:px-10 sm:py-10 lg:px-30">
        <PageHeading
          title="Fontes de dados"
          description="Arquivos, bancos e datasets que o assistente pode consultar."
          actions={
            <Button render={<Link href="/fontes-de-dados/editor" />} nativeButton={false}>
              <Code2 aria-hidden />
              Editor SQL
            </Button>
          }
        />
        <TabBar active={tab} counts={{ fontes: sources.length, datasets: saved.length }} onChange={changeTab} />

        {removeError ? <p className="mb-4 text-sm text-destructive">{removeError}</p> : null}

        {tab === "fontes" ? (
          <div role="tabpanel" id="painel-fontes" aria-labelledby="aba-fontes">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Arquivos e bancos conectados, que o assistente e o editor SQL podem consultar.
              </p>
              <button
                type="button"
                onClick={() => setNewOpen(true)}
                className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="size-4" aria-hidden />
                Nova fonte de dados
              </button>
            </div>
            {selected && selected.kind !== "dataset" ? (
              <SourceDetail source={selected} onClose={() => setSelectedId(null)} />
            ) : null}

            {!hydrated ? (
              <CardSkeletons />
            ) : loadError ? (
              <ErrorState title="Não foi possível carregar as fontes" message={loadError} onRetry={() => void reload()} />
            ) : sources.length === 0 ? (
              <EmptyState
                icon={Database}
                title="Nenhuma fonte ainda"
                description="Envie um CSV/XLSX ou conecte um banco PostgreSQL. Depois escolha a fonte na barra lateral do projeto para o assistente consultar."
                action={<Button onClick={() => setNewOpen(true)}>Nova fonte de dados</Button>}
              />
            ) : (
              <TileGrid>{sources.map((dataset) => renderTile(dataset))}</TileGrid>
            )}
          </div>
        ) : (
          <div role="tabpanel" id="painel-datasets" aria-labelledby="aba-datasets">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Resultados tratados no editor SQL, prontos para usar nas análises dos projetos.
              </p>
              <Link
                href="/fontes-de-dados/editor"
                className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="size-4" aria-hidden />
                Novo dataset
              </Link>
            </div>
            {selected && selected.kind === "dataset" ? (
              <SourceDetail source={selected} onClose={() => setSelectedId(null)} />
            ) : null}

            {!hydrated ? (
              <CardSkeletons />
            ) : loadError ? (
              <ErrorState title="Não foi possível carregar os datasets" message={loadError} onRetry={() => void reload()} />
            ) : saved.length === 0 ? (
              <EmptyState
                icon={Table2}
                title="Nenhum dataset salvo ainda"
                description='No editor SQL, trate os dados com uma consulta e use "Salvar como dataset". Ele aparece aqui e na barra lateral dos projetos.'
                action={
                  <Button render={<Link href="/fontes-de-dados/editor" />} nativeButton={false}>
                    Abrir editor SQL
                  </Button>
                }
              />
            ) : (
              <TileGrid>{saved.map((dataset) => renderTile(dataset))}</TileGrid>
            )}
          </div>
        )}
      </main>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova fonte de dados</DialogTitle>
            <DialogDescription>
              Envie um arquivo CSV/XLSX ou conecte um banco PostgreSQL para consultar com o assistente e o editor SQL.
            </DialogDescription>
          </DialogHeader>
          <NewSourceForm
            onCreated={(source) => {
              setNewOpen(false);
              setSelectedId(source.id);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Fontes de dados e datasets salvos, em abas (a aba ativa fica na URL: ?aba=datasets). */
export default function FontesDeDadosPage() {
  return (
    <RoleGate roles={DATA_ROLES}>
      <Suspense>
        <FontesDeDadosContent />
      </Suspense>
    </RoleGate>
  );
}
