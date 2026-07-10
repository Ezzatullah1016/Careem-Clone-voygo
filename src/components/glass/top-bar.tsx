"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title?: React.ReactNode;
  backHref?: string;
  right?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** Fixed glass app bar with backdrop blur and light-catching bottom edge. */
export function TopBar({ title = "Voygo", backHref, right, className, children }: TopBarProps) {
  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-50 flex h-[72px] items-center justify-between border-b border-white/40 bg-surface/60 px-container-padding shadow-glass backdrop-blur-glass dark:border-white/10 dark:bg-charcoal/60",
        className
      )}
    >
      <div className="flex items-center gap-4">
        {backHref && (
          <Link
            href={backHref}
            className="flex h-10 w-10 items-center justify-center rounded-full text-primary transition-colors hover:bg-white/10 active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        {typeof title === "string" ? (
          <h1 className="text-headline-lg-mobile font-bold text-primary">{title}</h1>
        ) : (
          title
        )}
      </div>
      {children}
      {right && <div className="flex items-center gap-4">{right}</div>}
    </header>
  );
}
