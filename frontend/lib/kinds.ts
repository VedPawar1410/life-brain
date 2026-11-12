import { Heart, Info, Leaf, Repeat, TriangleExclamationPoint, type LucideIcon } from "lucide-react";
import type { EntryKind } from "@/lib/api";

// One place that decides how each kind of entry looks. Colours are CSS tokens (globals.css),
// so they switch with light/dark mode.
export const KINDS: Record<EntryKind, { label: string; icon: LucideIcon; color: string; bg: string }> = {
  issue: { label: "Issue", icon: TriangleExclamationPoint, color: "var(--kind-issue)", bg: "var(--kind-issue-bg)" },
  remedy: { label: "Remedy", icon: Leaf, color: "var(--kind-remedy)", bg: "var(--kind-remedy-bg)" },
  routine: { label: "Routine", icon: Repeat, color: "var(--kind-routine)", bg: "var(--kind-routine-bg)" },
  preference: { label: "Preference", icon: Heart, color: "var(--kind-preference)", bg: "var(--kind-preference-bg)" },
  fact: { label: "Fact", icon: Info, color: "var(--kind-fact)", bg: "var(--kind-fact-bg)" },
};
