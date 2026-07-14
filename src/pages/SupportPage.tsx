import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Inbox,
  Lock,
  MessageSquare,
  Search,
  UserCheck,
  Tag,
  Calendar,
  User as UserIcon,
  FileText,
  Send,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { supportAPI } from '@/services/api';
import { DataTable, Pagination } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { PageHeader, StatusBadge, RefreshButton } from '@/components/common';
import { useAuthStore } from '@/store/authStore';

type TicketStatus = 'open' | 'pending_user' | 'in_progress' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
type TicketCategory =
  | 'ride_issue'
  | 'payment'
  | 'refund'
  | 'driver_behavior'
  | 'lost_item'
  | 'safety'
  | 'account'
  | 'app_bug'
  | 'other';

interface User {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;
  adminRole?: string;
}

interface TicketMessage {
  _id?: string;
  sender: string | User;
  senderRole: 'customer' | 'driver' | 'admin' | 'system';
  body: string;
  attachments?: string[];
  internal: boolean;
  createdAt: string;
}

interface Ticket {
  _id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  submittedBy?: User;
  submittedByRole: 'customer' | 'driver';
  assignedTo?: User;
  relatedRide?: { _id: string; status?: string; pickup?: any; dropoff?: any };
  relatedPayment?: { _id: string; amount?: number; status?: string };
  messages?: TicketMessage[];
  tags?: string[];
  resolution?: string;
  slaDueAt?: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  closedByRole?: 'customer' | 'driver' | 'admin' | 'system';
  reopenCount?: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

const STATUSES: TicketStatus[] = [
  'open',
  'in_progress',
  'pending_user',
  'resolved',
  'closed',
];
const PRIORITIES: TicketPriority[] = ['urgent', 'high', 'normal', 'low'];
const CATEGORIES: TicketCategory[] = [
  'ride_issue',
  'payment',
  'refund',
  'driver_behavior',
  'lost_item',
  'safety',
  'account',
  'app_bug',
  'other',
];

const PRIORITY_VARIANT: Record<TicketPriority, 'danger' | 'warning' | 'neutral' | 'success'> = {
  urgent: 'danger',
  high: 'warning',
  normal: 'neutral',
  low: 'success',
};

const STATUS_VARIANT: Record<TicketStatus, 'danger' | 'warning' | 'neutral' | 'success'> = {
  open: 'warning',
  in_progress: 'neutral',
  pending_user: 'warning',
  resolved: 'success',
  closed: 'neutral',
};

function userName(u?: User | null) {
  if (!u) return '—';
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || u.phone || '—';
}

export default function SupportPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    status: string;
    priority: string;
    category: string;
    submittedByRole: string;
    q: string;
    assignedTo: string;
    tag: string;
  }>({
    status: '',
    priority: '',
    category: '',
    submittedByRole: '',
    q: '',
    assignedTo: '',
    tag: '',
  });
  const [openId, setOpenId] = useState<string | null>(null);

  const statsQ = useQuery({
    queryKey: ['support-stats'],
    queryFn: async () =>
      (await supportAPI.stats()).data.data as {
        status: Record<string, number>;
        priority: Record<string, number>;
        breachedSla: number;
        unassignedOpen: number;
      },
    refetchInterval: 30_000,
  });

  const listQ = useQuery({
    queryKey: ['support-tickets', page, filters],
    queryFn: async () =>
      (
        await supportAPI.list({
          page,
          limit: 25,
          status: filters.status || undefined,
          priority: filters.priority || undefined,
          category: filters.category || undefined,
          submittedByRole: (filters.submittedByRole || undefined) as any,
          assignedTo: filters.assignedTo || undefined,
          q: filters.q || undefined,
          tag: filters.tag || undefined,
        })
      ).data.data as {
        items: Ticket[];
        total: number;
        pages: number;
        statusCounts: Record<string, number>;
      },
  });

  const items = listQ.data?.items ?? [];

  const claim = useMutation({
    mutationFn: (id: string) => supportAPI.assign(id, { claim: true }),
    onSuccess: () => {
      toast.success('Claimed');
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      qc.invalidateQueries({ queryKey: ['support-stats'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Claim failed'),
  });

  const columns = [
    {
      key: 'ticket',
      header: 'Ticket',
      render: (t: Ticket) => (
        <div>
          <div className="font-mono text-xs">{t.ticketNumber}</div>
          <div className="text-sm font-medium truncate max-w-xs">{t.subject}</div>
          <div className="text-xs text-gray-500 capitalize">
            {t.category.replace(/_/g, ' ')}
          </div>
        </div>
      ),
    },
    {
      key: 'requester',
      header: 'Requester',
      render: (t: Ticket) => (
        <div className="text-xs">
          <div>{userName(t.submittedBy)}</div>
          <div className="text-gray-500 capitalize">{t.submittedByRole}</div>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (t: Ticket) => (
        <StatusBadge status={t.priority} variant={PRIORITY_VARIANT[t.priority]} />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (t: Ticket) => (
        <StatusBadge
          status={t.status.replace(/_/g, ' ')}
          variant={STATUS_VARIANT[t.status]}
        />
      ),
    },
    {
      key: 'assignee',
      header: 'Assignee',
      render: (t: Ticket) =>
        t.assignedTo ? (
          <span className="text-xs">{userName(t.assignedTo)}</span>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              claim.mutate(t._id);
            }}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            <UserCheck className="w-3 h-3" /> Claim
          </button>
        ),
    },
    {
      key: 'sla',
      header: 'SLA',
      render: (t: Ticket) => {
        if (!t.slaDueAt || t.status === 'closed' || t.status === 'resolved') return '—';
        const due = new Date(t.slaDueAt);
        const breached = due.getTime() < Date.now();
        return (
          <span
            className={`text-xs flex items-center gap-1 ${
              breached ? 'text-red-600' : 'text-gray-600'
            }`}
          >
            {breached ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {breached ? 'breached ' : ''}
            {formatDistanceToNow(due, { addSuffix: true })}
          </span>
        );
      },
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (t: Ticket) => (
        <span className="text-xs text-gray-600">
          {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}
        </span>
      ),
    },
  ];

  const stats = statsQ.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Support tickets"
        subtitle="Customer & driver support inbox with SLA tracking"
        actions={
          <div className="flex gap-2">
            <RefreshButton
              onRefresh={() => { statsQ.refetch(); listQ.refetch(); }}
              isFetching={statsQ.isFetching || listQ.isFetching}
            />
          </div>
        }
      />

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          label="Open"
          value={(stats?.status.open ?? 0) + (stats?.status.in_progress ?? 0)}
          icon={<Inbox className="w-5 h-5 text-blue-600" />}
        />
        <StatCard
          label="Unassigned"
          value={stats?.unassignedOpen ?? 0}
          icon={<UserCheck className="w-5 h-5 text-yellow-600" />}
        />
        <StatCard
          label="Breached SLA"
          value={stats?.breachedSla ?? 0}
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          danger
        />
        <StatCard
          label="Resolved"
          value={stats?.status.resolved ?? 0}
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
        />
        <StatCard
          label="Closed"
          value={stats?.status.closed ?? 0}
          icon={<Lock className="w-5 h-5 text-gray-500" />}
        />
      </div>

      {/* Quick filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setFilters((f) => ({ ...f, tag: '' }));
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
            filters.tag === ''
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          All tickets
        </button>
        <button
          onClick={() => {
            setFilters((f) => ({ ...f, tag: 'doc-update' }));
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 ${
            filters.tag === 'doc-update'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Document update requests
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-600 mb-1">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-3 text-gray-400" />
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
              placeholder="Subject or TKT-…"
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => {
            setFilters((f) => ({ ...f, status: v }));
            setPage(1);
          }}
          options={STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
        />
        <FilterSelect
          label="Priority"
          value={filters.priority}
          onChange={(v) => {
            setFilters((f) => ({ ...f, priority: v }));
            setPage(1);
          }}
          options={PRIORITIES.map((p) => ({ value: p, label: p }))}
        />
        <FilterSelect
          label="Category"
          value={filters.category}
          onChange={(v) => {
            setFilters((f) => ({ ...f, category: v }));
            setPage(1);
          }}
          options={CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, ' ') }))}
        />
        <FilterSelect
          label="Role"
          value={filters.submittedByRole}
          onChange={(v) => {
            setFilters((f) => ({ ...f, submittedByRole: v }));
            setPage(1);
          }}
          options={[
            { value: 'customer', label: 'customer' },
            { value: 'driver', label: 'driver' },
          ]}
        />
        <FilterSelect
          label="Assigned"
          value={filters.assignedTo}
          onChange={(v) => {
            setFilters((f) => ({ ...f, assignedTo: v }));
            setPage(1);
          }}
          options={[{ value: 'unassigned', label: 'unassigned' }]}
        />
      </div>

      <DataTable
        columns={columns as any}
        data={items}
        keyExtractor={(t: Ticket) => t._id}
        isLoading={listQ.isLoading}
        emptyMessage="No tickets"
        onRowClick={(t: Ticket) => setOpenId(t._id)}
      />

      {listQ.data && listQ.data.pages > 1 && (
        <Pagination
          page={page}
          totalPages={listQ.data.pages}
          onPageChange={setPage}
          total={listQ.data.total}
        />
      )}

      {openId && (
        <TicketDetail
          ticketId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ['support-tickets'] });
            qc.invalidateQueries({ queryKey: ['support-stats'] });
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  danger,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow-sm border ${
        danger && value > 0 ? 'border-red-300' : 'border-gray-200'
      } p-3`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500 uppercase">{label}</div>
          <div className={`text-2xl font-semibold ${danger && value > 0 ? 'text-red-600' : ''}`}>
            {value}
          </div>
        </div>
        {icon}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm capitalize"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TicketDetail({
  ticketId,
  onClose,
  onChanged,
}: {
  ticketId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [activeTab, setActiveTab] = useState<'conversation' | 'details'>('conversation');

  const q = useQuery({
    queryKey: ['support-ticket', ticketId],
    queryFn: async () => (await supportAPI.get(ticketId)).data.data as Ticket,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const ticket = q.data;
  const adminClosed = ticket?.status === 'closed' && ticket?.closedByRole === 'admin';

  const replyMut = useMutation({
    mutationFn: () => supportAPI.reply(ticketId, { body: reply, internal }),
    onSuccess: () => {
      setReply('');
      qc.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
      onChanged();
      toast.success(internal ? 'Internal note saved' : 'Reply sent');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Reply failed'),
  });

  const updateMut = useMutation({
    mutationFn: (body: any) => supportAPI.update(ticketId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
      onChanged();
      toast.success('Updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Update failed'),
  });

  const claim = useMutation({
    mutationFn: () => supportAPI.assign(ticketId, { claim: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
      onChanged();
      toast.success('Assigned to you');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Claim failed'),
  });

  const statusLabels: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    pending_user: 'Pending User Reply',
    resolved: 'Resolved',
    closed: 'Closed',
  };

  return (
    <Modal isOpen onClose={onClose} title={ticket ? `#${ticket.ticketNumber} • ${ticket.subject}` : 'Support Ticket'} size="xl">
      {q.isLoading || !ticket ? (
        <div className="p-12 text-center text-gray-500">Loading ticket details…</div>
      ) : (
        <div className="space-y-4">
          {/* Top Banner Info Bar */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                {userName(ticket.submittedBy).charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <span>{userName(ticket.submittedBy)}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium uppercase bg-gray-200 text-gray-700">
                    {ticket.submittedByRole}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Opened {format(new Date(ticket.createdAt), 'dd MMM yyyy HH:mm')} ({formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })})
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={ticket.status} variant={STATUS_VARIANT[ticket.status]} />
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold capitalize bg-white border border-gray-200 text-gray-700">
                {ticket.priority} priority
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab('conversation')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'conversation'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Conversation Thread ({ticket.messages?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Tag className="w-4 h-4" />
              Ticket Settings & Status
            </button>
          </div>

          {activeTab === 'conversation' ? (
            <div className="space-y-4">
              {/* Messages timeline */}
              <div className="border border-gray-200 rounded-xl max-h-[380px] overflow-y-auto p-4 bg-gray-50/60 space-y-3">
                {(ticket.messages ?? []).length === 0 ? (
                  <div className="text-center py-6 text-sm text-gray-400">No messages yet.</div>
                ) : (
                  (ticket.messages ?? []).map((m, i) => {
                    const isAdmin = m.senderRole === 'admin';
                    const sender = typeof m.sender === 'object' ? m.sender : null;
                    return (
                      <div
                        key={m._id ?? i}
                        className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-xl px-4 py-3 text-sm shadow-sm ${
                            m.internal
                              ? 'bg-amber-50 border border-amber-300 text-amber-950'
                              : isAdmin
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-gray-200 text-gray-800'
                          }`}
                        >
                          <div
                            className={`text-xs mb-1.5 flex items-center justify-between gap-3 ${
                              isAdmin && !m.internal ? 'text-blue-100' : 'text-gray-500'
                            }`}
                          >
                            <span className="font-semibold flex items-center gap-1.5">
                              {sender ? userName(sender) : 'Support Agent'}
                              {m.internal && (
                                <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded text-[10px] uppercase font-bold tracking-wide">
                                  Internal Note
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] opacity-80">
                              {format(new Date(m.createdAt), 'dd MMM HH:mm')}
                            </span>
                          </div>
                          <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reply or Locked banner */}
              {adminClosed ? (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 text-sm text-gray-600 flex items-center gap-3">
                  <Lock className="w-5 h-5 text-gray-400 shrink-0" />
                  <span>
                    This ticket was closed by support and is locked. The customer must create a new ticket to continue.
                  </span>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl p-3 bg-white shadow-sm space-y-3">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    placeholder={
                      internal
                        ? 'Write an internal note (only visible to admin team)...'
                        : 'Reply to customer...'
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={internal}
                        onChange={(e) => setInternal(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Internal Note (Hidden from Customer)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => reply.trim() && replyMut.mutate()}
                      disabled={!reply.trim() || replyMut.isPending}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send className="w-4 h-4" />
                      {replyMut.isPending ? 'Sending…' : internal ? 'Save Note' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 p-5 rounded-xl border border-gray-200">
              {/* Status Section */}
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Ticket Status
                  </label>
                  {adminClosed ? (
                    <div className="space-y-1">
                      <StatusBadge status="closed" variant={STATUS_VARIANT.closed} />
                      <p className="text-xs text-gray-500 mt-1">
                        Closed by support — this is permanent and cannot be reopened.
                      </p>
                    </div>
                  ) : (
                    <select
                      value={ticket.status}
                      onChange={(e) => updateMut.mutate({ status: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {statusLabels[s] || s}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Priority Section */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Priority Level
                  </label>
                  <select
                    value={ticket.priority}
                    disabled={adminClosed}
                    onChange={(e) => updateMut.mutate({ priority: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium capitalize focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assignee Section */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Assignee
                  </label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">
                      {ticket.assignedTo ? userName(ticket.assignedTo) : 'Unassigned'}
                    </span>
                    {me && !adminClosed && (ticket.assignedTo as any)?._id !== (me as any)?._id && (
                      <button
                        type="button"
                        onClick={() => claim.mutate()}
                        className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                      >
                        Claim Ticket
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right column: Document Update / Resolution Notes / Metadata */}
              <div className="space-y-4">
                {ticket.metadata?.docType && (
                  <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Document Update Request
                    </div>
                    <div className="text-sm text-blue-900">
                      <span className="font-medium">Type:</span>{' '}
                      <span className="capitalize">
                        {(ticket.metadata.docType as string).replace(/-/g, ' ')}
                      </span>
                    </div>
                    {ticket.metadata.newFileUrl ? (
                      <a
                        href={ticket.metadata.newFileUrl as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline pt-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        View Proposed New File ↗
                      </a>
                    ) : (
                      <div className="text-xs text-gray-500">No file attached</div>
                    )}
                  </div>
                )}

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Resolution Notes
                  </label>
                  <textarea
                    defaultValue={ticket.resolution ?? ''}
                    disabled={adminClosed}
                    onBlur={(e) => {
                      if (e.target.value !== (ticket.resolution ?? '')) {
                        updateMut.mutate({ resolution: e.target.value });
                      }
                    }}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                    placeholder="Document how this ticket was resolved..."
                  />
                </div>

                {(ticket.relatedRide || ticket.relatedPayment) && (
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2 text-xs text-gray-600">
                    <div className="font-semibold uppercase tracking-wider text-gray-500">
                      Linked Entities
                    </div>
                    {ticket.relatedRide && (
                      <div>
                        Related Ride ID: <span className="font-mono font-medium">{ticket.relatedRide._id}</span>
                      </div>
                    )}
                    {ticket.relatedPayment && (
                      <div>
                        Related Payment ID: <span className="font-mono font-medium">{ticket.relatedPayment._id}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
