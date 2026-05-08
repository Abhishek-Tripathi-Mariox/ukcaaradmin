/**
 * Mirror of backend permission constants. Keep in sync with
 * ukcaar-backend/src/config/permissions.ts.
 */
export const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_ANALYTICS: 'view_analytics',
  EXPORT_REPORTS: 'export_reports',
  VIEW_USERS: 'view_users',
  MANAGE_USERS: 'manage_users',
  IMPERSONATE_USER: 'impersonate_user',
  VIEW_DRIVERS: 'view_drivers',
  MANAGE_DRIVERS: 'manage_drivers',
  APPROVE_DRIVERS: 'approve_drivers',
  FORCE_OFFLINE: 'force_offline',
  VIEW_RIDES: 'view_rides',
  MANAGE_RIDES: 'manage_rides',
  ADJUST_FARE: 'adjust_fare',
  RESOLVE_DISPUTE: 'resolve_dispute',
  VIEW_PAYMENTS: 'view_payments',
  REFUND_PAYMENTS: 'refund_payments',
  PROCESS_PAYOUTS: 'process_payouts',
  ADJUST_WALLET: 'adjust_wallet',
  VIEW_SETTLEMENTS: 'view_settlements',
  RECONCILE_SETTLEMENTS: 'reconcile_settlements',
  MANAGE_INVOICES: 'manage_invoices',
  VIEW_PROMOS: 'view_promos',
  MANAGE_PROMOS: 'manage_promos',
  VIEW_ONEPASS: 'view_onepass',
  MANAGE_ONEPASS: 'manage_onepass',
  VIEW_CHATS: 'view_chats',
  VIEW_TICKETS: 'view_tickets',
  MANAGE_TICKETS: 'manage_tickets',
  ASSIGN_TICKETS: 'assign_tickets',
  SEND_NOTIFICATIONS: 'send_notifications',
  VIEW_INCENTIVES: 'view_incentives',
  MANAGE_INCENTIVES: 'manage_incentives',
  PAYOUT_INCENTIVES: 'payout_incentives',
  VIEW_LOYALTY: 'view_loyalty',
  MANAGE_LOYALTY: 'manage_loyalty',
  ADJUST_LOYALTY_POINTS: 'adjust_loyalty_points',
  VIEW_ZONES: 'view_zones',
  MANAGE_ZONES: 'manage_zones',
  VIEW_ROUTES: 'view_routes',
  MANAGE_ROUTES: 'manage_routes',
  VIEW_NOTIFICATION_TEMPLATES: 'view_notification_templates',
  MANAGE_NOTIFICATION_TEMPLATES: 'manage_notification_templates',
  VIEW_SETTINGS: 'view_settings',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_ADMINS: 'manage_admins',
  VIEW_AUDIT_LOG: 'view_audit_log',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ADMIN_ROLES = ['super_admin', 'support', 'finance', 'ops_viewer'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  support: 'Support',
  finance: 'Finance',
  ops_viewer: 'Ops Viewer',
};
