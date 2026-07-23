import { lazy, Suspense } from 'react';
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import MainLayout from '@/layouts/MainLayout';
import { LoadingSpinner } from '@/components/common';

// Lazy load pages
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const UsersPage = lazy(() => import('@/pages/UsersPage'));
const DriversPage = lazy(() => import('@/pages/DriversPage'));
const RidesPage = lazy(() => import('@/pages/RidesPage'));
const PaymentsPage = lazy(() => import('@/pages/PaymentsPage'));
const PromosPage = lazy(() => import('@/pages/PromosPage'));
const RechargeOffersPage = lazy(() => import('@/pages/RechargeOffersPage'));
const OnePassPage = lazy(() => import('@/pages/OnePassPage'));
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const AdminsPage = lazy(() => import('@/pages/AdminsPage'));
const AuditLogPage = lazy(() => import('@/pages/AuditLogPage'));
const LiveMapPage = lazy(() => import('@/pages/LiveMapPage'));
const SettlementsPage = lazy(() => import('@/pages/SettlementsPage'));
const InvoicesPage = lazy(() => import('@/pages/InvoicesPage'));
const SupportPage = lazy(() => import('@/pages/SupportPage'));
const HeatmapPage = lazy(() => import('@/pages/HeatmapPage'));
const ExportsPage = lazy(() => import('@/pages/ExportsPage'));
const IncentivesPage = lazy(() => import('@/pages/IncentivesPage'));
const LoyaltyPage = lazy(() => import('@/pages/LoyaltyPage'));
const ZonesPage = lazy(() => import('@/pages/ZonesPage'));
const RoutesPage = lazy(() => import('@/pages/RoutesPage'));
const NotificationTemplatesPage = lazy(() => import('@/pages/NotificationTemplatesPage'));
const VehicleTypesPage = lazy(() => import('@/pages/VehicleTypesPage'));
const FaqsPage = lazy(() => import('@/pages/FaqsPage'));
const FareCalculationPage = lazy(() => import('@/pages/FareCalculationPage'));
// SubscriptionsPage route intentionally removed — feature hidden (admin-only, inert).
// Re-add this lazy import + the /subscriptions <Route> below to restore it.
const ReferralsPage = lazy(() => import('@/pages/ReferralsPage'));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PermissionGuard({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  if (!hasPermission(permission as never)) {
    return (
      <div className="p-8 text-center text-gray-600">
        You do not have permission to view this page.
      </div>
    );
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  // Refresh permissions on app load if we have a stored session.
  const { isAuthenticated, refreshPermissions } = useAuthStore();
  useEffect(() => {
    if (isAuthenticated) {
      refreshPermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicRoute>
              <ResetPasswordPage />
            </PublicRoute>
          }
        />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route
            path="referrals"
            element={
              <PermissionGuard permission="view_referrals">
                <ReferralsPage />
              </PermissionGuard>
            }
          />
          <Route path="drivers" element={<DriversPage />} />
          <Route path="rides" element={<RidesPage />} />
          <Route
            path="live-map"
            element={
              <PermissionGuard permission="manage_rides">
                <LiveMapPage />
              </PermissionGuard>
            }
          />
          <Route path="payments" element={<PaymentsPage />} />
          <Route
            path="settlements"
            element={
              <PermissionGuard permission="view_settlements">
                <SettlementsPage />
              </PermissionGuard>
            }
          />
          <Route
            path="invoices"
            element={
              <PermissionGuard permission="manage_invoices">
                <InvoicesPage />
              </PermissionGuard>
            }
          />
          <Route
            path="support"
            element={
              <PermissionGuard permission="view_tickets">
                <SupportPage />
              </PermissionGuard>
            }
          />
          <Route
            path="heatmap"
            element={
              <PermissionGuard permission="view_analytics">
                <HeatmapPage />
              </PermissionGuard>
            }
          />
          <Route
            path="exports"
            element={
              <PermissionGuard permission="export_reports">
                <ExportsPage />
              </PermissionGuard>
            }
          />
          <Route
            path="incentives"
            element={
              <PermissionGuard permission="view_incentives">
                <IncentivesPage />
              </PermissionGuard>
            }
          />
          <Route
            path="loyalty"
            element={
              <PermissionGuard permission="view_loyalty">
                <LoyaltyPage />
              </PermissionGuard>
            }
          />
          <Route
            path="zones"
            element={
              <PermissionGuard permission="view_zones">
                <ZonesPage />
              </PermissionGuard>
            }
          />
          <Route
            path="routes"
            element={
              <PermissionGuard permission="view_routes">
                <RoutesPage />
              </PermissionGuard>
            }
          />
          <Route
            path="notification-templates"
            element={
              <PermissionGuard permission="view_notification_templates">
                <NotificationTemplatesPage />
              </PermissionGuard>
            }
          />
          <Route
            path="vehicle-types"
            element={
              <PermissionGuard permission="view_settings">
                <VehicleTypesPage />
              </PermissionGuard>
            }
          />
          <Route
            path="faqs"
            element={
              <PermissionGuard permission="view_faqs">
                <FaqsPage />
              </PermissionGuard>
            }
          />
          <Route
            path="fare-calculation"
            element={
              <PermissionGuard permission="view_settings">
                <FareCalculationPage />
              </PermissionGuard>
            }
          />
          <Route path="promos" element={<PromosPage />} />
          <Route
            path="recharge-offers"
            element={
              <PermissionGuard permission="view_promos">
                <RechargeOffersPage />
              </PermissionGuard>
            }
          />
          <Route path="onepass" element={<OnePassPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route
            path="admins"
            element={
              <PermissionGuard permission="manage_admins">
                <AdminsPage />
              </PermissionGuard>
            }
          />
          <Route
            path="audit-logs"
            element={
              <PermissionGuard permission="view_audit_log">
                <AuditLogPage />
              </PermissionGuard>
            }
          />
        </Route>

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#333',
              color: '#fff',
              borderRadius: '8px',
            },
            success: {
              style: {
                background: '#10B981',
              },
            },
            error: {
              style: {
                background: '#EF4444',
              },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
