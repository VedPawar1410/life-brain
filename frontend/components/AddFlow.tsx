"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import EntryForm from "@/components/EntryForm";
import MicButton from "@/components/MicButton";
import { api, emptyEntry, type AskRecord, type CaptureDraft, type Entry, type EntryInput } from "@/lib/api";

// 1) say it in your own words  2) review the AI's draft before anything is saved
// 3) (optional) merge: review the combined entry and remove anything no longer true.
type Review = { name: "review"; draft: EntryInput; duplicate: Entry | null; reason: string | null };
type Step =
  | { name: "write" }
  | Review
  | { name: "merge"; merged: Entry; from: Review }
  | { name: "manual" };

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setThinking(false);
    }
  }

  const openEntry = (entry: Entry) => router.push(`/entries/${entry.id}`);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">➕ Add to your brain</h1>
        <p className="text-sm text-muted">
          {step.name === "review"
            ? "Check the draft. Nothing is saved until you confirm."
            : step.name === "merge"
              ? "This is the combined entry. Remove anything that's no longer true, then save."
              : "Something you've learned about your body or life."}
        </p>
      </header>

      {step.name === "write" && (
        <>
          {followUp && (
            <div className="card text-sm">
              <p className="text-muted">Following up on your question:</p>
              <p className="mt-1 font-medium">{followUp.question}</p>
            </div>
          )}
          <textarea
            autoFocus
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="input"
            placeholder={
              followUp
                ? "What actually worked (or didn't)? e.g. The ginger tea helped a lot, the socks didn't matter."
                : "e.g. When I eat a banana and drink water right after, I get bloated for about an hour. Waiting 30 min helps."
            }
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <MicButton value={text} onChange={setText} />
            <button
              onClick={structure}
              disabled={thinking || text.trim().length < 3}
              className="btn-primary flex-1"
            >
              {thinking ? "Thinking…" : "✨ Structure it"}
            </button>
          </div>
          <button onClick={() => setStep({ name: "manual" })} className="text-sm text-muted">
            or fill it in manually
          </button>
        </>
      )}

      {step.name === "review" && (
        <>
          {step.duplicate && (
            <div className="card border-accent">
              <p className="text-sm font-medium">Looks like something you already have:</p>
              <p className="mt-1 font-semibold">{step.duplicate.title}</p>
              {step.reason && <p className="mt-1 text-sm text-muted">{step.reason}</p>}
              <p className="mt-2 text-sm text-muted">
                &ldquo;Merge&rdquo; combines them into one entry. You&apos;ll see the result before
                anything is saved.
              </p>
            </div>
          )}
          <EntryForm
            initial={step.draft}
            submitLabel="Save new"
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
        <EntryForm
          key={step.merged.id}
          initial={step.merged}
          submitLabel="Save merged entry"
          onSubmit={async (data) => openEntry(await api.updateEntry(step.merged.id, data))}
          cancelLabel="Back"
          onCancel={() => setStep(step.from)}
        />
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
