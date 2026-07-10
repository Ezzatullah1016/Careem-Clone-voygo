"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Banknote, Calendar, ChevronRight, CreditCard, Loader2, Tag, Wallet as WalletIcon } from "lucide-react";
import type { PaymentMethod } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { useBookingStore, type FareOption } from "@/stores/booking.store";
import { RideMap } from "@/components/map/ride-map";
import { BottomSheet } from "@/components/glass/bottom-sheet";
import { TopBar } from "@/components/glass/top-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDuration } from "@/lib/utils";
import { RideTypeIcon } from "./ride-type-icon";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: typeof CreditCard }[] = [
  { value: "card", label: "Card", icon: CreditCard },
  { value: "wallet", label: "Wallet", icon: WalletIcon },
  { value: "cash", label: "Cash", icon: Banknote },
];

/**
 * Ride selection (voygo_select_ride): fare estimates per ride type,
 * payment method, promo code, optional scheduling, confirm CTA.
 */
export default function BookPage() {
  const router = useRouter();
  const booking = useBookingStore();
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);

  const fetchQuote = useCallback(
    async (promoCode?: string) => {
      if (!booking.pickup || !booking.dropoff) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/fare-estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickup: booking.pickup.location,
            dropoff: booking.dropoff.location,
            promoCode: promoCode || undefined,
          }),
        });
        if (!res.ok) throw new Error("Fare estimation failed");
        const json = await res.json();
        booking.setQuote(json.estimates as FareOption[], json.route.polyline);
        if (promoCode && json.promoApplied) booking.setPromoCode(json.promoApplied);
        else if (promoCode && !json.promoApplied) setError("Promo code is not valid");
      } catch {
        setError("Could not fetch fares. Check your connection and retry.");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [booking.pickup, booking.dropoff]
  );

  useEffect(() => {
    if (!booking.pickup || !booking.dropoff) {
      router.replace("/home");
      return;
    }
    void fetchQuote();
  }, [booking.pickup, booking.dropoff, fetchQuote, router]);

  const selected = booking.estimates.find((e) => e.rideTypeId === booking.selectedRideTypeId);

  async function confirmRide() {
    if (!booking.pickup || !booking.dropoff || !selected) return;
    setConfirming(true);
    setError(null);
    try {
      const { rides, promos } = repos();
      let promoId: string | undefined;
      if (booking.promoCode) {
        promoId = (await promos.findByCode(booking.promoCode))?.id;
      }

      const ride = await rides.create({
        rideTypeId: selected.rideTypeId,
        pickupAddress: booking.pickup.address,
        pickupLocation: booking.pickup.location,
        dropoffAddress: booking.dropoff.address,
        dropoffLocation: booking.dropoff.location,
        paymentMethod: booking.paymentMethod,
        estimatedFare: selected.amount,
        distanceM: selected.distanceM,
        durationS: selected.durationS,
        routePolyline: booking.routePolyline ?? undefined,
        promoId,
        scheduledAt: booking.scheduledAt ?? undefined,
      });

      if (!booking.scheduledAt) {
        // Fire dispatch; tracking page shows matching progress.
        void fetch("/api/rides/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rideId: ride.id }),
        });
      }

      booking.reset();
      router.push(booking.scheduledAt ? "/history" : `/ride/${ride.id}`);
    } catch {
      setError("Could not book the ride. Please try again.");
      setConfirming(false);
    }
  }

  return (
    <>
      <RideMap
        pickup={booking.pickup?.location}
        dropoff={booking.dropoff?.location}
        routePolyline={booking.routePolyline}
      />
      <TopBar
        backHref="/home"
        right={
          selected && (
            <div className="flex flex-col items-end">
              <span className="text-label-sm text-on-surface-variant">Estimated Time</span>
              <span className="text-label-md font-bold text-primary">
                {formatDuration(selected.durationS)}
              </span>
            </div>
          )
        }
      />

      {/* Pickup / destination summary */}
      <div className="fixed left-container-padding right-container-padding top-[90px] z-10 flex flex-col gap-2">
        <LocationRow dotClass="bg-primary-container" label="Pickup" value={booking.pickup?.address ?? ""} />
        <LocationRow dotClass="bg-primary" label="Destination" value={booking.dropoff?.address ?? ""} />
      </div>

      <BottomSheet>
        <div className="flex items-end justify-between">
          <h2 className="text-headline-md text-on-background">Select Ride Type</h2>
          <button
            className="flex items-center gap-1 rounded-lg bg-secondary-container px-2 py-1 text-label-sm"
            onClick={() => setShowSchedule((s) => !s)}
          >
            <Calendar className="h-4 w-4" />
            {booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString() : "Ride now"}
          </button>
        </div>

        {showSchedule && (
          <Input
            type="datetime-local"
            min={new Date(Date.now() + 15 * 60_000).toISOString().slice(0, 16)}
            onChange={(e) =>
              booking.setScheduledAt(e.target.value ? new Date(e.target.value).toISOString() : null)
            }
          />
        )}

        {/* Ride options */}
        <div className="flex max-h-[300px] flex-col gap-3 overflow-y-auto pr-1 no-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-primary">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            booking.estimates.map((option) => {
              const active = option.rideTypeId === booking.selectedRideTypeId;
              return (
                <motion.button
                  key={option.rideTypeId}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => booking.selectRideType(option.rideTypeId)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl border bg-white/40 p-4 text-left backdrop-blur-sm transition-all",
                    active ? "border-2 border-primary-container shadow-glow" : "border-white/60"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container">
                      <RideTypeIcon code={option.rideTypeCode} active={active} />
                    </div>
                    <div>
                      <h3 className="text-label-md text-on-background">{option.displayName}</h3>
                      <p className="text-label-sm text-on-surface-variant">
                        {option.seats} seats
                        {option.surgeMultiplier > 1 && ` • ${option.surgeMultiplier}x surge`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-semibold text-on-background">
                      {formatCurrency(option.amount, option.currency)}
                    </p>
                    {option.discount > 0 && (
                      <p className="text-label-sm text-primary">
                        −{formatCurrency(option.discount, option.currency)} promo
                      </p>
                    )}
                  </div>
                </motion.button>
              );
            })
          )}
        </div>

        {/* Payment + promo row */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-2">
            {PAYMENT_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => booking.setPaymentMethod(value)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-full px-3 py-2 text-label-sm transition-all",
                  booking.paymentMethod === value
                    ? "bg-primary-container text-on-primary-container shadow-glow"
                    : "bg-secondary-container text-on-secondary-container"
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
            <Input
              placeholder="Promo code"
              className="h-11 pl-11 uppercase"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
            />
          </div>
          <Button variant="outline" size="sm" className="h-11" onClick={() => void fetchQuote(promoInput)} disabled={!promoInput || loading}>
            Apply
          </Button>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-error-container px-4 py-2 text-label-sm text-on-error-container">
            {error}
          </p>
        )}

        <Button size="lg" className="w-full" onClick={confirmRide} disabled={!selected || loading || confirming}>
          {confirming ? (
            <Loader2 className="animate-spin" />
          ) : (
            <>
              {booking.scheduledAt ? "Schedule" : "Confirm"} {selected?.displayName ?? "Ride"}
              <ChevronRight />
            </>
          )}
        </Button>
      </BottomSheet>
    </>
  );
}

function LocationRow({ dotClass, label, value }: { dotClass: string; label: string; value: string }) {
  return (
    <div className="glass-panel flex items-center gap-4 rounded-2xl bg-white/70 p-4">
      <div className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} />
      <div className="min-w-0 flex-1">
        <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">{label}</p>
        <p className="truncate text-label-md text-on-background">{value}</p>
      </div>
    </div>
  );
}
