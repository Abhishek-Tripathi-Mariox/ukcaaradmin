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

  const q = useQuery({
    queryKey: ['support-ticket', ticketId],
    queryFn: async () => (await supportAPI.get(ticketId)).data.data as Ticket,
    // Poll so customer replies appear while the admin has the ticket open
    // (the customer thread mirrors this). Also refetch when the admin returns
    // to the tab.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const ticket = q.data;
  // Once support closes a ticket it's terminal — lock every control so it
  // can't be reopened or edited. The backend rejects these too.
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

  return (
    <Modal isOpen onClose={onClose} title={ticket?.ticketNumber ?? 'Ticket'} size="xl">
      {q.isLoading || !ticket ? (
        <div className="p-8 text-center text-gray-500">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Conversation */}
          <div className="md:col-span-2 space-y-3">
            <div>
              <div className="text-lg font-semibold">{ticket.subject}</div>
              <div className="text-xs text-gray-500">
                Opened {format(new Date(ticket.createdAt), 'dd MMM yy HH:mm')} ·{' '}
                {userName(ticket.submittedBy)} ({ticket.submittedByRole})
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg max-h-[420px] overflow-y-auto p-3 bg-gray-50 space-y-2">
              {(ticket.messages ?? []).map((m, i) => {
                const isAdmin = m.senderRole === 'admin';
                const sender = typeof m.sender === 'object' ? m.sender : null;
                return (
                  <div
                    key={m._id ?? i}
                    className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        m.internal
                          ? 'bg-yellow-50 border border-yellow-300'
                          : isAdmin
                          ? 'bg-blue-100'
                          : 'bg-white border border-gray-200'
                      }`}
                    >
                      <div className="text-xs text-gray-500 mb-1 flex items-center gap-2">
                        <span>
                          {sender ? userName(sender) : '—'}{' '}
                          <span className="text-gray-400">· {m.senderRole}</span>
                        </span>
                        {m.internal && (
                          <span className="text-yellow-700 text-[10px] uppercase font-semibold">
                            internal
                          </span>
                        )}
                        <span className="ml-auto text-gray-400">
                          {format(new Date(m.createdAt), 'dd MMM HH:mm')}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap">{m.body}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {adminClosed ? (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 text-sm text-gray-500">
                This ticket was closed by support and is locked. The customer must
                create a new ticket to continue.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-2 bg-white">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder={internal ? 'Internal note (not visible to user)' : 'Reply to user…'}
                  className="w-full px-2 py-1 text-sm focus:outline-none resize-none"
                />
                <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={internal}
                      onChange={(e) => setInternal(e.target.checked)}
                    />
                    Internal note
                  </label>
                  <button
                    onClick={() => reply.trim() && replyMut.mutate()}
                    disabled={!reply.trim() || replyMut.isPending}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-1"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {replyMut.isPending ? 'Sending…' : internal ? 'Save note' : 'Send reply'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-3 text-sm">
            <Sidebar label="Status">
              {ticket.status === 'closed' && ticket.closedByRole === 'admin' ? (
                <div className="space-y-1">
                  <StatusBadge status="closed" variant={STATUS_VARIANT.closed} />
                  <p className="text-xs text-gray-500">
                    Closed by support — this is permanent and can't be reopened.
                    The customer must create a new ticket.
                  </p>
                </div>
              ) : (
                <select
                  value={ticket.status}
                  onChange={(e) => updateMut.mutate({ status: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              )}
            </Sidebar>

            <Sidebar label="Priority">
              <select
                value={ticket.priority}
                disabled={adminClosed}
                onChange={(e) => updateMut.mutate({ priority: e.target.value })}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:text-gray-400"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Sidebar>

            <Sidebar label="Assignee">
              {ticket.assignedTo ? (
                <div className="text-sm">
                  {userName(ticket.assignedTo)}
                  {me && !adminClosed && (ticket.assignedTo as any)._id !== (me as any)._id && (
                    <button
                      onClick={() => claim.mutate()}
                      className="ml-2 text-xs text-blue-600 hover:underline"
                    >
                      claim
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => claim.mutate()}
                  disabled={adminClosed}
                  className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Claim
                </button>
              )}
            </Sidebar>

            <Sidebar label="Category">
              <span className="capitalize">{ticket.category.replace(/_/g, ' ')}</span>
            </Sidebar>

            {(ticket.tags ?? []).includes('doc-update') && (
              <Sidebar label="Document update request">
                <div className="text-xs space-y-1">
                  <div>
                    <span className="text-gray-500">Doc type: </span>
                    <span className="font-medium capitalize">
                      {(ticket.metadata?.docType as string)?.replace(/-/g, ' ') ?? '—'}
                    </span>
                  </div>
                  {ticket.metadata?.newFileUrl ? (
                    <a
                      href={ticket.metadata.newFileUrl as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View proposed new file ↗
                    </a>
                  ) : (
                    <div className="text-gray-500">No new file attached</div>
                  )}
                </div>
              </Sidebar>
            )}

            {ticket.slaDueAt && (
              <Sidebar label="SLA due">
                {format(new Date(ticket.slaDueAt), 'dd MMM HH:mm')}
                <div className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(ticket.slaDueAt), { addSuffix: true })}
                </div>
              </Sidebar>
            )}

            {ticket.firstResponseAt && (
              <Sidebar label="First response">
                {format(new Date(ticket.firstResponseAt), 'dd MMM HH:mm')}
              </Sidebar>
            )}

            {ticket.relatedRide && (
              <Sidebar label="Related ride">
                <span className="font-mono text-xs">{ticket.relatedRide._id}</span>
              </Sidebar>
            )}

            {ticket.relatedPayment && (
              <Sidebar label="Related payment">
                <span className="font-mono text-xs">{ticket.relatedPayment._id}</span>
                {ticket.relatedPayment.amount != null && (
                  <div className="text-xs">₹{ticket.relatedPayment.amount}</div>
                )}
              </Sidebar>
            )}

            <Sidebar label="Resolution">
              <textarea
                defaultValue={ticket.resolution ?? ''}
                disabled={adminClosed}
                onBlur={(e) => {
                  if (e.target.value !== (ticket.resolution ?? '')) {
                    updateMut.mutate({ resolution: e.target.value });
                  }
                }}
                rows={3}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:text-gray-400"
                placeholder="Notes on how this was resolved…"
              />
            </Sidebar>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Sidebar({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}
