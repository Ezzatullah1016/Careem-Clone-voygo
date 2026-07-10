import "server-only";
import type { LatLng } from "@/core/entities";
import type { RoutingGateway } from "@/core/repositories";

/**
 * Google Maps routing gateway (server-side).
 * Uses the Routes API for directions/ETA and the Geocoding API for addresses.
 * The browser never sees the server key; clients call our API routes instead.
 */
export class GoogleRoutingGateway implements RoutingGateway {
  private readonly key = process.env.GOOGLE_MAPS_SERVER_API_KEY!;

  async route(origin: LatLng, destination: LatLng) {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.key,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
      // Route geometry changes with traffic; don't cache.
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Routes API error: ${res.status} ${await res.text()}`);
    const json = await res.json();
    const route = json.routes?.[0];
    if (!route) throw new Error("No route found");
    return {
      distanceM: route.distanceMeters as number,
      durationS: parseInt(String(route.duration).replace("s", ""), 10),
      polyline: route.polyline?.encodedPolyline as string,
    };
  }

  async etaSeconds(origin: LatLng, destination: LatLng): Promise<number> {
    const { durationS } = await this.route(origin, destination);
    return durationS;
  }

  async geocode(address: string) {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", this.key);
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(`Geocoding error: ${res.status}`);
    const json = await res.json();
    const result = json.results?.[0];
    if (!result) return null;
    return {
      location: { lat: result.geometry.location.lat, lng: result.geometry.location.lng },
      formattedAddress: result.formatted_address as string,
    };
  }

  async reverseGeocode(location: LatLng): Promise<string | null> {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${location.lat},${location.lng}`);
    url.searchParams.set("key", this.key);
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(`Reverse geocoding error: ${res.status}`);
    const json = await res.json();
    return json.results?.[0]?.formatted_address ?? null;
  }
}

export const routingGateway = new GoogleRoutingGateway();
