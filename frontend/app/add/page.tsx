import { Suspense } from "react";
import AddFlow from "@/components/AddFlow";

// AddFlow reads ?ask=<id> (follow-up from an answer), which needs Suspense with cacheComponents.
export default function AddPage() {
  return (
    <Suspense>
      <AddFlow />
    </Suspense>
  );
}
