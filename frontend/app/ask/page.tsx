"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "@/components/Markdown";
import { api, askStream, type AskEvent } from "@/lib/api";

type Turn = {
  question: string;
  answer: string;
  model?: string;
  fallback?: boolean;
  tokens?: number;
  error?: string;
  done: boolean;
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = turns.length > 0 && !turns[turns.length - 1].done;

  // Entry titles turn [#id] citations into readable chips.
  useEffect(() => {
    api.listEntries()
      .then((entries) => setTitles(Object.fromEntries(entries.map((e) => [e.id, e.title]))))
      .catch(() => {});
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
                {turn.fallback && " (lighter fallback model: main model was rate-limited)"}
                {turn.tokens && ` · ${turn.tokens.toLocaleString()} tokens`}
              </p>
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
        className="fixed inset-x-0 bottom-16 border-t border-line bg-background/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-md gap-2 px-4 py-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What's happening?"
            className="input"
          />
          <button type="submit" disabled={busy || question.trim().length < 3} className="btn-primary">
            {busy ? "…" : "Ask"}
          </button>
        </div>
      </form>
    </div>
  );
}
