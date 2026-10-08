// Thin typed wrapper around the FastAPI backend. Every network call lives here.

// Default: same-origin "/api", proxied to FastAPI by next.config.ts rewrites.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export const ENTRY_KINDS = ["issue", "remedy", "routine", "preference", "fact"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export type EntryInput = {
  title: string;
  kind: EntryKind;
  situation: string;
  what_happens: string;
  to_do: string[];
  to_avoid: string[];
  notes: string;
  tags: string[];
  source_text: string;
};

export type Entry = EntryInput & {
  id: number;
  created_at: string;
  updated_at: string;
};

export type CaptureDraft = Omit<EntryInput, "source_text"> & {
  possible_duplicate_id: number | null;
  duplicate_reason: string | null;
};

export type AskRecord = {
  id: number;
  question: string;
  answer: string;
  model_used: string;
  entry_ids_used: number[];
  prompt_tokens: number | null;
  completion_tokens: number | null;
  created_at: string;
};

export const emptyEntry: EntryInput = {
  title: "",
  kind: "issue",
  situation: "",
  what_happens: "",
  to_do: [],
  to_avoid: [],
  notes: "",
  tags: [],
  source_text: "",
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ? JSON.stringify(body.detail) : `Request failed (${res.status})`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  listEntries: () => request<Entry[]>("/entries"),
  getEntry: (id: number) => request<Entry>(`/entries/${id}`),
  createEntry: (data: EntryInput) =>
    request<Entry>("/entries", { method: "POST", body: JSON.stringify(data) }),
  updateEntry: (id: number, data: Partial<EntryInput>) =>
    request<Entry>(`/entries/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteEntry: (id: number) => request<void>(`/entries/${id}`, { method: "DELETE" }),
  /** The combined entry, NOT saved: the user tidies it, then saves with updateEntry. */
  previewMerge: (id: number, data: EntryInput) =>
    request<Entry>(`/entries/${id}/merge?preview=true`, { method: "POST", body: JSON.stringify(data) }),
  capture: (text: string, askId?: number) =>
    request<CaptureDraft>("/capture", { method: "POST", body: JSON.stringify({ text, ask_id: askId }) }),
  listAsks: () => request<AskRecord[]>("/asks"),
  getAsk: (id: number) => request<AskRecord>(`/asks/${id}`),
};

// --- Ask: streamed as NDJSON (one JSON event per line) ---------------------------------

export type AskEvent =
  | { type: "entries"; ids: number[] }
  | { type: "meta"; model: string; fallback: boolean }
  | { type: "delta"; text: string }
  | { type: "done"; usage: { prompt_tokens: number; completion_tokens: number } | null }
  | { type: "error"; message: string }
  | { type: "saved"; ask_id: number };

export async function askStream(question: string, onEvent: (event: AskEvent) => void) {
  const res = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);

  // Network chunks don't line up with events, so buffer until we have whole lines.
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // last piece may be incomplete
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
  }
}
