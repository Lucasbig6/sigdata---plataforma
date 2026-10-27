import { Suspense } from "react";
import { Assistant } from "../assistant";

export default function WorkspacePage() {
  return (
    <Suspense>
      <Assistant />
    </Suspense>
  );
}
