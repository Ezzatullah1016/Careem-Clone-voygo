"use client";

import { useEffect, useState } from "react";
import type { LatLng, Ride } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";

/**
 * Live ride state: subscribes to ride status changes and driver
 * location breadcrumbs over Supabase Realtime.
 */
export function useLiveRide(rideId: string) {
  const [ride, setRide] = useState<Ride | null>(null);
  const [driverLocation, setDriverLocation] = useState<(LatLng & { heading?: number }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { rides } = repos();
    let cancelled = false;

    void rides.getById(rideId).then((r) => {
      if (!cancelled) {
        setRide(r);
        setDriverLocation(r?.driver?.currentLocation ?? null);
        setLoading(false);
      }
    });

    const offRide = rides.onRideChange(rideId, setRide);
    const offLoc = rides.onDriverLocation(rideId, setDriverLocation);

    return () => {
      cancelled = true;
      offRide();
      offLoc();
    };
  }, [rideId]);

  return { ride, driverLocation, loading };
}
