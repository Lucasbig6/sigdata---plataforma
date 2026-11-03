"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RoleGate } from "@/components/sigdata/role-gate";
import { DATA_ROLES } from "@shared/roles";
import { SqlEditor } from "@/components/fontes/sql-editor";

const EditorContent = () => {
  const params = useSearchParams();
  return <SqlEditor
      initialSourceId={params.get("source")}
      initialSql={params.get("sql")}
      initialCross={params.get("cross")?.split(",").filter(Boolean) ?? []}
    />;
};

/** Editor SQL em tela cheia: abre ao escolher uma fonte em Fontes de dados. */
export default function EditorSqlPage() {
  return (
    <RoleGate roles={DATA_ROLES}>
      <Suspense>
        <EditorContent />
      </Suspense>
    </RoleGate>
  );
}
