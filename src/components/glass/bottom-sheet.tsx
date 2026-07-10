"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Glassmorphic bottom sheet — the primary interaction hub per DESIGN.md.
 * Slides over the map; the map stays visible through the glass.
 */
export function BottomSheet({ open = true, children, className }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.section
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-gutter pb-safe sm:px-0"
        >
          <div
            className={cn(
              "glass-sheet flex w-full max-w-[600px] flex-col gap-4 rounded-t-card p-6",
              className
            )}
          >
            <div className="grab-handle" />
            {children}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
