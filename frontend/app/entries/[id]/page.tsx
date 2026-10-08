import { Suspense } from "react";
import EntryDetail from "@/components/EntryDetail";

// The entry id is only known at request time, so the client component that reads it
// sits inside Suspense (required when cacheComponents is enabled).
export default function EntryPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <EntryDetail />
    </Suspense>
  );
}
