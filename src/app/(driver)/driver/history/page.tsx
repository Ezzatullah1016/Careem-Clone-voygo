"use client";

import { useEffect, useState } from "react";
import { CalendarClock, MapPin } from "lucide-react";
import type { Ride } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { useAuth } from "@/hooks/use-auth";
import { TopBar } from "@/components/glass/top-bar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

/** Driver trip history with per-trip earnings. */
export default function DriverHistoryPage() {
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void repos()
      .rides.historyForDriver(user.id)
      .then((page) => {
        setRides(page.items);
        setLoading(false);
      });
  }, [user]);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-background to-primary-container/5 pb-[110px] pt-[90px]">
      <TopBar title="Trip History" backHref="/driver" />

      <div className="mx-auto flex max-w-[600px] flex-col gap-4 px-container-padding">
        {loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        {!loading && rides.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-body-md text-on-surface-variant">
              No trips yet.
            </CardContent>
          </Card>
        )}
        {rides.map((ride) => (
          <Card key={ride.id}>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                  <CalendarClock className="h-4 w-4" />
                  {new Date(ride.requestedAt).toLocaleString()}
                </span>
                <Badge variant={ride.status === "completed" ? "success" : "destructive"}>
                  {ride.status.replaceAll("_", " ")}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <p className="min-w-0 flex-1 truncate text-label-md text-on-surface">
                  {ride.pickupAddress.split(",")[0]} → {ride.dropoffAddress.split(",")[0]}
                </p>
                <p className="text-body-lg font-semibold text-primary">
                  {ride.driverEarnings != null ? `+${formatCurrency(ride.driverEarnings)}` : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
