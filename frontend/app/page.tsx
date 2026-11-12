"use client";

import KindBadge from "@/components/ui/KindBadge";
import PageHeader from "@/components/ui/PageHeader";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, type Entry } from "@/lib/api";

export default function BrainPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    api.listEntries().then(setEntries).catch((e: Error) => setError(e.message));
  }, []);

  // A personal brain is small, so we load it all once and filter in the browser:
  // instant results, no request per keystroke.
  const allTags = useMemo(
    () => [...new Set((entries ?? []).flatMap((e) => e.tags))].sort(),
    [entries],
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (entries ?? []).filter((e) => {
      if (activeTag && !e.tags.includes(activeTag)) return false;
      if (!q) return true;
      return [e.title, e.situation, e.what_happens, e.notes, ...e.to_do, ...e.to_avoid]
        .some((text) => text.toLowerCase().includes(q));
    });
  }, [entries, query, activeTag]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Your brain"
        subtitle={entries ? `${entries.length} things you know about yourself` : "Loading…"}
      />

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your brain…"
        className="input"
      />

      {allTags.length > 0 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`chip shrink-0 ${activeTag === tag ? "outline-2 outline-accent" : ""}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-danger">
          Couldn&apos;t reach the API ({error}). Is the backend running?
        </p>
      )}

      {entries && entries.length === 0 && (
        <div className="card text-center">
          <p>Your brain is empty.</p>
          <Link href="/add" className="text-accent font-semibold">Add your first thing →</Link>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {visible.map((entry) => (
          <li key={entry.id}>
            <Link href={`/entries/${entry.id}`} className="card">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium">{entry.title}</h2>
                <KindBadge kind={entry.kind} />
              </div>
              {entry.situation && (
                <p className="mt-1 line-clamp-2 text-sm text-muted">{entry.situation}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {entries && entries.length > 0 && visible.length === 0 && (
        <p className="text-center text-sm text-muted">Nothing matches.</p>
      )}
    </div>
  );
}
