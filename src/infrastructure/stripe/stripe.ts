import "server-only";
import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

/** Server-side Stripe client. */
export function stripe(): Stripe {
  stripeSingleton ??= new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
  return stripeSingleton;
}

/** Amount in the smallest currency unit (Stripe expects cents). */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}
