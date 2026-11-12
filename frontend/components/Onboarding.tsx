import { Brain, CirclePlus, Lightbulb, MessageCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: CirclePlus,
    title: "Capture",
    body: "Tell it something you've learned about your body, in your own words. It turns it into a tidy entry.",
  },
  {
    icon: MessageCircle,
    title: "Ask",
    body: "Describe what's happening. The answer starts with what you already know, then general advice.",
  },
  {
    icon: Lightbulb,
    title: "Grow",
    body: "After you try the advice, save what worked. Your brain gets more personal with every answer.",
  },
];

/** First run: explain the capture → ask → grow loop before asking for the first note. */
export default function Onboarding() {
  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="rounded-2xl bg-accent p-3.5 text-on-accent">
          <Brain size={32} aria-hidden />
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Your second brain</h2>
          <p className="mt-1 text-sm text-muted">
            A private notebook for what works for your body, stored on your own machine.
          </p>
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="card flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Icon size={18} aria-hidden />
            </span>
            <div>
              <h3 className="font-medium">
                <span className="text-muted">{i + 1} · </span>
                {title}
              </h3>
              <p className="mt-0.5 text-sm text-muted">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <Link href="/add" className="btn-primary w-full">
        <CirclePlus size={18} aria-hidden /> Add your first note
      </Link>
      <p className="text-center text-xs text-muted">
        Want to try it with sample data first? Load the{" "}
        <a
          href="https://github.com/VedPawar1410/life-brain#run-locally"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-accent underline underline-offset-2"
        >
          demo brain
        </a>
        .
      </p>
    </div>
  );
}
