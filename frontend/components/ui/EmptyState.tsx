import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = { icon: LucideIcon; title: string; body?: ReactNode; action?: ReactNode; tone?: "neutral" | "danger" };

/** Empty, no-results and error screens: an icon, a headline, one line and one action. */
export default function EmptyState({ icon: Icon, title, body, action, tone = "neutral" }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className={`rounded-2xl p-3 ${tone === "danger" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent"}`}>
        <Icon size={24} aria-hidden />
      </span>
      <div>
        <h2 className="font-semibold">{title}</h2>
        {body && <p className="mt-1 text-sm text-muted">{body}</p>}
      </div>
      {action}
    </div>
  );
}
