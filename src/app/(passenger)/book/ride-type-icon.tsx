import { Bus, Car } from "lucide-react";
import { cn } from "@/lib/utils";

/** Icon per ride type code, filled when the card is selected. */
export function RideTypeIcon({ code, active }: { code: string; active?: boolean }) {
  const Icon = code === "xl" ? Bus : Car;
  return (
    <Icon
      className={cn("h-8 w-8", active ? "fill-primary-container/30 text-on-background" : "text-secondary")}
      strokeWidth={active ? 2.5 : 2}
    />
  );
}
