import { CircleCheck, CircleX, Quote } from "lucide-react";
import type { ReactNode } from "react";
import KindBadge from "@/components/ui/KindBadge";
import type { Entry } from "@/lib/api";
import { timeAgo } from "@/lib/time";

export default function EntryView({ entry }: { entry: Entry }) {
  const hasContext = entry.situation || entry.what_happens;

  return (
    <article className="flex flex-col gap-4">
      <header>
        <KindBadge kind={entry.kind} />
        <h1 className="mt-2 text-[1.625rem] leading-tight font-semibold tracking-tight">{entry.title}</h1>
        <p className="mt-1 text-xs text-muted">Updated {timeAgo(entry.updated_at)}</p>
      </header>

      {hasContext && (
        <div className="card flex flex-col gap-3">
          <Field label="When" text={entry.situation} />
          <Field label="What happens" text={entry.what_happens} />
        </div>
      )}

      <List
        title="Do"
        items={entry.to_do}
        icon={<CircleCheck size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />}
      />
      <List
        title="Avoid"
        items={entry.to_avoid}
        icon={<CircleX size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden />}
      />

      {entry.notes && (
        <div className="card">
          <Field label="Notes" text={entry.notes} />
        </div>
      )}

      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.tags.map((t) => <span key={t} className="chip">#{t}</span>)}
        </div>
      )}

      {entry.source_text && (
        <details className="group rounded-xl text-sm text-muted">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium">
            <Quote size={14} aria-hidden /> Your original words
          </summary>
          <p className="mt-2 border-l-2 border-line pl-3 whitespace-pre-wrap">{entry.source_text}</p>
        </details>
      )}
    </article>
  );
}

function Field({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <section>
      <h2 className="text-xs font-medium tracking-wide text-muted uppercase">{label}</h2>
      <p className="mt-0.5 whitespace-pre-wrap">{text}</p>
    </section>
  );
}

function List({ title, icon, items }: { title: string; icon: ReactNode; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="card">
      <h2 className="text-xs font-medium tracking-wide text-muted uppercase">{title}</h2>
      {/* Each item carries its own icon, so Do and Avoid stay distinct at a glance. */}
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            {icon}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
