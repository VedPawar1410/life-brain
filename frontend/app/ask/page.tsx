"use client";

import { ArrowUp, ArrowUpRight, Check, Copy, Lightbulb, RotateCcw, RotateCcwClock } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import HistorySheet from "@/components/HistorySheet";
import Markdown, { toPlainText, type CitedEntries } from "@/components/Markdown";
import MicButton from "@/components/MicButton";
import PageHeader from "@/components/ui/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
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
  "Is it fine to eat curd at 9pm?",
  "I can't fall asleep tonight",
];

export default function AskPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [entries, setEntries] = useState<CitedEntries>({});
  const [history, setHistory] = useState<AskRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = turns.length > 0 && !turns[turns.length - 1].done;

  // Entry titles and kinds turn [#id] citations into readable chips.
  useEffect(() => {
    api.listEntries()
      .then((list) => setEntries(Object.fromEntries(list.map((e) => [e.id, { title: e.title, kind: e.kind }]))))
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
  const reopen = useCallback((record: AskRecord) => {
    setHistoryOpen(false);
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
  }, []);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);

  async function ask(text: string) {
    if (!text.trim() || busy) return;
    setQuestion("");
    setTurns((all) => [...all, { question: text.trim(), answer: "", done: false }]);
    try {
      await askStream(text.trim(), onEvent);
    } catch {
      updateLast(() => ({ error: "Couldn't reach the backend.", done: true }));
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-24">
      <PageHeader
        title="Ask your brain"
        subtitle="Describe what's happening. Your own entries come first."
        action={
          history.length > 0 && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="btn-icon gap-1.5 px-3 py-2 text-sm"
              aria-label={`Recent questions (${history.length})`}
            >
              <RotateCcwClock size={16} aria-hidden /> {history.length}
            </button>
          )
        }
      />

      {turns.length === 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted">Try asking</h2>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              onClick={() => ask(example)}
              className="card flex items-center gap-3 text-left text-sm transition-colors active:bg-surface-2"
            >
              <span className="flex-1">{example}</span>
              <ArrowUpRight size={16} className="shrink-0 text-subtle" aria-hidden />
            </button>
          ))}
        </section>
      )}

      {turns.map((turn, i) => (
        <div key={i} className="flex flex-col gap-2">
          <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-on-accent">
            {turn.question}
          </p>
          <article className="card">
            {turn.answer ? (
              <Markdown text={turn.answer} entries={entries} />
            ) : (
              !turn.error && (
                <div className="flex flex-col gap-2" aria-live="polite">
                  <p className="text-sm font-medium text-accent">Checking your brain…</p>
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-5/6" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
              )
            )}

            {turn.error && (
              <div role="alert" className="flex flex-col items-start gap-2">
                <p className="text-sm text-danger">{turn.error} Try again in a moment.</p>
                <button onClick={() => ask(turn.question)} disabled={busy} className="btn-secondary text-sm">
                  <RotateCcw size={16} aria-hidden /> Try again
                </button>
              </div>
            )}

            {turn.done && !turn.error && (
              <footer className="mt-4 border-t border-line pt-3">
                <div className="flex gap-2">
                  {turn.askId && (
                    <Link href={`/add?ask=${turn.askId}`} className="btn-secondary flex-1 py-2 text-sm">
                      <Lightbulb size={16} aria-hidden /> Save what worked
                    </Link>
                  )}
                  <CopyButton text={toPlainText(turn.answer, entries)} />
                </div>
                <p className="mt-2.5 text-xs text-muted">
                  Not medical advice · {turn.model?.replace("openai/", "")}
                  {turn.fallback && " (fallback)"}
                  {turn.tokens && ` · ${turn.tokens.toLocaleString()} tokens`}
                </p>
              </footer>
            )}
          </article>
        </div>
      ))}
      <div ref={bottomRef} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        // Sits just above the bottom nav, which grows by the home-indicator inset.
        className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] border-t border-line bg-background/90 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-2">
          {/* Messaging-app composer: input and mic in one pill, round send button. */}
          <div className="flex min-w-0 flex-1 items-center rounded-full border border-line bg-card pr-1 pl-4 focus-within:border-accent">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What's happening?"
              aria-label="Your question"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none placeholder:text-subtle"
            />
            <MicButton value={question} onChange={setQuestion} className="!rounded-full !border-0 !bg-transparent" />
          </div>
          <button
            type="submit"
            disabled={busy || question.trim().length < 3}
            aria-label="Ask"
            className="btn-primary size-11 shrink-0 !rounded-full !p-0"
          >
            <ArrowUp size={20} aria-hidden />
          </button>
        </div>
      </form>

      <HistorySheet open={historyOpen} onClose={closeHistory} items={history} onPick={reopen} />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    // Clipboard access can be refused (permissions, unfocused page, older browsers): say so.
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 1800);
  }
  return (
    <button type="button" onClick={copy} className="btn-secondary py-2 text-sm" aria-live="polite">
      {state === "copied" ? <Check size={16} className="text-accent" aria-hidden /> : <Copy size={16} aria-hidden />}
      {state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : "Copy"}
    </button>
  );
}
