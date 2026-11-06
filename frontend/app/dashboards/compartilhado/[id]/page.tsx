"use client";

import { useParams } from "next/navigation";
import { SharedView } from "@/components/dashboards/shared-view";

/** Dashboard que outra pessoa compartilhou com você (somente leitura, exige login). */
export default function SharedWithMePage() {
  const { id } = useParams<{ id: string }>();
  const base = `/api/dashboards/${encodeURIComponent(id)}/view`;
  return <SharedView source={{ token: id, loadUrl: base, basePath: base }} backHref="/dashboards" />;
}
