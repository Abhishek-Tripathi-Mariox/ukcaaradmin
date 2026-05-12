import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { governanceAPI } from '@/services/api';
import { DataTable, Pagination } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { PageHeader, StatusBadge, LoadingSpinner, RefreshButton } from '@/components/common';
import { format } from 'date-fns';
import { Eye, Filter } from 'lucide-react';

interface AuditEntry {
  _id: string;
  actorId: string;
  actorEmail?: string;
  actorRole?: string;
  actorAdminRole?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  method: string;
  path: string;
  statusCode: number;
  outcome: 'success' | 'failure';
  ip?: string;
  userAgent?: string;
  requestBody?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
  durationMs?: number;
  createdAt: string;
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    actorId: '',
    resourceType: '',
    outcome: '' as '' | 'success' | 'failure',
    startDate: '',
    endDate: '',
  });
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['audit-logs', page, filters],
    queryFn: async () => {
      const params: any = { page, limit: 50 };
      if (filters.action) params.action = filters.action;
      if (filters.actorId) params.actorId = filters.actorId;
      if (filters.resourceType) params.resourceType = filters.resourceType;
      if (filters.outcome) params.outcome = filters.outcome;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const res = await governanceAPI.listAuditLogs(params);
      return res.data.data as {
        items: AuditEntry[];
        total: number;
        pages: number;
        facets: { actions: string[] };
      };
    },
  });

  const columns = [
    {
      key: 'time',
      header: 'When',
      render: (e: AuditEntry) => (
        <div className="text-sm">
          <div>{format(new Date(e.createdAt), 'PP')}</div>
          <div className="text-xs text-gray-500">
            {format(new Date(e.createdAt), 'p')}
          </div>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (e: AuditEntry) => (
        <div>
          <div className="text-sm font-medium">{e.actorEmail ?? e.actorId}</div>
          <div className="text-xs text-gray-500">
            {e.actorAdminRole ?? e.actorRole}
          </div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (e: AuditEntry) => (
        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{e.action}</code>
      ),
    },
    {
      key: 'resource',
      header: 'Resource',
      render: (e: AuditEntry) =>
        e.resourceType ? (
          <div className="text-xs">
            <div className="font-medium">{e.resourceType}</div>
            {e.resourceId && (
              <div className="text-gray-500 truncate max-w-[140px]">
                {e.resourceId}
              </div>
            )}
          </div>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (e: AuditEntry) => (
        <div className="flex items-center gap-2">
          <StatusBadge
            status={e.outcome}
            variant={e.outcome === 'success' ? 'success' : 'danger'}
          />
          <span className="text-xs text-gray-500">{e.statusCode}</span>
        </div>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      render: (e: AuditEntry) => (
        <span className="text-xs text-gray-600">{e.ip ?? '—'}</span>
      ),
    },
    {
      key: 'view',
      header: '',
      render: (e: AuditEntry) => (
        <button
          onClick={() => setSelected(e)}
          className="p-2 hover:bg-gray-100 rounded"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Every admin action recorded for compliance & investigation"
        actions={<RefreshButton onRefresh={refetch} isFetching={isFetching} />}
      />

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
          <Filter className="w-4 h-4" />
          Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <select
            value={filters.action}
            onChange={(e) => {
              setFilters({ ...filters, action: e.target.value });
              setPage(1);
            }}
            className="form-input"
          >
            <option value="">All actions</option>
            {data?.facets.actions?.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input
            placeholder="Actor user ID"
            value={filters.actorId}
            onChange={(e) => {
              setFilters({ ...filters, actorId: e.target.value });
              setPage(1);
            }}
            className="form-input"
          />
          <input
            placeholder="Resource type"
            value={filters.resourceType}
            onChange={(e) => {
              setFilters({ ...filters, resourceType: e.target.value });
              setPage(1);
            }}
            className="form-input"
          />
          <select
            value={filters.outcome}
            onChange={(e) => {
              setFilters({
                ...filters,
                outcome: e.target.value as '' | 'success' | 'failure',
              });
              setPage(1);
            }}
            className="form-input"
          >
            <option value="">All outcomes</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => {
              setFilters({ ...filters, startDate: e.target.value });
              setPage(1);
            }}
            className="form-input"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => {
              setFilters({ ...filters, endDate: e.target.value });
              setPage(1);
            }}
            className="form-input"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            keyExtractor={(e) => e._id}
            emptyMessage="No audit log entries match the filters"
          />
          {data && data.pages > 1 && (
            <Pagination
              page={page}
              totalPages={data.pages}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {selected && (
        <Modal
          isOpen
          onClose={() => setSelected(null)}
          title={`Audit entry · ${selected.action}`}
          size="lg"
        >
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Pair label="Time" value={format(new Date(selected.createdAt), 'PPpp')} />
            <Pair label="Actor" value={selected.actorEmail ?? selected.actorId} />
            <Pair label="Role" value={selected.actorAdminRole ?? selected.actorRole ?? '—'} />
            <Pair label="Outcome" value={`${selected.outcome} (${selected.statusCode})`} />
            <Pair label="Method" value={selected.method} />
            <Pair label="Path" value={selected.path} />
            <Pair label="IP" value={selected.ip ?? '—'} />
            <Pair label="Duration" value={`${selected.durationMs ?? 0} ms`} />
            <Pair label="Resource type" value={selected.resourceType ?? '—'} />
            <Pair label="Resource id" value={selected.resourceId ?? '—'} />
          </dl>
          {selected.errorMessage && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-1">Error</h4>
              <pre className="bg-red-50 text-red-800 text-xs rounded p-3 overflow-auto">
                {selected.errorMessage}
              </pre>
            </div>
          )}
          {selected.requestBody && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-1">Request body</h4>
              <pre className="bg-gray-50 text-xs rounded p-3 overflow-auto max-h-60">
                {JSON.stringify(selected.requestBody, null, 2)}
              </pre>
            </div>
          )}
          {selected.metadata && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-1">Metadata</h4>
              <pre className="bg-gray-50 text-xs rounded p-3 overflow-auto max-h-60">
                {JSON.stringify(selected.metadata, null, 2)}
              </pre>
            </div>
          )}
          {selected.userAgent && (
            <div className="mt-4 text-xs text-gray-500">
              <strong>User agent:</strong> {selected.userAgent}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function Pair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase text-gray-500">{label}</dt>
      <dd className="text-gray-900 break-all">{value}</dd>
    </div>
  );
}
