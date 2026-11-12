import { CircleCheck, CircleX } from "lucide-react";
import type { ReactNode } from "react";
import KindBadge from "@/components/ui/KindBadge";
import type { Entry } from "@/lib/api";

export default function EntryView({ entry }: { entry: Entry }) {
  return (
    <article className="flex flex-col gap-4">
      <div>
        <KindBadge kind={entry.kind} />
        <h1 className="mt-2 text-[1.625rem] font-semibold tracking-tight">{entry.title}</h1>
      </div>
      <Section title="Situation" text={entry.situation} />
      <Section title="What happens" text={entry.what_happens} />
      <List title="Do" icon={<CircleCheck size={16} className="text-accent" aria-hidden />} items={entry.to_do} />
      <List title="Avoid" icon={<CircleX size={16} className="text-danger" aria-hidden />} items={entry.to_avoid} />
      <Section title="Notes" text={entry.notes} />
      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.tags.map((t) => <span key={t} className="chip">#{t}</span>)}
        </div>
      )}
      {entry.source_text && (
        <details className="text-sm text-muted">
          <summary className="cursor-pointer">Your original words</summary>
          <p className="mt-1 whitespace-pre-wrap">{entry.source_text}</p>
        </details>
      )}
    </article>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <section>
      <h2 className="text-sm font-medium text-muted">{title}</h2>
      <p className="mt-0.5 whitespace-pre-wrap">{text}</p>
    </section>
  );
}

function List({ title, icon, items }: { title: string; icon: ReactNode; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted">{icon}{title}</h2>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </section>
  );
}
