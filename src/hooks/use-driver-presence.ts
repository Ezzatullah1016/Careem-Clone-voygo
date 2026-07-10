"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { repos } from "@/infrastructure/repositories";

const LOCATION_INTERVAL_MS = 10_000;

/**
 * Driver availability + heartbeat. While online, streams geolocation to
 * driver_profiles (dispatch feed); while on an active ride, also appends
 * ride_locations breadcrumbs for the passenger's live map.
 */
export function useDriverPresence(driverId: string | undefined, activeRideId?: string | null) {
  const [online, setOnlineState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastPushRef = useRef(0);

  const stopWatch = useCallback(() => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  const startWatch = useCallback(() => {
    if (!driverId || watchRef.current != null) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastPushRef.current < LOCATION_INTERVAL_MS) return;
        lastPushRef.current = now;

        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const heading = pos.coords.heading ?? undefined;
        const { drivers, rides } = repos();
        void drivers.updateLocation(driverId, loc).catch(() => undefined);
        if (activeRideId) {
          void rides
            .pushDriverLocation(activeRideId, driverId, loc, heading, pos.coords.speed ?? undefined)
            .catch(() => undefined);
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }, [driverId, activeRideId]);

  const setOnline = useCallback(
    async (next: boolean) => {
      if (!driverId) return;
      setError(null);
      try {
        await repos().drivers.setOnline(driverId, next);
        setOnlineState(next);
        if (next) startWatch();
        else stopWatch();
      } catch {
        setError("Could not update availability");
      }
    },
    [driverId, startWatch, stopWatch]
  );

  // Load initial state; keep watching while an active ride exists.
  useEffect(() => {
    if (!driverId) return;
    void repos()
      .drivers.getById(driverId)
      .then((d) => {
        if (d?.isOnline) {
          setOnlineState(true);
          startWatch();
        }
      });
    return stopWatch;
  }, [driverId, startWatch, stopWatch]);

  return { online, setOnline, error };
}
