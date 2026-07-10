"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronRight, MapPin } from "lucide-react";
import type { Ride } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { useAuth } from "@/hooks/use-auth";
import { TopBar } from "@/components/glass/top-bar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "destructive" | "secondary" | "warning" }> = {
  completed: { label: "Completed", variant: "success" },
  scheduled: { label: "Scheduled", variant: "warning" },
  cancelled_by_passenger: { label: "Cancelled", variant: "destructive" },
  cancelled_by_driver: { label: "Cancelled", variant: "destructive" },
  no_drivers_found: { label: "No drivers", variant: "secondary" },
};

/** Ride history with status badges; active rides link back into tracking. */
export default function HistoryPage() {
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void repos()
      .rides.historyForPassenger(user.id)
      .then((page) => {
        setRides(page.items);
        setLoading(false);
      });
  }, [user]);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-background to-primary-container/5 pb-[110px] pt-[90px]">
      <TopBar title="Ride History" backHref="/home" />

      <div className="mx-auto flex max-w-[600px] flex-col gap-4 px-container-padding">
        {loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}

        {!loading && rides.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-body-md text-on-surface-variant">
              No rides yet — book your first Voygo!
            </CardContent>
          </Card>
        )}

        {rides.map((ride) => {
          const badge = STATUS_BADGE[ride.status] ?? { label: "In progress", variant: "secondary" as const };
          const active = ["requested", "accepted", "arriving", "in_progress"].includes(ride.status);
          return (
            <Link key={ride.id} href={active ? `/ride/${ride.id}` : "#"} className={active ? "" : "pointer-events-none"}>
              <Card className="transition-transform hover:scale-[1.01]">
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                      <CalendarClock className="h-4 w-4" />
                      {new Date(ride.scheduledAt ?? ride.requestedAt).toLocaleString()}
                    </span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-1.5 flex flex-col items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-primary-container" />
                      <span className="h-6 w-px bg-outline-variant" />
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label-md text-on-surface">{ride.pickupAddress}</p>
                      <p className="mt-3 truncate text-label-md text-on-surface">{ride.dropoffAddress}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="text-body-lg font-semibold text-on-surface">
                        {formatCurrency(ride.finalFare ?? ride.estimatedFare ?? 0, ride.currency)}
                      </p>
                      {active && <ChevronRight className="h-5 w-5 text-primary" />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
