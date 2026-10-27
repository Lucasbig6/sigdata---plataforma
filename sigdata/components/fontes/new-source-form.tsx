"use client";

import { FileSpreadsheet, Loader2, PlugZap, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDatasetsStore } from "@/lib/datasets/store";
import type { DataSource, PostgresConnectionInput } from "@/lib/domain/sources";
import { cn } from "@/lib/utils";

type Mode = "arquivo" | "postgresql";

const label = "text-xs font-medium text-muted-foreground";

const Field = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <label htmlFor={id} className={label}>
      {title}
    </label>
    {children}
  </div>
);

const EMPTY_PG: PostgresConnectionInput = {
  host: "",
  port: 5432,
  database: "",
  user: "",
  password: "",
  ssl: false,
};

export const NewSourceForm = ({ onCreated }: { onCreated: (source: DataSource) => void }) => {
  const uploadFile = useDatasetsStore((state) => state.uploadFile);
  const testPostgres = useDatasetsStore((state) => state.testPostgres);
  const connectPostgres = useDatasetsStore((state) => state.connectPostgres);

  const [mode, setMode] = useState<Mode>("arquivo");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pg, setPg] = useState<PostgresConnectionInput>(EMPTY_PG);
  const [busy, setBusy] = useState<"enviar" | "testar" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "erro"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName("");
    setDescription("");
    setFile(null);
    setPg(EMPTY_PG);
    if (fileRef.current) fileRef.current.value = "";
  };

  const run = async (kind: "enviar" | "testar", fn: () => Promise<string | null>) => {
    setBusy(kind);
    setMessage(null);
    try {
      const text = await fn();
      if (text) setMessage({ tone: "ok", text });
    } catch (error) {
      setMessage({ tone: "erro", text: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void run("enviar", async () => {
      const source =
        mode === "arquivo"
          ? await uploadFile({ file: file as File, name, description })
          : await connectPostgres({ name, description, connection: pg });
      if (source.status === "erro") throw new Error(source.error ?? "Falha ao processar a fonte.");
      reset();
      onCreated(source);
      return `"${source.name}" pronta — ${source.tables.length} tabela(s).`;
    });
  };

  const canSubmit =
    mode === "arquivo" ? file !== null : Boolean(pg.host && pg.database && pg.user);

  const setPgField = <K extends keyof PostgresConnectionInput>(key: K, value: PostgresConnectionInput[K]) =>
    setPg((current) => ({ ...current, [key]: value }));

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-medium text-foreground">Nova fonte</h2>
        <div role="tablist" className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {(
            [
              { id: "arquivo", label: "Arquivo CSV/XLSX", icon: FileSpreadsheet },
              { id: "postgresql", label: "PostgreSQL", icon: PlugZap },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mode === tab.id}
              onClick={() => {
                setMode(tab.id);
                setMessage(null);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                mode === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon className="size-3.5" aria-hidden />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field id="source-name" title="Nome">
          <Input
            id="source-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={mode === "arquivo" ? "Ex.: Vendas por município" : "Ex.: Banco do CRM"}
          />
        </Field>
        <Field id="source-description" title="Descrição (ajuda o assistente a entender os dados)">
          <Input
            id="source-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="De onde vêm os dados e o que contêm"
          />
        </Field>
      </div>

      {mode === "arquivo" ? (
        <label
          htmlFor="source-file"
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-background/60 px-4 py-4 transition-colors hover:border-primary/50"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-muted/60 text-muted-foreground">
            <Upload className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-foreground">
              {file ? file.name : "Escolher arquivo .csv ou .xlsx"}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {file
                ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                : "Até 50 MB. Cada aba do Excel vira uma tabela."}
            </span>
          </span>
          <input
            ref={fileRef}
            id="source-file"
            type="file"
            accept=".csv,.txt,.xlsx"
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
      ) : (
        <div className="grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <Field id="pg-host" title="Host">
              <Input id="pg-host" value={pg.host} onChange={(e) => setPgField("host", e.target.value)} placeholder="db.exemplo.gov.br" />
            </Field>
          </div>
          <div className="sm:col-span-1">
            <Field id="pg-port" title="Porta">
              <Input
                id="pg-port"
                inputMode="numeric"
                value={String(pg.port)}
                onChange={(e) => setPgField("port", Number(e.target.value.replace(/\D/g, "")) || 0)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id="pg-db" title="Banco">
              <Input id="pg-db" value={pg.database} onChange={(e) => setPgField("database", e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id="pg-user" title="Usuário (de preferência só leitura)">
              <Input id="pg-user" autoComplete="off" value={pg.user} onChange={(e) => setPgField("user", e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id="pg-password" title="Senha">
              <Input
                id="pg-password"
                type="password"
                autoComplete="new-password"
                value={pg.password}
                onChange={(e) => setPgField("password", e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id="pg-schemas" title="Schemas (opcional, separados por vírgula)">
              <Input
                id="pg-schemas"
                placeholder="public"
                onChange={(e) =>
                  setPgField(
                    "schemas",
                    e.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  )
                }
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-6">
            <input type="checkbox" checked={pg.ssl} onChange={(e) => setPgField("ssl", e.target.checked)} />
            Usar SSL
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={!canSubmit || busy !== null}>
          {busy === "enviar" ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {mode === "arquivo" ? "Enviar e processar" : "Conectar"}
        </Button>
        {mode === "postgresql" ? (
          <Button
            type="button"
            variant="outline"
            disabled={!canSubmit || busy !== null}
            onClick={() =>
              void run("testar", async () => {
                const out = await testPostgres(pg);
                return `Conexão ok — ${out.tables} tabela(s) visíveis.`;
              })
            }
          >
            {busy === "testar" ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Testar conexão
          </Button>
        ) : null}
        {message ? (
          <span className={cn("text-xs", message.tone === "erro" ? "text-destructive" : "text-primary")}>
            {message.text}
          </span>
        ) : null}
      </div>
      {mode === "postgresql" ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          A senha é guardada criptografada. Toda consulta roda em transação somente-leitura com
          limite de tempo.
        </p>
      ) : null}
    </form>
  );
};
