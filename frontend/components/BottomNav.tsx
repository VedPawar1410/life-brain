"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Brain", icon: "🧠" },
  { href: "/add", label: "Add", icon: "➕" },
  { href: "/ask", label: "Ask", icon: "💬" },
];

export default function BottomNav() {
  const pathname = usePathname();
  // Entry detail pages live under "/" conceptually, so keep "Brain" highlighted there.
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/entries") : pathname.startsWith(href);

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => (
          <li key={tab.href} className="flex-1">
            <Link
              href={tab.href}
              className={`flex flex-col items-center py-2 text-xs ${
                isActive(tab.href) ? "text-accent font-semibold" : "text-muted"
              }`}
            >
              <span className="text-xl" aria-hidden>{tab.icon}</span>
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
