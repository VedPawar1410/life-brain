"use client";

import { CopyCheck, Layers, MessageCircle, PenLine, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import EntryForm from "@/components/EntryForm";
import MicButton from "@/components/MicButton";
import PageHeader from "@/components/ui/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
import { api, emptyEntry, type AskRecord, type CaptureDraft, type Entry, type EntryInput } from "@/lib/api";

// 1) say it in your own words  2) review the AI's draft before anything is saved
// 3) (optional) merge: review the combined entry and remove anything no longer true.
type Review = { name: "review"; draft: EntryInput; duplicate: Entry | null; reason: string | null };
type Step =
  | { name: "write" }
  | Review
  | { name: "merge"; merged: Entry; from: Review }
  | { name: "manual" };

const SUBTITLES: Record<Step["name"], string> = {
  write: "Something you've learned about your body or life.",
  review: "Check the draft. Nothing is saved until you confirm.",
  merge: "This is the combined entry. Remove anything that's no longer true, then save.",
  manual: "Fill in what you know. Only the title is required.",
};

/** The model explains overlaps using internal ids ("as entry 1"); show the title instead. */
function readableReason(reason: string, duplicate: Entry) {
  return reason.replace(new RegExp(`\\b(?:entry|id)\\s*#?${duplicate.id}\\b`, "gi"), `"${duplicate.title}"`);
}

export default function AddFlow() {
  const router = useRouter();
  // Set when arriving via "Save what worked" on an answer.
  const askId = Number(useSearchParams().get("ask")) || undefined;
  const [followUp, setFollowUp] = useState<AskRecord | null>(null);
  const [step, setStep] = useState<Step>({ name: "write" });
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (askId) api.getAsk(askId).then(setFollowUp).catch(() => {});
  }, [askId]);

  async function structure() {
    setThinking(true);
    setError(null);
    try {
      const { possible_duplicate_id, duplicate_reason, ...fields }: CaptureDraft =
        await api.capture(text, askId);
      const duplicate = possible_duplicate_id ? await api.getEntry(possible_duplicate_id) : null;
      // Keep the user's original words alongside the structured version.
      setStep({ name: "review", draft: { ...fields, source_text: text }, duplicate, reason: duplicate_reason });
    } catch {
      setError("Couldn't structure that note. Check the backend is running, then try again.");
    } finally {
      setThinking(false);
    }
  }

  const openEntry = (entry: Entry) => router.push(`/entries/${entry.id}`);
  const canStructure = text.trim().length >= 3 && !thinking;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Add to your brain" subtitle={SUBTITLES[step.name]} />

      {step.name === "write" && (
        <>
          {followUp && (
            <div className="flex gap-3 rounded-2xl bg-accent-soft p-3 text-sm text-accent-ink">
              <MessageCircle size={18} className="mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">Following up on your question</p>
                <p className="mt-0.5">{followUp.question}</p>
              </div>
            </div>
          )}

          {thinking ? (
            // A preview of the draft that's coming, so the wait has a shape.
            <div className="flex flex-col gap-3" aria-live="polite">
              <p className="flex items-center gap-2 text-sm font-medium text-accent">
                <Sparkles size={16} className="animate-pulse" aria-hidden /> Structuring your note…
              </p>
              <div className="card flex flex-col gap-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-9 w-full rounded-xl" />
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-7 w-20 rounded-full" />)}
                </div>
              </div>
              <div className="card flex flex-col gap-3">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            </div>
          ) : (
            <>
              {/* The note and its actions live in one compose card. */}
              <div className="card flex flex-col gap-2 p-2 focus-within:border-accent">
                <textarea
                  autoFocus
                  rows={6}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  aria-label="Your note"
                  className="w-full resize-none bg-transparent px-2 pt-1.5 text-base outline-none placeholder:text-subtle"
                  placeholder={
                    followUp
                      ? "What actually worked, or didn't? The ginger tea helped a lot; the socks didn't matter."
                      : "When I eat a banana and drink water right after, I get bloated for about an hour. Waiting 30 minutes helps."
                  }
                />
                <div className="flex items-center gap-2">
                  <MicButton value={text} onChange={setText} />
                  <button onClick={structure} disabled={!canStructure} className="btn-primary ml-auto">
                    <Sparkles size={18} aria-hidden /> Structure it
                  </button>
                </div>
              </div>
              {error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
              <button
                onClick={() => setStep({ name: "manual" })}
                className="inline-flex items-center gap-1.5 self-center text-sm font-medium text-muted"
              >
                <PenLine size={16} aria-hidden /> Fill it in yourself instead
              </button>
            </>
          )}
        </>
      )}

      {step.name === "review" && (
        <>
          {step.duplicate && (
            <div className="flex gap-3 rounded-2xl border border-accent bg-accent-soft p-3 text-sm text-accent-ink">
              <CopyCheck size={20} className="mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">You may already have this</p>
                <p className="mt-0.5">
                  It overlaps with <span className="font-semibold">{step.duplicate.title}</span>.
                </p>
                {step.reason && <p className="mt-1">{readableReason(step.reason, step.duplicate)}</p>}
                <p className="mt-1.5">Merge combines them into one entry. You&apos;ll see the result before anything is saved.</p>
              </div>
            </div>
          )}
          <EntryForm
            initial={step.draft}
            submitLabel="Save new entry"
            onSubmit={async (data) => openEntry(await api.createEntry(data))}
            secondary={
              step.duplicate
                ? {
                    label: "Merge into existing",
                    onSubmit: async (data) => {
                      // Keep the edited draft, so "Back" returns to it unchanged.
                      const from = { ...step, draft: data };
                      setStep({ name: "merge", merged: await api.previewMerge(step.duplicate!.id, data), from });
                    },
                  }
                : undefined
            }
            cancelLabel="Discard"
            onCancel={() => setStep({ name: "write" })}
          />
        </>
      )}

      {step.name === "merge" && (
        <>
          <div className="flex gap-3 rounded-2xl bg-surface-2 p-3 text-sm">
            <Layers size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <p>
              Your new note has been folded into <span className="font-semibold">{step.merged.title}</span>.
              Merging only adds, so delete anything that&apos;s no longer true.
            </p>
          </div>
          <EntryForm
            key={step.merged.id}
            initial={step.merged}
            submitLabel="Save merged entry"
            onSubmit={async (data) => openEntry(await api.updateEntry(step.merged.id, data))}
            cancelLabel="Back to draft"
            onCancel={() => setStep(step.from)}
          />
        </>
      )}

      {step.name === "manual" && (
        <EntryForm
          initial={emptyEntry}
          submitLabel="Save to brain"
          onSubmit={async (data) => openEntry(await api.createEntry(data))}
          onCancel={() => setStep({ name: "write" })}
        />
      )}
    </div>
  );
}
