import { KINDS } from "@/lib/kinds";
import type { EntryKind } from "@/lib/api";

export default function KindBadge({ kind }: { kind: EntryKind }) {
  const { label, icon: Icon, color, bg } = KINDS[kind];
  return (
    <span className="chip shrink-0" style={{ color, background: bg }}>
      <Icon size={12} strokeWidth={2.25} aria-hidden />
      {label}
    </span>
  );
}
