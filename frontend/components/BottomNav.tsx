"use client";

import { Brain, CirclePlus, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Brain", icon: Brain },
  { href: "/add", label: "Add", icon: CirclePlus },
  { href: "/ask", label: "Ask", icon: MessageCircle },
];

export default function BottomNav() {
  const pathname = usePathname();
  // Entry detail pages live under "/" conceptually, so keep "Brain" highlighted there.
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/entries") : pathname.startsWith(href);

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-background/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                {/* A soft pill behind the active icon marks the current tab. */}
                <span className={`rounded-full px-4 py-1 transition-colors ${active ? "bg-accent-soft" : ""}`}>
                  <Icon size={22} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
