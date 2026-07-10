import { Briefcase, Dumbbell, Heart, Home, MapPin, School } from "lucide-react";

const ICONS = {
  home: Home,
  work: Briefcase,
  fitness_center: Dumbbell,
  gym: Dumbbell,
  school: School,
  favorite: Heart,
} as const;

/** Maps a saved-location icon slug to a lucide icon (Material-symbol names kept from the design). */
export function SavedLocationIcon({ name }: { name: string }) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? MapPin;
  return <Icon className="h-6 w-6" />;
}
