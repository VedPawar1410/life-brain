"use client";

import { ArrowUpDown, ChevronRight, CloudOff, RotateCcw, Search, SearchX, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Onboarding from "@/components/Onboarding";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
import { api, type Entry } from "@/lib/api";
import { KINDS } from "@/lib/kinds";
import { timeAgo } from "@/lib/time";

type Sort = "recent" | "az";

export default function BrainPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("recent");

  const load = useCallback(() => {
    api.listEntries().then(setEntries).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  function retry() {
    setError(null);
    setEntries(null);
    load();
  }

  // A personal brain is small, so we load it all once and filter in the browser:
  // instant results, no request per keystroke.
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tag of (entries ?? []).flatMap((e) => e.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts].sort(([a, x], [b, y]) => y - x || a.localeCompare(b)); // most used first
  }, [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (entries ?? []).filter((e) => {
      if (activeTag && !e.tags.includes(activeTag)) return false;
      if (!q) return true;
      return [e.title, e.situation, e.what_happens, e.notes, ...e.to_do, ...e.to_avoid]
        .some((text) => text.toLowerCase().includes(q));
    });
    // The API returns newest first; A–Z is a local re-sort.
    return sort === "az" ? [...matches].sort((a, b) => a.title.localeCompare(b.title)) : matches;
  }, [entries, query, activeTag, sort]);

  const filtering = Boolean(query.trim() || activeTag);
  const clearFilters = () => {
    setQuery("");
    setActiveTag(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Your brain"
        subtitle={
          entries
            ? filtering
              ? `${visible.length} of ${entries.length} entries`
              : entries.length > 0
                ? `${entries.length} things you know about yourself`
                : undefined
            : error
              ? undefined
              : "Loading…"
        }
        action={
          entries && entries.length > 1 && (
            <button
              onClick={() => setSort(sort === "recent" ? "az" : "recent")}
              className="btn-icon gap-1.5 px-3 py-2 text-sm"
              aria-label={`Sorted by ${sort === "recent" ? "most recent" : "title"}. Change sort`}
            >
              <ArrowUpDown size={16} aria-hidden />
              {sort === "recent" ? "Recent" : "A–Z"}
            </button>
          )
        }
      />

      {entries && entries.length > 0 && (
        <>
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your brain"
              className="input pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 text-subtle"
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </div>

          {tagCounts.length > 0 && (
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TagChip label="All" active={!activeTag} onClick={() => setActiveTag(null)} />
              {tagCounts.map(([tag, count]) => (
                <TagChip
                  key={tag}
                  label={`#${tag}`}
                  count={count}
                  active={activeTag === tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {error ? (
        <EmptyState
          icon={CloudOff}
          tone="danger"
          title="Couldn't load your brain"
          body="The app can't reach its backend. Check that it's running, then try again."
          action={
            <button onClick={retry} className="btn-secondary">
              <RotateCcw size={16} aria-hidden /> Try again
            </button>
          }
        />
      ) : !entries ? (
        <ul className="flex flex-col gap-2" aria-label="Loading entries">
          {[0, 1, 2].map((i) => (
            <li key={i} className="card flex gap-3">
              <Skeleton className="size-10 shrink-0 rounded-xl" />
              <div className="flex flex-1 flex-col gap-2 py-0.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </li>
          ))}
        </ul>
      ) : entries.length === 0 ? (
        <Onboarding />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matches"
          body="Nothing in your brain matches that search or tag."
          action={
            <button onClick={clearFilters} className="btn-secondary">
              Clear filters
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((entry) => (
            <li key={entry.id}>
              <EntryCard entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EntryCard({ entry }: { entry: Entry }) {
  const { icon: Icon, color, bg, label } = KINDS[entry.kind];
  const meta = [
    timeAgo(entry.updated_at),
    entry.to_do.length > 0 && `${entry.to_do.length} do`,
    entry.to_avoid.length > 0 && `${entry.to_avoid.length} avoid`,
  ].filter(Boolean);

  return (
    <Link href={`/entries/${entry.id}`} className="card flex items-center gap-3 transition-colors active:bg-surface-2">
      {/* The kind as a coloured tile makes the list scannable by type. */}
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: bg, color }}>
        <Icon size={20} aria-label={label} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-medium">{entry.title}</h2>
        {entry.situation && <p className="truncate text-sm text-muted">{entry.situation.split("\n")[0]}</p>}
        <p className="mt-0.5 text-xs text-muted">{meta.join(" · ")}</p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-subtle" aria-hidden />
    </Link>
  );
}

function TagChip({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      // On the page background the grey chip fill nearly vanishes, so filter chips sit on
      // the card colour with a hairline border, like the other tappable surfaces.
      className={`chip shrink-0 border py-1 ${active ? "border-transparent !bg-accent-soft !text-accent-ink" : "border-line !bg-card"}`}
    >
      {label}
      {count !== undefined && <span className={active ? "" : "text-muted"}>{count}</span>}
    </button>
  );
}
