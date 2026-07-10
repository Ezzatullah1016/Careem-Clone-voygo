"use client";

import { History, Home, User, Wallet } from "lucide-react";
import { MapProvider } from "@/components/map/map-provider";
import { BottomNav } from "@/components/glass/bottom-nav";

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/history", label: "History", icon: History },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/profile", label: "Profile", icon: User },
];

export default function PassengerLayout({ children }: { children: React.ReactNode }) {
  return (
    <MapProvider>
      {children}
      <BottomNav items={NAV_ITEMS} />
    </MapProvider>
  );
}
