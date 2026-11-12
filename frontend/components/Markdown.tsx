import {
  BookMarked, CalendarClock, Info, ListChecks, Siren, Stethoscope, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import type { EntryKind } from "@/lib/api";
import { KINDS } from "@/lib/kinds";

// A deliberately tiny renderer for the exact format our Ask prompt requests:
// "## headings", "- bullets", "- [ ] checklist items", **bold** and [#id] entry citations.
// We control the format, so this beats pulling in a full markdown library.

export type CitedEntries = Record<number, { title: string; kind: EntryKind }>;
type Props = { text: string; entries: CitedEntries };

// Each section the prompt asks for gets an icon, so an answer can be scanned by shape.
const SECTIONS: Record<string, { icon: LucideIcon; danger?: boolean }> = {
  "from your brain": { icon: BookMarked },
  "general guidance": { icon: Info },
  "do now": { icon: ListChecks },
  "next time": { icon: CalendarClock },
  "see a doctor if": { icon: Stethoscope, danger: true },
};

// The prompt puts emergencies first, as a bold line naming emergency services.
const EMERGENCY = /emergenc|911|112|ambulance/i;

export default function Markdown({ text, entries }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {text.split("\n").map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return null;

        if (line.startsWith("## ")) {
          const title = line.slice(3).trim();
          const section = SECTIONS[title.toLowerCase()];
          const Icon = section?.icon;
          return (
            <h3
              key={i}
              className={`mt-4 flex items-center gap-1.5 text-sm font-semibold first:mt-0 ${section?.danger ? "text-danger" : "text-accent"}`}
            >
              {Icon && <Icon size={16} aria-hidden />}
              {title}
            </h3>
          );
        }

        const bold = line.match(/^\*\*(.+)\*\*$/);
        if (bold && EMERGENCY.test(bold[1]))
          return (
            <p key={i} role="alert" className="flex gap-2 rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">
              <Siren size={18} className="mt-0.5 shrink-0" aria-hidden />
              <span>{bold[1]}</span>
            </p>
          );

        const check = line.match(/^\s*- \[[ x]\] (.*)/);
        if (check)
          return (
            <label key={i} className="flex cursor-pointer items-start gap-2.5 py-0.5">
              <input type="checkbox" className="mt-1 size-4 shrink-0 accent-[var(--accent)]" />
              <span><Inline text={check[1]} entries={entries} /></span>
            </label>
          );

        const bullet = line.match(/^\s*[-*] (.*)/);
        if (bullet)
          return (
            <p key={i} className="flex gap-2">
              <span className="text-subtle" aria-hidden>•</span>
              <span><Inline text={bullet[1]} entries={entries} /></span>
            </p>
          );

        return <p key={i}><Inline text={line} entries={entries} /></p>;
      })}
    </div>
  );
}

function Inline({ text, entries }: Props) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|\[#\d+\])/g).map((part, i) => {
        const bold = part.match(/^\*\*(.+)\*\*$/);
        if (bold) return <strong key={i} className="font-semibold">{bold[1]}</strong>;
        const cite = part.match(/^\[#(\d+)\]$/);
        if (cite) {
          const id = Number(cite[1]);
          const entry = entries[id];
          // The cited entry's kind icon, the same one it has in the Brain list.
          const Icon = entry ? KINDS[entry.kind].icon : BookMarked;
          return (
            <Link key={i} href={`/entries/${id}`} className="chip mx-0.5 align-middle !bg-accent-soft !text-accent-ink no-underline">
              <Icon size={12} aria-hidden /> {entry?.title ?? `Entry ${id}`}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

/** Plain text for the clipboard: citations become entry titles, markdown symbols go. */
export function toPlainText(text: string, entries: CitedEntries): string {
  return text
    .replace(/\[#(\d+)\]/g, (_, id) => (entries[Number(id)] ? `(${entries[Number(id)].title})` : ""))
    .replace(/^## /gm, "")
    .replace(/^\s*- \[[ x]\] /gm, "- ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .trim();
}
