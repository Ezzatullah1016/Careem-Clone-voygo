import * as React from "react";
import { cn } from "@/lib/utils";

/** Rounded input per design system: 20px radius, emerald focus ring. */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-2xl border-none bg-surface-container-lowest px-4 py-3 text-body-md text-on-surface transition-all",
        "placeholder:text-on-secondary-container focus:outline-none focus:ring-2 focus:ring-primary-container",
        "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10 dark:text-white",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
