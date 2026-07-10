"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Loader2,
  MessageCircle,
  Phone,
  ShieldAlert,
  Star,
  XCircle,
} from "lucide-react";
import type { RideStatus } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { useLiveRide } from "@/hooks/use-live-ride";
import { RideMap } from "@/components/map/ride-map";
import { BottomSheet } from "@/components/glass/bottom-sheet";
import { TopBar } from "@/components/glass/top-bar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDistance, formatDuration } from "@/lib/utils";

const STATUS_HEADLINE: Record<RideStatus, string> = {
  requested: "Finding your driver…",
  scheduled: "Ride scheduled",
  accepted: "Driver assigned",
  arriving: "Driver arriving",
  in_progress: "On the way",
  completed: "Trip complete",
  cancelled_by_passenger: "Ride cancelled",
  cancelled_by_driver: "Driver cancelled",
  no_drivers_found: "No drivers available",
};

/**
 * Live tracking (voygo_tracking_driver): map with moving car marker,
 * driver glass card, call/message actions, SOS, cancel, rating on completion.
 */
export default function RideTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { ride, driverLocation, loading } = useLiveRide(id);
  const [cancelling, setCancelling] = useState(false);
  const [stars, setStars] = useState(0);
  const [ratingSent, setRatingSent] = useState(false);

  const etaLabel = useMemo(() => {
    if (!ride?.durationS) return null;
    return formatDuration(ride.durationS);
  }, [ride?.durationS]);

  async function cancelRide() {
    if (!ride || !confirm("Cancel this ride?")) return;
    setCancelling(true);
    try {
      await repos().rides.updateStatus(ride.id, "cancelled_by_passenger");
      router.replace("/home");
    } finally {
      setCancelling(false);
    }
  }

  async function submitRating() {
    if (!ride?.driverId || stars === 0) return;
    await repos().ratings.rate({ rideId: ride.id, rateeId: ride.driverId, stars });
    setRatingSent(true);
    setTimeout(() => router.replace("/home"), 1200);
  }

  if (loading || !ride) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const driverProfile = ride.driver?.profile;
  const searching = ride.status === "requested";
  const finished = ride.status === "completed";

  return (
    <>
      <RideMap
        pickup={ride.pickupLocation}
        dropoff={ride.dropoffLocation}
        driver={driverLocation}
        routePolyline={ride.routePolyline}
      />

      <TopBar
        backHref="/home"
        right={
          <button
            className="flex items-center gap-1 rounded-full bg-error px-4 py-1.5 text-label-md text-on-error shadow-lg transition-all hover:scale-105 active:scale-95"
            onClick={() => alert("Emergency alert dispatched. Stay calm — help is on the way.")}
          >
            <ShieldAlert className="h-4 w-4" /> SOS
          </button>
        }
      />

      <BottomSheet>
        {/* Status + ETA */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-label-md uppercase tracking-wider text-primary">
              {STATUS_HEADLINE[ride.status]}
            </span>
            {etaLabel && !finished && (
              <span className="text-headline-lg-mobile text-on-background">{etaLabel}</span>
            )}
          </div>
          {ride.distanceM && (
            <div className="text-right">
              <span className="text-label-md uppercase tracking-wider text-secondary">Distance</span>
              <p className="text-body-lg font-semibold text-on-background">
                {formatDistance(ride.distanceM)}
              </p>
            </div>
          )}
        </div>

        {searching && (
          <div className="flex items-center gap-4 rounded-2xl border border-white/50 bg-white/40 p-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
            >
              <Loader2 className="h-6 w-6 text-primary" />
            </motion.div>
            <p className="text-body-md text-on-surface-variant">
              Contacting nearby drivers — this usually takes under a minute.
            </p>
          </div>
        )}

        {ride.status === "no_drivers_found" && (
          <div className="flex flex-col gap-3">
            <p className="text-body-md text-on-surface-variant">
              No drivers were available nearby. Try again in a few minutes.
            </p>
            <Button onClick={() => router.replace("/home")}>Back to home</Button>
          </div>
        )}

        {/* Driver card */}
        {driverProfile && !finished && (
          <div className="flex items-center gap-4 rounded-2xl border border-white/50 bg-white/40 p-4">
            <div className="relative">
              <Avatar className="h-16 w-16 border-primary-container">
                <AvatarImage src={driverProfile.avatarUrl ?? undefined} alt={driverProfile.fullName ?? "Driver"} />
                <AvatarFallback>{driverProfile.fullName?.charAt(0) ?? "D"}</AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded-full border border-black/5 bg-white px-1.5 py-0.5 text-[10px] font-bold shadow-sm">
                <Star className="h-3 w-3 fill-[#FFB300] text-[#FFB300]" />
                {driverProfile.rating.toFixed(1)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="truncate text-headline-md leading-tight text-on-background">
                  {driverProfile.fullName}
                </h2>
                {ride.vehicle && <Badge variant="secondary">{ride.vehicle.plateNumber}</Badge>}
              </div>
              {ride.vehicle && (
                <p className="mt-1 flex items-center gap-1 text-body-md text-on-surface-variant">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  {ride.vehicle.make} {ride.vehicle.model} · {ride.vehicle.color}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Call / message */}
        {driverProfile && !finished && !searching && (
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" asChild>
              <a href={driverProfile.phone ? `tel:${driverProfile.phone}` : "#"}>
                <Phone /> Call
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={driverProfile.phone ? `sms:${driverProfile.phone}` : "#"}>
                <MessageCircle /> Message
              </a>
            </Button>
          </div>
        )}

        {/* Completion: fare + rating */}
        {finished && (
          <div className="flex flex-col items-center gap-4">
            {ride.finalFare != null && (
              <p className="text-headline-lg text-on-background">
                {formatCurrency(ride.finalFare, ride.currency)}
              </p>
            )}
            {!ratingSent ? (
              <>
                <p className="text-body-md text-on-surface-variant">How was your trip?</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setStars(n)} aria-label={`${n} stars`}>
                      <Star
                        className={
                          n <= stars
                            ? "h-9 w-9 fill-[#FFB300] text-[#FFB300]"
                            : "h-9 w-9 text-secondary"
                        }
                      />
                    </button>
                  ))}
                </div>
                <Button className="w-full" onClick={submitRating} disabled={stars === 0}>
                  Submit rating
                </Button>
              </>
            ) : (
              <p className="text-body-md text-primary">Thanks for your feedback!</p>
            )}
          </div>
        )}

        {/* Cancel */}
        {["requested", "accepted", "arriving", "scheduled"].includes(ride.status) && (
          <div className="flex justify-center border-t border-on-surface/5 pt-4">
            <button
              onClick={cancelRide}
              disabled={cancelling}
              className="flex items-center gap-1 text-label-md text-secondary transition-colors hover:text-error active:scale-95"
            >
              <XCircle className="h-5 w-5" /> Cancel Trip
            </button>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
