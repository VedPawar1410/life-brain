"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import EntryForm from "@/components/EntryForm";
import EntryView from "@/components/EntryView";
import { api, type Entry } from "@/lib/api";

export default function EntryDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api.getEntry(Number(id)).then(setEntry).catch((e: Error) => setError(e.message));
  }, [id]);

  async function handleDelete() {
    if (!entry || !confirm(`Delete "${entry.title}"? This can't be undone.`)) return;
    await api.deleteEntry(entry.id);
    router.push("/");
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!entry) return <p className="text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="text-sm text-muted">← Brain</Link>

      {editing ? (
        <EntryForm
          initial={entry}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (data) => {
            setEntry(await api.updateEntry(entry.id, data));
            setEditing(false);
          }}
        />
      ) : (
        <>
          <EntryView entry={entry} />
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="btn-secondary flex-1">Edit</button>
            <button onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </>
      )}
    </div>
  );
}
