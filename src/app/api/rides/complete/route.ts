import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/infrastructure/supabase/server";
import { createAdminClient } from "@/infrastructure/supabase/admin";
import { stripe, toMinorUnits } from "@/infrastructure/stripe/stripe";
import { promoDiscount, splitEarnings } from "@/core/services/fare.service";
import { mapPromo } from "@/infrastructure/supabase/mappers";

const BodySchema = z.object({ rideId: z.string().uuid() });

/**
 * POST /api/rides/complete
 * Called by the driver at drop-off. Settles the fare:
 *  - card  → Stripe PaymentIntent (off-session, saved customer)
 *  - wallet→ atomic wallet debit via apply_wallet_transaction
 *  - cash  → recorded as captured, collected in person
 * Then credits driver earnings, records promo redemption, closes the ride.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: ride } = await admin
    .from("rides")
    .select("*, pricing:ride_type_id(id)")
    .eq("id", parsed.data.rideId)
    .single();

  if (!ride) return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  if (ride.driver_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ride.status !== "in_progress") {
    return NextResponse.json({ error: "Ride is not in progress" }, { status: 409 });
  }

  // Final fare: estimate is the quote honoured at completion (surge locked at request).
  let finalFare = Number(ride.estimated_fare ?? 0);
  let discount = 0;

  if (ride.promo_id) {
    const { data: promoRow } = await admin.from("promo_codes").select("*").eq("id", ride.promo_id).single();
    if (promoRow) {
      discount = promoDiscount(mapPromo(promoRow), finalFare);
      finalFare = Math.max(finalFare - discount, 0);
    }
  }

  const { data: ruleRow } = await admin
    .from("pricing_rules")
    .select("commission_pct")
    .eq("ride_type_id", ride.ride_type_id)
    .eq("is_active", true)
    .order("effective_from", { ascending: false })
    .limit(1)
    .single();
  const { platformFee, driverEarnings } = splitEarnings(finalFare, Number(ruleRow?.commission_pct ?? 20));

  // ── Collect payment ────────────────────────────────────────────────────────
  let paymentStatus = "captured";
  let stripePi: string | null = null;

  try {
    if (ride.payment_method === "wallet") {
      await admin.rpc("apply_wallet_transaction", {
        p_user_id: ride.passenger_id,
        p_type: "ride_payment",
        p_amount: -finalFare,
        p_ride_id: ride.id,
        p_description: `Ride ${ride.pickup_address} → ${ride.dropoff_address}`,
      });
    } else if (ride.payment_method === "card") {
      const { data: profile } = await admin
        .from("payments")
        .select("stripe_customer_id")
        .eq("user_id", ride.passenger_id)
        .not("stripe_customer_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (profile?.stripe_customer_id && finalFare > 0) {
        const pi = await stripe().paymentIntents.create({
          amount: toMinorUnits(finalFare),
          currency: ride.currency.toLowerCase(),
          customer: profile.stripe_customer_id,
          off_session: true,
          confirm: true,
          metadata: { ride_id: ride.id, user_id: ride.passenger_id },
        });
        stripePi = pi.id;
        paymentStatus = pi.status === "succeeded" ? "captured" : "pending";
      } else {
        // No saved card — fall back to pending; client completes payment in-app.
        paymentStatus = "pending";
      }
    }
    // cash: nothing to charge — driver collects.
  } catch (err) {
    console.error("payment capture failed", err);
    paymentStatus = "failed";
  }

  await admin.from("payments").insert({
    ride_id: ride.id,
    user_id: ride.passenger_id,
    method: ride.payment_method,
    status: paymentStatus,
    amount: finalFare,
    currency: ride.currency,
    stripe_payment_intent_id: stripePi,
  });

  // ── Credit driver ─────────────────────────────────────────────────────────
  if (paymentStatus !== "failed") {
    await admin.rpc("apply_wallet_transaction", {
      p_user_id: ride.driver_id,
      p_type: "ride_earning",
      p_amount: driverEarnings,
      p_ride_id: ride.id,
      p_description: "Ride earnings",
    });
  }

  if (ride.promo_id && discount > 0) {
    await admin.from("promo_redemptions").insert({
      promo_id: ride.promo_id,
      user_id: ride.passenger_id,
      ride_id: ride.id,
      discount_applied: discount,
    });
  }

  const { data: updated } = await admin
    .from("rides")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      final_fare: finalFare,
      discount_amount: discount,
      driver_earnings: driverEarnings,
      platform_fee: platformFee,
    })
    .eq("id", ride.id)
    .select()
    .single();

  await admin.from("driver_profiles").update({ total_trips: (await tripCount(admin, ride.driver_id)) }).eq("id", ride.driver_id);

  await admin.from("notifications").insert({
    user_id: ride.passenger_id,
    title: "Trip completed",
    body: `Your fare was ${ride.currency} ${finalFare.toFixed(2)}. Thanks for riding with Voygo!`,
    type: "ride_update",
    data: { ride_id: ride.id },
  });

  return NextResponse.json({ ride: updated, finalFare, paymentStatus });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function tripCount(admin: any, driverId: string): Promise<number> {
  const { count } = await admin
    .from("rides")
    .select("*", { count: "exact", head: true })
    .eq("driver_id", driverId)
    .eq("status", "completed");
  return count ?? 0;
}
