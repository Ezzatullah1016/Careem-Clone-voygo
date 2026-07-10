"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCheck, Loader2, MapPin, Navigation, Power, Star, TrendingUp } from "lucide-react";
import type { Ride, RideOffer, Vehicle } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { useAuth } from "@/hooks/use-auth";
import { useDriverPresence } from "@/hooks/use-driver-presence";
import { TopBar } from "@/components/glass/top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCurrency, formatDistance, formatDuration } from "@/lib/utils";

/**
 * Driver dashboard (voygo_driver_dashboard): today's earnings, rating,
 * acceptance rate, giant Go Online toggle, incoming offer cards and
 * the active-ride control strip.
 */
export default function DriverDashboardPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [offers, setOffers] = useState<RideOffer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [acceptance, setAcceptance] = useState(100);
  const [busy, setBusy] = useState(false);
  const { online, setOnline, error } = useDriverPresence(user?.id, activeRide?.id);

  const activeVehicle = useMemo(() => vehicles.find((v) => v.isActive && v.status === "approved"), [vehicles]);

  const refreshActive = useCallback(async () => {
    if (!user) return;
    const ride = await repos().rides.activeForUser(user.id);
    setActiveRide(ride && ride.driverId === user.id ? ride : null);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const { offers: offerRepo, vehicles: vehicleRepo, drivers, wallets } = repos();

    void refreshActive();
    void vehicleRepo.listByDriver(user.id).then(setVehicles);
    void drivers.getById(user.id).then((d) => d && setAcceptance(d.acceptanceRate));
    void offerRepo.pendingForDriver(user.id).then(setOffers);
    void wallets.transactions(user.id).then((page) => {
      const today = new Date().toDateString();
      setTodayEarnings(
        page.items
          .filter((tx) => tx.type === "ride_earning" && new Date(tx.createdAt).toDateString() === today)
          .reduce((sum, tx) => sum + tx.amount, 0)
      );
    });

    return offerRepo.onNewOffer(user.id, (offer) =>
      setOffers((prev) => (prev.some((o) => o.id === offer.id) ? prev : [...prev, offer]))
    );
  }, [user, refreshActive]);

  async function acceptOffer(offer: RideOffer) {
    if (!activeVehicle) {
      alert("No approved active vehicle on your account.");
      return;
    }
    setBusy(true);
    try {
      const ride = await repos().offers.accept(offer.rideId, activeVehicle.id);
      setOffers([]);
      setActiveRide(ride);
    } catch {
      // Another driver won the race.
      setOffers((prev) => prev.filter((o) => o.id !== offer.id));
    } finally {
      setBusy(false);
    }
  }

  async function rejectOffer(offer: RideOffer) {
    setOffers((prev) => prev.filter((o) => o.id !== offer.id));
    await repos().offers.reject(offer.id).catch(() => undefined);
  }

  async function advanceRide() {
    if (!activeRide) return;
    setBusy(true);
    try {
      if (activeRide.status === "accepted") {
        setActiveRide(await repos().rides.updateStatus(activeRide.id, "arriving"));
      } else if (activeRide.status === "arriving") {
        setActiveRide(await repos().rides.updateStatus(activeRide.id, "in_progress"));
      } else if (activeRide.status === "in_progress") {
        const res = await fetch("/api/rides/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rideId: activeRide.id }),
        });
        if (res.ok) {
          setActiveRide(null);
          router.push("/driver/earnings");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const advanceLabel =
    activeRide?.status === "accepted"
      ? "I'm heading to pickup"
      : activeRide?.status === "arriving"
        ? "Start trip"
        : "Complete trip";

  return (
    <main className="min-h-dvh bg-gradient-to-b from-background to-primary-container/10 pb-[110px] pt-[90px]">
      <TopBar title="Voygo Driver" />

      <div className="mx-auto flex max-w-[600px] flex-col gap-6 px-container-padding">
        {/* Earnings glass card */}
        <Card>
          <CardContent className="p-6">
            <span className="text-label-md uppercase tracking-widest text-secondary">
              Today&apos;s Earnings
            </span>
            <p className="mt-1 text-display-lg text-on-surface">{formatCurrency(todayEarnings)}</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 rounded-2xl bg-white/40 p-3">
                <Star className="h-5 w-5 fill-[#FFB300] text-[#FFB300]" />
                <div>
                  <p className="text-headline-md leading-none">{profile?.rating.toFixed(2) ?? "5.00"}</p>
                  <p className="text-label-sm text-on-surface-variant">Rating</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white/40 p-3">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-headline-md leading-none">{Math.round(acceptance)}%</p>
                  <p className="text-label-sm text-on-surface-variant">Acceptance</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Go Online toggle */}
        {!activeRide && (
          <div className="flex flex-col items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setOnline(!online)}
              className={cn(
                "flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-full text-headline-md font-bold uppercase tracking-tight transition-all",
                online
                  ? "bg-error text-white shadow-[0_12px_40px_rgba(186,26,26,0.3)]"
                  : "bg-primary-container text-on-primary-container shadow-[0_12px_40px_rgba(0,200,83,0.3)] animate-pulse-glow"
              )}
            >
              <Power className="h-10 w-10" />
              {online ? "Go Offline" : "Go Online"}
            </motion.button>
            <p className="text-label-md text-on-surface-variant">
              {online ? "Online and ready for rides" : "You're offline"}
            </p>
            {error && <p className="text-label-sm text-error">{error}</p>}
          </div>
        )}

        {/* Incoming offers */}
        <AnimatePresence>
          {offers.map((offer) => (
            <motion.div
              key={offer.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card className="border-2 border-primary-container">
                <CardContent className="flex flex-col gap-4 p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-headline-md text-on-surface">New ride request</h3>
                    {offer.ride?.estimatedFare != null && (
                      <p className="text-headline-md text-primary">
                        {formatCurrency(offer.ride.estimatedFare, offer.ride.currency)}
                      </p>
                    )}
                  </div>
                  {offer.ride && (
                    <div className="flex flex-col gap-1 text-label-md text-on-surface-variant">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary-container" />
                        {offer.ride.pickupAddress}
                      </span>
                      <span className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        {offer.ride.dropoffAddress}
                      </span>
                      {offer.ride.distanceM && (
                        <span className="text-label-sm">
                          {formatDistance(offer.ride.distanceM)} ·{" "}
                          {offer.ride.durationS ? formatDuration(offer.ride.durationS) : ""}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="secondary" onClick={() => rejectOffer(offer)} disabled={busy}>
                      Decline
                    </Button>
                    <Button onClick={() => acceptOffer(offer)} disabled={busy}>
                      {busy ? <Loader2 className="animate-spin" /> : "Accept"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Active ride controls */}
        {activeRide && (
          <Card className="border-2 border-primary-container">
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-headline-md capitalize text-on-surface">
                  {activeRide.status.replace("_", " ")}
                </h3>
                {activeRide.estimatedFare != null && (
                  <p className="text-headline-md text-primary">
                    {formatCurrency(activeRide.estimatedFare, activeRide.currency)}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1 text-label-md text-on-surface-variant">
                <span>{activeRide.pickupAddress}</span>
                <span className="text-primary">→ {activeRide.dropoffAddress}</span>
              </div>
              <Button
                variant="outline"
                asChild
              >
                {/* Hand off turn-by-turn to Google Maps navigation. */}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${
                    activeRide.status === "in_progress"
                      ? `${activeRide.dropoffLocation.lat},${activeRide.dropoffLocation.lng}`
                      : `${activeRide.pickupLocation.lat},${activeRide.pickupLocation.lng}`
                  }&travelmode=driving`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation /> Navigate
                </a>
              </Button>
              <Button onClick={advanceRide} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <><CheckCheck /> {advanceLabel}</>}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
