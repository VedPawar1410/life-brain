import type { ReactNode } from "react";

type Props = { title: string; subtitle?: ReactNode; action?: ReactNode };

/** The title block at the top of every screen, with an optional action on the right. */
export default function PageHeader({ title, subtitle, action }: Props) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.625rem] font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
