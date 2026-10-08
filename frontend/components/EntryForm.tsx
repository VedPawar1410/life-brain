"use client";

import { useState } from "react";
import { ENTRY_KINDS, type EntryInput, type EntryKind } from "@/lib/api";

// Lists are edited as "one item per line" (to_do / to_avoid) or "comma separated" (tags):
// far easier on a phone keyboard than add/remove buttons per item.
const toLines = (items: string[]) => items.join("\n");
const fromLines = (text: string) => text.split("\n").map((s) => s.trim()).filter(Boolean);
const fromCommas = (text: string) => text.split(",").map((s) => s.trim()).filter(Boolean);

type Props = {
  initial: EntryInput;
  submitLabel: string;
  onSubmit: (data: EntryInput) => Promise<void>;
  onCancel?: () => void;
};

export default function EntryForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState({
    ...initial,
    to_do: toLines(initial.to_do),
    to_avoid: toLines(initial.to_avoid),
    tags: initial.tags.join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Title">
        <input required value={form.title} onChange={set("title")} className="input"
          placeholder="e.g. Getting soaked in the rain" />
      </Field>
      <Field label="Kind">
        <select value={form.kind} onChange={set("kind")} className="input capitalize">
          {ENTRY_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </Field>
      <Field label="Situation" hint="When does this happen / what triggers it?">
        <textarea rows={2} value={form.situation} onChange={set("situation")} className="input" />
      </Field>
      <Field label="What happens" hint="How your body or mind reacts">
        <textarea rows={2} value={form.what_happens} onChange={set("what_happens")} className="input" />
      </Field>
      <Field label="Do" hint="One per line">
        <textarea rows={3} value={form.to_do} onChange={set("to_do")} className="input" />
      </Field>
      <Field label="Avoid" hint="One per line">
        <textarea rows={3} value={form.to_avoid} onChange={set("to_avoid")} className="input" />
      </Field>
      <Field label="Notes">
        <textarea rows={2} value={form.notes} onChange={set("notes")} className="input" />
      </Field>
      <Field label="Tags" hint="Comma separated">
        <input value={form.tags} onChange={set("tags")} className="input" placeholder="rain, cold, throat" />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        )}
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">
        {label} {hint && <span className="font-normal text-muted">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}
