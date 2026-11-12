"use client";

import { ChevronLeft, Pencil, Trash } from "lucide-react";
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

  if (error) return <p className="text-danger">{error}</p>;
  if (!entry) return <p className="text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-muted">
        <ChevronLeft size={18} aria-hidden /> Brain
      </Link>

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
            <button onClick={() => setEditing(true)} className="btn-secondary flex-1">
              <Pencil size={16} aria-hidden /> Edit
            </button>
            <button onClick={handleDelete} className="btn-danger">
              <Trash size={16} aria-hidden /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
