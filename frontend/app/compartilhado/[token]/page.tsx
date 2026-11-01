"use client";

import { useParams, useSearchParams } from "next/navigation";
import { SharedView } from "@/components/dashboards/shared-view";

/** Visualização pública (somente leitura) de um dashboard compartilhado por link. */
export default function SharedDashboardPage() {
  const { token } = useParams<{ token: string }>();
  // ?embed=1: sem cabeçalho, para incorporar em outra página
  const embed = useSearchParams().get("embed") === "1";
  return <SharedView source={{ token, loadUrl: `/api/public/dashboards/${encodeURIComponent(token)}` }} embed={embed} />;
}
