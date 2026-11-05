"use client";

import { Input } from "@/components/ui/input";
import type { GSheetsConnectionInput } from "@/lib/domain/sources";
import { Field } from "./field";

export const EMPTY_SHEETS: GSheetsConnectionInput = { url: "" };

export const SheetsFields = ({
  value,
  onChange,
}: {
  value: GSheetsConnectionInput;
  onChange: (next: GSheetsConnectionInput) => void;
}) => (
  <Field id="sheets-url" title="Link da planilha">
    <Input
      id="sheets-url"
      value={value.url}
      onChange={(e) => onChange({ url: e.target.value })}
      placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0"
    />
  </Field>
);
