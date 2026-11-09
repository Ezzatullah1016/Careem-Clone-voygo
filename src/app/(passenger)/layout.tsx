"use client";

import { usePathname } from "next/navigation";
import { History, Home, User, Wallet } from "lucide-react";
import { MapProvider } from "@/components/map/map-provider";
import { BottomNav } from "@/components/glass/bottom-nav";

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/history", label: "History", icon: History },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/profile", label: "Profile", icon: User },
];

/**
 * Full-screen flows (select ride, live trip) own the bottom of the screen with
 * their sheet + primary CTA and have their own back button, so the tab bar
 * is hidden there — matching the Stitch select-ride/tracking screens.
 */
const FLOW_ROUTES = ["/book", "/ride/"];

export default function PassengerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inFlow = FLOW_ROUTES.some((route) => pathname === route || pathname.startsWith(route));

  return (
    <MapProvider>
      {children}
      {!inFlow && <BottomNav items={NAV_ITEMS} />}
    </MapProvider>
  );
}
