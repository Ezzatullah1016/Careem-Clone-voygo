/**
 * Repository interfaces — the ports of the clean architecture.
 * The service layer depends only on these; Supabase implementations
 * live in src/infrastructure/repositories.
 */

import type {
  AppNotification,
  DriverProfile,
  FareEstimate,
  LatLng,
  Payment,
  PricingRule,
  Profile,
  PromoCode,
  Rating,
  Ride,
  RideOffer,
  RideStatus,
  RideType,
  SavedLocation,
  SupportTicket,
  Vehicle,
  Wallet,
  WalletTransaction,
} from "@/core/entities";

export interface Page<T> {
  items: T[];
  total: number;
}

export interface ProfileRepository {
  getById(id: string): Promise<Profile | null>;
  update(id: string, patch: Partial<Pick<Profile, "fullName" | "avatarUrl" | "email">>): Promise<Profile>;
  /** Admin: paged user listing with search. */
  list(opts: { role?: string; search?: string; page?: number; pageSize?: number }): Promise<Page<Profile>>;
  setActive(id: string, isActive: boolean): Promise<void>;
}

export interface DriverRepository {
  getById(id: string): Promise<DriverProfile | null>;
  apply(input: { licenseNumber: string; licenseExpiry: string; licenseDocumentUrl: string; idDocumentUrl: string }): Promise<DriverProfile>;
  setOnline(driverId: string, online: boolean): Promise<void>;
  updateLocation(driverId: string, location: LatLng, heading?: number): Promise<void>;
  /** Admin verification queue. */
  listByStatus(status: string, page?: number): Promise<Page<DriverProfile>>;
  review(driverId: string, decision: "approved" | "rejected", reason?: string): Promise<void>;
}

export interface VehicleRepository {
  listByDriver(driverId: string): Promise<Vehicle[]>;
  register(input: Omit<Vehicle, "id" | "status" | "isActive">): Promise<Vehicle>;
  listPending(page?: number): Promise<Page<Vehicle>>;
  review(vehicleId: string, decision: "approved" | "rejected", reason?: string): Promise<void>;
}

export interface RideRepository {
  getById(id: string): Promise<Ride | null>;
  create(input: {
    rideTypeId: string;
    pickupAddress: string;
    pickupLocation: LatLng;
    dropoffAddress: string;
    dropoffLocation: LatLng;
    paymentMethod: string;
    estimatedFare: number;
    distanceM: number;
    durationS: number;
    routePolyline?: string;
    promoId?: string;
    scheduledAt?: string;
  }): Promise<Ride>;
  updateStatus(id: string, status: RideStatus, extra?: Record<string, unknown>): Promise<Ride>;
  historyForPassenger(passengerId: string, page?: number): Promise<Page<Ride>>;
  historyForDriver(driverId: string, page?: number): Promise<Page<Ride>>;
  activeForUser(userId: string): Promise<Ride | null>;
  /** Realtime subscription to a single ride row. Returns unsubscribe. */
  onRideChange(rideId: string, cb: (ride: Ride) => void): () => void;
  /** Realtime driver breadcrumbs for a ride. Returns unsubscribe. */
  onDriverLocation(rideId: string, cb: (loc: LatLng & { heading?: number }) => void): () => void;
  pushDriverLocation(rideId: string, driverId: string, loc: LatLng, heading?: number, speedMps?: number): Promise<void>;
}

export interface OfferRepository {
  pendingForDriver(driverId: string): Promise<RideOffer[]>;
  accept(rideId: string, vehicleId: string): Promise<Ride>;
  reject(offerId: string): Promise<void>;
  onNewOffer(driverId: string, cb: (offer: RideOffer) => void): () => void;
}

export interface PricingRepository {
  listRideTypes(): Promise<RideType[]>;
  activeRuleFor(rideTypeId: string): Promise<PricingRule | null>;
  listRules(): Promise<PricingRule[]>;
  upsertRule(rule: Omit<PricingRule, "id"> & { id?: string }): Promise<PricingRule>;
}

export interface WalletRepository {
  getForUser(userId: string): Promise<Wallet | null>;
  transactions(userId: string, page?: number): Promise<Page<WalletTransaction>>;
}

export interface PaymentRepository {
  listForUser(userId: string, page?: number): Promise<Page<Payment>>;
  listAll(opts?: { status?: string; page?: number }): Promise<Page<Payment>>;
}

export interface PromoRepository {
  findByCode(code: string): Promise<PromoCode | null>;
  list(): Promise<PromoCode[]>;
  upsert(promo: Partial<PromoCode> & { code: string }): Promise<PromoCode>;
  deactivate(id: string): Promise<void>;
  redemptionCount(promoId: string, userId?: string): Promise<number>;
}

export interface SavedLocationRepository {
  listForUser(userId: string): Promise<SavedLocation[]>;
  save(input: Omit<SavedLocation, "id">): Promise<SavedLocation>;
  remove(id: string): Promise<void>;
}

export interface RatingRepository {
  rate(input: { rideId: string; rateeId: string; stars: number; comment?: string }): Promise<Rating>;
  forRide(rideId: string): Promise<Rating[]>;
}

export interface NotificationRepository {
  listForUser(userId: string, page?: number): Promise<Page<AppNotification>>;
  markRead(id: string): Promise<void>;
  onNew(userId: string, cb: (n: AppNotification) => void): () => void;
}

export interface SupportRepository {
  createTicket(input: { subject: string; rideId?: string; body: string }): Promise<SupportTicket>;
  listMine(userId: string): Promise<SupportTicket[]>;
  listAll(status?: string): Promise<SupportTicket[]>;
  reply(ticketId: string, body: string): Promise<void>;
  setStatus(ticketId: string, status: string): Promise<void>;
}

/** Maps/routing port — implemented against Google Maps in infrastructure. */
export interface RoutingGateway {
  route(origin: LatLng, destination: LatLng): Promise<{
    distanceM: number;
    durationS: number;
    polyline: string;
  }>;
  etaSeconds(origin: LatLng, destination: LatLng): Promise<number>;
  geocode(address: string): Promise<{ location: LatLng; formattedAddress: string } | null>;
  reverseGeocode(location: LatLng): Promise<string | null>;
}

/** Fare estimation output for the ride-selection sheet. */
export interface FareQuote {
  estimates: FareEstimate[];
  distanceM: number;
  durationS: number;
}
