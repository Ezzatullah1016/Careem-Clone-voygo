"use client";

import { APIProvider } from "@vis.gl/react-google-maps";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/** True once a real (non-placeholder) Maps key is configured. */
export const mapsConfigured = Boolean(KEY && KEY.startsWith("AIza"));

/**
 * Loads the Google Maps JS SDK once for any subtree containing maps.
 * Without a valid key, renders children bare so the rest of the app
 * still works (maps show a styled placeholder instead).
 */
export function MapProvider({ children }: { children: React.ReactNode }) {
  if (!mapsConfigured) return <>{children}</>;
  return (
    <APIProvider apiKey={KEY!} libraries={["places", "geometry", "marker"]}>
      {children}
    </APIProvider>
  );
}
