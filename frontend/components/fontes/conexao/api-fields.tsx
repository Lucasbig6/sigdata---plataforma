"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiConnectionInput } from "@/lib/domain/sources";
import { Field } from "./field";

export const EMPTY_API: ApiConnectionInput = {
  url: "",
  headers: [],
  recordsPath: "",
  pagination: { type: "none" },
  maxPages: 10,
};

type PaginationType = ApiConnectionInput["pagination"]["type"];

const PAGINATION: Record<PaginationType, string> = {
  none: "Sem paginação (uma só resposta)",
  page: "Por número de página",
  next: "Por link da próxima página",
};

const select =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** Configuração de uma API REST que devolve JSON. */
export const ApiFields = ({
  value,
  onChange,
}: {
  value: ApiConnectionInput;
  onChange: (next: ApiConnectionInput) => void;
}) => {
  const set = <K extends keyof ApiConnectionInput>(key: K, next: ApiConnectionInput[K]) =>
    onChange({ ...value, [key]: next });
  const { pagination } = value;

  const changePagination = (type: PaginationType) =>
    set(
      "pagination",
      type === "none"
        ? { type }
        : type === "page"
          ? { type, param: "page", start: 1 }
          : { type, path: "next" },
    );

  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <div className="sm:col-span-4">
        <Field id="api-url" title="Endereço (GET)">
          <Input id="api-url" value={value.url} onChange={(e) => set("url", e.target.value)} placeholder="https://api.exemplo.gov.br/v1/registros" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id="api-path" title="Caminho dos registros (opcional)">
          <Input id="api-path" value={value.recordsPath} onChange={(e) => set("recordsPath", e.target.value)} placeholder="data.items" />
        </Field>
      </div>

      <div className="flex flex-col gap-2 sm:col-span-6">
        <span className="text-xs font-medium text-muted-foreground">Cabeçalhos (ex.: Authorization: Bearer …)</span>
        {value.headers.map((header, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              aria-label="Nome do cabeçalho"
              className="max-w-[14rem]"
              value={header.name}
              placeholder="Authorization"
              onChange={(e) =>
                set("headers", value.headers.map((entry, i) => (i === index ? { ...entry, name: e.target.value } : entry)))
              }
            />
            <Input
              aria-label="Valor do cabeçalho"
              type="password"
              autoComplete="new-password"
              value={header.value}
              placeholder="valor"
              onChange={(e) =>
                set("headers", value.headers.map((entry, i) => (i === index ? { ...entry, value: e.target.value } : entry)))
              }
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Remover cabeçalho"
              onClick={() => set("headers", value.headers.filter((_, i) => i !== index))}
            >
              <X aria-hidden />
            </Button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => set("headers", [...value.headers, { name: "", value: "" }])}
          >
            <Plus aria-hidden />
            Cabeçalho
          </Button>
        </div>
      </div>

      <div className="sm:col-span-3">
        <Field id="api-pagination" title="Paginação">
          <select
            id="api-pagination"
            className={select}
            value={pagination.type}
            onChange={(e) => changePagination(e.target.value as PaginationType)}
          >
            {(Object.keys(PAGINATION) as PaginationType[]).map((type) => (
              <option key={type} value={type}>
                {PAGINATION[type]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {pagination.type === "page" ? (
        <>
          <div className="sm:col-span-1">
            <Field id="api-page-param" title="Parâmetro">
              <Input id="api-page-param" value={pagination.param} onChange={(e) => set("pagination", { ...pagination, param: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-1">
            <Field id="api-page-start" title="Começa em">
              <Input
                id="api-page-start"
                inputMode="numeric"
                value={String(pagination.start)}
                onChange={(e) => set("pagination", { ...pagination, start: Number(e.target.value.replace(/\D/g, "")) || 0 })}
              />
            </Field>
          </div>
        </>
      ) : null}
      {pagination.type === "next" ? (
        <div className="sm:col-span-2">
          <Field id="api-next" title="Caminho do link da próxima página">
            <Input id="api-next" value={pagination.path} onChange={(e) => set("pagination", { ...pagination, path: e.target.value })} />
          </Field>
        </div>
      ) : null}
      {pagination.type !== "none" ? (
        <div className="sm:col-span-1">
          <Field id="api-max-pages" title="Máx. de páginas">
            <Input
              id="api-max-pages"
              inputMode="numeric"
              value={String(value.maxPages)}
              onChange={(e) => set("maxPages", Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 1))}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
};
