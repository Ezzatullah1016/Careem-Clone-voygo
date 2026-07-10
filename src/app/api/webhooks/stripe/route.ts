import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/infrastructure/stripe/stripe";
import { createAdminClient } from "@/infrastructure/supabase/admin";

/**
 * POST /api/webhooks/stripe
 * Verifies the Stripe signature, then:
 *  - wallet_topup succeeded → credit wallet (idempotent on payment intent id)
 *  - ride payment succeeded/failed → update payments row
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      await req.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("stripe signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object;

      if (pi.metadata.purpose === "wallet_topup" && pi.metadata.user_id) {
        // Idempotency: skip if this intent already produced a ledger entry.
        const { count } = await admin
          .from("wallet_transactions")
          .select("*", { count: "exact", head: true })
          .eq("stripe_payment_intent_id", pi.id);
        if (!count) {
          await admin.rpc("apply_wallet_transaction", {
            p_user_id: pi.metadata.user_id,
            p_type: "topup",
            p_amount: pi.amount_received / 100,
            p_stripe_pi: pi.id,
            p_description: "Wallet top-up",
          });
          await admin.from("notifications").insert({
            user_id: pi.metadata.user_id,
            title: "Wallet topped up",
            body: `${(pi.amount_received / 100).toFixed(2)} ${pi.currency.toUpperCase()} added to your wallet.`,
            type: "payment",
          });
        }
      }

      if (pi.metadata.ride_id) {
        await admin
          .from("payments")
          .update({ status: "captured" })
          .eq("stripe_payment_intent_id", pi.id);
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      if (pi.metadata.ride_id) {
        await admin
          .from("payments")
          .update({ status: "failed", failure_reason: pi.last_payment_error?.message ?? null })
          .eq("stripe_payment_intent_id", pi.id);
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object;
      if (typeof charge.payment_intent === "string") {
        await admin
          .from("payments")
          .update({ status: "refunded" })
          .eq("stripe_payment_intent_id", charge.payment_intent);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
