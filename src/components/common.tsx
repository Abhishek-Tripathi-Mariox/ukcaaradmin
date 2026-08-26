import { useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, HelpCircle, RefreshCw } from 'lucide-react';

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
  const [spinning, setSpinning] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const handleClick = () => {
    setSpinning(true);
    onRefresh();
    setLastRefreshed(new Date());
    setTimeout(() => setSpinning(false), 750);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isFetching || spinning}
      className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition-all disabled:opacity-70"
      title={`Last updated: ${lastRefreshed.toLocaleTimeString()}`}
    >
      <RefreshCw
        className={clsx(
          'w-4 h-4 text-brand-teal transition-transform',
          (isFetching || spinning) && 'animate-spin'
        )}
      />
      <span>Refresh</span>
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

// ── FeatureGuide ────────────────────────────────────────────────────────────
// Collapsible "what does this page actually do" panel. Admins were reading
// these screens without a reference for what each field means or what the
// rider/driver sees as a result, so each guide pairs the admin-side controls
// with their user-side effect. Collapsed state persists per key.

export interface GuideSection {
  heading: string;
  body?: string;
  bullets?: string[];
  /** Field reference: [term, meaning, example]. */
  table?: { head: string[]; rows: string[][] };
}

interface FeatureGuideProps {
  /** Stable id — also the localStorage key for the collapsed state. */
  storageKey: string;
  title: string;
  sections: GuideSection[];
}

export function FeatureGuide({ storageKey, title, sections }: FeatureGuideProps) {
  const lsKey = `ukcaar.admin.guide.${storageKey}`;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      // Default open: an admin who has never seen the page needs it most.
      return localStorage.getItem(lsKey) !== 'closed';
    } catch {
      return true;
    }
  });

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem(lsKey, next ? 'open' : 'closed');
      } catch {
        /* private mode / storage disabled — state is per-session only */
      }
      return next;
    });
  };

  return (
    <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/60">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-blue-900">
          <HelpCircle className="h-4 w-4 shrink-0" />
          {title}
        </span>
        <ChevronDown
          className={clsx(
            'h-4 w-4 shrink-0 text-blue-700 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-blue-200 px-4 py-4">
          {sections.map((s) => (
            <div key={s.heading}>
              <h4 className="text-xs font-bold uppercase tracking-wide text-blue-900">
                {s.heading}
              </h4>
              {s.body && (
                <p className="mt-1 text-sm leading-relaxed text-gray-700">{s.body}</p>
              )}
              {s.bullets && (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {s.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              {s.table && (
                <div className="mt-2 overflow-x-auto rounded-lg border border-blue-200 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-blue-100/70 text-xs uppercase tracking-wide text-blue-900">
                      <tr>
                        {s.table.head.map((h) => (
                          <th key={h} className="px-3 py-2 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100">
                      {s.table.rows.map((r, i) => (
                        <tr key={i} className="align-top">
                          {r.map((c, j) => (
                            <td
                              key={j}
                              className={clsx(
                                'px-3 py-2 text-gray-700',
                                j === 0 && 'whitespace-nowrap font-mono text-xs text-gray-900',
                              )}
                            >
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
