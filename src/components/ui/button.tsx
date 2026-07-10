import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-label-md font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container disabled:pointer-events-none disabled:opacity-50 active:scale-95 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Emerald pill with glow — the primary CTA per the design system.
        default: "rounded-full bg-primary-container text-on-primary-container shadow-glow hover:scale-[1.02]",
        outline: "rounded-full border-2 border-primary-container text-primary hover:bg-primary-container/5",
        secondary: "rounded-full bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80",
        ghost: "rounded-full hover:bg-black/5 dark:hover:bg-white/10",
        destructive: "rounded-full bg-error text-on-error shadow-lg hover:scale-[1.02]",
        glass: "rounded-full glass-panel text-on-surface hover:bg-white/80 dark:hover:bg-white/10",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-6",
        sm: "h-9 px-4 text-label-sm",
        lg: "h-14 px-8",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
