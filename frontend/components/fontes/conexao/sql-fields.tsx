"use client";

import { Input } from "@/components/ui/input";
import type { LiveSqlKind, SqlConnectionInput } from "@/lib/domain/sources";
import { Field } from "./field";

export const DEFAULT_PORTS: Record<LiveSqlKind, number> = { postgresql: 5432, mysql: 3306, sqlserver: 1433 };

export const emptySqlConnection = (kind: LiveSqlKind): SqlConnectionInput => ({
  host: "",
  port: DEFAULT_PORTS[kind],
  database: "",
  user: "",
  password: "",
  ssl: false,
  sslVerify: true,
});

const SCHEMA_TITLE: Record<LiveSqlKind, string> = {
  postgresql: "Schemas (opcional, separados por vírgula)",
  mysql: "Bancos extras (opcional, separados por vírgula)",
  sqlserver: "Schemas (opcional, separados por vírgula)",
};

/** Campos de conexão de PostgreSQL, MySQL/MariaDB e SQL Server (são os mesmos). */
export const SqlFields = ({
  kind,
  value,
  onChange,
}: {
  kind: LiveSqlKind;
  value: SqlConnectionInput;
  onChange: (next: SqlConnectionInput) => void;
}) => {
  const set = <K extends keyof SqlConnectionInput>(key: K, next: SqlConnectionInput[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <div className="sm:col-span-3">
        <Field id="db-host" title="Host">
          <Input id="db-host" value={value.host} onChange={(e) => set("host", e.target.value)} placeholder="db.exemplo.gov.br" />
        </Field>
      </div>
      <div className="sm:col-span-1">
        <Field id="db-port" title="Porta">
          <Input
            id="db-port"
            inputMode="numeric"
            value={String(value.port)}
            onChange={(e) => set("port", Number(e.target.value.replace(/\D/g, "")) || 0)}
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id="db-name" title="Banco">
          <Input id="db-name" value={value.database} onChange={(e) => set("database", e.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id="db-user" title="Usuário (de preferência só leitura)">
          <Input id="db-user" autoComplete="off" value={value.user} onChange={(e) => set("user", e.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id="db-password" title="Senha">
          <Input
            id="db-password"
            type="password"
            autoComplete="new-password"
            value={value.password}
            onChange={(e) => set("password", e.target.value)}
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id="db-schemas" title={SCHEMA_TITLE[kind]}>
          <Input
            id="db-schemas"
            placeholder={kind === "sqlserver" ? "dbo" : kind === "mysql" ? "o banco acima" : "public"}
            onChange={(e) =>
              set(
                "schemas",
                e.target.value
                  .split(",")
                  .map((part) => part.trim())
                  .filter(Boolean),
              )
            }
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-6">
        <input type="checkbox" checked={value.ssl} onChange={(e) => set("ssl", e.target.checked)} />
        Usar SSL
      </label>
      {value.ssl ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-6">
          <input type="checkbox" checked={value.sslVerify !== false} onChange={(e) => set("sslVerify", e.target.checked)} />
          Validar o certificado do servidor (desmarque só para certificado autoassinado)
        </label>
      ) : null}
    </div>
  );
};
