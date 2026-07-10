"use client";

import { CircleDollarSign, History, LayoutDashboard, Wallet } from "lucide-react";
import { MapProvider } from "@/components/map/map-provider";
import { BottomNav } from "@/components/glass/bottom-nav";

const NAV_ITEMS = [
  { href: "/driver", label: "Dashboard", icon: LayoutDashboard },
  { href: "/driver/earnings", label: "Earnings", icon: CircleDollarSign },
  { href: "/driver/history", label: "History", icon: History },
  { href: "/driver/wallet", label: "Wallet", icon: Wallet },
];

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <MapProvider>
      {children}
      <BottomNav items={NAV_ITEMS} />
    </MapProvider>
  );
}
