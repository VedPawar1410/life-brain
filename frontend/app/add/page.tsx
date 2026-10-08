"use client";

import { useRouter } from "next/navigation";
import EntryForm from "@/components/EntryForm";
import { api, emptyEntry } from "@/lib/api";

// Manual entry for now. PR 3 puts AI capture (describe it in your own words) in front of this form.
export default function AddPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">➕ Add to your brain</h1>
        <p className="text-sm text-muted">Something you&apos;ve learned about your body or life.</p>
      </header>
      <EntryForm
        initial={emptyEntry}
        submitLabel="Save to brain"
        onSubmit={async (data) => {
          const entry = await api.createEntry(data);
          router.push(`/entries/${entry.id}`);
        }}
      />
    </div>
  );
}
