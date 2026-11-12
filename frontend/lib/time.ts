const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600], ["month", 30 * 24 * 3600], ["week", 7 * 24 * 3600],
  ["day", 24 * 3600], ["hour", 3600], ["minute", 60],
];

/** "2 days ago", "yesterday", "just now". */
export function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
