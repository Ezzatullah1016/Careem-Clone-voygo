import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-label-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary-container/15 text-primary",
        secondary: "bg-secondary-container text-on-secondary-container",
        success: "bg-primary-container text-on-primary-container",
        destructive: "bg-error-container text-on-error-container",
        warning: "bg-tertiary-container/40 text-on-tertiary-container",
        outline: "border border-outline-variant text-on-surface-variant",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
