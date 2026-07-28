import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Gift,
  Plus,
  Trash2,
  Award,
  Users,
  TrendingUp,
  Coins,
  Search,
} from 'lucide-react';
import { loyaltyAPI } from '@/services/api';
import { Modal, ConfirmModal } from '@/components/Modal';
import {
  PageHeader,
  StatusBadge,
  LoadingSpinner,
  EmptyState,
  RefreshButton,
} from '@/components/common';

type Tab = 'overview' | 'tiers' | 'rewards' | 'accounts' | 'redemptions';

export default function LoyaltyPage() {
  const qcMain = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');

  const handleRefresh = () => {
    qcMain.refetchQueries({ queryKey: ['loyalty-stats'] });
    qcMain.refetchQueries({ queryKey: ['loyalty-tiers'] });
    qcMain.refetchQueries({ queryKey: ['loyalty-rewards'] });
    qcMain.refetchQueries({ queryKey: ['loyalty-accounts'] });
    qcMain.refetchQueries({ queryKey: ['loyalty-redemptions'] });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customer loyalty"
        subtitle="Tiers, rewards, points balances and redemptions"
        actions={<RefreshButton onRefresh={handleRefresh} />}
      />

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {(['overview', 'tiers', 'rewards', 'accounts', 'redemptions'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize whitespace-nowrap ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'tiers' && <TiersTab />}
      {tab === 'rewards' && <RewardsTab />}
      {tab === 'accounts' && <AccountsTab />}
      {tab === 'redemptions' && <RedemptionsTab />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// OVERVIEW
// ════════════════════════════════════════════════════════════════════

function OverviewTab() {
  const q = useQuery({
    queryKey: ['loyalty-stats'],
    queryFn: async () => (await loyaltyAPI.stats()).data.data,
    refetchInterval: 60000,
  });
  const s = q.data ?? {};
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat
        label="Total accounts"
        value={s.totalAccounts ?? 0}
        icon={<Users className="w-5 h-5 text-blue-500" />}
      />
      <Stat
        label="Points outstanding"
        value={(s.totalPointsOutstanding ?? 0).toLocaleString()}
        icon={<Coins className="w-5 h-5 text-yellow-500" />}
      />
      <Stat
        label="Lifetime points awarded"
        value={(s.totalLifetimePoints ?? 0).toLocaleString()}
        icon={<TrendingUp className="w-5 h-5 text-green-500" />}
      />
      <Stat
        label="Active redemptions"
        value={
          (s.redemptionStats ?? []).find((r: any) => r._id === 'issued')?.count ?? 0
        }
        icon={<Gift className="w-5 h-5 text-purple-500" />}
      />

      <div className="md:col-span-2 bg-white border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-2">Accounts by tier</h3>
        {(s.byTier ?? []).length === 0 ? (
          <div className="text-xs text-gray-500">No tier data</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {(s.byTier ?? []).map((t: any) => (
                <tr key={t._id} className="border-b last:border-b-0">
                  <td className="py-1 capitalize">{t._id}</td>
                  <td className="py-1 text-right">{t.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="md:col-span-2 bg-white border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-2">Redemptions by status</h3>
        {(s.redemptionStats ?? []).length === 0 ? (
          <div className="text-xs text-gray-500">No data</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {(s.redemptionStats ?? []).map((r: any) => (
                <tr key={r._id} className="border-b last:border-b-0">
                  <td className="py-1 capitalize">{r._id}</td>
                  <td className="py-1 text-right">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TIERS
// ════════════════════════════════════════════════════════════════════

function TiersTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const q = useQuery({
    queryKey: ['loyalty-tiers'],
    queryFn: async () => (await loyaltyAPI.listTiers()).data.data.items as any[],
  });

  const remove = async (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New tier
        </button>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        {q.isLoading ? (
          <div className="p-6 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : !q.data || q.data.length === 0 ? (
          <EmptyState
            icon={<Award className="w-10 h-10 text-gray-400" />}
            title="No tiers yet"
            description="Create your first loyalty tier."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left">Order</th>
                <th className="px-4 py-2 text-left">Key</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-right">Min lifetime pts</th>
                <th className="px-4 py-2 text-right">Earn ×</th>
                <th className="px-4 py-2 text-right">Discount %</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {q.data.map((t: any) => (
                <tr key={t._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{t.order}</td>
                  <td className="px-4 py-2 font-mono text-xs">{t.key}</td>
                  <td className="px-4 py-2 font-medium">{t.name}</td>
                  <td className="px-4 py-2 text-right">{t.minLifetimePoints}</td>
                  <td className="px-4 py-2 text-right">{t.earnMultiplier}×</td>
                  <td className="px-4 py-2 text-right">{t.rideDiscountPct}%</td>
                  <td className="px-4 py-2">
                    <StatusBadge
                      status={t.active ? 'Active' : 'Inactive'}
                      variant={t.active ? 'success' : 'neutral'}
                    />
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditing(t);
                        setOpen(true);
                      }}
                      className="px-2 py-1 text-xs text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(t._id, t.name)}
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

      {open && (
        <TierFormModal
          tier={editing}
          onClose={() => setOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['loyalty-tiers'] });
            setOpen(false);
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await loyaltyAPI.deleteTier(deleteTarget.id);
            toast.success('Deleted');
            qc.invalidateQueries({ queryKey: ['loyalty-tiers'] });
          } catch (e: any) {
            toast.error(e.response?.data?.message || 'Failed');
          } finally {
            setDeleteTarget(null);
          }
        }}
        title="Delete Tier"
        message={`Delete tier "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

function TierFormModal({
  tier,
  onClose,
  onSaved,
}: {
  tier: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    key: tier?.key ?? '',
    name: tier?.name ?? '',
    order: tier?.order ?? 1,
    minLifetimePoints: tier?.minLifetimePoints ?? 0,
    earnMultiplier: tier?.earnMultiplier ?? 1,
    rideDiscountPct: tier?.rideDiscountPct ?? 0,
    perksDescription: tier?.perksDescription ?? '',
    active: tier?.active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const payload: any = {
        key: form.key.toLowerCase(),
        name: form.name,
        order: Number(form.order),
        minLifetimePoints: Number(form.minLifetimePoints),
        earnMultiplier: Number(form.earnMultiplier),
        rideDiscountPct: Number(form.rideDiscountPct),
        perksDescription: form.perksDescription,
        active: form.active,
      };
      if (tier) {
        await loyaltyAPI.updateTier(tier._id, payload);
        toast.success('Updated');
      } else {
        await loyaltyAPI.createTier(payload);
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
    <Modal isOpen onClose={onClose} title={tier ? 'Edit tier' : 'New tier'} size="md">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Key (slug) *">
            <input
              disabled={!!tier}
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm disabled:bg-gray-100"
            />
          </Field>
          <Field label="Name *">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </Field>
          <Field label="Order">
            <input
              type="number"
              value={form.order}
              onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </Field>
          <Field label="Min lifetime points">
            <input
              type="number"
              min={0}
              value={form.minLifetimePoints}
              onChange={(e) =>
                setForm({ ...form, minLifetimePoints: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </Field>
          <Field label="Earn multiplier">
            <input
              type="number"
              step="0.1"
              value={form.earnMultiplier}
              onChange={(e) =>
                setForm({ ...form, earnMultiplier: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </Field>
          <Field label="Ride discount (%)">
            <input
              type="number"
              value={form.rideDiscountPct}
              onChange={(e) =>
                setForm({ ...form, rideDiscountPct: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </Field>
        </div>
        <Field label="Perks description">
          <textarea
            value={form.perksDescription}
            onChange={(e) => setForm({ ...form, perksDescription: e.target.value })}
            className="w-full px-3 py-2 border rounded text-sm"
            rows={2}
          />
        </Field>
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
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            disabled={saving || !form.key || !form.name}
            onClick={submit}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════
// REWARDS
// ════════════════════════════════════════════════════════════════════

function RewardsTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const q = useQuery({
    queryKey: ['loyalty-rewards'],
    queryFn: async () => (await loyaltyAPI.listRewards()).data.data.items as any[],
  });

  const remove = async (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New reward
        </button>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        {q.isLoading ? (
          <div className="p-6 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : !q.data || q.data.length === 0 ? (
          <EmptyState
            icon={<Gift className="w-10 h-10 text-gray-400" />}
            title="No rewards yet"
            description="Add rewards customers can redeem with points."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-right">Cost (pts)</th>
                <th className="px-4 py-2 text-right">Value</th>
                <th className="px-4 py-2 text-right">Redemptions</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {q.data.map((r: any) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-xs">{r.type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2 text-right">{r.pointsCost}</td>
                  <td className="px-4 py-2 text-right">
                    {r.type === 'ride_discount_pct' ? `${r.value}%` : `₹${r.value}`}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.totalRedemptionsCount}
                    {r.totalRedemptionLimit ? ` / ${r.totalRedemptionLimit}` : ''}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge
                      status={r.active ? 'Active' : 'Inactive'}
                      variant={r.active ? 'success' : 'neutral'}
                    />
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditing(r);
                        setOpen(true);
                      }}
                      className="px-2 py-1 text-xs text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(r._id, r.name)}
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

      {open && (
        <RewardFormModal
          reward={editing}
          onClose={() => setOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['loyalty-rewards'] });
            setOpen(false);
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await loyaltyAPI.deleteReward(deleteTarget.id);
            toast.success('Deleted');
            qc.invalidateQueries({ queryKey: ['loyalty-rewards'] });
          } catch (e: any) {
            toast.error(e.response?.data?.message || 'Failed');
          } finally {
            setDeleteTarget(null);
          }
        }}
        title="Delete Reward"
        message={`Delete reward "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

function RewardFormModal({
  reward,
  onClose,
  onSaved,
}: {
  reward: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: reward?.name ?? '',
    description: reward?.description ?? '',
    type: reward?.type ?? 'ride_discount_flat',
    pointsCost: reward?.pointsCost ?? 100,
    value: reward?.value ?? 50,
    maxRedemptionsPerUser: reward?.maxRedemptionsPerUser ?? '',
    totalRedemptionLimit: reward?.totalRedemptionLimit ?? '',
    minTierKey: reward?.minTierKey ?? '',
    validFrom: reward?.validFrom?.slice(0, 10) ?? '',
    validUntil: reward?.validUntil?.slice(0, 10) ?? '',
    active: reward?.active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        description: form.description,
        type: form.type,
        pointsCost: Number(form.pointsCost),
        value: Number(form.value),
        // Blank optional fields send null (undefined is JSON-dropped and
        // would silently never clear a previously set value)
        maxRedemptionsPerUser: form.maxRedemptionsPerUser
          ? Number(form.maxRedemptionsPerUser)
          : null,
        totalRedemptionLimit: form.totalRedemptionLimit
          ? Number(form.totalRedemptionLimit)
          : null,
        minTierKey: form.minTierKey || null,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        active: form.active,
      };
      if (reward) {
        await loyaltyAPI.updateReward(reward._id, payload);
        toast.success('Updated');
      } else {
        await loyaltyAPI.createReward(payload);
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
    <Modal isOpen onClose={onClose} title={reward ? 'Edit reward' : 'New reward'} size="lg">
      <div className="space-y-3">
        <Field label="Name *">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border rounded text-sm"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border rounded text-sm"
            rows={2}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type *">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm"
            >
              <option value="ride_discount_flat">Ride discount (₹)</option>
              <option value="ride_discount_pct">Ride discount (%)</option>
              <option value="free_ride">Free ride (max value ₹)</option>
              <option value="wallet_credit">Wallet credit (₹)</option>
              <option value="voucher">Voucher</option>
            </select>
          </Field>
          <Field label="Points cost *">
            <input
              type="number"
              value={form.pointsCost}
              onChange={(e) => setForm({ ...form, pointsCost: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </Field>
          <Field
            label={`Value * (${form.type === 'ride_discount_pct' ? '%' : '₹'})`}
          >
            <input
              type="number"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </Field>
          <Field label="Min tier key (optional)">
            <input
              value={form.minTierKey}
              onChange={(e) => setForm({ ...form, minTierKey: e.target.value })}
              placeholder="silver"
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </Field>
          <Field label="Max per user">
            <input
              type="number"
              value={form.maxRedemptionsPerUser}
              onChange={(e) =>
                setForm({ ...form, maxRedemptionsPerUser: e.target.value })
              }
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </Field>
          <Field label="Total limit">
            <input
              type="number"
              value={form.totalRedemptionLimit}
              onChange={(e) =>
                setForm({ ...form, totalRedemptionLimit: e.target.value })
              }
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </Field>
          <Field label="Valid from">
            <input
              type="date"
              value={form.validFrom}
              onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </Field>
          <Field label="Valid until">
            <input
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </Field>
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
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            disabled={saving || !form.name}
            onClick={submit}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════
// ACCOUNTS
// ════════════════════════════════════════════════════════════════════

function AccountsTab() {
  const [tierKey, setTierKey] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['loyalty-accounts', tierKey],
    queryFn: async () =>
      (
        await loyaltyAPI.listAccounts({
          tierKey: tierKey || undefined,
          limit: 200,
        })
      ).data.data.items as any[],
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <input
          value={tierKey}
          onChange={(e) => setTierKey(e.target.value)}
          placeholder="Filter by tier key (e.g. gold)"
          className="px-3 py-2 border rounded text-sm w-64"
        />
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        {q.isLoading ? (
          <div className="p-6 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : !q.data || q.data.length === 0 ? (
          <EmptyState
            icon={<Users className="w-10 h-10 text-gray-400" />}
            title="No accounts"
            description=""
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Tier</th>
                <th className="px-4 py-2 text-right">Balance</th>
                <th className="px-4 py-2 text-right">Lifetime</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {q.data.map((a: any) => (
                <tr key={a._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="font-medium">
                      {a.user?.firstName} {a.user?.lastName}
                    </div>
                    <div className="text-xs text-gray-500">{a.user?.phone}</div>
                  </td>
                  <td className="px-4 py-2 capitalize">
                    {a.tier?.name || a.tierKey || '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {a.pointsBalance}
                  </td>
                  <td className="px-4 py-2 text-right">{a.lifetimePoints}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => setSelectedUserId(a.user?._id)}
                      className="px-2 py-1 text-xs text-blue-600 hover:underline"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedUserId && (
        <AccountDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}

function AccountDetailModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [points, setPoints] = useState<number>(0);
  const [description, setDescription] = useState('');

  const q = useQuery({
    queryKey: ['loyalty-account', userId],
    queryFn: async () => (await loyaltyAPI.getAccount(userId)).data.data,
  });

  const adjust = async () => {
    if (!points) return toast.error('Enter a non-zero points value');
    try {
      await loyaltyAPI.adjustPoints(userId, { points, description });
      toast.success('Adjusted');
      setPoints(0);
      setDescription('');
      qc.invalidateQueries({ queryKey: ['loyalty-account', userId] });
      qc.invalidateQueries({ queryKey: ['loyalty-accounts'] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  };

  const recalc = async () => {
    try {
      await loyaltyAPI.recalcTier(userId);
      toast.success('Tier recalculated');
      qc.invalidateQueries({ queryKey: ['loyalty-account', userId] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  };

  const data = q.data;

  return (
    <Modal isOpen onClose={onClose} title="Loyalty account" size="xl">
      {q.isLoading || !data ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Balance" value={data.account.pointsBalance} />
            <Stat label="Lifetime" value={data.account.lifetimePoints} />
            <Stat label="Tier" value={data.account.tier?.name ?? '—'} />
          </div>

          <div className="bg-gray-50 border rounded p-3 space-y-2">
            <div className="text-sm font-semibold">Adjust points</div>
            <div className="flex gap-2">
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                placeholder="Points (+/-)"
                className="flex-1 px-3 py-2 border rounded text-sm"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Reason / description"
                className="flex-1 px-3 py-2 border rounded text-sm"
              />
              <button
                onClick={adjust}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Apply
              </button>
              <button
                onClick={recalc}
                className="px-4 py-2 text-sm border rounded hover:bg-white"
              >
                Recalc tier
              </button>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-1">Recent transactions</div>
            <div className="border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left">When</th>
                    <th className="px-2 py-1 text-left">Type</th>
                    <th className="px-2 py-1 text-right">Pts</th>
                    <th className="px-2 py-1 text-right">After</th>
                    <th className="px-2 py-1 text-left">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.transactions.map((t: any) => (
                    <tr key={t._id}>
                      <td className="px-2 py-1">
                        {format(new Date(t.createdAt), 'PP p')}
                      </td>
                      <td className="px-2 py-1">{t.type}</td>
                      <td
                        className={`px-2 py-1 text-right font-medium ${
                          t.points > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {t.points > 0 ? `+${t.points}` : t.points}
                      </td>
                      <td className="px-2 py-1 text-right">{t.balanceAfter}</td>
                      <td className="px-2 py-1">{t.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════
// REDEMPTIONS
// ════════════════════════════════════════════════════════════════════

function RedemptionsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [code, setCode] = useState('');
  const [cancelTarget, setCancelTarget] = useState<{ id: string; code: string } | null>(null);

  const q = useQuery({
    queryKey: ['loyalty-redemptions', status, code],
    queryFn: async () =>
      (
        await loyaltyAPI.listRedemptions({
          status: status || undefined,
          code: code || undefined,
        })
      ).data.data.items as any[],
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => loyaltyAPI.cancelRedemption(id),
    onSuccess: () => {
      toast.success('Cancelled and points refunded');
      qc.invalidateQueries({ queryKey: ['loyalty-redemptions'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="">All statuses</option>
          <option value="issued">Issued</option>
          <option value="used">Used</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2 top-3 text-gray-400" />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Code"
            className="pl-8 pr-3 py-2 border rounded text-sm"
          />
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        {q.isLoading ? (
          <div className="p-6 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : !q.data || q.data.length === 0 ? (
          <EmptyState
            icon={<Gift className="w-10 h-10 text-gray-400" />}
            title="No redemptions"
            description=""
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Reward</th>
                <th className="px-4 py-2 text-right">Points</th>
                <th className="px-4 py-2 text-left">Issued</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {q.data.map((r: any) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2">
                    {r.user?.firstName} {r.user?.lastName}
                    <div className="text-xs text-gray-500">{r.user?.phone}</div>
                  </td>
                  <td className="px-4 py-2">
                    {r.rewardSnapshot?.name || r.reward?.name}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.rewardSnapshot?.pointsCost ?? r.reward?.pointsCost}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {format(new Date(r.issuedAt), 'PP p')}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge
                      status={r.status}
                      variant={
                        r.status === 'issued'
                          ? 'success'
                          : r.status === 'used'
                          ? 'neutral'
                          : r.status === 'expired'
                          ? 'warning'
                          : 'danger'
                      }
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.status === 'issued' && (
                      <button
                        onClick={() => setCancelTarget({ id: r._id, code: r.code })}
                        className="px-2 py-1 text-xs text-red-600 hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          if (!cancelTarget) return;
          cancel.mutate(cancelTarget.id);
          setCancelTarget(null);
        }}
        title="Cancel Redemption"
        message={`Cancel code ${cancelTarget?.code} and refund the points to the customer?`}
        confirmText="Cancel Redemption"
        variant="danger"
        isLoading={cancel.isPending}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      {children}
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
    <div className="bg-white border rounded-lg p-3 flex items-center justify-between">
      <div>
        <div className="text-xs text-gray-500 uppercase">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </div>
      {icon}
    </div>
  );
}
