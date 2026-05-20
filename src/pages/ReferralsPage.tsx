import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { referralsAPI } from '@/services/api';
import { DataTable, Pagination } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { PageHeader, StatCard, LoadingSpinner, RefreshButton } from '@/components/common';
import { Search, Share2, Users, IndianRupee, Eye, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const currency = (n: number) =>
  `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function fullName(u: any) {
  return `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || u?.phone || '—';
}

function initials(u: any) {
  const f = (u?.firstName ?? '').charAt(0);
  const l = (u?.lastName ?? '').charAt(0);
  return (f + l).toUpperCase() || '?';
}

function RoleBadge({ role }: { role?: string }) {
  const map: Record<string, string> = {
    driver: 'bg-blue-50 text-blue-700',
    customer: 'bg-emerald-50 text-emerald-700',
    admin: 'bg-purple-50 text-purple-700',
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full capitalize ${
        map[role ?? ''] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {role ?? '—'}
    </span>
  );
}

export default function ReferralsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['referrals', page, search],
    queryFn: async () => {
      const params: any = { page, limit: 10 };
      if (search) params.search = search;
      const res = await referralsAPI.getAll(params);
      return res.data?.data ?? { referrers: [], summary: {}, pagination: null };
    },
  });

  const summary = data?.summary ?? { totalReferrers: 0, totalReferred: 0, totalEarnings: 0 };
  const referrers = data?.referrers ?? [];

  const copyCode = (code?: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast.success(`Copied ${code}`);
  };

  const columns = [
    {
      key: 'referrer',
      header: 'Referrer',
      render: (r: any) => (
        <div className="flex items-center gap-3">
          {r.avatar ? (
            <img src={r.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold">
              {initials(r)}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate">{fullName(r)}</div>
            <div className="text-xs text-gray-500">{r.phone || r.email || '—'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (r: any) => <RoleBadge role={r.role} />,
    },
    {
      key: 'code',
      header: 'Referral Code',
      render: (r: any) =>
        r.referralCode ? (
          <button
            onClick={() => copyCode(r.referralCode)}
            className="inline-flex items-center gap-1.5 font-mono text-sm bg-gray-50 border rounded px-2 py-1 hover:bg-gray-100"
            title="Copy code"
          >
            {r.referralCode}
            <Copy className="w-3 h-3 text-gray-400" />
          </button>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'referredCount',
      header: 'Referred',
      render: (r: any) => <span className="font-semibold">{r.referredCount}</span>,
    },
    {
      key: 'rate',
      header: 'Rate',
      render: (r: any) => (
        <span className="text-gray-500 text-sm">{currency(r.ratePerReferral)}/ref</span>
      ),
    },
    {
      key: 'earnings',
      header: 'Earnings',
      render: (r: any) => (
        <span className="font-semibold text-emerald-600">{currency(r.earnings)}</span>
      ),
    },
    {
      key: 'last',
      header: 'Last Referral',
      render: (r: any) =>
        r.lastReferralAt ? (
          <span className="text-sm text-gray-600">
            {format(new Date(r.lastReferralAt), 'PP')}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (r: any) => (
        <button
          onClick={() => setDetailId(r.referrerId)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
          title="View referred users"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Referrals"
        subtitle="Track refer & earn — who referred whom and the rewards earned"
        actions={<RefreshButton onRefresh={refetch} isFetching={isFetching} />}
      />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Total Referrers"
          value={summary.totalReferrers ?? 0}
          icon={<Share2 className="w-6 h-6" />}
          color="primary"
        />
        <StatCard
          title="People Referred"
          value={summary.totalReferred ?? 0}
          icon={<Users className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Total Earnings"
          value={currency(summary.totalEarnings ?? 0)}
          icon={<IndianRupee className="w-6 h-6" />}
          color="purple"
        />
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, email, or code…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={referrers}
            keyExtractor={(r: any) => r.referrerId}
            emptyMessage="No referrals yet"
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

      {detailId && (
        <ReferralDetailModal userId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}

function ReferralDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['referral-detail', userId],
    queryFn: async () => (await referralsAPI.getById(userId)).data.data,
  });

  return (
    <Modal isOpen onClose={onClose} title="Referral details" size="lg">
      {isLoading || !data ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          {/* Referrer header */}
          <div className="flex items-center gap-3">
            {data.referrer.avatar ? (
              <img
                src={data.referrer.avatar}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold">
                {initials(data.referrer)}
              </div>
            )}
            <div>
              <div className="font-semibold flex items-center gap-2">
                {fullName(data.referrer)} <RoleBadge role={data.referrer.role} />
              </div>
              <div className="text-sm text-gray-500">
                {data.referrer.phone || data.referrer.email || '—'}
                {data.referrer.referralCode && (
                  <span className="ml-2 font-mono text-xs bg-gray-50 border rounded px-1.5 py-0.5">
                    {data.referrer.referralCode}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Referred</div>
              <div className="text-xl font-bold">{data.referredCount}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Rate</div>
              <div className="text-xl font-bold">{currency(data.ratePerReferral)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Earnings</div>
              <div className="text-xl font-bold text-emerald-600">
                {currency(data.earnings)}
              </div>
            </div>
          </div>

          {/* Referred users */}
          <div>
            <div className="text-sm font-semibold mb-2">People referred</div>
            <div className="border rounded-lg overflow-hidden">
              {data.referred.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">No one yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Role</th>
                      <th className="px-3 py-2 text-left">Joined</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.referred.map((u: any) => (
                      <tr key={u._id}>
                        <td className="px-3 py-2">
                          <div className="font-medium">{fullName(u)}</div>
                          <div className="text-xs text-gray-500">
                            {u.phone || u.email || ''}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {u.createdAt ? format(new Date(u.createdAt), 'PP') : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              u.isActive
                                ? 'bg-green-50 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
