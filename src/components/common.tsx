import clsx from 'clsx';
import { RefreshCw } from 'lucide-react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
}

const statusVariants: Record<string, BadgeVariant> = {
  // User/Driver status
  active: 'success',
  inactive: 'neutral',
  pending: 'warning',
  suspended: 'danger',
  verified: 'success',
  rejected: 'danger',
  approved: 'success',
  
  // Ride status
  searching: 'warning',
  driver_assigned: 'info',
  driver_arriving: 'info',
  driver_arrived: 'info',
  in_progress: 'info',
  payment_pending: 'warning',
  // Scheduled-shuttle seat reservation surfaced on the admin Rides
  // table — coloured blue so it's distinct from in-flight rides.
  reserved: 'info',
  completed: 'success',
  cancelled: 'danger',
  
  // Payment status
  failed: 'danger',
  refunded: 'warning',
  
  // Document status
  
  // General
  online: 'success',
  offline: 'neutral',
  open: 'warning',
  resolved: 'success',
};

export function StatusBadge({ status, variant }: StatusBadgeProps) {
  const v = variant || statusVariants[status.toLowerCase()] || 'neutral';
  
  const variantClasses: Record<BadgeVariant, string> = {
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    neutral: 'badge-neutral',
  };

  const formattedStatus = status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <span className={clsx('badge', variantClasses[v])}>
      {formattedStatus}
    </span>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'primary' | 'green' | 'yellow' | 'red' | 'purple' | 'blue';
}

export function StatCard({ title, value, icon, change, color = 'primary' }: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    blue: 'bg-blue-50 text-blue-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 card-hover">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <p
              className={clsx(
                'text-sm mt-1',
                change.isPositive ? 'text-green-600' : 'text-red-600'
              )}
            >
              {change.isPositive ? '↑' : '↓'} {Math.abs(change.value)}%
            </p>
          )}
        </div>
        <div className={clsx('p-3 rounded-xl', colorClasses[color])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex justify-center items-center p-8">
      <div
        className={clsx(
          'border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin',
          sizeClasses[size]
        )}
      />
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

// ── Shared refresh button ────────────────────────────────────────────────────
interface RefreshButtonProps {
  onRefresh: () => void;
  isFetching?: boolean;
}

export function RefreshButton({ onRefresh, isFetching = false }: RefreshButtonProps) {
  return (
    <button
      onClick={onRefresh}
      disabled={isFetching}
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
    >
      <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
      Refresh
    </button>
  );
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="mt-4 sm:mt-0">{actions}</div>}
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto w-12 h-12 text-gray-400 mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-500 mb-4">{description}</p>
      {action}
    </div>
  );
}
