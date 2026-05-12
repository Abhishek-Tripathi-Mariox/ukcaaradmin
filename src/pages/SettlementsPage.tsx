import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Upload, RefreshCw, CheckCircle, AlertTriangle, Search } from 'lucide-react';
import { financeAPI } from '@/services/api';
import { DataTable, Pagination } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { PageHeader, StatusBadge, LoadingSpinner, RefreshButton } from '@/components/common';

interface Settlement {
  _id: string;
  razorpaySettlementId: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  utr?: string;
  grossAmount: number;
  fee: number;
  tax: number;
  netAmount: number;
  currency: string;
  status: 'pending' | 'matched' | 'mismatch' | 'failed' | 'reconciled';
  diff?: number;
  expectedAmount?: number;
  mismatchReason?: string;
  batchId?: string;
  reportSource?: string;
  settledAt?: string;
  createdAt: string;
  payment?: { amount: number; status: string };
  ride?: { _id: string; actualFare?: number };
  notes?: string;
}

const STATUSES: Settlement['status'][] = ['pending', 'matched', 'mismatch', 'failed', 'reconciled'];

export default function SettlementsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [utr, setUtr] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [detail, setDetail] = useState<Settlement | null>(null);

  const listQ = useQuery({
    queryKey: ['settlements', page, status, utr],
    queryFn: async () =>
      (
        await financeAPI.listSettlements({
          page,
          limit: 25,
          status: status || undefined,
          utr: utr || undefined,
        })
      ).data.data as {
        items: Settlement[];
        total: number;
        pages: number;
        summary: Record<string, { count: number; totalNet: number }>;
      },
  });

  const reconcile = useMutation({
    mutationFn: (body?: { batchId?: string }) => financeAPI.reconcileSettlements(body),
    onSuccess: (res) => {
      const d = res.data.data;
      toast.success(`Reconciled ${d.matched}/${d.total} (${d.mismatch} mismatch, ${d.missing} missing)`);
      qc.invalidateQueries({ queryKey: ['settlements'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Reconcile failed'),
  });

  const mark = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => financeAPI.updateSettlement(id, body),
    onSuccess: () => {
      toast.success('Updated');
      qc.invalidateQueries({ queryKey: ['settlements'] });
      setDetail(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Update failed'),
  });

  const items = listQ.data?.items ?? [];
  const summary = listQ.data?.summary ?? {};

  const columns = [
    {
      key: 'settlementId',
      header: 'Settlement ID',
      render: (s: Settlement) => (
        <div>
          <div className="font-mono text-xs">{s.razorpaySettlementId}</div>
          {s.utr && <div className="text-xs text-gray-500">UTR: {s.utr}</div>}
        </div>
      ),
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (s: Settlement) => (
        <div className="text-xs">
          {s.razorpayPaymentId ? (
            <span className="font-mono">{s.razorpayPaymentId.slice(-10)}</span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
          {s.payment ? (
            <div className="text-gray-500">internal ₹{s.payment.amount}</div>
          ) : (
            <div className="text-orange-600">no internal match</div>
          )}
        </div>
      ),
    },
    {
      key: 'amounts',
      header: 'Amounts',
      render: (s: Settlement) => (
        <div className="text-xs">
          <div>Gross: ₹{s.grossAmount.toFixed(2)}</div>
          <div className="text-gray-500">Fee: ₹{s.fee.toFixed(2)} · Tax: ₹{s.tax.toFixed(2)}</div>
          <div className="font-medium">Net: ₹{s.netAmount.toFixed(2)}</div>
        </div>
      ),
    },
    {
      key: 'diff',
      header: 'Diff',
      render: (s: Settlement) =>
        s.diff != null ? (
          <span className={s.diff === 0 ? 'text-green-600' : 'text-red-600'}>
            {s.diff > 0 ? '+' : ''}
            {s.diff.toFixed(2)}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s: Settlement) => (
        <StatusBadge
          status={s.status}
          variant={
            s.status === 'matched' || s.status === 'reconciled'
              ? 'success'
              : s.status === 'mismatch'
              ? 'warning'
              : s.status === 'failed'
              ? 'danger'
              : 'neutral'
          }
        />
      ),
    },
    {
      key: 'settledAt',
      header: 'Settled',
      render: (s: Settlement) =>
        s.settledAt ? format(new Date(s.settledAt), 'dd MMM yy HH:mm') : '—',
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settlements & Reconciliation"
        subtitle="Razorpay settlement reports and reconciliation status"
        actions={
          <div className="flex gap-2">
            <RefreshButton onRefresh={() => listQ.refetch()} isFetching={listQ.isFetching} />
            <button
              onClick={() => reconcile.mutate(undefined)}
              disabled={reconcile.isPending}
              className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${reconcile.isPending ? 'animate-spin' : ''}`} />
              Reconcile pending
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1 px-3 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
            >
              <Upload className="w-4 h-4" /> Import report
            </button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STATUSES.map((s) => (
          <div key={s} className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="text-xs text-gray-500 uppercase">{s}</div>
            <div className="text-lg font-semibold">{summary[s]?.count ?? 0}</div>
            <div className="text-xs text-gray-500">
              ₹{(summary[s]?.totalNet ?? 0).toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">UTR</label>
          <input
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
            placeholder="search UTR"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <button
          onClick={() => listQ.refetch()}
          className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
        >
          <Search className="w-4 h-4" /> Apply
        </button>
      </div>

      <DataTable
        columns={columns as any}
        data={items}
        keyExtractor={(s: Settlement) => s._id}
        isLoading={listQ.isLoading}
        emptyMessage="No settlements found"
        onRowClick={(s: Settlement) => setDetail(s)}
      />

      {listQ.data && listQ.data.pages > 1 && (
        <Pagination
          page={page}
          totalPages={listQ.data.pages}
          onPageChange={setPage}
          total={listQ.data.total}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            qc.invalidateQueries({ queryKey: ['settlements'] });
            setShowImport(false);
          }}
        />
      )}

      {detail && (
        <DetailModal
          settlement={detail}
          onClose={() => setDetail(null)}
          onUpdate={(body) => mark.mutate({ id: detail._id, body })}
          isPending={mark.isPending}
        />
      )}
    </div>
  );
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [source, setSource] = useState<'csv' | 'json'>('csv');
  const [text, setText] = useState('');
  const [batchId, setBatchId] = useState('');
  const importMut = useMutation({
    mutationFn: () =>
      financeAPI.importSettlements({
        source,
        batchId: batchId || undefined,
        data: source === 'json' ? JSON.parse(text || '[]') : text,
      }),
    onSuccess: (res) => {
      const d = res.data.data;
      toast.success(`Imported: ${d.inserted} new, ${d.updated} updated, ${d.skipped} skipped`);
      onImported();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message || 'Import failed'),
  });

  return (
    <Modal isOpen onClose={onClose} title="Import Razorpay settlement report" size="lg">
      <div className="space-y-3">
        <div className="flex gap-2 text-sm">
          <label className="flex items-center gap-1">
            <input type="radio" checked={source === 'csv'} onChange={() => setSource('csv')} /> CSV
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={source === 'json'} onChange={() => setSource('json')} /> JSON
          </label>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Batch ID (optional)</label>
          <input
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            placeholder="e.g. RZP_2026_04_28"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            {source === 'csv'
              ? 'Paste CSV (with headers settlement_id, payment_id, amount, fee, tax, settled_amount, settled_at, utr)'
              : 'Paste JSON array'}
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono"
            placeholder={
              source === 'csv'
                ? 'settlement_id,payment_id,amount,fee,tax,settled_amount,settled_at,utr\nsetl_xxx,pay_yyy,500,12,2.16,485.84,2026-04-28,RBI...'
                : '[{"settlement_id":"setl_xxx","payment_id":"pay_yyy","amount":500,"fee":12,"tax":2.16,"settled_amount":485.84,"settled_at":"2026-04-28","utr":"..."}]'
            }
          />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
            Cancel
          </button>
          <button
            disabled={!text || importMut.isPending}
            onClick={() => importMut.mutate()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {importMut.isPending ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DetailModal({
  settlement,
  onClose,
  onUpdate,
  isPending,
}: {
  settlement: Settlement;
  onClose: () => void;
  onUpdate: (body: any) => void;
  isPending: boolean;
}) {
  const [notes, setNotes] = useState(settlement.notes || '');
  return (
    <Modal isOpen onClose={onClose} title={`Settlement ${settlement.razorpaySettlementId}`} size="lg">
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <StatusBadge status={settlement.status} />
          </Field>
          <Field label="UTR">{settlement.utr || '—'}</Field>
          <Field label="Razorpay payment">{settlement.razorpayPaymentId || '—'}</Field>
          <Field label="Razorpay order">{settlement.razorpayOrderId || '—'}</Field>
          <Field label="Gross">₹{settlement.grossAmount.toFixed(2)}</Field>
          <Field label="Fee">₹{settlement.fee.toFixed(2)}</Field>
          <Field label="Tax">₹{settlement.tax.toFixed(2)}</Field>
          <Field label="Net">₹{settlement.netAmount.toFixed(2)}</Field>
          <Field label="Expected (internal)">
            {settlement.expectedAmount != null ? `₹${settlement.expectedAmount.toFixed(2)}` : '—'}
          </Field>
          <Field label="Diff">
            {settlement.diff != null ? (
              <span className={settlement.diff === 0 ? 'text-green-600' : 'text-red-600'}>
                {settlement.diff > 0 ? '+' : ''}
                {settlement.diff.toFixed(2)}
              </span>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Settled at">
            {settlement.settledAt ? format(new Date(settlement.settledAt), 'dd MMM yy HH:mm') : '—'}
          </Field>
          <Field label="Batch">{settlement.batchId || '—'}</Field>
        </div>

        {settlement.mismatchReason && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <span>{settlement.mismatchReason}</span>
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-600 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button
            onClick={() => onUpdate({ notes })}
            disabled={isPending}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            Save notes
          </button>
          {settlement.status !== 'reconciled' && (
            <button
              onClick={() => onUpdate({ status: 'reconciled', notes })}
              disabled={isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-1"
            >
              <CheckCircle className="w-4 h-4" />
              Mark reconciled
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

// Suppress unused-warning helpers
void LoadingSpinner;
