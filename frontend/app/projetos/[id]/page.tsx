import { Suspense } from "react";
import { Assistant } from "@/app/assistant";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <Assistant notebookId={id} />
    </Suspense>
  );
}
