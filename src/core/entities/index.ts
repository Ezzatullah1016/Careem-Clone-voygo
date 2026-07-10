/**
 * Core domain entities.
 * Framework-agnostic: no Supabase, Next.js or Stripe imports here.
 * These are the shapes the rest of the app programs against; the
 * infrastructure layer maps database rows into them.
 */

export type UserRole = "passenger" | "driver" | "admin";

export type DriverStatus =
  | "pending"
  | "documents_requested"
  | "approved"
  | "rejected"
  | "suspended";

export type VehicleStatus = "pending" | "approved" | "rejected";

export type RideStatus =
  | "requested"
  | "scheduled"
  | "accepted"
  | "arriving"
  | "in_progress"
  | "completed"
  | "cancelled_by_passenger"
  | "cancelled_by_driver"
  | "no_drivers_found";

export type PaymentMethod = "card" | "cash" | "wallet";

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "refunded"
  | "failed";

export type WalletTxType =
  | "topup"
  | "ride_payment"
  | "ride_earning"
  | "refund"
  | "payout"
  | "promo_credit"
  | "adjustment";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Profile {
  id: string;
  role: UserRole;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  rating: number;
  ratingCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface DriverProfile {
  id: string;
  status: DriverStatus;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  isOnline: boolean;
  currentLocation: LatLng | null;
  locationUpdatedAt: string | null;
  acceptanceRate: number;
  totalTrips: number;
  profile?: Profile;
}

export interface Vehicle {
  id: string;
  driverId: string;
  status: VehicleStatus;
  rideTypeId: string | null;
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  isActive: boolean;
}

export interface RideType {
  id: string;
  code: string;
  displayName: string;
  description: string | null;
  icon: string;
  seats: number;
  sortOrder: number;
  isActive: boolean;
}

export interface PricingRule {
  id: string;
  rideTypeId: string;
  currency: string;
  baseFare: number;
  perKm: number;
  perMinute: number;
  minimumFare: number;
  bookingFee: number;
  cancellationFee: number;
  surgeMultiplier: number;
  commissionPct: number;
}

export interface SavedLocation {
  id: string;
  userId: string;
  label: string;
  icon: string;
  address: string;
  location: LatLng;
}

export interface Ride {
  id: string;
  passengerId: string;
  driverId: string | null;
  vehicleId: string | null;
  rideTypeId: string;
  status: RideStatus;
  pickupAddress: string;
  pickupLocation: LatLng;
  dropoffAddress: string;
  dropoffLocation: LatLng;
  scheduledAt: string | null;
  distanceM: number | null;
  durationS: number | null;
  routePolyline: string | null;
  estimatedFare: number | null;
  finalFare: number | null;
  surgeMultiplier: number;
  currency: string;
  paymentMethod: PaymentMethod;
  promoId: string | null;
  discountAmount: number;
  driverEarnings: number | null;
  requestedAt: string;
  completedAt: string | null;
  passenger?: Profile;
  driver?: DriverProfile;
  vehicle?: Vehicle;
  rideType?: RideType;
}

export interface RideOffer {
  id: string;
  rideId: string;
  driverId: string;
  expiresAt: string;
  respondedAt: string | null;
  accepted: boolean | null;
  ride?: Ride;
}

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  currency: string;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: WalletTxType;
  amount: number;
  balanceAfter: number;
  rideId: string | null;
  description: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  rideId: string;
  userId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: string;
  stripePaymentIntentId: string | null;
  createdAt: string;
}

export interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discountPct: number | null;
  discountAmount: number | null;
  maxDiscount: number | null;
  minFare: number;
  usageLimit: number | null;
  perUserLimit: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
}

export interface Rating {
  id: string;
  rideId: string;
  raterId: string;
  rateeId: string;
  stars: number;
  comment: string | null;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  rideId: string | null;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  user?: Profile;
}

export interface FareEstimate {
  rideTypeId: string;
  rideTypeCode: string;
  displayName: string;
  currency: string;
  amount: number;
  surgeMultiplier: number;
  distanceM: number;
  durationS: number;
  etaPickupS: number | null;
}
