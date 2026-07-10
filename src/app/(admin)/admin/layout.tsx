"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  BarChart3,
  CarFront,
  CreditCard,
  FileText,
  LifeBuoy,
  Map as MapIcon,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { MapProvider } from "@/components/map/map-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Analytics", icon: BarChart3 },
  { href: "/admin/live-map", label: "Live Map", icon: MapIcon },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/drivers", label: "Drivers", icon: ShieldCheck },
  { href: "/admin/vehicles", label: "Vehicles", icon: CarFront },
  { href: "/admin/pricing", label: "Pricing", icon: BadgeDollarSign },
  { href: "/admin/coupons", label: "Coupons", icon: Ticket },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
];

/** Admin shell: glass sidebar on desktop, scrollable top rail on mobile. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <MapProvider>
      <div className="flex min-h-dvh bg-gradient-to-br from-background to-primary-container/5">
        {/* Sidebar (desktop) */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col gap-1 border-r border-white/40 bg-surface/70 p-4 backdrop-blur-glass lg:flex">
          <Link href="/admin" className="mb-6 px-3 text-headline-md font-bold text-primary">
            Voygo Admin
          </Link>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-full px-4 py-2.5 text-label-md transition-all",
                  active
                    ? "bg-primary-container text-on-primary-container shadow-glow"
                    : "text-on-surface-variant hover:bg-black/5"
                )}
              >
                <Icon className="h-5 w-5" /> {label}
              </Link>
            );
          })}
        </aside>

        {/* Mobile top rail */}
        <nav className="fixed left-0 right-0 top-0 z-40 flex gap-2 overflow-x-auto border-b border-white/40 bg-surface/80 p-3 backdrop-blur-glass no-scrollbar lg:hidden">
          {NAV.map(({ href, label }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "whitespace-nowrap rounded-full px-4 py-1.5 text-label-sm",
                  active ? "bg-primary-container text-on-primary-container" : "bg-white/50 text-on-surface-variant"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="w-full pt-16 lg:pl-60 lg:pt-0">
          <div className="mx-auto max-w-[1200px] p-container-padding lg:p-8">{children}</div>
        </div>
      </div>
    </MapProvider>
  );
}
