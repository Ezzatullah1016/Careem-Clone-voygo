"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, History as HistoryIcon, Plus } from "lucide-react";
import type { Ride, SavedLocation } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { useAuth } from "@/hooks/use-auth";
import { useBookingStore } from "@/stores/booking.store";
import { RideMap } from "@/components/map/ride-map";
import { PlaceAutocomplete, type PlaceResult } from "@/components/map/place-autocomplete";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SavedLocationIcon } from "./saved-location-icon";

/**
 * Passenger home — "Where to?" glass sheet over the live map,
 * saved-place shortcuts and recent destinations (voygo_home screen).
 */
export default function HomePage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { setPickup, setDropoff, reset } = useBookingStore();
  const [saved, setSaved] = useState<SavedLocation[]>([]);
  const [recent, setRecent] = useState<Ride[]>([]);
  const [position, setPosition] = useState<GeolocationPosition | null>(null);

  useEffect(() => {
    reset();
    navigator.geolocation?.getCurrentPosition(setPosition, () => undefined, {
      enableHighAccuracy: true,
    });
  }, [reset]);

  useEffect(() => {
    if (!user) return;
    const { savedLocations, rides } = repos();
    void savedLocations.listForUser(user.id).then(setSaved).catch(() => undefined);
    void rides
      .historyForPassenger(user.id)
      .then((p) => setRecent(p.items.slice(0, 2)))
      .catch(() => undefined);
    // Resume active ride if one exists.
    void rides
      .activeForUser(user.id)
      .then((ride) => {
        if (ride) router.replace(`/ride/${ride.id}`);
      })
      .catch(() => undefined);
  }, [user, router]);

  const startBooking = useCallback(
    async (destination: PlaceResult) => {
      const coords = position?.coords;
      const pickupLoc = coords
        ? { lat: coords.latitude, lng: coords.longitude }
        : { lat: 48.8566, lng: 2.3522 };

      let pickupAddress = "Current location";
      try {
        const res = await fetch(`/api/geocode?lat=${pickupLoc.lat}&lng=${pickupLoc.lng}`);
        const json = await res.json();
        pickupAddress = json.result?.formattedAddress ?? pickupAddress;
      } catch {
        // Keep the fallback label; booking still works.
      }

      setPickup({ address: pickupAddress, location: pickupLoc });
      setDropoff({ address: destination.address, location: destination.location });
      router.push("/book");
    },
    [position, router, setPickup, setDropoff]
  );

  const firstName = profile?.fullName?.split(" ")[0] ?? "there";
  const greeting = new Date().getHours() < 12 ? "Good Morning," : new Date().getHours() < 18 ? "Good Afternoon," : "Good Evening,";

  return (
    <>
      <RideMap
        center={position ? { lat: position.coords.latitude, lng: position.coords.longitude } : undefined}
        pickup={position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null}
      />

      {/* Top app bar */}
      <header className="fixed left-0 right-0 top-0 z-50 flex h-20 items-center justify-between border-b border-white/40 bg-surface/60 px-container-padding shadow-glass backdrop-blur-glass dark:border-white/10 dark:bg-charcoal/60">
        <div className="flex items-center gap-4">
          <Avatar>
            <AvatarImage src={profile?.avatarUrl ?? undefined} alt={profile?.fullName ?? "Profile"} />
            <AvatarFallback>{firstName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-label-sm leading-none text-on-surface-variant">{greeting}</p>
            <h1 className="text-headline-md font-bold text-primary">{firstName}</h1>
          </div>
        </div>
        <button
          className="glass-panel flex h-12 w-12 items-center justify-center rounded-full text-primary transition-colors hover:bg-white/10 active:scale-95"
          aria-label="Notifications"
          onClick={() => router.push("/profile")}
        >
          <Bell className="h-5 w-5" />
        </button>
      </header>

      <main className="pointer-events-none relative z-20 flex h-dvh flex-col justify-end">
        {/* Saved-place shortcuts */}
        <div className="pointer-events-auto flex gap-6 px-container-padding pb-6">
          {saved.map((loc) => (
            <button
              key={loc.id}
              className="flex flex-col items-center gap-1"
              onClick={() => startBooking({ address: loc.address, location: loc.location })}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-lg transition-transform hover:scale-105 active:scale-90">
                <SavedLocationIcon name={loc.icon} />
              </span>
              <span className="rounded-full bg-white/40 px-2 text-label-sm font-bold backdrop-blur-sm">
                {loc.label}
              </span>
            </button>
          ))}
          <button
            className="flex flex-col items-center gap-1"
            onClick={() => router.push("/locations")}
          >
            <span className="glass-panel flex h-14 w-14 items-center justify-center rounded-full text-primary transition-transform hover:scale-105 active:scale-90">
              <Plus className="h-6 w-6" />
            </span>
            <span className="rounded-full bg-white/40 px-2 text-label-sm font-bold backdrop-blur-sm">Add</span>
          </button>
        </div>

        {/* "Where to?" sheet */}
        <div className="pointer-events-auto px-container-padding pb-[100px]">
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", damping: 26, stiffness: 260 }}
            className="glass-panel flex flex-col gap-6 rounded-card bg-white/60 p-6"
          >
            <div className="grab-handle" />
            <h2 className="text-headline-md text-on-surface">Where to?</h2>
            <PlaceAutocomplete onSelect={startBooking} />

            {recent.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {recent.map((ride) => (
                  <button
                    key={ride.id}
                    className="flex items-center gap-4 rounded-2xl p-4 text-left transition-colors hover:bg-black/5"
                    onClick={() =>
                      startBooking({ address: ride.dropoffAddress, location: ride.dropoffLocation })
                    }
                  >
                    <HistoryIcon className="h-5 w-5 shrink-0 text-secondary" />
                    <div className="min-w-0">
                      <p className="truncate text-label-md text-on-surface">
                        {ride.dropoffAddress.split(",")[0]}
                      </p>
                      <p className="truncate text-[10px] text-on-secondary-container">
                        {ride.dropoffAddress}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </>
  );
}
