"use client";

/**
 * Smaller repositories: profiles, pricing, wallet, payments, promos,
 * saved locations, ratings, notifications, support.
 */

import type {
  AppNotification,
  Payment,
  PricingRule,
  Profile,
  PromoCode,
  Rating,
  RideType,
  SavedLocation,
  SupportTicket,
  Wallet,
  WalletTransaction,
} from "@/core/entities";
import type {
  NotificationRepository,
  Page,
  PaymentRepository,
  PricingRepository,
  ProfileRepository,
  PromoRepository,
  RatingRepository,
  SavedLocationRepository,
  SupportRepository,
  WalletRepository,
} from "@/core/repositories";
import type { BrowserSupabase } from "@/infrastructure/supabase/client";
import {
  mapNotification,
  mapPayment,
  mapPricingRule,
  mapProfile,
  mapPromo,
  mapRideType,
  mapSavedLocation,
  mapTicket,
  mapWallet,
  mapWalletTx,
  toGeography,
} from "@/infrastructure/supabase/mappers";

const PAGE_SIZE = 20;

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly db: BrowserSupabase) {}

  async getById(id: string): Promise<Profile | null> {
    const { data, error } = await this.db.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapProfile(data) : null;
  }

  async update(id: string, patch: Partial<Pick<Profile, "fullName" | "avatarUrl" | "email">>): Promise<Profile> {
    const { data, error } = await this.db
      .from("profiles")
      .update({
        ...(patch.fullName !== undefined && { full_name: patch.fullName }),
        ...(patch.avatarUrl !== undefined && { avatar_url: patch.avatarUrl }),
        ...(patch.email !== undefined && { email: patch.email }),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return mapProfile(data);
  }

  async list(opts: { role?: string; search?: string; page?: number; pageSize?: number }): Promise<Page<Profile>> {
    const pageSize = opts.pageSize ?? PAGE_SIZE;
    const from = (opts.page ?? 0) * pageSize;
    let q = this.db.from("profiles").select("*", { count: "exact" });
    if (opts.role) q = q.eq("role", opts.role);
    if (opts.search) q = q.or(`full_name.ilike.%${opts.search}%,phone.ilike.%${opts.search}%,email.ilike.%${opts.search}%`);
    const { data, error, count } = await q.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
    if (error) throw error;
    return { items: (data ?? []).map(mapProfile), total: count ?? 0 };
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await this.db.from("profiles").update({ is_active: isActive }).eq("id", id);
    if (error) throw error;
  }
}

export class SupabasePricingRepository implements PricingRepository {
  constructor(private readonly db: BrowserSupabase) {}

  async listRideTypes(): Promise<RideType[]> {
    const { data, error } = await this.db
      .from("ride_types")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw error;
    return (data ?? []).map(mapRideType);
  }

  async activeRuleFor(rideTypeId: string): Promise<PricingRule | null> {
    const { data, error } = await this.db
      .from("pricing_rules")
      .select("*")
      .eq("ride_type_id", rideTypeId)
      .eq("is_active", true)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapPricingRule(data) : null;
  }

  async listRules(): Promise<PricingRule[]> {
    const { data, error } = await this.db
      .from("pricing_rules")
      .select("*")
      .eq("is_active", true)
      .order("effective_from", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapPricingRule);
  }

  async upsertRule(rule: Omit<PricingRule, "id"> & { id?: string }): Promise<PricingRule> {
    // New rule versions supersede old ones rather than mutating history.
    if (rule.id) {
      await this.db.from("pricing_rules").update({ is_active: false }).eq("id", rule.id);
    }
    const { data, error } = await this.db
      .from("pricing_rules")
      .insert({
        ride_type_id: rule.rideTypeId,
        currency: rule.currency,
        base_fare: rule.baseFare,
        per_km: rule.perKm,
        per_minute: rule.perMinute,
        minimum_fare: rule.minimumFare,
        booking_fee: rule.bookingFee,
        cancellation_fee: rule.cancellationFee,
        surge_multiplier: rule.surgeMultiplier,
        commission_pct: rule.commissionPct,
      })
      .select()
      .single();
    if (error) throw error;
    return mapPricingRule(data);
  }
}

export class SupabaseWalletRepository implements WalletRepository {
  constructor(private readonly db: BrowserSupabase) {}

  async getForUser(userId: string): Promise<Wallet | null> {
    const { data, error } = await this.db.from("wallets").select("*").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? mapWallet(data) : null;
  }

  async transactions(userId: string, page = 0): Promise<Page<WalletTransaction>> {
    const wallet = await this.getForUser(userId);
    if (!wallet) return { items: [], total: 0 };
    const from = page * PAGE_SIZE;
    const { data, error, count } = await this.db
      .from("wallet_transactions")
      .select("*", { count: "exact" })
      .eq("wallet_id", wallet.id)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    return { items: (data ?? []).map(mapWalletTx), total: count ?? 0 };
  }
}

export class SupabasePaymentRepository implements PaymentRepository {
  constructor(private readonly db: BrowserSupabase) {}

  async listForUser(userId: string, page = 0): Promise<Page<Payment>> {
    const from = page * PAGE_SIZE;
    const { data, error, count } = await this.db
      .from("payments")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    return { items: (data ?? []).map(mapPayment), total: count ?? 0 };
  }

  async listAll(opts: { status?: string; page?: number } = {}): Promise<Page<Payment>> {
    const from = (opts.page ?? 0) * PAGE_SIZE;
    let q = this.db.from("payments").select("*", { count: "exact" });
    if (opts.status) q = q.eq("status", opts.status);
    const { data, error, count } = await q.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    return { items: (data ?? []).map(mapPayment), total: count ?? 0 };
  }
}

export class SupabasePromoRepository implements PromoRepository {
  constructor(private readonly db: BrowserSupabase) {}

  async findByCode(code: string): Promise<PromoCode | null> {
    const { data, error } = await this.db
      .from("promo_codes")
      .select("*")
      .ilike("code", code)
      .maybeSingle();
    if (error) throw error;
    return data ? mapPromo(data) : null;
  }

  async list(): Promise<PromoCode[]> {
    const { data, error } = await this.db.from("promo_codes").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapPromo);
  }

  async upsert(promo: Partial<PromoCode> & { code: string }): Promise<PromoCode> {
    const { data, error } = await this.db
      .from("promo_codes")
      .upsert(
        {
          ...(promo.id && { id: promo.id }),
          code: promo.code.toUpperCase(),
          description: promo.description ?? null,
          discount_pct: promo.discountPct ?? null,
          discount_amount: promo.discountAmount ?? null,
          max_discount: promo.maxDiscount ?? null,
          min_fare: promo.minFare ?? 0,
          usage_limit: promo.usageLimit ?? null,
          per_user_limit: promo.perUserLimit ?? 1,
          valid_until: promo.validUntil ?? null,
          is_active: promo.isActive ?? true,
        },
        { onConflict: "code" }
      )
      .select()
      .single();
    if (error) throw error;
    return mapPromo(data);
  }

  async deactivate(id: string): Promise<void> {
    const { error } = await this.db.from("promo_codes").update({ is_active: false }).eq("id", id);
    if (error) throw error;
  }

  async redemptionCount(promoId: string, userId?: string): Promise<number> {
    let q = this.db.from("promo_redemptions").select("*", { count: "exact", head: true }).eq("promo_id", promoId);
    if (userId) q = q.eq("user_id", userId);
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  }
}

export class SupabaseSavedLocationRepository implements SavedLocationRepository {
  constructor(private readonly db: BrowserSupabase) {}

  async listForUser(userId: string): Promise<SavedLocation[]> {
    const { data, error } = await this.db
      .from("saved_locations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at");
    if (error) throw error;
    return (data ?? []).map(mapSavedLocation);
  }

  async save(input: Omit<SavedLocation, "id">): Promise<SavedLocation> {
    const { data, error } = await this.db
      .from("saved_locations")
      .upsert(
        {
          user_id: input.userId,
          label: input.label,
          icon: input.icon,
          address: input.address,
          location: toGeography(input.location),
        },
        { onConflict: "user_id,label" }
      )
      .select("*")
      .single();
    if (error) throw error;
    return mapSavedLocation(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from("saved_locations").delete().eq("id", id);
    if (error) throw error;
  }
}

export class SupabaseRatingRepository implements RatingRepository {
  constructor(private readonly db: BrowserSupabase) {}

  async rate(input: { rideId: string; rateeId: string; stars: number; comment?: string }): Promise<Rating> {
    const { data: auth } = await this.db.auth.getUser();
    if (!auth.user) throw new Error("Not authenticated");
    const { data, error } = await this.db
      .from("ratings")
      .insert({
        ride_id: input.rideId,
        rater_id: auth.user.id,
        ratee_id: input.rateeId,
        stars: input.stars,
        comment: input.comment ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      rideId: data.ride_id,
      raterId: data.rater_id,
      rateeId: data.ratee_id,
      stars: data.stars,
      comment: data.comment,
      createdAt: data.created_at,
    };
  }

  async forRide(rideId: string): Promise<Rating[]> {
    const { data, error } = await this.db.from("ratings").select("*").eq("ride_id", rideId);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      rideId: r.ride_id,
      raterId: r.rater_id,
      rateeId: r.ratee_id,
      stars: r.stars,
      comment: r.comment,
      createdAt: r.created_at,
    }));
  }
}

export class SupabaseNotificationRepository implements NotificationRepository {
  constructor(private readonly db: BrowserSupabase) {}

  async listForUser(userId: string, page = 0): Promise<Page<AppNotification>> {
    const from = page * PAGE_SIZE;
    const { data, error, count } = await this.db
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    return { items: (data ?? []).map(mapNotification), total: count ?? 0 };
  }

  async markRead(id: string): Promise<void> {
    const { error } = await this.db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  onNew(userId: string, cb: (n: AppNotification) => void): () => void {
    const channel = this.db
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => cb(mapNotification(payload.new))
      )
      .subscribe();
    return () => void this.db.removeChannel(channel);
  }
}

export class SupabaseSupportRepository implements SupportRepository {
  constructor(private readonly db: BrowserSupabase) {}

  async createTicket(input: { subject: string; rideId?: string; body: string }): Promise<SupportTicket> {
    const { data: auth } = await this.db.auth.getUser();
    if (!auth.user) throw new Error("Not authenticated");
    const { data, error } = await this.db
      .from("support_tickets")
      .insert({ user_id: auth.user.id, subject: input.subject, ride_id: input.rideId ?? null })
      .select()
      .single();
    if (error) throw error;
    await this.reply(data.id, input.body);
    return mapTicket(data);
  }

  async listMine(userId: string): Promise<SupportTicket[]> {
    const { data, error } = await this.db
      .from("support_tickets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapTicket);
  }

  async listAll(status?: string): Promise<SupportTicket[]> {
    let q = this.db.from("support_tickets").select("*, profiles(*)");
    if (status) q = q.eq("status", status);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapTicket);
  }

  async reply(ticketId: string, body: string): Promise<void> {
    const { data: auth } = await this.db.auth.getUser();
    if (!auth.user) throw new Error("Not authenticated");
    const { error } = await this.db
      .from("ticket_messages")
      .insert({ ticket_id: ticketId, sender_id: auth.user.id, body });
    if (error) throw error;
  }

  async setStatus(ticketId: string, status: string): Promise<void> {
    const { error } = await this.db.from("support_tickets").update({ status }).eq("id", ticketId);
    if (error) throw error;
  }
}
