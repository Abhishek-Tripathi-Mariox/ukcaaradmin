// User types
export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'customer' | 'driver' | 'admin';
  avatar?: string;
  isActive: boolean;
  isVerified: boolean;
  // Average rating this user received from drivers (rating.driverToCustomer),
  // computed by the admin users-list endpoint. count === 0 means unrated.
  rating?: { average: number; count: number };
  createdAt: string;
  updatedAt: string;
}

export interface DriverProfile {
  /** Driver's chosen primary service category: instant / private / scheduled. */
  serviceType?: 'instant' | 'private' | 'scheduled';

  // Vehicle (matches backend User.driverProfile)
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  vehicleColor?: string;
  plateNumber?: string;
  licenceNumber?: string;
  insuranceNumber?: string;

  // Status
  isOnline: boolean;
  isOnePass: boolean;
  onePassExpiry?: string;

  // Stats
  rating: number;
  totalTrips: number;
  totalEarnings: number;
  commissionRate?: number;

  documents: DriverDocument[];
  // Payout bank details captured on the "complete profile" step. Shown in the
  // admin driver documents tab alongside uploaded documents.
  bankDetails?: {
    accountHolder?: string;
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    passbookUrl?: string;
  };
  currentLocation?: { lat: number; lng: number };
}

export interface DriverDocument {
  type: string;
  url: string;
  status: 'pending' | 'verified' | 'rejected';
  verifiedAt?: string;
  verifiedBy?: string;
  note?: string;
  rejectionReason?: string;
  reviewedAt?: string;
  resubmittedAt?: string;
  expiry?: string;
}

export interface Driver extends User {
  driverProfile: DriverProfile;
}

// Ride types
export interface Location {
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface Ride {
  _id: string;
  customer: User;
  driver?: Driver;
  pickup: Location;
  dropoff: Location;
  stops?: Location[];
  rideType: string;
  // Category flag from the backend — rideType holds the vehicle-type code,
  // so "private" is detected via this flag, not rideType.
  isPrivate?: boolean;
  isScheduled?: boolean;
  scheduledAt?: string;
  vehicleType?: 'standard' | 'comfort' | 'xl';
  status: 'searching' | 'driver_assigned' | 'driver_arriving' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled' | 'reserved';
  // Flat fare fields as stored/returned by the backend
  estimatedFare: number;
  actualFare?: number;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeFare: number;
  discount: number;
  tip: number;
  commission: number;
  driverEarnings: number;
  estimatedDistance: number;
  estimatedDuration: number;
  actualDistance?: number;
  actualDuration?: number;
  distance?: number;
  duration?: number;
  paymentMethod: 'card' | 'cash' | 'wallet';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  rating?: number;
  review?: string;
  // Cancellation detail as stored on the Ride doc / projected from a
  // shuttle booking. Nested (not flat) — read `cancellation.cancelledBy`
  // and `cancellation.reason` in the UI.
  cancellation?: {
    cancelledBy: 'customer' | 'driver' | 'admin' | 'system';
    reason: string;
    fee?: number;
    cancelledAt?: string;
  };
  dispute?: {
    status: 'open' | 'resolved';
    reason: string;
    resolution?: string;
    resolvedBy?: string;
    resolvedAt?: string;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// Payment types
export interface Payment {
  _id: string;
  user: User;
  ride?: Ride;
  type: 'ride_payment' | 'subscription' | 'refund' | 'payout' | 'wallet_topup';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  method: 'card' | 'cash' | 'wallet' | 'bank_transfer';
  stripePaymentId?: string;
  description?: string;
  createdAt: string;
}

export interface Wallet {
  _id: string;
  user: string;
  balance: number;
  currency: string;
  transactions: WalletTransaction[];
}

export interface WalletTransaction {
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference?: string;
  createdAt: string;
}

// Promo types
export interface PromoCode {
  _id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  maxUses: number;
  usedCount: number;
  maxUsesPerUser: number;
  /** Model field; older responses may only carry minRideAmount. */
  minFare?: number;
  minRideAmount: number;
  maxDiscount?: number;
  expiresAt: string;
  isActive: boolean;
  description?: string;
  createdAt: string;
}

// Chat types
export interface Chat {
  _id: string;
  ride: string;
  participants: string[];
  messages: ChatMessage[];
  createdAt: string;
}

export interface ChatMessage {
  sender: string;
  message: string;
  type: 'text' | 'image' | 'location';
  createdAt: string;
}

// Dashboard types
export interface DashboardMetrics {
  customers: {
    total: number;
  };
  drivers: {
    total: number;
    verified: number;
    pending: number;
    online: number;
    onePass: number;
    averageRating: number;
  };
  rides: {
    total: number;
    active: number;
    completed: number;
    cancelled: number;
    today: number;
    thisWeek: number;
    completionRate: number;
  };
  revenue: {
    total: number;
    today: number;
    thisWeek: number;
    commission: number;
  };
  promos: {
    active: number;
  };
  wallets: {
    totalBalance: number;
  };
}

export interface AnalyticsData {
  labels: string[];
  data: number[];
}

// Pagination
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Settings types
export interface FareConfig {
  baseFare: {
    standard: number;
    comfort: number;
    xl: number;
  };
  perMile: {
    standard: number;
    comfort: number;
    xl: number;
  };
  perMinute: {
    standard: number;
    comfort: number;
    xl: number;
  };
  minimumFare: {
    standard: number;
    comfort: number;
    xl: number;
  };
  cancellationFee: number;
  bookingFee: number;
  surgeMultipliers: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface GeneralSettings {
  appName: string;
  supportEmail: string;
  supportPhone: string;
  maxSearchRadius: number;
  driverTimeout: number;
  maintenanceMode: boolean;
}
