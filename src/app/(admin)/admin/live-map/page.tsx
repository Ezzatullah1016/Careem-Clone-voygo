"use client";

import { useEffect, useState } from "react";
import { AdvancedMarker, Map } from "@vis.gl/react-google-maps";
import { Car } from "lucide-react";
import { createClient } from "@/infrastructure/supabase/client";
import { parseGeo } from "@/infrastructure/supabase/mappers";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface FleetDriver {
  id: string;
  name: string;
  lat: number;
  lng: number;
  onTrip: boolean;
}

const REFRESH_MS = 10_000;

/** Live fleet map: every online driver, refreshed on an interval. */
export default function LiveMapPage() {
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [activeTrips, setActiveTrips] = useState(0);

  useEffect(() => {
    const db = createClient();

    async function load() {
      const [{ data: dp }, { data: trips }] = await Promise.all([
        db
          .from("driver_profiles")
          .select("id, current_location, profiles(full_name)")
          .eq("is_online", true)
          .not("current_location", "is", null),
        db
          .from("rides")
          .select("driver_id")
          .in("status", ["accepted", "arriving", "in_progress"]),
      ]);

      const busy = new Set((trips ?? []).map((t) => t.driver_id));
      setActiveTrips(busy.size);
      setDrivers(
        (dp ?? []).flatMap((row) => {
          const loc = parseGeo(row.current_location);
          if (!loc) return [];
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const name = (row.profiles as any)?.full_name ?? "Driver";
          return [{ id: row.id, name, ...loc, onTrip: busy.has(row.id) }];
        })
      );
    }

    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-headline-lg text-on-surface">Live Fleet Activity</h1>
        <div className="flex gap-2">
          <Badge>{drivers.length} online</Badge>
          <Badge variant="warning">{activeTrips} on trip</Badge>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="h-[70vh] p-0">
          <Map
            defaultCenter={{ lat: drivers[0]?.lat ?? 48.8566, lng: drivers[0]?.lng ?? 2.3522 }}
            defaultZoom={12}
            mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
            gestureHandling="greedy"
            className="h-full w-full"
          >
            {drivers.map((d) => (
              <AdvancedMarker key={d.id} position={{ lat: d.lat, lng: d.lng }} title={d.name}>
                <div
                  className={
                    d.onTrip
                      ? "rounded-full bg-tertiary-container p-2 shadow-lg"
                      : "rounded-full bg-primary-container p-2 shadow-glow"
                  }
                >
                  <Car className="h-4 w-4 text-white" />
                </div>
              </AdvancedMarker>
            ))}
          </Map>
        </CardContent>
      </Card>
    </div>
  );
}
