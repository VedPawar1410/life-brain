"use client";

import { ChevronRight, X } from "lucide-react";
import { useEffect } from "react";
import type { AskRecord } from "@/lib/api";
import { timeAgo } from "@/lib/time";

type Props = { open: boolean; onClose: () => void; items: AskRecord[]; onPick: (record: AskRecord) => void };

/** Past questions in a bottom sheet, so the Ask screen itself stays about asking. */
export default function HistorySheet({ open, onClose, items, onPick }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button aria-label="Close history" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recent questions"
        className="relative flex max-h-[75lvh] w-full max-w-md flex-col rounded-t-3xl border border-line bg-background pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-semibold">Recent questions</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-muted">
            <X size={20} aria-hidden />
          </button>
        </div>
        <ul className="flex flex-col gap-2 overflow-y-auto px-4 pb-4">
          {items.map((record) => (
            <li key={record.id}>
              <button
                onClick={() => onPick(record)}
                className="card flex w-full items-center gap-3 text-left transition-colors active:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{record.question}</span>
                  <span className="text-xs text-muted">{timeAgo(record.created_at)}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-subtle" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
