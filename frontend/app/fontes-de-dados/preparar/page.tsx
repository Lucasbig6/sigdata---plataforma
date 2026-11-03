"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PrepWorkspace } from "@/components/fontes/preparo/prep-workspace";
import { RoleGate } from "@/components/sigdata/role-gate";
import { DATA_ROLES } from "@shared/roles";

const PrepContent = () => {
  const params = useSearchParams();
  return (
    <PrepWorkspace
      initialSourceId={params.get("source")}
      initialTable={params.get("table")}
      initialDatasetId={params.get("dataset")}
    />
  );
};

/** Preparação de dados em etapas: abre ao escolher "Preparar dados" em Fontes de dados. */
export default function PreparoPage() {
  return (
    <RoleGate roles={DATA_ROLES}>
      <Suspense>
        <PrepContent />
      </Suspense>
    </RoleGate>
  );
}
