"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Markdown from "@/components/Markdown";
import MicButton from "@/components/MicButton";
import { api, askStream, type AskEvent, type AskRecord } from "@/lib/api";

type Turn = {
  question: string;
  answer: string;
  model?: string;
  fallback?: boolean;
  tokens?: number;
  error?: string;
  done: boolean;
  askId?: number; // set once the answer is saved to history
};

const EXAMPLES = [
  "I just got soaked in the rain, what should I do?",
  "I ate a banana and drank water, now I feel bloated",
  "I can't fall asleep tonight",
];

export default function AskPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [titles, setTitles] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<AskRecord[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = turns.length > 0 && !turns[turns.length - 1].done;

  // Entry titles turn [#id] citations into readable chips.
  useEffect(() => {
    api.listEntries()
      .then((entries) => setTitles(Object.fromEntries(entries.map((e) => [e.id, e.title]))))
      .catch(() => {});
    api.listAsks().then(setHistory).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  // Apply each streamed event to the latest turn.
  const updateLast = (patch: (t: Turn) => Partial<Turn>) =>
    setTurns((all) => [...all.slice(0, -1), { ...all[all.length - 1], ...patch(all[all.length - 1]) }]);

  function onEvent(event: AskEvent) {
    if (event.type === "meta") updateLast(() => ({ model: event.model, fallback: event.fallback }));
    if (event.type === "delta") updateLast((t) => ({ answer: t.answer + event.text }));
    if (event.type === "done")
      updateLast(() => ({
        done: true,
        tokens: event.usage ? event.usage.prompt_tokens + event.usage.completion_tokens : undefined,
      }));
    if (event.type === "error") updateLast(() => ({ error: event.message, done: true }));
    if (event.type === "saved") updateLast(() => ({ askId: event.ask_id }));
  }

  // Re-open a past answer from history without calling the LLM again.
  function reopen(record: AskRecord) {
    setTurns((all) => [
      ...all,
      {
        question: record.question,
        answer: record.answer,
        model: record.model_used,
        tokens: (record.prompt_tokens ?? 0) + (record.completion_tokens ?? 0) || undefined,
        done: true,
        askId: record.id,
      },
    ]);
  }

  async function ask(text: string) {
    if (!text.trim() || busy) return;
    setQuestion("");
    setTurns((all) => [...all, { question: text.trim(), answer: "", done: false }]);
    try {
      await askStream(text.trim(), onEvent);
    } catch (err) {
      updateLast(() => ({ error: err instanceof Error ? err.message : "Something went wrong", done: true }));
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <header>
        <h1 className="text-2xl font-semibold">💬 Ask your brain</h1>
        <p className="text-sm text-muted">Describe what&apos;s happening. Your own entries come first.</p>
      </header>

      {turns.length === 0 && (
        <div className="flex flex-col gap-2">
          {EXAMPLES.map((example) => (
            <button key={example} onClick={() => ask(example)} className="card text-left text-sm">
              {example}
            </button>
          ))}
          {history.length > 0 && (
            <>
              <h2 className="mt-4 text-sm font-medium text-muted">Recent questions</h2>
              {history.slice(0, 10).map((record) => (
                <button key={record.id} onClick={() => reopen(record)} className="card text-left text-sm">
                  <span className="line-clamp-1">{record.question}</span>
                  <span className="text-xs text-muted">
                    {new Date(record.created_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {turns.map((turn, i) => (
        <div key={i} className="flex flex-col gap-2">
          <p className="self-end rounded-2xl rounded-br-sm bg-accent px-3 py-2 text-background">
            {turn.question}
          </p>
          <div className="card">
            {turn.answer ? (
              <Markdown text={turn.answer} titles={titles} />
            ) : (
              !turn.error && <p className="animate-pulse text-muted">Thinking…</p>
            )}
            {turn.error && <p className="text-sm text-red-600">{turn.error}</p>}
            {turn.done && !turn.error && (
              <p className="mt-3 border-t border-line pt-2 text-xs text-muted">
                Not medical advice. {turn.model?.replace("openai/", "")}
                {turn.fallback && " (fallback: the main model was busy)"}
                {turn.tokens && ` · ${turn.tokens.toLocaleString()} tokens`}
              </p>
            )}
            {turn.askId && (
              <Link href={`/add?ask=${turn.askId}`} className="btn-secondary mt-3 block text-center text-sm">
                💡 Tried it? Save what worked
              </Link>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        // Sits just above the bottom nav, which grows by the home-indicator inset.
        className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] border-t border-line bg-background/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-md gap-2 px-4 py-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What's happening?"
            className="input"
          />
          <MicButton value={question} onChange={setQuestion} />
          <button type="submit" disabled={busy || question.trim().length < 3} className="btn-primary">
            {busy ? "…" : "Ask"}
          </button>
        </div>
      </form>
    </div>
  );
}
