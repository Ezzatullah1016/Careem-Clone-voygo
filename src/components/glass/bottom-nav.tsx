"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Fixed glass bottom navigation — thumb-zone pattern from the Stitch design. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 z-50 flex h-[88px] w-full items-center justify-around rounded-t-sheet border-t border-white/40 bg-surface/75 px-4 pb-safe shadow-glass-top backdrop-blur-glass dark:border-white/10 dark:bg-charcoal/75">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "group flex flex-col items-center justify-center gap-1 transition-all",
              active ? "font-bold text-primary" : "text-secondary hover:text-on-surface"
            )}
          >
            <Icon
              className={cn("h-6 w-6 transition-transform group-active:scale-90", active && "fill-current")}
              strokeWidth={active ? 2.5 : 2}
            />
            <span className="text-label-sm">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
