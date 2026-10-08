import Link from "next/link";
import { Fragment } from "react";

// A deliberately tiny renderer for the exact format our Ask prompt requests:
// "## headings", "- bullets", "- [ ] checklist items", **bold** and [#id] entry citations.
// We control the format, so this beats pulling in a full markdown library.

type Props = { text: string; titles: Record<number, string> };

export default function Markdown({ text, titles }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {text.split("\n").map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return null;
        if (line.startsWith("## "))
          return <h3 key={i} className="mt-3 text-sm font-semibold uppercase tracking-wide text-accent first:mt-0">{line.slice(3)}</h3>;
        const check = line.match(/^\s*- \[[ x]\] (.*)/);
        if (check)
          return (
            <label key={i} className="flex items-start gap-2">
              <input type="checkbox" className="mt-1.5 accent-[var(--accent)]" />
              <span><Inline text={check[1]} titles={titles} /></span>
            </label>
          );
        const bullet = line.match(/^\s*[-*] (.*)/);
        if (bullet)
          return (
            <p key={i} className="flex gap-2">
              <span className="text-muted">•</span>
              <span><Inline text={bullet[1]} titles={titles} /></span>
            </p>
          );
        return <p key={i}><Inline text={line} titles={titles} /></p>;
      })}
    </div>
  );
}

function Inline({ text, titles }: Props) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|\[#\d+\])/g).map((part, i) => {
        const bold = part.match(/^\*\*(.+)\*\*$/);
        if (bold) return <strong key={i}>{bold[1]}</strong>;
        const cite = part.match(/^\[#(\d+)\]$/);
        if (cite) {
          const id = Number(cite[1]);
          return (
            <Link key={i} href={`/entries/${id}`} className="chip mx-0.5 align-middle no-underline">
              🧠 {titles[id] ?? `#${id}`}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
