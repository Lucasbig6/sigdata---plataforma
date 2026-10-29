"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SqlEditor } from "@/components/fontes/sql-editor";
import { RoleGate } from "@/components/sigdata/role-gate";

const EditorContent = () => {
  const params = useSearchParams();
  return <SqlEditor initialSourceId={params.get("source")} initialSql={params.get("sql")} />;
};

/** Editor SQL em tela cheia: abre ao escolher uma fonte em Fontes de dados. */
export default function EditorSqlPage() {
  return (
    <RoleGate role="analista">
      <Suspense>
        <EditorContent />
      </Suspense>
    </RoleGate>
  );
}
