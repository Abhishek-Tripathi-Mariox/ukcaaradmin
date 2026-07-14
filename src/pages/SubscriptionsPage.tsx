import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsAPI } from '@/services/api';
import { DataTable, Pagination } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { PageHeader, StatusBadge, LoadingSpinner, StatCard, RefreshButton } from '@/components/common';
import { UserSearchSelect, type AdminUserLite } from '@/components/UserSearchSelect';
import {
  Plus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Crown,
  Repeat,
  Car,
  Calendar,
  TrendingUp,
  Users,
  DollarSign,
  Search,
  ChevronRight,
  Layers,
  Zap,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, differenceInDays } from 'date-fns';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanType = 'monthly' | 'weekly' | 'daily' | 'annual' | 'ride_pack' | 'commission';
type PlanTarget = 'driver' | 'customer';

interface SubscriptionPlan {
  _id: string;
  name: string;
  type: PlanType;
  target: PlanTarget;
  price: number;             // INR (0 for pure commission plans)
  commissionRate: number;    // % per ride (0 for flat plans)
  rideLimit: number | null;  // null = unlimited
  validityDays: number;
  benefits: string[];
  isActive: boolean;
  subscriberCount: number;
  createdAt: string;
}

interface Subscriber {
  _id: string;
  driver?: { _id: string; name: string; phone: string };
  customer?: { _id: string; name: string; phone: string };
  plan: SubscriptionPlan;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  startDate: string;
  endDate: string;
  ridesUsed: number;
  autoRenew: boolean;
}

interface Stats {
  totalPlans: number;
  activePlans: number;
  totalSubscribers: number;
  activeSubscribers: number;
  mrr: number;          // Monthly Recurring Revenue
  expiringIn7Days: number;
}

type TabType = 'plans' | 'subscribers' | 'revenue';

// ─── Plan type metadata ───────────────────────────────────────────────────────

const PLAN_TYPE_META: Record<PlanType, { label: string; color: string; icon: typeof Crown; desc: string }> = {
  monthly: {
    label: 'Monthly',
    color: 'bg-blue-100 text-blue-700',
    icon: Calendar,
    desc: 'Fixed monthly fee – unlimited or capped rides',
  },
  weekly: {
    label: 'Weekly',
    color: 'bg-indigo-100 text-indigo-700',
    icon: Repeat,
    desc: 'Short-term weekly access pass',
  },
  daily: {
    label: 'Daily Pass',
    color: 'bg-violet-100 text-violet-700',
    icon: Zap,
    desc: 'Single-day unlimited rides pass',
  },
  annual: {
    label: 'Annual',
    color: 'bg-green-100 text-green-700',
    icon: Crown,
    desc: 'Best-value yearly plan with lowest per-ride cost',
  },
  ride_pack: {
    label: 'Ride Pack',
    color: 'bg-orange-100 text-orange-700',
    icon: Layers,
    desc: 'Buy a bundle of rides upfront (like Rapido Ride Pack)',
  },
  commission: {
    label: 'Commission',
    color: 'bg-yellow-100 text-yellow-700',
    icon: TrendingUp,
    desc: 'No upfront fee – platform takes % per ride (Ola/Uber default)',
  },
};

// ─── Blank plan form ──────────────────────────────────────────────────────────

const blankPlan = (): Omit<SubscriptionPlan, '_id' | 'subscriberCount' | 'createdAt'> => ({
  name: '',
  type: 'monthly',
  target: 'driver',
  price: 0,
  commissionRate: 0,
  rideLimit: null,
  validityDays: 30,
  benefits: [''],
  isActive: true,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function daysLeft(endDate: string) {
  const d = differenceInDays(new Date(endDate), new Date());
  return d;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const [tab, setTab] = useState<TabType>('plans');

  // Plans tab state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planForm, setPlanForm] = useState(blankPlan);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  // Subscribers tab state
  const [subPage, setSubPage] = useState(1);
  const [subSearch, setSubSearch] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState('');
  const [subPlanFilter, setSubPlanFilter] = useState('');
  const [selectedSub, setSelectedSub] = useState<Subscriber | null>(null);
  const [showSubDetail, setShowSubDetail] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantData, setGrantData] = useState({ userId: '', userType: 'driver', planId: '', reason: '' });
  const [grantUser, setGrantUser] = useState<AdminUserLite | null>(null);
  const [showCancelSubModal, setShowCancelSubModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: stats } = useQuery({
    queryKey: ['subscriptions', 'stats'],
    queryFn: async () => {
      const res = await subscriptionsAPI.getStats();
      return res.data.data as Stats;
    },
  });

  const { data: plansData, isLoading: plansLoading, refetch: refetchPlans, isFetching: plansFetching } = useQuery({
    queryKey: ['subscriptions', 'plans'],
    queryFn: async () => {
      const res = await subscriptionsAPI.getPlans();
      return res.data.data as SubscriptionPlan[];
    },
  });

  const { data: subsData, isLoading: subsLoading, refetch: refetchSubs, isFetching: subsFetching } = useQuery({
    queryKey: ['subscriptions', 'subscribers', subPage, subSearch, subStatusFilter, subPlanFilter],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: subPage, limit: 10 };
      if (subSearch) params.search = subSearch;
      if (subStatusFilter) params.status = subStatusFilter;
      if (subPlanFilter) params.planId = subPlanFilter;
      const res = await subscriptionsAPI.getSubscribers(params);
      return {
        data: (res.data?.data?.subscribers ?? []) as Subscriber[],
        pagination: res.data?.data?.pagination ?? null,
      };
    },
    enabled: tab === 'subscribers',
  });

  const { data: revenueData } = useQuery({
    queryKey: ['subscriptions', 'revenue'],
    queryFn: async () => {
      const res = await subscriptionsAPI.getRevenue();
      return res.data.data;
    },
    enabled: tab === 'revenue',
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const savePlanMutation = useMutation({
    mutationFn: (payload: typeof planForm) =>
      editingPlan
        ? subscriptionsAPI.updatePlan(editingPlan._id, payload)
        : subscriptionsAPI.createPlan(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success(editingPlan ? 'Plan updated' : 'Plan created');
      setShowPlanModal(false);
    },
    onError: () => toast.error('Failed to save plan'),
  });

  const togglePlanMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      subscriptionsAPI.togglePlan(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', 'plans'] });
      toast.success('Plan status updated');
    },
    onError: () => toast.error('Failed to update plan status'),
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: string) => subscriptionsAPI.deletePlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success('Plan deleted');
      setShowDeleteModal(false);
    },
    onError: () => toast.error('Failed to delete plan'),
  });

  const grantMutation = useMutation({
    mutationFn: (d: typeof grantData) => subscriptionsAPI.grantSubscription(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', 'subscribers'] });
      toast.success('Subscription granted');
      setShowGrantModal(false);
      setGrantData({ userId: '', userType: 'driver', planId: '', reason: '' });
      setGrantUser(null);
    },
    onError: () => toast.error('Failed to grant subscription'),
  });

  const cancelSubMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      subscriptionsAPI.cancelSubscription(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', 'subscribers'] });
      toast.success('Subscription cancelled');
      setShowCancelSubModal(false);
      setCancelReason('');
      setSelectedSub(null);
    },
    onError: () => toast.error('Failed to cancel subscription'),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openCreatePlan() {
    setEditingPlan(null);
    setPlanForm(blankPlan());
    setShowPlanModal(true);
  }

  function openEditPlan(plan: SubscriptionPlan) {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      type: plan.type,
      target: plan.target,
      price: plan.price,
      commissionRate: plan.commissionRate,
      rideLimit: plan.rideLimit,
      validityDays: plan.validityDays,
      benefits: plan.benefits.length ? plan.benefits : [''],
      isActive: plan.isActive,
    });
    setShowPlanModal(true);
  }

  function openDeletePlan(id: string) {
    setDeletingPlanId(id);
    setShowDeleteModal(true);
  }

  function addBenefit() {
    setPlanForm((p) => ({ ...p, benefits: [...p.benefits, ''] }));
  }

  function updateBenefit(idx: number, val: string) {
    setPlanForm((p) => {
      const b = [...p.benefits];
      b[idx] = val;
      return { ...p, benefits: b };
    });
  }

  function removeBenefit(idx: number) {
    setPlanForm((p) => ({ ...p, benefits: p.benefits.filter((_, i) => i !== idx) }));
  }

  function handleSavePlan() {
    if (!planForm.name.trim()) {
      toast.error('Plan name is required');
      return;
    }
    const price = Number(planForm.price);
    if (isNaN(price) || price < 0) {
      toast.error('Upfront price cannot be negative');
      return;
    }
    const commissionRate = Number(planForm.commissionRate);
    if (isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100) {
      toast.error('Commission rate must be between 0 and 100%');
      return;
    }
    const validityDays = Number(planForm.validityDays);
    if (isNaN(validityDays) || validityDays < 1) {
      toast.error('Validity days must be at least 1');
      return;
    }
    const payload = {
      ...planForm,
      name: planForm.name.trim(),
      price: Math.max(0, price),
      commissionRate: Math.min(100, Math.max(0, commissionRate)),
      validityDays: Math.max(1, validityDays),
      benefits: planForm.benefits.filter((b) => b.trim()),
    };
    savePlanMutation.mutate(payload);
  }

  // ─────────────────────────────────────────────────────────────────────────

  const plans = plansData ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        subtitle="Manage driver & customer subscription plans — monthly, ride packs, commission, and more"
        actions={
          tab === 'plans' ? (
            <button onClick={openCreatePlan} className="btn btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Plan
            </button>
          ) : tab === 'subscribers' ? (
            <button onClick={() => setShowGrantModal(true)} className="btn btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Grant Subscription
            </button>
          ) : undefined
        }
      />

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard title="Total Plans" value={stats.totalPlans} icon={<Layers className="w-6 h-6" />} />
          <StatCard title="Active Plans" value={stats.activePlans} icon={<CheckCircle className="w-6 h-6" />} color="green" />
          <StatCard title="Total Subscribers" value={stats.totalSubscribers} icon={<Users className="w-6 h-6" />} />
          <StatCard title="Active Subscribers" value={stats.activeSubscribers} icon={<Car className="w-6 h-6" />} color="blue" />
          <StatCard title="MRR" value={fmtINR(stats.mrr)} icon={<DollarSign className="w-6 h-6" />} color="purple" />
          <StatCard title="Expiring in 7d" value={stats.expiringIn7Days} icon={<Calendar className="w-6 h-6" />} color="yellow" />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {(['plans', 'subscribers', 'revenue'] as TabType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'pb-3 text-sm font-medium border-b-2 transition-colors capitalize',
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              {t === 'revenue' ? 'Revenue & Analytics' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* ── PLANS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'plans' && (
        <div>
          {plansLoading ? (
            <div className="flex justify-center py-20"><LoadingSpinner /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {plans.map((plan) => {
                const meta = PLAN_TYPE_META[plan.type];
                const Icon = meta.icon;
                return (
                  <div
                    key={plan._id}
                    className={clsx(
                      'bg-white rounded-xl border shadow-sm overflow-hidden transition-opacity',
                      !plan.isActive && 'opacity-60',
                    )}
                  >
                    {/* Card header */}
                    <div className="px-5 py-4 flex items-start justify-between border-b">
                      <div className="flex items-center gap-3">
                        <div className={clsx('p-2 rounded-lg', meta.color)}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{plan.name}</p>
                          <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', meta.color)}>
                            {meta.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => togglePlanMutation.mutate({ id: plan._id, isActive: !plan.isActive })}
                          className="p-1 hover:bg-gray-100 rounded"
                          title={plan.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {plan.isActive
                            ? <ToggleRight className="w-5 h-5 text-green-600" />
                            : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                        </button>
                        <button
                          onClick={() => openEditPlan(plan)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => openDeletePlan(plan._id)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* Pricing summary */}
                    <div className="px-5 py-3 flex items-center gap-4 bg-gray-50">
                      <div className="text-center">
                        <p className="text-xl font-bold text-gray-900">
                          {plan.price > 0 ? fmtINR(plan.price) : 'Free'}
                        </p>
                        <p className="text-xs text-gray-500">upfront</p>
                      </div>
                      {plan.commissionRate > 0 && (
                        <>
                          <span className="text-gray-300 text-lg">+</span>
                          <div className="text-center">
                            <p className="text-xl font-bold text-gray-900">{plan.commissionRate}%</p>
                            <p className="text-xs text-gray-500">per ride</p>
                          </div>
                        </>
                      )}
                      <div className="ml-auto text-right">
                        <p className="text-sm font-semibold text-gray-700">{plan.subscriberCount}</p>
                        <p className="text-xs text-gray-500">subscribers</p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="px-5 py-3 text-sm text-gray-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Validity</span>
                        <span className="font-medium text-gray-800">{plan.validityDays} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ride limit</span>
                        <span className="font-medium text-gray-800">
                          {plan.rideLimit == null ? 'Unlimited' : plan.rideLimit}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Target</span>
                        <span className="font-medium text-gray-800 capitalize">{plan.target}</span>
                      </div>
                    </div>

                    {/* Benefits */}
                    {plan.benefits.length > 0 && (
                      <ul className="px-5 pb-4 space-y-1">
                        {plan.benefits.map((b, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}

              {plans.length === 0 && (
                <div className="col-span-3 text-center py-20 text-gray-400">
                  No subscription plans yet. Click <strong>New Plan</strong> to create one.
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end mt-4">
            <RefreshButton onRefresh={() => refetchPlans()} isFetching={plansFetching} />
          </div>
        </div>
      )}

      {/* ── SUBSCRIBERS TAB ───────────────────────────────────────────────── */}
      {tab === 'subscribers' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input pl-9 w-full"
                placeholder="Search by name or phone…"
                value={subSearch}
                onChange={(e) => { setSubSearch(e.target.value); setSubPage(1); }}
              />
            </div>
            <select
              className="input min-w-[140px]"
              value={subStatusFilter}
              onChange={(e) => { setSubStatusFilter(e.target.value); setSubPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="pending">Pending</option>
            </select>
            <select
              className="input min-w-[160px]"
              value={subPlanFilter}
              onChange={(e) => { setSubPlanFilter(e.target.value); setSubPage(1); }}
            >
              <option value="">All Plans</option>
              {plans.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
            <RefreshButton onRefresh={() => refetchSubs()} isFetching={subsFetching} />
          </div>

          {subsLoading ? (
            <div className="flex justify-center py-20"><LoadingSpinner /></div>
          ) : (
            <DataTable
              columns={[
                {
                  key: 'subscriber',
                  header: 'Subscriber',
                  render: (row: Subscriber) => {
                    const person = row.driver ?? row.customer;
                    return (
                      <div>
                        <p className="font-medium text-gray-900">{person?.name ?? '—'}</p>
                        <p className="text-xs text-gray-500">{person?.phone ?? '—'}</p>
                        <span className="text-xs text-gray-400 capitalize">{row.driver ? 'Driver' : 'Customer'}</span>
                      </div>
                    );
                  },
                },
                {
                  key: 'plan',
                  header: 'Plan',
                  render: (row: Subscriber) => {
                    const meta = PLAN_TYPE_META[row.plan?.type ?? 'monthly'];
                    return (
                      <div className="flex items-center gap-2">
                        <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', meta.color)}>
                          {meta.label}
                        </span>
                        <span className="text-sm text-gray-700">{row.plan?.name}</span>
                      </div>
                    );
                  },
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row: Subscriber) => <StatusBadge status={row.status} />,
                },
                {
                  key: 'validity',
                  header: 'Validity',
                  render: (row: Subscriber) => {
                    const left = daysLeft(row.endDate);
                    return (
                      <div className="text-sm">
                        <p>{format(new Date(row.startDate), 'dd MMM yy')} – {format(new Date(row.endDate), 'dd MMM yy')}</p>
                        <p className={clsx('text-xs', left < 0 ? 'text-red-500' : left <= 7 ? 'text-orange-500' : 'text-gray-400')}>
                          {left < 0 ? `Expired ${Math.abs(left)}d ago` : `${left}d remaining`}
                        </p>
                      </div>
                    );
                  },
                },
                {
                  key: 'rides',
                  header: 'Rides',
                  render: (row: Subscriber) => (
                    <span className="text-sm text-gray-700">
                      {row.ridesUsed} / {row.plan?.rideLimit ?? '∞'}
                    </span>
                  ),
                },
                {
                  key: 'autoRenew',
                  header: 'Auto-renew',
                  render: (row: Subscriber) =>
                    row.autoRenew
                      ? <CheckCircle className="w-4 h-4 text-green-500" />
                      : <XCircle className="w-4 h-4 text-gray-300" />,
                },
                {
                  key: 'actions',
                  header: '',
                  render: (row: Subscriber) => (
                    <button
                      onClick={() => { setSelectedSub(row); setShowSubDetail(true); }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  ),
                },
              ]}
              data={subsData?.data ?? []}
              keyExtractor={(r: Subscriber) => r._id}
            />
          )}

          {subsData?.pagination && (
            <Pagination
              page={subPage}
              totalPages={subsData.pagination.totalPages}
              onPageChange={setSubPage}
            />
          )}
        </div>
      )}

      {/* ── REVENUE TAB ───────────────────────────────────────────────────── */}
      {tab === 'revenue' && (
        <div className="space-y-6">
          {revenueData ? (
            <>
              {/* MRR breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Monthly Recurring Revenue" value={fmtINR(revenueData.mrr ?? 0)} icon={<TrendingUp className="w-6 h-6" />} color="green" />
                <StatCard title="Collected This Month" value={fmtINR(revenueData.collectedThisMonth ?? 0)} icon={<DollarSign className="w-6 h-6" />} color="blue" />
                <StatCard title="Renewal Rate" value={`${revenueData.renewalRate ?? 0}%`} icon={<Repeat className="w-6 h-6" />} color="purple" />
              </div>

              {/* Per-plan revenue table */}
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b">
                  <h3 className="font-semibold text-gray-800">Revenue by Plan</h3>
                </div>
                <DataTable
                  columns={[
                    { key: 'planName', header: 'Plan' },
                    {
                      key: 'type',
                      header: 'Type',
                      render: (row: any) => {
                        const meta = PLAN_TYPE_META[row.type as PlanType];
                        return (
                          <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', meta?.color)}>
                            {meta?.label ?? row.type}
                          </span>
                        );
                      },
                    },
                    { key: 'activeCount', header: 'Active Subs' },
                    {
                      key: 'monthRevenue',
                      header: 'Revenue (Month)',
                      render: (row: any) => <span>{fmtINR(row.monthRevenue ?? 0)}</span>,
                    },
                    {
                      key: 'totalRevenue',
                      header: 'Revenue (Total)',
                      render: (row: any) => <span>{fmtINR(row.totalRevenue ?? 0)}</span>,
                    },
                    {
                      key: 'avgCommission',
                      header: 'Avg. Commission Earned',
                      render: (row: any) => <span>{fmtINR(row.avgCommission ?? 0)}</span>,
                    },
                  ]}
                  data={revenueData.byPlan ?? []}
                  keyExtractor={(r: any) => r.planId}
                />
              </div>
            </>
          ) : (
            <div className="flex justify-center py-20"><LoadingSpinner /></div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════ */}

      {/* Create / Edit Plan Modal */}
      <Modal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        title={editingPlan ? 'Edit Subscription Plan' : 'New Subscription Plan'}
        size="lg"
      >
        <div className="space-y-4">
          {/* Name + Target */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Plan Name *</label>
              <input
                className="input w-full"
                placeholder="e.g. Rapido Plus Monthly"
                value={planForm.name}
                onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Target</label>
              <select
                className="input w-full"
                value={planForm.target}
                onChange={(e) => setPlanForm((p) => ({ ...p, target: e.target.value as PlanTarget }))}
              >
                <option value="driver">Driver</option>
                <option value="customer">Customer</option>
              </select>
            </div>
          </div>

          {/* Plan Type */}
          <div>
            <label className="form-label">Plan Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PLAN_TYPE_META) as PlanType[]).map((t) => {
                const meta = PLAN_TYPE_META[t];
                const Icon = meta.icon;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      const defaults: Partial<typeof planForm> = {};
                      if (t === 'monthly') defaults.validityDays = 30;
                      else if (t === 'weekly') defaults.validityDays = 7;
                      else if (t === 'daily') defaults.validityDays = 1;
                      else if (t === 'annual') defaults.validityDays = 365;
                      else if (t === 'ride_pack') { defaults.validityDays = 90; defaults.rideLimit = 50; }
                      else if (t === 'commission') { defaults.price = 0; defaults.commissionRate = 18; }
                      setPlanForm((p) => ({ ...p, type: t, ...defaults }));
                    }}
                    className={clsx(
                      'flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all',
                      planForm.type === t
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300',
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-1">{PLAN_TYPE_META[planForm.type].desc}</p>
          </div>

          {/* Price + Commission */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label">Upfront Price (₹)</label>
              <input
                type="number"
                min="0"
                className="input w-full"
                value={planForm.price}
                onChange={(e) => setPlanForm((p) => ({ ...p, price: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="form-label">Commission Rate (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                className="input w-full"
                placeholder="0"
                value={planForm.commissionRate}
                onChange={(e) => setPlanForm((p) => ({ ...p, commissionRate: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="form-label">Validity (days)</label>
              <input
                type="number"
                min="1"
                className="input w-full"
                value={planForm.validityDays}
                onChange={(e) => setPlanForm((p) => ({ ...p, validityDays: Number(e.target.value) }))}
              />
            </div>
          </div>

          {/* Ride limit */}
          <div>
            <label className="form-label">Ride Limit</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={planForm.rideLimit === null}
                  onChange={() => setPlanForm((p) => ({ ...p, rideLimit: null }))}
                />
                Unlimited
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={planForm.rideLimit !== null}
                  onChange={() => setPlanForm((p) => ({ ...p, rideLimit: 50 }))}
                />
                Fixed limit
              </label>
              {planForm.rideLimit !== null && (
                <input
                  type="number"
                  min="1"
                  className="input w-24"
                  value={planForm.rideLimit ?? ''}
                  onChange={(e) => setPlanForm((p) => ({ ...p, rideLimit: Number(e.target.value) }))}
                />
              )}
            </div>
          </div>

          {/* Benefits */}
          <div>
            <label className="form-label">Benefits / Features</label>
            <div className="space-y-2">
              {planForm.benefits.map((b, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder={`Benefit ${i + 1}`}
                    value={b}
                    onChange={(e) => updateBenefit(i, e.target.value)}
                  />
                  {planForm.benefits.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBenefit(i)}
                      className="p-2 hover:bg-red-50 rounded text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addBenefit}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add benefit
              </button>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Active</label>
            <button
              type="button"
              onClick={() => setPlanForm((p) => ({ ...p, isActive: !p.isActive }))}
            >
              {planForm.isActive
                ? <ToggleRight className="w-6 h-6 text-green-600" />
                : <ToggleLeft className="w-6 h-6 text-gray-400" />}
            </button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn btn-secondary" onClick={() => setShowPlanModal(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSavePlan}
              disabled={savePlanMutation.isPending}
            >
              {savePlanMutation.isPending ? 'Saving…' : editingPlan ? 'Update Plan' : 'Create Plan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Plan Confirmation */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Plan"
      >
        <p className="text-gray-600 mb-6">
          This plan will be permanently deleted. Existing subscribers will keep their access until expiry.
        </p>
        <div className="flex justify-end gap-3">
          <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
          <button
            className="btn btn-danger"
            onClick={() => deletingPlanId && deletePlanMutation.mutate(deletingPlanId)}
            disabled={deletePlanMutation.isPending}
          >
            {deletePlanMutation.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>

      {/* Grant Subscription Modal */}
      <Modal
        isOpen={showGrantModal}
        onClose={() => setShowGrantModal(false)}
        title="Grant Subscription"
      >
        <div className="space-y-4">
          <UserSearchSelect
            label="User"
            required
            defaultRole="driver"
            value={grantUser}
            onChange={(u) => {
              setGrantUser(u);
              setGrantData((g) => ({
                ...g,
                userId: u?._id ?? '',
                userType: (u?.role as string) ?? g.userType,
              }));
            }}
          />
          <div>
            <label className="form-label">Plan</label>
            <select
              className="input w-full"
              value={grantData.planId}
              onChange={(e) => setGrantData((g) => ({ ...g, planId: e.target.value }))}
            >
              <option value="">Select plan…</option>
              {plans.filter((p) => p.isActive).map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Reason</label>
            <input
              className="input w-full"
              placeholder="e.g. Promotional grant, driver onboarding"
              value={grantData.reason}
              onChange={(e) => setGrantData((g) => ({ ...g, reason: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn btn-secondary" onClick={() => { setShowGrantModal(false); setGrantUser(null); }}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => grantMutation.mutate(grantData)}
              disabled={!grantData.userId || !grantData.planId || grantMutation.isPending}
            >
              {grantMutation.isPending ? 'Granting…' : 'Grant Subscription'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Subscriber Detail Modal */}
      <Modal
        isOpen={showSubDetail && !!selectedSub}
        onClose={() => { setShowSubDetail(false); setSelectedSub(null); }}
        title="Subscription Detail"
        size="lg"
      >
        {selectedSub && (
          <div className="space-y-4">
            {/* Person info */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Name</span>
                <span className="font-medium">{(selectedSub.driver ?? selectedSub.customer)?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Phone</span>
                <span className="font-medium">{(selectedSub.driver ?? selectedSub.customer)?.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-medium capitalize">{selectedSub.driver ? 'Driver' : 'Customer'}</span>
              </div>
            </div>

            {/* Plan info */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Plan</span>
                <span className="font-medium">{selectedSub.plan?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', PLAN_TYPE_META[selectedSub.plan?.type]?.color)}>
                  {PLAN_TYPE_META[selectedSub.plan?.type]?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <StatusBadge status={selectedSub.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Valid</span>
                <span className="font-medium">
                  {format(new Date(selectedSub.startDate), 'dd MMM yyyy')} – {format(new Date(selectedSub.endDate), 'dd MMM yyyy')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Rides Used</span>
                <span className="font-medium">{selectedSub.ridesUsed} / {selectedSub.plan?.rideLimit ?? '∞'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Auto Renew</span>
                <span>{selectedSub.autoRenew ? 'Yes' : 'No'}</span>
              </div>
            </div>

            {/* Actions */}
            {selectedSub.status === 'active' && (
              <div className="flex justify-end gap-3 pt-2">
                <button
                  className="btn btn-danger"
                  onClick={() => { setShowSubDetail(false); setShowCancelSubModal(true); }}
                >
                  Cancel Subscription
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Cancel Subscription Confirmation */}
      <Modal
        isOpen={showCancelSubModal}
        onClose={() => { setShowCancelSubModal(false); setSelectedSub(null); }}
        title="Cancel Subscription"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to cancel this subscription? The driver / customer will lose access immediately.
        </p>
        <div className="mb-4">
          <label className="form-label">Reason</label>
          <input
            className="input w-full"
            placeholder="Reason for cancellation"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn btn-secondary" onClick={() => { setShowCancelSubModal(false); setSelectedSub(null); }}>
            Back
          </button>
          <button
            className="btn btn-danger"
            onClick={() => selectedSub && cancelSubMutation.mutate({ id: selectedSub._id, reason: cancelReason })}
            disabled={!cancelReason.trim() || cancelSubMutation.isPending}
          >
            {cancelSubMutation.isPending ? 'Cancelling…' : 'Confirm Cancel'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
