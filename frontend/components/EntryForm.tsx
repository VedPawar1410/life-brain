"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ENTRY_KINDS, type EntryInput, type EntryKind } from "@/lib/api";
import { KINDS } from "@/lib/kinds";

// Lists are edited as "one item per line" (to_do / to_avoid) or "comma separated" (tags):
// far easier on a phone keyboard than add/remove buttons per item.
const toLines = (items: string[]) => items.join("\n");
const fromLines = (text: string) => text.split("\n").map((s) => s.trim()).filter(Boolean);
const fromCommas = (text: string) => text.split(",").map((s) => s.trim()).filter(Boolean);

/** Enough rows to show all the text: merged entries can be long, and hidden text can't be reviewed.
 *  Estimates wrapped lines at ~34 characters per line (a phone-width field). */
const rowsFor = (text: string, min: number) =>
  Math.min(12, Math.max(min, text.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 34)), 0)));

type Props = {
  initial: EntryInput;
  submitLabel: string;
  onSubmit: (data: EntryInput) => Promise<void>;
  onCancel?: () => void;
  cancelLabel?: string;
  /** Optional second action that also receives the edited values, e.g. "Merge into existing". */
  secondary?: { label: string; onSubmit: (data: EntryInput) => Promise<void> };
};

export default function EntryForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  cancelLabel = "Cancel",
  secondary,
}: Props) {
  const [form, setForm] = useState({
    ...initial,
    to_do: toLines(initial.to_do),
    to_avoid: toLines(initial.to_avoid),
    tags: initial.tags.join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm({ ...form, [field]: e.target.value });

  // Shared by the main submit and the optional secondary action.
  async function run(action: (data: EntryInput) => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await action({
        ...form,
        kind: form.kind as EntryKind,
        to_do: fromLines(form.to_do),
        to_avoid: fromLines(form.to_avoid),
        tags: fromCommas(form.tags),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(onSubmit);
      }}
      className="flex flex-col gap-3"
    >
      {/* Grouped like the entry detail page, so a draft reads like the entry it becomes. */}
      <Group>
        <Field label="Title">
          <input required value={form.title} onChange={set("title")} className="input"
            placeholder="Getting soaked in the rain" />
        </Field>
        <Field label="Kind">
          <KindPicker value={form.kind as EntryKind} onChange={(kind) => setForm({ ...form, kind })} />
        </Field>
      </Group>

      <Group>
        <Field label="When" hint="What triggers it">
          <textarea rows={rowsFor(form.situation, 2)} value={form.situation} onChange={set("situation")} className="input"
            placeholder="Coming home wet from the rain" />
        </Field>
        <Field label="What happens" hint="How your body or mind reacts">
          <textarea rows={rowsFor(form.what_happens, 2)} value={form.what_happens} onChange={set("what_happens")} className="input"
            placeholder="Sore throat the next day" />
        </Field>
      </Group>

      <Group>
        <Field label="Do" hint="One per line" icon={<CircleCheck size={14} className="text-accent" aria-hidden />}>
          <textarea rows={rowsFor(form.to_do, 3)} value={form.to_do} onChange={set("to_do")} className="input"
            placeholder={"Hot shower straight away\nDry hair fully"} />
        </Field>
        <Field label="Avoid" hint="One per line" icon={<CircleX size={14} className="text-danger" aria-hidden />}>
          <textarea rows={rowsFor(form.to_avoid, 2)} value={form.to_avoid} onChange={set("to_avoid")} className="input"
            placeholder="Sitting in wet clothes" />
        </Field>
      </Group>

      <Group>
        <Field label="Notes">
          <textarea rows={rowsFor(form.notes, 2)} value={form.notes} onChange={set("notes")} className="input" />
        </Field>
        <Field label="Tags" hint="Comma separated">
          <input value={form.tags} onChange={set("tags")} className="input" placeholder="rain, cold, throat" />
        </Field>
      </Group>

      {error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="mt-1 flex flex-col gap-2">
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? "Saving…" : submitLabel}
        </button>
        {(secondary || onCancel) && (
          <div className="flex gap-2">
            {secondary && (
              <button type="button" disabled={saving} onClick={() => run(secondary.onSubmit)}
                className="btn-secondary flex-1">
                {secondary.label}
              </button>
            )}
            {onCancel && (
              <button type="button" onClick={onCancel} className="btn-secondary flex-1">{cancelLabel}</button>
            )}
          </div>
        )}
      </div>
    </form>
  );
}

/** Five tappable pills instead of a dropdown: one tap on a phone, and the same colours as the badges. */
function KindPicker({ value, onChange }: { value: EntryKind; onChange: (kind: EntryKind) => void }) {
  return (
    <div role="radiogroup" aria-label="Kind" className="flex flex-wrap gap-1.5">
      {ENTRY_KINDS.map((kind) => {
        const { label, icon: Icon, color, bg } = KINDS[kind];
        const selected = value === kind;
        return (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(kind)}
            className={`chip border py-1.5 ${selected ? "border-transparent" : "border-line !bg-card"}`}
            style={selected ? { color, background: bg } : undefined}
          >
            <Icon size={14} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <div className="card flex flex-col gap-4">{children}</div>;
}

function Field({ label, hint, icon, children }: { label: string; hint?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex flex-col">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {label}
        </span>
        {/* Hints get their own line, so long labels never wrap beside them. */}
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
