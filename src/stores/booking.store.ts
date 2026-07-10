"use client";

import { create } from "zustand";
import type { LatLng, PaymentMethod } from "@/core/entities";

export interface FareOption {
  rideTypeId: string;
  rideTypeCode: string;
  displayName: string;
  icon: string;
  seats: number;
  currency: string;
  amount: number;
  discount: number;
  surgeMultiplier: number;
  distanceM: number;
  durationS: number;
}

interface BookingState {
  pickup: { address: string; location: LatLng } | null;
  dropoff: { address: string; location: LatLng } | null;
  routePolyline: string | null;
  estimates: FareOption[];
  selectedRideTypeId: string | null;
  paymentMethod: PaymentMethod;
  promoCode: string | null;
  scheduledAt: string | null;

  setPickup: (p: BookingState["pickup"]) => void;
  setDropoff: (d: BookingState["dropoff"]) => void;
  setQuote: (estimates: FareOption[], polyline: string | null) => void;
  selectRideType: (id: string) => void;
  setPaymentMethod: (m: PaymentMethod) => void;
  setPromoCode: (code: string | null) => void;
  setScheduledAt: (iso: string | null) => void;
  reset: () => void;
}

const initial = {
  pickup: null,
  dropoff: null,
  routePolyline: null,
  estimates: [],
  selectedRideTypeId: null,
  paymentMethod: "card" as PaymentMethod,
  promoCode: null,
  scheduledAt: null,
};

/** Booking flow state shared across home → select-ride → confirmation. */
export const useBookingStore = create<BookingState>((set) => ({
  ...initial,
  setPickup: (pickup) => set({ pickup }),
  setDropoff: (dropoff) => set({ dropoff }),
  setQuote: (estimates, routePolyline) =>
    set({
      estimates,
      routePolyline,
      // Preselect the middle (premium) option like the Stitch design.
      selectedRideTypeId: estimates[Math.min(1, estimates.length - 1)]?.rideTypeId ?? null,
    }),
  selectRideType: (selectedRideTypeId) => set({ selectedRideTypeId }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setPromoCode: (promoCode) => set({ promoCode }),
  setScheduledAt: (scheduledAt) => set({ scheduledAt }),
  reset: () => set(initial),
}));
