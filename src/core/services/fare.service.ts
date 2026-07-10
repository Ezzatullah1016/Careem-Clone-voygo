/**
 * Fare engine — pure functions, no I/O. Unit-testable in isolation.
 */

import type { PricingRule, PromoCode } from "@/core/entities";

export interface FareBreakdown {
  base: number;
  distanceCharge: number;
  timeCharge: number;
  bookingFee: number;
  subtotal: number;
  surgeMultiplier: number;
  discount: number;
  total: number;
  currency: string;
}

/** Estimate a fare from a pricing rule and route metrics. */
export function calculateFare(
  rule: PricingRule,
  distanceM: number,
  durationS: number,
  promo?: PromoCode | null
): FareBreakdown {
  const distanceCharge = (distanceM / 1000) * rule.perKm;
  const timeCharge = (durationS / 60) * rule.perMinute;

  let subtotal = (rule.baseFare + distanceCharge + timeCharge) * rule.surgeMultiplier;
  subtotal = Math.max(subtotal, rule.minimumFare);
  subtotal += rule.bookingFee;

  const discount = promo ? promoDiscount(promo, subtotal) : 0;
  const total = round2(Math.max(subtotal - discount, 0));

  return {
    base: round2(rule.baseFare),
    distanceCharge: round2(distanceCharge),
    timeCharge: round2(timeCharge),
    bookingFee: round2(rule.bookingFee),
    subtotal: round2(subtotal),
    surgeMultiplier: rule.surgeMultiplier,
    discount: round2(discount),
    total,
    currency: rule.currency,
  };
}

/** Discount a promo grants on a given fare. 0 when below min fare. */
export function promoDiscount(promo: PromoCode, fare: number): number {
  if (fare < promo.minFare) return 0;
  let discount = 0;
  if (promo.discountPct != null) discount = fare * (promo.discountPct / 100);
  else if (promo.discountAmount != null) discount = promo.discountAmount;
  if (promo.maxDiscount != null) discount = Math.min(discount, promo.maxDiscount);
  return Math.min(round2(discount), fare);
}

/** Validity check independent of redemption counts (those need the DB). */
export function isPromoWindowValid(promo: PromoCode, now = new Date()): boolean {
  if (!promo.isActive) return false;
  if (new Date(promo.validFrom) > now) return false;
  if (promo.validUntil && new Date(promo.validUntil) <= now) return false;
  return true;
}

/** Split a captured fare between driver and platform. */
export function splitEarnings(finalFare: number, commissionPct: number) {
  const platformFee = round2(finalFare * (commissionPct / 100));
  return { platformFee, driverEarnings: round2(finalFare - platformFee) };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
