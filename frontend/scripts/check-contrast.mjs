// Checks every text-on-background pair in app/globals.css against WCAG AA, in both modes.
// Run: node scripts/check-contrast.mjs
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const block = (start) => css.slice(css.indexOf(start), css.indexOf("}", css.indexOf(start)));
const tokens = (text) => Object.fromEntries([...text.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const modes = { light: tokens(block(":root {")), dark: tokens(block("@media (prefers-color-scheme: dark)")) };

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [text token, background token, minimum ratio]. 4.5 = body text, 3 = large text / icons.
const PAIRS = [
  ["foreground", "background", 4.5], ["foreground", "card", 4.5],
  ["muted", "background", 4.5], ["muted", "card", 4.5], ["muted", "surface-2", 4.5],
  ["subtle", "card", 3], ["accent", "card", 4.5], ["accent", "background", 4.5],
  ["on-accent", "accent", 4.5], ["accent-ink", "accent-soft", 4.5], ["danger", "card", 4.5],
  ["danger", "danger-soft", 4.5],
  ...["issue", "remedy", "routine", "preference", "fact"].map((k) => [`kind-${k}`, `kind-${k}-bg`, 4.5]),
];

let failed = 0;
for (const [mode, t] of Object.entries(modes)) {
  for (const [fg, bg, min] of PAIRS) {
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`${ok ? "✓" : "✗"} ${mode.padEnd(5)} ${fg} on ${bg}: ${r.toFixed(2)} (need ${min})`);
  }
}
process.exit(failed ? 1 : 0);
