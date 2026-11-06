import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Assistant } from "../assistant";
import { projectHref } from "@/lib/routes";

/** Endereço antigo (`/workspace?notebook=id`) segue funcionando e leva à rota do projeto. */
export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ notebook?: string }> }) {
  const { notebook } = await searchParams;
  if (notebook) redirect(projectHref(notebook));
  return (
    <Suspense>
      <Assistant />
    </Suspense>
  );
}
