import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Award,
  Plus,
  Trash2,
  Coins,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { incentivesAPI } from '@/services/api';
import { Modal, ConfirmModal } from '@/components/Modal';
import {
  PageHeader,
  StatusBadge,
  LoadingSpinner,
  EmptyState,
  RefreshButton,
} from '@/components/common';

interface Incentive {
  _id: string;
  name: string;
  description?: string;
  active: boolean;
  period: 'daily' | 'weekly' | 'monthly';
  target: 'rides' | 'earnings';
  threshold: number;
  rewardType: 'flat' | 'percentage';
  rewardAmount: number;
  rideTypes?: string[];
  vehicleTypes?: string[];
  minRating?: number;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

interface ProgressItem {
  _id: string;
  driver: { _id: string; firstName?: string; lastName?: string; phone?: string };
  incentive: any;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  target: string;
  threshold: number;
  rideCount: number;
  earnings: number;
  progress: number;
  earned: boolean;
  earnedAt?: string;
  rewardAmount: number;
  paidOut: boolean;
  paidOutAt?: string;
}

const periodLabel: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export default function IncentivesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'rules' | 'progress' | 'payouts'>('rules');
  const [filterActive, setFilterActive] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Incentive | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Incentive | null>(null);

  const rulesQ = useQuery({
    queryKey: ['incentives', filterActive],
    queryFn: async () =>
      (
        await incentivesAPI.list({
          active: filterActive === '' ? undefined : filterActive === 'true',
        })
      ).data.data.items as Incentive[],
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Driver incentives"
        subtitle="Performance-based bonuses and payouts"
        actions={
          <div className="flex gap-2">
            <RefreshButton onRefresh={() => rulesQ.refetch()} isFetching={rulesQ.isFetching} />
            <button
              onClick={() => {
                setEditing(null);
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> New incentive
            </button>
          </div>
        }
      />

      <div className="flex gap-2 border-b border-gray-200">
        {(['rules', 'progress', 'payouts'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t === 'rules' ? 'Rules' : t === 'progress' ? 'Progress' : 'Payouts'}
          </button>
        ))}
      </div>

      {tab === 'rules' && (
        <RulesTab
          rulesQ={rulesQ}
          filterActive={filterActive}
          setFilterActive={setFilterActive}
          onEdit={(r) => {
            setEditing(r);
            setCreateOpen(true);
          }}
          onDelete={(r) => setDeleteTarget(r)}
        />
      )}

      {tab === 'progress' && <ProgressTab paidOut={false} />}
      {tab === 'payouts' && <ProgressTab paidOut={true} />}

      {createOpen && (
        <IncentiveFormModal
          incentive={editing}
          onClose={() => {
            setCreateOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['incentives'] });
            setCreateOpen(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await incentivesAPI.remove(deleteTarget._id);
            toast.success('Deleted');
            qc.invalidateQueries({ queryKey: ['incentives'] });
          } catch (e: any) {
            toast.error(e.response?.data?.message || 'Failed');
          } finally {
            setDeleteTarget(null);
          }
        }}
        title="Delete Incentive"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// RULES TAB
// ════════════════════════════════════════════════════════════════════

function RulesTab({
  rulesQ,
  filterActive,
  setFilterActive,
  onEdit,
  onDelete,
}: {
  rulesQ: any;
  filterActive: string;
  setFilterActive: (v: string) => void;
  onEdit: (r: Incentive) => void;
  onDelete: (r: Incentive) => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
      </div>

      {rulesQ.isLoading ? (
        <div className="p-6 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : !rulesQ.data || rulesQ.data.length === 0 ? (
        <EmptyState
          icon={<Award className="w-10 h-10 text-gray-400" />}
          title="No incentives yet"
          description="Create your first driver incentive to reward performance."
        />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Period</th>
              <th className="px-4 py-2 text-left">Target</th>
              <th className="px-4 py-2 text-right">Threshold</th>
              <th className="px-4 py-2 text-right">Reward</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rulesQ.data.map((r: Incentive) => (
              <tr key={r._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.name}</div>
                  {r.description && (
                    <div className="text-xs text-gray-500 line-clamp-1">{r.description}</div>
                  )}
                </td>
                <td className="px-4 py-3">{periodLabel[r.period]}</td>
                <td className="px-4 py-3 capitalize">{r.target}</td>
                <td className="px-4 py-3 text-right">
                  {r.target === 'earnings' ? `₹${r.threshold}` : r.threshold}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.rewardType === 'flat'
                    ? `₹${r.rewardAmount}`
                    : `${r.rewardAmount}%`}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={r.active ? 'Active' : 'Inactive'}
                    variant={r.active ? 'success' : 'neutral'}
                  />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => onEdit(r)}
                    className="px-2 py-1 text-xs text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(r)}
                    className="px-2 py-1 text-xs text-red-600 hover:underline"
                  >
                    <Trash2 className="w-3 h-3 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PROGRESS / PAYOUTS TAB
// ════════════════════════════════════════════════════════════════════

function ProgressTab({ paidOut }: { paidOut: boolean }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paymentRef, setPaymentRef] = useState('');

  const q = useQuery({
    queryKey: ['incentive-progress', paidOut],
    queryFn: async () =>
      (
        await incentivesAPI.progressAll({
          earned: 'true',
          paidOut: paidOut ? 'true' : 'false',
        })
      ).data.data.items as ProgressItem[],
    refetchInterval: 30000,
  });

  const items = q.data ?? [];

  const totals = useMemo(() => {
    const drivers = new Set(items.map((i) => i.driver?._id));
    const reward = items.reduce((s, i) => s + (i.rewardAmount || 0), 0);
    return { drivers: drivers.size, count: items.length, reward };
  }, [items]);

  const payoutMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await incentivesAPI.payoutBulk(ids, paymentRef || undefined);
    },
    onSuccess: () => {
      toast.success('Marked as paid out');
      setSelected(new Set());
      setPaymentRef('');
      qc.invalidateQueries({ queryKey: ['incentive-progress'] });
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Payout failed');
    },
  });

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i._id)));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="Drivers" value={totals.drivers} icon={<Users className="w-5 h-5 text-blue-500" />} />
        <Stat
          label={paidOut ? 'Paid items' : 'Earned items'}
          value={totals.count}
          icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
        />
        <Stat
          label={paidOut ? 'Paid amount' : 'Pending payout'}
          value={`₹${totals.reward.toFixed(2)}`}
          icon={<Coins className="w-5 h-5 text-yellow-500" />}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {!paidOut && selected.size > 0 && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
            <span className="text-sm">{selected.size} selected</span>
            <input
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="Payment ref (optional)"
              className="px-2 py-1 text-sm border border-gray-300 rounded"
            />
            <button
              disabled={payoutMutation.isPending}
              onClick={() => payoutMutation.mutate(Array.from(selected))}
              className="ml-auto px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              Mark paid
            </button>
          </div>
        )}

        {q.isLoading ? (
          <div className="p-6 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Coins className="w-10 h-10 text-gray-400" />}
            title={paidOut ? 'No payouts yet' : 'No earned bonuses pending'}
            description=""
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                {!paidOut && (
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size > 0 && selected.size === items.length}
                      onChange={toggleAll}
                    />
                  </th>
                )}
                <th className="px-4 py-2 text-left">Driver</th>
                <th className="px-4 py-2 text-left">Incentive</th>
                <th className="px-4 py-2 text-left">Period</th>
                <th className="px-4 py-2 text-right">Progress</th>
                <th className="px-4 py-2 text-right">Reward</th>
                <th className="px-4 py-2 text-left">{paidOut ? 'Paid at' : 'Earned at'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it) => (
                <tr key={it._id} className="hover:bg-gray-50">
                  {!paidOut && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(it._id)}
                        onChange={() => {
                          const s = new Set(selected);
                          s.has(it._id) ? s.delete(it._id) : s.add(it._id);
                          setSelected(s);
                        }}
                      />
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <div className="font-medium">
                      {it.driver?.firstName} {it.driver?.lastName}
                    </div>
                    <div className="text-xs text-gray-500">{it.driver?.phone}</div>
                  </td>
                  <td className="px-4 py-2">{it.incentive?.name}</td>
                  <td className="px-4 py-2 text-xs">{it.periodKey}</td>
                  <td className="px-4 py-2 text-right">
                    {it.target === 'earnings'
                      ? `₹${it.progress.toFixed(0)} / ₹${it.threshold}`
                      : `${it.progress} / ${it.threshold}`}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    ₹{it.rewardAmount.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {(paidOut ? it.paidOutAt : it.earnedAt)
                      ? format(new Date((paidOut ? it.paidOutAt : it.earnedAt)!), 'PP p')
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex items-center justify-between">
      <div>
        <div className="text-xs text-gray-500 uppercase">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </div>
      {icon}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// CREATE / EDIT MODAL
// ════════════════════════════════════════════════════════════════════

function IncentiveFormModal({
  incentive,
  onClose,
  onSaved,
}: {
  incentive: Incentive | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: incentive?.name ?? '',
    description: incentive?.description ?? '',
    active: incentive?.active ?? true,
    period: incentive?.period ?? 'daily',
    target: incentive?.target ?? 'rides',
    threshold: incentive?.threshold ?? 10,
    rewardType: incentive?.rewardType ?? 'flat',
    rewardAmount: incentive?.rewardAmount ?? 100,
    minRating: incentive?.minRating ?? 0,
    rideTypes: (incentive?.rideTypes ?? []).join(','),
    startDate: incentive?.startDate?.slice(0, 10) ?? '',
    endDate: incentive?.endDate?.slice(0, 10) ?? '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        description: form.description,
        active: form.active,
        period: form.period,
        target: form.target,
        threshold: Number(form.threshold),
        rewardType: form.rewardType,
        rewardAmount: Number(form.rewardAmount),
        minRating: form.minRating ? Number(form.minRating) : undefined,
        rideTypes: form.rideTypes
          ? form.rideTypes.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      };
      if (incentive) {
        await incentivesAPI.update(incentive._id, payload);
        toast.success('Updated');
      } else {
        await incentivesAPI.create(payload);
        toast.success('Created');
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={incentive ? 'Edit incentive' : 'New incentive'}
      size="lg"
    >
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-600">Name *</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            rows={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600">Period *</label>
            <select
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Target *</label>
            <select
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="rides">Rides count</option>
              <option value="earnings">Earnings (₹)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">
              Threshold * ({form.target === 'rides' ? 'rides' : '₹'})
            </label>
            <input
              type="number"
              value={form.threshold}
              onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Reward type *</label>
            <select
              value={form.rewardType}
              onChange={(e) =>
                setForm({ ...form, rewardType: e.target.value as any })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="flat">Flat ₹</option>
              <option value="percentage">Percentage of earnings</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">
              Reward amount * ({form.rewardType === 'flat' ? '₹' : '%'})
            </label>
            <input
              type="number"
              value={form.rewardAmount}
              onChange={(e) =>
                setForm({ ...form, rewardAmount: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Min driver rating</label>
            <input
              type="number"
              step="0.1"
              min={0}
              max={5}
              value={form.minRating}
              onChange={(e) =>
                setForm({ ...form, minRating: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Start date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">End date</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600">
            Ride types (comma-separated, blank = all)
          </label>
          <input
            value={form.rideTypes}
            onChange={(e) => setForm({ ...form, rideTypes: e.target.value })}
            placeholder="economy,comfort"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Active
        </label>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            disabled={saving || !form.name}
            onClick={submit}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : incentive ? 'Save changes' : 'Create incentive'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
