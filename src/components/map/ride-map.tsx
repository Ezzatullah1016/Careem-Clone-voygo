"use client";

import { useEffect, useMemo } from "react";
import { AdvancedMarker, Map, useMap } from "@vis.gl/react-google-maps";
import { motion } from "framer-motion";
import { Car } from "lucide-react";
import type { LatLng } from "@/core/entities";
import { decodePolyline } from "@/infrastructure/maps/polyline";
import { mapsConfigured } from "@/components/map/map-provider";

interface RideMapProps {
  center?: LatLng;
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  driver?: (LatLng & { heading?: number }) | null;
  routePolyline?: string | null;
  className?: string;
}

const DEFAULT_CENTER: LatLng = { lat: 48.8566, lng: 2.3522 };

/**
 * Full-bleed base-layer map (Level 1 in the elevation model).
 * Emerald route line, teardrop destination pin, pulsing current-location
 * marker and live driver marker — matching the Stitch screens.
 */
export function RideMap({ center, pickup, dropoff, driver, routePolyline, className }: RideMapProps) {
  if (!mapsConfigured) {
    return (
      <div
        className={
          (className ?? "fixed inset-0 z-0 h-full w-full") +
          " flex items-center justify-center bg-gradient-to-br from-surface-container to-primary-container/10"
        }
      >
        <p className="rounded-full bg-white/60 px-4 py-2 text-label-sm text-on-surface-variant backdrop-blur-sm">
          Map unavailable — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </p>
      </div>
    );
  }
  return (
    <div className={className ?? "fixed inset-0 z-0 h-full w-full"}>
      <Map
        defaultCenter={center ?? pickup ?? DEFAULT_CENTER}
        defaultZoom={14}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
        disableDefaultUI
        gestureHandling="greedy"
        className="h-full w-full"
      >
        {pickup && (
          <AdvancedMarker position={pickup} title="Pickup">
            {/* White circle, emerald stroke, glow pulse — "current location" pin */}
            <div className="h-6 w-6 animate-pulse-glow rounded-full border-[3px] border-primary-container bg-white" />
          </AdvancedMarker>
        )}
        {dropoff && (
          <AdvancedMarker position={dropoff} title="Destination">
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-container shadow-glow">
                <div className="h-2.5 w-2.5 rounded-full bg-white" />
              </div>
              <div className="h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-primary-container" />
            </div>
          </AdvancedMarker>
        )}
        {driver && (
          <AdvancedMarker position={driver} title="Driver">
            <motion.div
              layout
              transition={{ type: "tween", duration: 1.5, ease: "linear" }}
              className="rounded-full border border-primary/20 bg-white p-1 shadow-xl"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container">
                <Car className="h-5 w-5 text-on-primary-container" />
              </div>
            </motion.div>
          </AdvancedMarker>
        )}
        {routePolyline && <RoutePolyline encoded={routePolyline} />}
        <FitBounds pickup={pickup} dropoff={dropoff} />
      </Map>
    </div>
  );
}

/** Draws the encoded route as an emerald polyline with soft glow. */
function RoutePolyline({ encoded }: { encoded: string }) {
  const map = useMap();
  const path = useMemo(() => decodePolyline(encoded), [encoded]);

  useEffect(() => {
    if (!map || path.length === 0) return;
    const line = new google.maps.Polyline({
      path,
      strokeColor: "#00c853",
      strokeOpacity: 0.9,
      strokeWeight: 6,
      map,
    });
    return () => line.setMap(null);
  }, [map, path]);

  return null;
}

/** Keeps both endpoints in view whenever they change. */
function FitBounds({ pickup, dropoff }: { pickup?: LatLng | null; dropoff?: LatLng | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !pickup || !dropoff) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(pickup);
    bounds.extend(dropoff);
    map.fitBounds(bounds, { top: 100, bottom: 320, left: 40, right: 40 });
  }, [map, pickup, dropoff]);

  return null;
}
