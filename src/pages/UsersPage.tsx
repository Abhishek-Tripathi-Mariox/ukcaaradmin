import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersAPI } from '@/services/api';
import { DataTable, Pagination } from '@/components/DataTable';
import { Modal, ConfirmModal } from '@/components/Modal';
import { PageHeader, StatusBadge, LoadingSpinner, RefreshButton } from '@/components/common';
import {
  Search,
  Eye,
  Ban,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Mail,
  Phone,
  MapPin,
  Wallet as WalletIcon,
  TrendingUp,
  XCircle,
  Calendar,
  CreditCard,
  Activity,
  Star,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import type { User } from '@/types';

// ════════════════════════════════════════════════════════════════════
// AVATAR
// ════════════════════════════════════════════════════════════════════

function Avatar({
  user,
  size = 40,
}: {
  user: { firstName?: string; lastName?: string; avatar?: string; phone?: string };
  size?: number;
}) {
  const [errored, setErrored] = useState(false);
  const initials =
    `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
    user.phone?.slice(-2) ||
    '?';

  if (user.avatar && !errored) {
    return (
      <img
        src={user.avatar}
        alt={initials}
        onError={() => setErrored(true)}
        className="rounded-full object-cover bg-gray-100"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-medium"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

function displayName(u: { firstName?: string; lastName?: string; phone?: string }) {
  const fn = (u.firstName || '').trim();
  const ln = (u.lastName || '').trim();
  if (fn || ln) return `${fn} ${ln}`.trim();
  return u.phone || '— Unnamed customer';
}

// ════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['users', page, search, statusFilter],
    queryFn: async () => {
      const params: any = { page, limit: 10, role: 'customer' };
      if (search) params.search = search;
      if (statusFilter === 'active') params.isActive = true;
      else if (statusFilter === 'inactive') params.isActive = false;
      const res = await usersAPI.getAll(params);
      return res.data?.data ?? { users: [], pagination: { page: 1, pages: 1, total: 0 } };
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, isActive, reason }: { id: string; isActive: boolean; reason?: string }) =>
      usersAPI.updateStatus(id, isActive, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User status updated');
      setShowStatusModal(false);
      setStatusReason('');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const columns = [
    {
      key: 'name',
      header: 'Customer',
      render: (user: User) => (
        <div className="flex items-center gap-3">
          <Avatar user={user} size={40} />
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate">{displayName(user)}</div>
            <div className="text-xs text-gray-500 truncate">
              {user.email || user.phone || '—'}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (user: User) => (
        <span className="text-gray-600 text-sm">{user.phone || '-'}</span>
      ),
    },
    {
      key: 'verified',
      header: 'Verified',
      render: (user: User) =>
        user.isVerified ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <XCircle className="w-4 h-4 text-gray-300" />
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (user: User) => (
        <StatusBadge status={user.isActive ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (user: User) =>
        user.rating && user.rating.count > 0 ? (
          <span className="inline-flex items-center gap-1 text-sm text-gray-700">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            {user.rating.average.toFixed(1)}
            <span className="text-xs text-gray-400">({user.rating.count})</span>
          </span>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (user: User) => (
        <span className="text-gray-600 text-sm">
          {format(new Date(user.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedUser(user);
              setShowDetails(true);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="View Details"
          >
            <Eye className="w-4 h-4 text-gray-500" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              updateStatusMutation.mutate({
                id: user._id,
                isActive: !user.isActive,
              });
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title={user.isActive ? 'Deactivate user' : 'Activate user'}
          >
            {user.isActive ? (
              <ToggleRight className="w-5 h-5 text-green-600" />
            ) : (
              <ToggleLeft className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Manage customer accounts and their status"
        actions={<RefreshButton onRefresh={refetch} isFetching={isFetching} />}
      />

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="input w-full sm:w-40"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.users ?? []}
            keyExtractor={(user) => user._id}
          />
          {data?.pagination && (
            <Pagination
              page={page}
              totalPages={data.pagination.pages}
              total={data.pagination.total}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {/* User Details Modal */}
      {selectedUser && showDetails && (
        <UserDetailModal
          userId={selectedUser._id}
          onClose={() => setShowDetails(false)}
        />
      )}

      {/* Status Change Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setStatusReason('');
        }}
        title={selectedUser?.isActive ? 'Deactivate User' : 'Activate User'}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            {selectedUser?.isActive
              ? `Are you sure you want to deactivate ${displayName(selectedUser ?? {})}'s account?`
              : `Are you sure you want to activate ${displayName(selectedUser ?? {})}'s account?`}
          </p>
          {selectedUser?.isActive && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className="input"
                rows={3}
                placeholder="Enter reason for deactivation..."
              />
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowStatusModal(false);
                setStatusReason('');
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedUser) {
                  updateStatusMutation.mutate({
                    id: selectedUser._id,
                    isActive: !selectedUser.isActive,
                    reason: statusReason || undefined,
                  });
                }
              }}
              className={selectedUser?.isActive ? 'btn btn-danger' : 'btn btn-success'}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending
                ? 'Processing...'
                : selectedUser?.isActive
                ? 'Deactivate'
                : 'Activate'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// USER DETAIL MODAL — analytics + recent rides + payments
// ════════════════════════════════════════════════════════════════════

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  completed: 'success',
  cancelled: 'danger',
  pending: 'warning',
  accepted: 'warning',
  arrived: 'warning',
  in_progress: 'warning',
  no_show: 'danger',
};

function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['user-detail', userId],
    queryFn: async () => (await usersAPI.getById(userId)).data.data,
  });

  const monthBars = useMemo(() => {
    const months = q.data?.stats?.ridesByMonth ?? [];
    if (!months.length) return [];
    const max = Math.max(...months.map((m: any) => m.count), 1);
    return months.map((m: any) => ({
      label: `${MONTH_LABELS[m._id.m - 1]} ${String(m._id.y).slice(2)}`,
      count: m.count,
      spent: m.spent,
      pct: Math.round((m.count / max) * 100),
    }));
  }, [q.data]);

  return (
    <Modal isOpen onClose={onClose} title="Customer profile" size="xl">
      {q.isLoading || !q.data ? (
        <div className="py-8 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <UserDetailContent data={q.data} monthBars={monthBars} />
      )}
    </Modal>
  );
}

function UserDetailContent({ data, monthBars }: { data: any; monthBars: any[] }) {
  const u = data.user;
  const s = data.stats ?? {};
  const w = data.wallet;
  const rides = data.rides ?? [];
  const payments = data.payments ?? [];
  const rating = data.rating ?? { average: 0, count: 0, distribution: {} };
  const driverFeedback = data.driverFeedback ?? [];
  const currency = (n: number) =>
    `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Avatar user={u} size={72} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold">{displayName(u)}</h3>
            <StatusBadge status={u.isActive ? 'active' : 'inactive'} />
            {u.isVerified && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                Verified
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" /> {u.phone || '—'}
            </span>
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" /> {u.email || '—'}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Joined{' '}
              {format(new Date(u.createdAt), 'PP')}
            </span>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Total bookings"
          value={s.totalRides ?? 0}
          icon={<Activity className="w-5 h-5 text-blue-500" />}
        />
        <Stat
          label="Completed"
          value={s.completedRides ?? 0}
          sub={`${s.completionRate ?? 0}% completion`}
          icon={<CheckCircle className="w-5 h-5 text-green-500" />}
        />
        <Stat
          label="Cancelled"
          value={s.cancelledRides ?? 0}
          icon={<XCircle className="w-5 h-5 text-red-500" />}
        />
        <Stat
          label="Last 30 days"
          value={s.last30dRides ?? 0}
          sub="bookings"
          icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
        />
        <Stat
          label="Total spent"
          value={currency(s.totalSpent ?? 0)}
          icon={<CreditCard className="w-5 h-5 text-amber-500" />}
        />
        <Stat label="Avg fare" value={currency(s.avgFare ?? 0)} />
        <Stat
          label="Distance"
          value={`${(s.totalDistanceKm ?? 0).toFixed(1)} km`}
          icon={<MapPin className="w-5 h-5 text-indigo-500" />}
        />
        <Stat
          label="Wallet balance"
          value={currency(w?.balance ?? 0)}
          icon={<WalletIcon className="w-5 h-5 text-emerald-500" />}
        />
      </div>

      {/* Rating from drivers */}
      <div className="bg-white border rounded-lg p-4">
        <div className="text-sm font-semibold mb-3">Rating from drivers</div>
        {rating.count === 0 ? (
          <div className="text-xs text-gray-500">No driver feedback yet</div>
        ) : (
          <div className="grid md:grid-cols-[200px_1fr] gap-5">
            {/* Average + stars */}
            <div className="flex flex-col items-center justify-center text-center border-r-0 md:border-r md:pr-5">
              <div className="text-4xl font-bold leading-none">
                {rating.average.toFixed(1)}
              </div>
              <StarRow value={rating.average} className="mt-2" />
              <div className="text-xs text-gray-500 mt-1">
                {rating.count} rating{rating.count === 1 ? '' : 's'}
              </div>
            </div>

            {/* Distribution bars */}
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const n = rating.distribution?.[star] ?? 0;
                const pct = rating.count ? Math.round((n / rating.count) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <div className="w-8 flex items-center gap-0.5 text-gray-600">
                      {star} <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    </div>
                    <div className="flex-1 bg-gray-100 rounded h-2.5 overflow-hidden">
                      <div className="bg-amber-400 h-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-8 text-right text-gray-500">{n}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent driver comments */}
        {driverFeedback.length > 0 && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Recent feedback
            </div>
            {driverFeedback.map((f: any) => (
              <div key={f._id} className="text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <StarRow value={f.stars} size={12} />
                  <span className="text-gray-700 font-medium">
                    {f.driver
                      ? `${f.driver.firstName ?? ''} ${f.driver.lastName ?? ''}`.trim() ||
                        'Driver'
                      : 'Driver'}
                  </span>
                  {f.date && (
                    <span className="text-xs text-gray-400">
                      {format(new Date(f.date), 'PP')}
                    </span>
                  )}
                </div>
                {f.comment && <div className="text-gray-600 mt-0.5">{f.comment}</div>}
                {f.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {f.tags.map((t: string, i: number) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bookings by status + monthly chart */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-white border rounded-lg p-3">
          <div className="text-sm font-semibold mb-2">Bookings by status</div>
          {(s.ridesByStatus ?? []).length === 0 ? (
            <div className="text-xs text-gray-500">No bookings yet</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {(s.ridesByStatus ?? []).map((r: any) => (
                  <tr key={r._id} className="border-b last:border-0">
                    <td className="py-1.5">
                      <StatusBadge status={r._id} />
                    </td>
                    <td className="py-1.5 text-right font-medium">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border rounded-lg p-3">
          <div className="text-sm font-semibold mb-2">Last 6 months</div>
          {monthBars.length === 0 ? (
            <div className="text-xs text-gray-500">No bookings in the last 6 months</div>
          ) : (
            <div className="space-y-1.5">
              {monthBars.map((m) => (
                <div key={m.label} className="flex items-center gap-2 text-xs">
                  <div className="w-12 text-gray-500">{m.label}</div>
                  <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
                    <div className="bg-blue-500 h-full" style={{ width: `${m.pct}%` }} />
                  </div>
                  <div className="w-10 text-right font-medium">{m.count}</div>
                  <div className="w-20 text-right text-gray-500">{currency(m.spent)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payments summary */}
      <div className="bg-white border rounded-lg p-3">
        <div className="text-sm font-semibold mb-2">Payments summary</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Paid" value={currency(s.payments?.totalPaid ?? 0)} compact />
          <Stat label="Refunded" value={currency(s.payments?.totalRefunded ?? 0)} compact />
          <Stat label="Failed" value={s.payments?.failedCount ?? 0} compact />
          <Stat
            label="Methods"
            value={(s.paymentsByMethod ?? []).length}
            compact
            sub={(s.paymentsByMethod ?? [])
              .map((m: any) => `${m._id}: ${currency(m.total)}`)
              .join(' · ')}
          />
        </div>
      </div>

      {/* Recent bookings */}
      <div>
        <div className="text-sm font-semibold mb-2">Recent bookings</div>
        <div className="border rounded-lg overflow-hidden">
          {rides.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No bookings yet</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 uppercase text-gray-600">
                <tr>
                  <th className="px-2 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-left">Pickup → Drop</th>
                  <th className="px-2 py-2 text-left">Driver</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Fare</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rides.map((r: any) => (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="px-2 py-2 whitespace-nowrap">
                      {format(new Date(r.createdAt), 'PP p')}
                    </td>
                    <td className="px-2 py-2">
                      <div className="truncate max-w-xs">
                        {r.pickup?.address || r.pickupLocation?.address || '—'}
                      </div>
                      <div className="truncate max-w-xs text-gray-500">
                        → {r.drop?.address || r.dropLocation?.address || '—'}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      {r.driver
                        ? `${r.driver.firstName ?? ''} ${r.driver.lastName ?? ''}`.trim() ||
                          r.driver.phone ||
                          '—'
                        : '—'}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-2 py-2 text-right font-medium">
                      {currency(r.actualFare ?? r.estimatedFare ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent payments */}
      <div>
        <div className="text-sm font-semibold mb-2">Recent payments</div>
        <div className="border rounded-lg overflow-hidden">
          {payments.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No payments yet</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 uppercase text-gray-600">
                <tr>
                  <th className="px-2 py-2 text-left">When</th>
                  <th className="px-2 py-2 text-left">Type</th>
                  <th className="px-2 py-2 text-left">Method</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((p: any) => (
                  <tr key={p._id} className="hover:bg-gray-50">
                    <td className="px-2 py-2 whitespace-nowrap">
                      {format(new Date(p.createdAt), 'PP p')}
                    </td>
                    <td className="px-2 py-2">{p.type}</td>
                    <td className="px-2 py-2 capitalize">{p.method}</td>
                    <td className="px-2 py-2 text-right font-medium">
                      {currency(p.amount)}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StarRow({
  value,
  size = 16,
  className = '',
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = value >= i - 0.25;
        return (
          <Star
            key={i}
            style={{ width: size, height: size }}
            className={filled ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
          />
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
  compact,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`bg-white border rounded-lg ${
        compact ? 'p-2' : 'p-3'
      } flex items-center justify-between`}
    >
      <div className="min-w-0">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
        <div className={`${compact ? 'text-base' : 'text-xl'} font-semibold truncate`}>
          {value}
        </div>
        {sub && <div className="text-[10px] text-gray-500 truncate">{sub}</div>}
      </div>
      {icon}
    </div>
  );
}

// Suppress unused variant constant lint if ever needed
export const __statusVariants = STATUS_VARIANT;
