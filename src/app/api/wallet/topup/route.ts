import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/infrastructure/supabase/server";
import { stripe, toMinorUnits } from "@/infrastructure/stripe/stripe";

const BodySchema = z.object({
  amount: z.number().min(5).max(1000),
  currency: z.string().length(3).default("USD"),
});

/**
 * POST /api/wallet/topup
 * Creates a Stripe PaymentIntent for a wallet top-up. The wallet is credited
 * only when the `payment_intent.succeeded` webhook lands (see stripe-webhook).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid amount (5–1000)" }, { status: 400 });
  }

  const intent = await stripe().paymentIntents.create({
    amount: toMinorUnits(parsed.data.amount),
    currency: parsed.data.currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: {
      purpose: "wallet_topup",
      user_id: auth.user.id,
    },
  });

  return NextResponse.json({ clientSecret: intent.client_secret });
}
