import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/infrastructure/supabase/server";
import { routingGateway } from "@/infrastructure/maps/routing.gateway";
import { calculateFare, isPromoWindowValid } from "@/core/services/fare.service";
import { mapPricingRule, mapPromo, mapRideType } from "@/infrastructure/supabase/mappers";

const BodySchema = z.object({
  pickup: z.object({ lat: z.number(), lng: z.number() }),
  dropoff: z.object({ lat: z.number(), lng: z.number() }),
  promoCode: z.string().trim().max(32).optional(),
});

/**
 * POST /api/fare-estimate
 * Returns route metrics + a fare estimate per active ride type.
 * Runs server-side so pricing rules and the Maps server key stay authoritative.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const { pickup, dropoff, promoCode } = parsed.data;

  try {
    const route = await routingGateway.route(pickup, dropoff);

    const [{ data: types }, { data: rules }] = await Promise.all([
      supabase.from("ride_types").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("pricing_rules").select("*").eq("is_active", true),
    ]);

    let promo = null;
    if (promoCode) {
      const { data: promoRow } = await supabase
        .from("promo_codes")
        .select("*")
        .ilike("code", promoCode)
        .maybeSingle();
      if (promoRow) {
        const candidate = mapPromo(promoRow);
        if (isPromoWindowValid(candidate)) promo = candidate;
      }
    }

    const estimates = (types ?? []).flatMap((typeRow) => {
      const type = mapRideType(typeRow);
      const ruleRow = (rules ?? []).find((r) => r.ride_type_id === type.id);
      if (!ruleRow) return [];
      const rule = mapPricingRule(ruleRow);
      const fare = calculateFare(rule, route.distanceM, route.durationS, promo);
      return [{
        rideTypeId: type.id,
        rideTypeCode: type.code,
        displayName: type.displayName,
        icon: type.icon,
        seats: type.seats,
        currency: fare.currency,
        amount: fare.total,
        discount: fare.discount,
        surgeMultiplier: fare.surgeMultiplier,
        distanceM: route.distanceM,
        durationS: route.durationS,
      }];
    });

    return NextResponse.json({
      estimates,
      route: {
        distanceM: route.distanceM,
        durationS: route.durationS,
        polyline: route.polyline,
      },
      promoApplied: promo?.code ?? null,
    });
  } catch (err) {
    console.error("fare-estimate failed", err);
    return NextResponse.json({ error: "Could not compute fare" }, { status: 502 });
  }
}
