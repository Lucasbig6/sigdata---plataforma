"use client";

import { useParams } from "next/navigation";
import { EditorShell } from "@/components/dashboards/editor-shell";

export default function DashboardEditorPage() {
  const params = useParams<{ id: string }>();
  return <EditorShell dashboardId={params.id} />;
}
