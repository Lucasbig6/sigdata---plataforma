"use client";

import { ArrowLeft, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDatasetsStore } from "@/lib/datasets/store";
import type {
  ApiConnectionInput,
  ConnectionRequest,
  DataSource,
  GSheetsConnectionInput,
  SqlConnectionInput,
} from "@/lib/domain/sources";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/feedback";
import { ApiFields, EMPTY_API } from "./conexao/api-fields";
import { Field } from "./conexao/field";
import { SheetsFields, EMPTY_SHEETS } from "./conexao/sheets-fields";
import { SqlFields, emptySqlConnection } from "./conexao/sql-fields";
import { ConnectorPicker, connectorOf, type ConnectorMode } from "./connector-picker";

type Mode = ConnectorMode;

const NAME_HINT: Record<Mode, string> = {
  arquivo: "Ex.: Vendas por município",
  postgresql: "Ex.: Banco do CRM",
  mysql: "Ex.: Banco do site",
  sqlserver: "Ex.: ERP financeiro",
  api: "Ex.: Cadastro de escolas",
  gsheets: "Ex.: Metas trimestrais",
};

const FOOTNOTE: Partial<Record<Mode, string>> = {
  postgresql: "A senha é guardada criptografada. Toda consulta roda em transação somente-leitura com limite de tempo.",
  mysql: "A senha é guardada criptografada. Toda consulta roda em transação somente-leitura com limite de tempo.",
  sqlserver:
    "A senha é guardada criptografada. O SQL Server não tem modo somente-leitura por sessão: use um usuário com permissão apenas de leitura (db_datareader).",
  api: "Os dados são copiados para o SIGDATA; use “Atualizar dados” na fonte para buscar de novo. Cabeçalhos são guardados criptografados.",
  gsheets: "A planilha precisa estar compartilhada como “Qualquer pessoa com o link”. Vale a aba do link (gid); sem ele, a primeira.",
};

export const NewSourceForm = ({ onCreated }: { onCreated: (source: DataSource) => void }) => {
  const uploadFile = useDatasetsStore((state) => state.uploadFile);
  const testConnection = useDatasetsStore((state) => state.testConnection);
  const connectSource = useDatasetsStore((state) => state.connectSource);

  // null = ainda escolhendo o tipo de conector (primeira etapa)
  const [chosen, setChosen] = useState<Mode | null>(null);
  const mode: Mode = chosen ?? "arquivo";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sql, setSql] = useState<SqlConnectionInput>(emptySqlConnection("postgresql"));
  const [api, setApi] = useState<ApiConnectionInput>(EMPTY_API);
  const [sheets, setSheets] = useState<GSheetsConnectionInput>(EMPTY_SHEETS);
  const [busy, setBusy] = useState<"enviar" | "testar" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "erro"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName("");
    setDescription("");
    setFile(null);
    setSql(emptySqlConnection(mode === "mysql" || mode === "sqlserver" ? mode : "postgresql"));
    setApi(EMPTY_API);
    setSheets(EMPTY_SHEETS);
    if (fileRef.current) fileRef.current.value = "";
  };

  const changeMode = (next: Mode) => {
    // ao trocar de banco, a porta padrão acompanha (se ainda não foi preenchido nada)
    if (next === "postgresql" || next === "mysql" || next === "sqlserver") {
      if (!sql.host && !sql.database) setSql(emptySqlConnection(next));
    }
    setChosen(next);
    setMessage(null);
  };

  const backToPicker = () => {
    setChosen(null);
    setMessage(null);
  };

  const request = (): ConnectionRequest | null => {
    if (mode === "arquivo") return null;
    if (mode === "api") return { kind: "api", connection: api };
    if (mode === "gsheets") return { kind: "gsheets", connection: sheets };
    return { kind: mode, connection: sql };
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
      const connection = request();
      const source = connection
        ? await connectSource({ ...connection, name, description })
        : await uploadFile({ file: file as File, name, description });
      if (source.status === "erro") throw new Error(source.error ?? "Falha ao processar a fonte.");
      reset();
      toast.success(`Fonte "${source.name}" adicionada.`);
      onCreated(source);
      return `"${source.name}" pronta — ${source.tables.length} tabela(s).`;
    });
  };

  const canSubmit =
    mode === "arquivo"
      ? file !== null
      : mode === "api"
        ? Boolean(api.url.trim())
        : mode === "gsheets"
          ? Boolean(sheets.url.trim())
          : Boolean(sql.host && sql.database && sql.user);

  const footnote = FOOTNOTE[mode];

  if (chosen === null) return <ConnectorPicker onPick={changeMode} />;

  const connector = connectorOf(chosen);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={backToPicker} className="-ms-2 gap-1.5 text-muted-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Trocar tipo
        </Button>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground">
          <connector.icon className="size-3.5 text-primary" aria-hidden />
          {connector.label}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field id="source-name" title="Nome">
          <Input id="source-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={NAME_HINT[mode]} />
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
            <span className="block truncate text-sm text-foreground">{file ? file.name : "Escolher arquivo .csv ou .xlsx"}</span>
            <span className="block text-[11px] text-muted-foreground">
              {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Até 50 MB. Cada aba do Excel vira uma tabela."}
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
      ) : mode === "api" ? (
        <ApiFields value={api} onChange={setApi} />
      ) : mode === "gsheets" ? (
        <SheetsFields value={sheets} onChange={setSheets} />
      ) : (
        <SqlFields kind={mode} value={sql} onChange={setSql} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={!canSubmit || busy !== null}>
          {busy === "enviar" ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {mode === "arquivo" ? "Enviar e processar" : mode === "api" || mode === "gsheets" ? "Importar" : "Conectar"}
        </Button>
        {mode !== "arquivo" ? (
          <Button
            type="button"
            variant="outline"
            disabled={!canSubmit || busy !== null}
            onClick={() =>
              void run("testar", async () => {
                const connection = request();
                if (!connection) return null;
                const out = await testConnection(connection);
                return out.rows != null
                  ? `Conexão ok — ${out.rows.toLocaleString("pt-BR")} registro(s) encontrados.`
                  : mode === "gsheets"
                    ? "Link válido."
                    : `Conexão ok — ${out.tables} tabela(s) visíveis.`;
              })
            }
          >
            {busy === "testar" ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Testar conexão
          </Button>
        ) : null}
        {message ? (
          <span className={cn("text-xs", message.tone === "erro" ? "text-destructive" : "text-primary")}>{message.text}</span>
        ) : null}
      </div>
      {footnote ? <p className="text-[11px] leading-relaxed text-muted-foreground">{footnote}</p> : null}
    </form>
  );
};
