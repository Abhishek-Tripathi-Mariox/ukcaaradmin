import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL;

if (!API_BASE_URL) {
  throw new Error(
    'VITE_API_URL is not set. Define it in ukcaar-admin/.env (e.g. VITE_API_URL=http://localhost:5000/api/v1).'
  );
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

// ════════════════════════════════════════════════════════════════════
// AUTH API
// ════════════════════════════════════════════════════════════════════

export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  logout: () => api.post('/auth/logout'),

  getProfile: () => api.get('/auth/me'),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (email: string, otp: string, newPassword: string) =>
    api.post('/auth/reset-password', { email, otp, newPassword }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// ════════════════════════════════════════════════════════════════════
// DASHBOARD API
// ════════════════════════════════════════════════════════════════════

export const dashboardAPI = {
  getMetrics: () => api.get('/admin/dashboard'),
  
  getRideAnalytics: (period: string = '7d') =>
    api.get(`/admin/analytics/rides?period=${period}`),
  
  getRevenueAnalytics: (period: string = '7d') =>
    api.get(`/admin/analytics/revenue?period=${period}`),
  
  exportReport: (type: string, startDate: string, endDate: string) =>
    api.get(`/admin/exports/${type}`, { params: { startDate, endDate } }),
};

// ════════════════════════════════════════════════════════════════════
// USERS API
// ════════════════════════════════════════════════════════════════════

export const usersAPI = {
  getAll: (params?: { page?: number; limit?: number; role?: string; isActive?: boolean; search?: string }) =>
    api.get('/admin/users', { params }),
  
  getById: (id: string) => api.get(`/admin/users/${id}`),
  
  update: (id: string, data: any) => api.put(`/admin/users/${id}`, data),

  updateStatus: (id: string, isActive: boolean, reason?: string) =>
    api.put(`/admin/users/${id}/status`, { isActive, reason }),
  
  delete: (id: string) => api.delete(`/admin/users/${id}`),
};

export const referralsAPI = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/admin/referrals', { params }),

  getById: (userId: string) => api.get(`/admin/referrals/${userId}`),
};

// ════════════════════════════════════════════════════════════════════
// DRIVERS API
// ════════════════════════════════════════════════════════════════════

export const driversAPI = {
  getAll: (params?: { page?: number; limit?: number; search?: string; status?: string; isOnline?: boolean; isOnePass?: boolean; minRating?: number; isVerified?: boolean; isActive?: boolean; serviceType?: string }) =>
    api.get('/admin/drivers', { params }),

  getById: (id: string) => api.get(`/admin/drivers/${id}`),

  getRides: (id: string, params?: { page?: number; limit?: number; status?: string }) =>
    api.get(`/admin/drivers/${id}/rides`, { params }),

  getStats: (id: string) => api.get(`/admin/drivers/${id}/stats`),

  getApplications: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/admin/drivers/applications', { params }),
  
  approveApplication: (id: string, note?: string) =>
    api.post(`/admin/drivers/${id}/approve`, { note }),
  
  rejectApplication: (id: string, reason: string) =>
    api.post(`/admin/drivers/${id}/reject`, { reason }),
  
  getDocuments: (id: string) => api.get(`/admin/drivers/${id}/documents`),
  
  verifyDocument: (driverId: string, documentType: string, status: string, note?: string) =>
    api.patch(`/admin/drivers/${driverId}/documents/${documentType}/verify`, { status, note }),
  
  updateCommission: (id: string, commissionRate: number) =>
    api.patch(`/admin/drivers/${id}/commission`, { commissionRate }),
  
  suspendDriver: (id: string, reason: string, duration?: number) =>
    api.post(`/admin/drivers/${id}/suspend`, { reason, duration }),
  
  reactivateDriver: (id: string) => api.post(`/admin/drivers/${id}/reactivate`),
  
  forceOffline: (id: string, reason: string) =>
    api.post(`/admin/drivers/${id}/force-offline`, { reason }),
};

// ════════════════════════════════════════════════════════════════════
// ONEPASS API
// ════════════════════════════════════════════════════════════════════

export const onePassAPI = {
  getSubscribers: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/admin/onepass/subscribers', { params }),
  
  getStats: () => api.get('/admin/onepass/stats'),
  
  extendSubscription: (driverId: string, days: number) =>
    api.post(`/admin/onepass/${driverId}/extend`, { days }),
  
  cancelSubscription: (driverId: string, reason: string) =>
    api.post(`/admin/onepass/${driverId}/cancel`, { reason }),
  
  grantSubscription: (driverId: string, plan: string, duration: number, reason: string) =>
    api.post(`/admin/onepass/${driverId}/grant`, { plan, duration, reason }),
};

// ════════════════════════════════════════════════════════════════════
// RIDES API
// ════════════════════════════════════════════════════════════════════

export interface RideListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  rideType?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  minFare?: number;
  maxFare?: number;
}

export const ridesAPI = {
  getAll: (params?: RideListParams) => api.get('/admin/rides', { params }),

  // Dedicated scheduled view — merges pre-booked rides + shuttle bookings.
  // Accepts the same filter set as getAll; date range matches the scheduled
  // departure rather than the booking-created time.
  getScheduled: (params?: RideListParams) =>
    api.get('/admin/rides/scheduled', { params }),

  getById: (id: string) => api.get(`/admin/rides/${id}`),

  getLive: () => api.get('/admin/rides/live'),
  
  getHeatmap: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/admin/heatmap', { params }),
  
  // Backend exposes PUT /admin/rides/:id/cancel and accepts a boolean `refund`
  // plus an optional `refundAmount`. We translate the legacy `refundPercentage`
  // arg here so existing call sites keep working without touching every
  // ride-management screen.
  cancel: (id: string, reason: string, refundPercentage?: number) =>
    api.put(`/admin/rides/${id}/cancel`, {
      reason,
      refund: refundPercentage != null && refundPercentage > 0,
      // refundAmount left undefined → backend defaults to actualFare or
      // estimatedFare. If a future caller needs partial refunds we can add
      // a `refundAmount` arg without touching the backend.
    }),
  
  // Cancel a shuttle seat reservation (scheduled-tab rows with a `sched_`
  // prefixed id). The backend tolerates the prefix and records an
  // admin-attributed cancellation reason. Refunds aren't processed here.
  cancelScheduledBooking: (bookingId: string, reason: string) =>
    api.put(`/admin/rides/scheduled/${bookingId}/cancel`, { reason }),

  reassign: (id: string, newDriverId: string, reason: string) =>
    api.put(`/admin/rides/${id}/reassign`, { driverId: newDriverId, reason }),

  // Drivers within 7 km of the ride's pickup, optionally filtered by
  // name/phone substring. Used by the manual-assign picker on the ride
  // detail page.
  nearbyDrivers: (rideId: string, q?: string) =>
    api.get(`/admin/rides/${rideId}/nearby-drivers`, {
      params: q ? { q } : {},
    }),

  // Force-assign a driver to a still-searching ride. Triggers
  // `ride:driver-assigned` on the customer and `ride:assigned` on the
  // driver so both apps navigate automatically.
  assignDriver: (rideId: string, driverId: string) =>
    api.post(`/admin/rides/${rideId}/assign-driver`, { driverId }),

  // Admin-side OTP confirmation. Same effect as the driver-side verify-otp
  // but callable from the admin console — flips the ride to in_progress
  // and broadcasts the status change. Used while we test the customer
  // flow without a real driver app.
  verifyOtp: (rideId: string, otp: string) =>
    api.post(`/admin/rides/${rideId}/verify-otp`, { otp }),

  // Admin-side completion. Mirrors the driver-side status='completed'
  // transition — actual fare, commission, driver-earnings credits + push
  // to both parties.
  complete: (rideId: string) =>
    api.post(`/admin/rides/${rideId}/complete`),
  
  adjustFare: (id: string, newFare: number, reason: string) =>
    api.put(`/admin/rides/${id}/adjust-fare`, { newFare, reason }),
  
  getDisputes: (params?: RideListParams) =>
    api.get('/admin/rides/disputed', { params }),
  
  resolveDispute: (rideId: string, resolution: string, refundAmount?: number, notes?: string) =>
    api.post(`/admin/rides/${rideId}/resolve-dispute`, { resolution, refundAmount, notes }),
};

// ════════════════════════════════════════════════════════════════════
// PROMO CODES API
// ════════════════════════════════════════════════════════════════════

export const promoAPI = {
  getAll: (params?: { page?: number; limit?: number; isActive?: boolean }) =>
    api.get('/admin/promos', { params }),
  
  getById: (id: string) => api.get(`/admin/promos/${id}`),
  
  create: (data: {
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    maxUses?: number;
    maxUsesPerUser?: number;
    minRideAmount?: number;
    maxDiscount?: number;
    expiresAt?: string;
    description?: string;
  }) => api.post('/admin/promos', data),
  
  update: (id: string, data: any) => api.patch(`/admin/promos/${id}`, data),
  
  delete: (id: string) => api.delete(`/admin/promos/${id}`),
  
  getUsage: (id: string) => api.get(`/admin/promos/${id}/usage`),
  
  toggleStatus: (id: string) => api.post(`/admin/promos/${id}/toggle`),
};

// ════════════════════════════════════════════════════════════════════
// PAYMENTS API
// ════════════════════════════════════════════════════════════════════

export const paymentsAPI = {
  getAll: (params?: { page?: number; limit?: number; type?: string; status?: string }) =>
    api.get('/admin/payments', { params }),
  
  getById: (id: string) => api.get(`/admin/payments/${id}`),
  
  refund: (id: string, amount: number, reason: string) =>
    api.post('/admin/payments/refund', { paymentId: id, amount, reason }),
  
  getPendingPayouts: () => api.get('/admin/payments/payouts/pending'),
  
  processPayouts: (driverIds: string[]) =>
    api.post('/admin/payments/payouts/process', { driverIds }),
};

// ════════════════════════════════════════════════════════════════════
// WALLETS API
// ════════════════════════════════════════════════════════════════════

export const walletsAPI = {
  getByUserId: (userId: string) => api.get(`/admin/wallets/${userId}`),
  
  adjustBalance: (userId: string, amount: number, type: 'credit' | 'debit', reason: string) =>
    api.post(`/admin/wallets/${userId}/adjust`, { amount, type, reason }),
};

// ════════════════════════════════════════════════════════════════════
// RECHARGE OFFERS API (wallet top-up denominations for the customer app)
// ════════════════════════════════════════════════════════════════════

export interface RechargeOffer {
  _id: string;
  amount: number;
  bonusAmount: number;
  discountPercent: number;
  label?: string;
  isPopular: boolean;
  isActive: boolean;
  order: number;
  validFrom?: string;
  validUntil?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const rechargeOffersAPI = {
  list: (params?: { isActive?: boolean }) =>
    api.get('/admin/recharge-offers', { params }),
  create: (data: Partial<RechargeOffer>) => api.post('/admin/recharge-offers', data),
  update: (id: string, data: Partial<RechargeOffer>) =>
    api.patch(`/admin/recharge-offers/${id}`, data),
  remove: (id: string) => api.delete(`/admin/recharge-offers/${id}`),
};

// ════════════════════════════════════════════════════════════════════
// CHAT API
// ════════════════════════════════════════════════════════════════════

export const chatAPI = {
  // Returns the chat document for a ride with its `messages` array embedded —
  // there is no separate messages endpoint.
  getByRideId: (rideId: string) => api.get(`/admin/chats/${rideId}`),
};

// ════════════════════════════════════════════════════════════════════
// SETTINGS API
// ════════════════════════════════════════════════════════════════════

export const settingsAPI = {
  getFareConfig: () => api.get('/admin/settings/fares'),
  
  updateFareConfig: (config: any) => api.patch('/admin/settings/fares', config),
  
  getGeneral: () => api.get('/admin/settings/general'),
  
  updateGeneral: (settings: any) => api.patch('/admin/settings/general', settings),
};

// ════════════════════════════════════════════════════════════════════
// NOTIFICATIONS API
// ════════════════════════════════════════════════════════════════════

export const notificationsAPI = {
  broadcast: (data: { title: string; body: string; targetRole: 'all' | 'customers' | 'drivers' }) => {
    // Backend expects: { title, message, targetRole? } — role is singular ('customer'/'driver'),
    // and 'all' means omit the role filter entirely.
    const roleMap: Record<string, string | undefined> = {
      all: undefined,
      customers: 'customer',
      drivers: 'driver',
    };
    const payload: Record<string, unknown> = {
      title: data.title,
      message: data.body,
    };
    const mapped = roleMap[data.targetRole];
    if (mapped) payload.targetRole = mapped;
    return api.post('/admin/broadcast', payload);
  },

  // Send to a single user resolved via the search-and-select flow (the admin
  // searches by mobile number + type, then picks the exact user).
  sendToUser: (userId: string, title: string, body: string) =>
    api.post(`/admin/notify/${userId}`, { title, message: body }),

  listSent: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/admin/notifications/sent', { params }),
};

// ════════════════════════════════════════════════════════════════════
// GOVERNANCE - RBAC + AUDIT LOG
// ════════════════════════════════════════════════════════════════════

export const governanceAPI = {
  getMyPermissions: () => api.get('/admin/me/permissions'),

  // Admin user management
  listAdmins: (params?: { page?: number; limit?: number; search?: string; adminRole?: string }) =>
    api.get('/admin/admins', { params }),

  inviteAdmin: (data: {
    email: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    adminRole: string;
    permissions?: string[];
  }) => api.post('/admin/admins/invite', data),

  updateAdmin: (
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      adminRole?: string;
      permissions?: string[];
      isActive?: boolean;
      reason?: string;
    }
  ) => api.patch(`/admin/admins/${id}`, data),

  resetAdminPassword: (id: string) => api.post(`/admin/admins/${id}/reset-password`),

  // Audit log
  listAuditLogs: (params?: {
    page?: number;
    limit?: number;
    actorId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    outcome?: 'success' | 'failure';
    startDate?: string;
    endDate?: string;
  }) => api.get('/admin/audit-logs', { params }),

  getAuditLog: (id: string) => api.get(`/admin/audit-logs/${id}`),
};

// ════════════════════════════════════════════════════════════════════
// DISPATCH API (live map + manual assign)
// ════════════════════════════════════════════════════════════════════

export const dispatchAPI = {
  getOnlineDrivers: () => api.get('/admin/dispatch/online-drivers'),
  getNearbyDrivers: (rideId: string, params?: { radius?: number; limit?: number }) =>
    api.get(`/admin/dispatch/nearby/${rideId}`, { params }),
  assignDriver: (rideId: string, driverId: string, reason?: string) =>
    api.post(`/admin/dispatch/${rideId}/assign`, { driverId, reason }),
};

// ════════════════════════════════════════════════════════════════════
// FINANCE API (settlements + invoices)
// ════════════════════════════════════════════════════════════════════

export const financeAPI = {
  // Settlements
  listSettlements: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    utr?: string;
    razorpayPaymentId?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get('/admin/settlements', { params }),

  importSettlements: (data: { source: 'csv' | 'json'; batchId?: string; data: string | any[] }) =>
    api.post('/admin/settlements/import', data),

  reconcileSettlements: (body?: { batchId?: string; settlementIds?: string[] }) =>
    api.post('/admin/settlements/reconcile', body || {}),

  updateSettlement: (id: string, data: { status?: string; notes?: string; mismatchReason?: string }) =>
    api.patch(`/admin/settlements/${id}`, data),

  // Invoices
  listInvoices: (params?: {
    page?: number;
    limit?: number;
    type?: 'customer' | 'driver_payout' | 'tds_certificate';
    status?: string;
    customer?: string;
    driver?: string;
    ride?: string;
    invoiceNumber?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get('/admin/invoices', { params }),

  getInvoice: (id: string) => api.get(`/admin/invoices/${id}`),

  invoicePdfUrl: (id: string) => {
    const token = useAuthStore.getState().token;
    return `${API_BASE_URL}/admin/invoices/${id}/pdf${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  createCustomerInvoice: (data: {
    rideId: string;
    receiverName?: string;
    receiverGstin?: string;
    receiverState?: string;
    receiverAddress?: string;
    issue?: boolean;
  }) => api.post('/admin/invoices/customer', data),

  createDriverPayoutInvoice: (data: {
    driverId: string;
    rideId?: string;
    grossAmount?: number;
    issue?: boolean;
  }) => api.post('/admin/invoices/driver-payout', data),

  issueInvoice: (id: string) => api.post(`/admin/invoices/${id}/issue`),
  cancelInvoice: (id: string, reason?: string) =>
    api.post(`/admin/invoices/${id}/cancel`, { reason }),
};

// ════════════════════════════════════════════════════════════════════
// SUPPORT TICKETING API
// ════════════════════════════════════════════════════════════════════

export const supportAPI = {
  list: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    category?: string;
    assignedTo?: string;
    submittedByRole?: 'customer' | 'driver';
    q?: string;
    startDate?: string;
    endDate?: string;
    /** Filter by ticket tag — e.g. 'doc-update' for driver-requested document changes. */
    tag?: string;
  }) => api.get('/admin/tickets', { params }),

  get: (id: string) => api.get(`/admin/tickets/${id}`),

  update: (
    id: string,
    body: {
      status?: string;
      priority?: string;
      assignedTo?: string | null;
      tags?: string[];
      resolution?: string;
    }
  ) => api.patch(`/admin/tickets/${id}`, body),

  assign: (id: string, body: { adminId?: string | null; claim?: boolean }) =>
    api.post(`/admin/tickets/${id}/assign`, body),

  reply: (id: string, body: { body: string; attachments?: string[]; internal?: boolean }) =>
    api.post(`/admin/tickets/${id}/messages`, body),

  stats: () => api.get('/admin/tickets-stats'),
};

// ════════════════════════════════════════════════════════════════════
// REPORTS / HEATMAP / EXPORTS API
// ════════════════════════════════════════════════════════════════════

export const reportsAPI = {
  getHeatmap: (params?: {
    type?: 'pickup' | 'dropoff';
    startDate?: string;
    endDate?: string;
    status?: string;
    rideType?: string;
    precision?: number;
  }) => api.get('/admin/heatmap', { params }),

  listExports: () => api.get('/admin/exports'),

  /**
   * Download a CSV using axios (carries auth header) and trigger a browser download.
   */
  downloadCsv: async (
    type: string,
    params?: Record<string, string | number | undefined>
  ) => {
    const res = await api.get(`/admin/exports/${type}.csv`, {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([res.data as BlobPart], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ukcaar-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

// ════════════════════════════════════════════════════════════════════
// DRIVER INCENTIVES API
// ════════════════════════════════════════════════════════════════════

export const incentivesAPI = {
  list: (params?: {
    active?: boolean;
    period?: string;
    target?: string;
    q?: string;
  }) => api.get('/admin/incentives', { params }),
  get: (id: string) => api.get(`/admin/incentives/${id}`),
  create: (data: any) => api.post('/admin/incentives', data),
  update: (id: string, data: any) => api.patch(`/admin/incentives/${id}`, data),
  remove: (id: string) => api.delete(`/admin/incentives/${id}`),
  progressFor: (id: string, params?: any) =>
    api.get(`/admin/incentives/${id}/progress`, { params }),
  progressAll: (params?: any) => api.get('/admin/incentives-progress', { params }),
  payout: (progressId: string, data?: { paymentRef?: string; notes?: string }) =>
    api.post(`/admin/incentives/progress/${progressId}/payout`, data ?? {}),
  payoutBulk: (ids: string[], paymentRef?: string) =>
    api.post('/admin/incentives/payout-bulk', { ids, paymentRef }),
};

// ════════════════════════════════════════════════════════════════════
// CUSTOMER LOYALTY API
// ════════════════════════════════════════════════════════════════════

export const loyaltyAPI = {
  // Tiers
  listTiers: () => api.get('/admin/loyalty/tiers'),
  createTier: (data: any) => api.post('/admin/loyalty/tiers', data),
  updateTier: (id: string, data: any) => api.patch(`/admin/loyalty/tiers/${id}`, data),
  deleteTier: (id: string) => api.delete(`/admin/loyalty/tiers/${id}`),

  // Rewards
  listRewards: (params?: { active?: boolean; type?: string }) =>
    api.get('/admin/loyalty/rewards', { params }),
  createReward: (data: any) => api.post('/admin/loyalty/rewards', data),
  updateReward: (id: string, data: any) => api.patch(`/admin/loyalty/rewards/${id}`, data),
  deleteReward: (id: string) => api.delete(`/admin/loyalty/rewards/${id}`),

  // Accounts
  listAccounts: (params?: { tierKey?: string; user?: string; limit?: number }) =>
    api.get('/admin/loyalty/accounts', { params }),
  getAccount: (userId: string) => api.get(`/admin/loyalty/accounts/${userId}`),
  adjustPoints: (userId: string, data: { points: number; description?: string; reference?: string }) =>
    api.post(`/admin/loyalty/accounts/${userId}/adjust`, data),
  recalcTier: (userId: string) =>
    api.post(`/admin/loyalty/accounts/${userId}/recalc-tier`),

  // Redemptions
  listRedemptions: (params?: { status?: string; user?: string; code?: string }) =>
    api.get('/admin/loyalty/redemptions', { params }),
  cancelRedemption: (id: string) =>
    api.post(`/admin/loyalty/redemptions/${id}/cancel`),

  // Stats
  stats: () => api.get('/admin/loyalty/stats'),
};

// ════════════════════════════════════════════════════════════════════
// ZONES + SURGE
// ════════════════════════════════════════════════════════════════════

export const zonesAPI = {
  listZones: (params?: { kind?: string; isActive?: boolean }) =>
    api.get('/admin/zones', { params }),
  getZone: (id: string) => api.get(`/admin/zones/${id}`),
  createZone: (data: any) => api.post('/admin/zones', data),
  updateZone: (id: string, data: any) => api.patch(`/admin/zones/${id}`, data),
  deleteZone: (id: string) => api.delete(`/admin/zones/${id}`),

  listSurgeRules: (params?: { isActive?: boolean; zone?: string }) =>
    api.get('/admin/surge-rules', { params }),
  createSurgeRule: (data: any) => api.post('/admin/surge-rules', data),
  updateSurgeRule: (id: string, data: any) =>
    api.patch(`/admin/surge-rules/${id}`, data),
  deleteSurgeRule: (id: string) => api.delete(`/admin/surge-rules/${id}`),

  probe: (data: { lat: number; lng: number; subtotal?: number; when?: string }) =>
    api.post('/admin/surge/probe', data),
};

// ════════════════════════════════════════════════════════════════════
// ROUTES (private + scheduled)
// ════════════════════════════════════════════════════════════════════

export const routesAPI = {
  list: (params?: { type?: 'private' | 'scheduled'; isActive?: boolean; search?: string }) =>
    api.get('/admin/routes', { params }),
  get: (id: string) => api.get(`/admin/routes/${id}`),
  create: (data: any) => api.post('/admin/routes', data),
  update: (id: string, data: any) => api.patch(`/admin/routes/${id}`, data),
  remove: (id: string) => api.delete(`/admin/routes/${id}`),
  addDriver: (id: string, driverId: string, data?: { status?: string; note?: string }) =>
    api.post(`/admin/routes/${id}/drivers`, { driverId, ...data }),
  updateDriver: (id: string, driverId: string, data: { status: string; note?: string }) =>
    api.patch(`/admin/routes/${id}/drivers/${driverId}`, data),
  removeDriver: (id: string, driverId: string) =>
    api.delete(`/admin/routes/${id}/drivers/${driverId}`),
  assignUser: (id: string, userId: string) =>
    api.post(`/admin/routes/${id}/assigned-users`, { userId }),
  unassignUser: (id: string, userId: string) =>
    api.delete(`/admin/routes/${id}/assigned-users/${userId}`),
};

// ════════════════════════════════════════════════════════════════════
// GEO (address autocomplete + reverse geocoding via backend Nominatim proxy)
// ════════════════════════════════════════════════════════════════════

export interface GeoPlace {
  id: string;
  displayName: string;
  address: string;
  lat: number;
  lng: number;
  parts?: {
    houseNumber?: string;
    road?: string;
    area?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    countryCode?: string;
  };
}

export const geoAPI = {
  autocomplete: (q: string, opts?: { countrycodes?: string; limit?: number }) =>
    api.get<{ success: boolean; data: { results: GeoPlace[] } }>('/geo/autocomplete', {
      params: {
        q,
        countrycodes: opts?.countrycodes ?? 'in',
        limit: opts?.limit ?? 8,
      },
    }),
  reverse: (lat: number, lng: number) =>
    api.get('/geo/reverse', { params: { lat, lng } }),
};

// ════════════════════════════════════════════════════════════════════
// NOTIFICATION TEMPLATES
// ════════════════════════════════════════════════════════════════════

export const notificationTemplatesAPI = {
  list: (params?: { search?: string; type?: string; locale?: string; isActive?: boolean }) =>
    api.get('/admin/notification-templates', { params }),
  get: (id: string) => api.get(`/admin/notification-templates/${id}`),
  create: (data: any) => api.post('/admin/notification-templates', data),
  update: (id: string, data: any) => api.patch(`/admin/notification-templates/${id}`, data),
  remove: (id: string) => api.delete(`/admin/notification-templates/${id}`),
  preview: (data: { titleTemplate: string; bodyTemplate: string; vars: Record<string, any> }) =>
    api.post('/admin/notification-templates/preview', data),
  test: (id: string, data: { userId: string; vars?: Record<string, any> }) =>
    api.post(`/admin/notification-templates/${id}/test`, data),
};

// ════════════════════════════════════════════════════════════════════
// VEHICLE + FUEL TYPES
// ════════════════════════════════════════════════════════════════════

export interface CatalogueType {
  _id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  /**
   * Vehicle-type-only: which service tier this type belongs to. The
   * customer app shows two tabs ("Instant" / "Private") and lists only
   * the matching types. Fuel types ignore this field.
   */
  tier?: 'instant' | 'private';
  // Vehicle-type-only pricing. The customer's /rides/estimate and the
  // ride-create flow look these up by code and fall back to the legacy
  // baseFares table when a field is blank.
  baseFare?: number;
  perKmFare?: number;
  perMinFare?: number;
  minFare?: number;
  createdAt?: string;
  updatedAt?: string;
}

export const vehicleTypesAPI = {
  list: () => api.get('/admin/vehicle-types'),
  create: (data: Partial<CatalogueType>) => api.post('/admin/vehicle-types', data),
  update: (id: string, data: Partial<CatalogueType>) =>
    api.put(`/admin/vehicle-types/${id}`, data),
  remove: (id: string) => api.delete(`/admin/vehicle-types/${id}`),
};

export const fuelTypesAPI = {
  list: () => api.get('/admin/fuel-types'),
  create: (data: Partial<CatalogueType>) => api.post('/admin/fuel-types', data),
  update: (id: string, data: Partial<CatalogueType>) =>
    api.put(`/admin/fuel-types/${id}`, data),
  remove: (id: string) => api.delete(`/admin/fuel-types/${id}`),
};

// ════════════════════════════════════════════════════════════════════
// FAQs (admin-managed help content for customer + driver apps)
// ════════════════════════════════════════════════════════════════════

export type FaqAudience = 'user' | 'driver' | 'both';

export interface Faq {
  _id: string;
  question: string;
  answer: string;
  audience: FaqAudience;
  isActive: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export const faqsAPI = {
  list: (params?: { audience?: FaqAudience; isActive?: boolean; search?: string }) =>
    api.get('/admin/faqs', { params }),
  create: (data: Partial<Faq>) => api.post('/admin/faqs', data),
  update: (id: string, data: Partial<Faq>) => api.put(`/admin/faqs/${id}`, data),
  remove: (id: string) => api.delete(`/admin/faqs/${id}`),
};

// ════════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS API
// ════════════════════════════════════════════════════════════════════

export const subscriptionsAPI = {
  // Plans CRUD
  getPlans: (params?: { target?: 'driver' | 'customer'; type?: string; isActive?: boolean }) =>
    api.get('/admin/subscription-plans', { params }),
  createPlan: (data: any) => api.post('/admin/subscription-plans', data),
  updatePlan: (id: string, data: any) => api.patch(`/admin/subscription-plans/${id}`, data),
  deletePlan: (id: string) => api.delete(`/admin/subscription-plans/${id}`),
  togglePlan: (id: string, isActive: boolean) =>
    api.patch(`/admin/subscription-plans/${id}/toggle`, { isActive }),

  // Subscribers
  getSubscribers: (params?: Record<string, string | number>) =>
    api.get('/admin/subscriptions', { params }),
  getSubscriber: (id: string) => api.get(`/admin/subscriptions/${id}`),
  grantSubscription: (data: { userId: string; userType: string; planId: string; reason?: string }) =>
    api.post('/admin/subscriptions/grant', data),
  cancelSubscription: (id: string, reason: string) =>
    api.post(`/admin/subscriptions/${id}/cancel`, { reason }),
  extendSubscription: (id: string, days: number) =>
    api.post(`/admin/subscriptions/${id}/extend`, { days }),

  // Stats & Revenue
  getStats: () => api.get('/admin/subscriptions/stats'),
  getRevenue: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/admin/subscriptions/revenue', { params }),
};

export default api;
