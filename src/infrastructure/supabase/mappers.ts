/**
 * Row → entity mappers. Database rows are snake_case with PostGIS WKB/GeoJSON
 * geography columns; entities are camelCase with plain LatLng.
 */

import type {
  AppNotification,
  DriverProfile,
  LatLng,
  Payment,
  PricingRule,
  Profile,
  PromoCode,
  Ride,
  RideOffer,
  RideType,
  SavedLocation,
  SupportTicket,
  Vehicle,
  Wallet,
  WalletTransaction,
} from "@/core/entities";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

/** Supabase returns geography as GeoJSON when selected via st_asgeojson, or WKT via helper columns. */
export function parseGeo(value: unknown): LatLng | null {
  if (!value) return null;
  if (typeof value === "object") {
    const g = value as { coordinates?: [number, number] };
    if (g.coordinates) return { lng: g.coordinates[0], lat: g.coordinates[1] };
  }
  if (typeof value === "string") {
    // EWKB hex (PostgREST's default JSON rendering for geography)
    if (/^[0-9A-Fa-f]{18,}$/.test(value)) return parseEwkbPoint(value);
    // GeoJSON string
    try {
      const g = JSON.parse(value);
      if (g?.coordinates) return { lng: g.coordinates[0], lat: g.coordinates[1] };
    } catch {
      // POINT(lng lat) WKT
      const m = value.match(/POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
      if (m) return { lng: Number(m[1]), lat: Number(m[2]) };
    }
  }
  return null;
}

/** Decode an EWKB hex point (little-endian, optional SRID header). */
function parseEwkbPoint(hex: string): LatLng | null {
  try {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    const view = new DataView(bytes.buffer);
    const littleEndian = bytes[0] === 1;
    const geomType = view.getUint32(1, littleEndian);
    // 0x20000000 flag = SRID present (4 extra bytes before coordinates).
    const hasSrid = (geomType & 0x20000000) !== 0;
    if ((geomType & 0xff) !== 1) return null; // not a point
    const offset = hasSrid ? 9 : 5;
    const lng = view.getFloat64(offset, littleEndian);
    const lat = view.getFloat64(offset + 8, littleEndian);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/** LatLng → PostGIS-compatible WKT for inserts. */
export function toGeography(loc: LatLng): string {
  return `POINT(${loc.lng} ${loc.lat})`;
}

export function mapProfile(r: Row): Profile {
  return {
    id: r.id,
    role: r.role,
    fullName: r.full_name,
    phone: r.phone,
    email: r.email,
    avatarUrl: r.avatar_url,
    rating: Number(r.rating ?? 5),
    ratingCount: r.rating_count ?? 0,
    isActive: r.is_active ?? true,
    createdAt: r.created_at,
  };
}

export function mapDriverProfile(r: Row): DriverProfile {
  return {
    id: r.id,
    status: r.status,
    licenseNumber: r.license_number,
    licenseExpiry: r.license_expiry,
    isOnline: r.is_online,
    currentLocation: parseGeo(r.current_location),
    locationUpdatedAt: r.location_updated_at,
    acceptanceRate: Number(r.acceptance_rate ?? 100),
    totalTrips: r.total_trips ?? 0,
    profile: r.profiles ? mapProfile(r.profiles) : undefined,
  };
}

export function mapVehicle(r: Row): Vehicle {
  return {
    id: r.id,
    driverId: r.driver_id,
    status: r.status,
    rideTypeId: r.ride_type_id,
    make: r.make,
    model: r.model,
    year: r.year,
    color: r.color,
    plateNumber: r.plate_number,
    isActive: r.is_active,
  };
}

export function mapRideType(r: Row): RideType {
  return {
    id: r.id,
    code: r.code,
    displayName: r.display_name,
    description: r.description,
    icon: r.icon,
    seats: r.seats,
    sortOrder: r.sort_order,
    isActive: r.is_active,
  };
}

export function mapPricingRule(r: Row): PricingRule {
  return {
    id: r.id,
    rideTypeId: r.ride_type_id,
    currency: r.currency,
    baseFare: Number(r.base_fare),
    perKm: Number(r.per_km),
    perMinute: Number(r.per_minute),
    minimumFare: Number(r.minimum_fare),
    bookingFee: Number(r.booking_fee),
    cancellationFee: Number(r.cancellation_fee),
    surgeMultiplier: Number(r.surge_multiplier),
    commissionPct: Number(r.commission_pct),
  };
}

export function mapRide(r: Row): Ride {
  return {
    id: r.id,
    passengerId: r.passenger_id,
    driverId: r.driver_id,
    vehicleId: r.vehicle_id,
    rideTypeId: r.ride_type_id,
    status: r.status,
    pickupAddress: r.pickup_address,
    pickupLocation: parseGeo(r.pickup_location) ?? { lat: 0, lng: 0 },
    dropoffAddress: r.dropoff_address,
    dropoffLocation: parseGeo(r.dropoff_location) ?? { lat: 0, lng: 0 },
    scheduledAt: r.scheduled_at,
    distanceM: r.distance_m,
    durationS: r.duration_s,
    routePolyline: r.route_polyline,
    estimatedFare: r.estimated_fare != null ? Number(r.estimated_fare) : null,
    finalFare: r.final_fare != null ? Number(r.final_fare) : null,
    surgeMultiplier: Number(r.surge_multiplier ?? 1),
    currency: r.currency,
    paymentMethod: r.payment_method,
    promoId: r.promo_id,
    discountAmount: Number(r.discount_amount ?? 0),
    driverEarnings: r.driver_earnings != null ? Number(r.driver_earnings) : null,
    requestedAt: r.requested_at,
    completedAt: r.completed_at,
    passenger: r.passenger ? mapProfile(r.passenger) : undefined,
    driver: r.driver ? mapDriverProfile(r.driver) : undefined,
    vehicle: r.vehicle ? mapVehicle(r.vehicle) : undefined,
    rideType: r.ride_type ? mapRideType(r.ride_type) : undefined,
  };
}

export function mapOffer(r: Row): RideOffer {
  return {
    id: r.id,
    rideId: r.ride_id,
    driverId: r.driver_id,
    expiresAt: r.expires_at,
    respondedAt: r.responded_at,
    accepted: r.accepted,
    ride: r.rides ? mapRide(r.rides) : undefined,
  };
}

export function mapSavedLocation(r: Row): SavedLocation {
  return {
    id: r.id,
    userId: r.user_id,
    label: r.label,
    icon: r.icon,
    address: r.address,
    location: parseGeo(r.location) ?? { lat: 0, lng: 0 },
  };
}

export function mapWallet(r: Row): Wallet {
  return { id: r.id, userId: r.user_id, balance: Number(r.balance), currency: r.currency };
}

export function mapWalletTx(r: Row): WalletTransaction {
  return {
    id: r.id,
    walletId: r.wallet_id,
    type: r.type,
    amount: Number(r.amount),
    balanceAfter: Number(r.balance_after),
    rideId: r.ride_id,
    description: r.description,
    createdAt: r.created_at,
  };
}

export function mapPayment(r: Row): Payment {
  return {
    id: r.id,
    rideId: r.ride_id,
    userId: r.user_id,
    method: r.method,
    status: r.status,
    amount: Number(r.amount),
    currency: r.currency,
    stripePaymentIntentId: r.stripe_payment_intent_id,
    createdAt: r.created_at,
  };
}

export function mapPromo(r: Row): PromoCode {
  return {
    id: r.id,
    code: r.code,
    description: r.description,
    discountPct: r.discount_pct != null ? Number(r.discount_pct) : null,
    discountAmount: r.discount_amount != null ? Number(r.discount_amount) : null,
    maxDiscount: r.max_discount != null ? Number(r.max_discount) : null,
    minFare: Number(r.min_fare ?? 0),
    usageLimit: r.usage_limit,
    perUserLimit: r.per_user_limit,
    validFrom: r.valid_from,
    validUntil: r.valid_until,
    isActive: r.is_active,
  };
}

export function mapNotification(r: Row): AppNotification {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    body: r.body,
    type: r.type,
    data: r.data ?? {},
    readAt: r.read_at,
    createdAt: r.created_at,
  };
}

export function mapTicket(r: Row): SupportTicket {
  return {
    id: r.id,
    userId: r.user_id,
    rideId: r.ride_id,
    subject: r.subject,
    status: r.status,
    createdAt: r.created_at,
    user: r.profiles ? mapProfile(r.profiles) : undefined,
  };
}
