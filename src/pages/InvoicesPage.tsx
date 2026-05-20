import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Download, FileText, Plus, X } from 'lucide-react';
import { financeAPI } from '@/services/api';
import { DataTable, Pagination } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { PageHeader, StatusBadge, RefreshButton } from '@/components/common';

type InvoiceType = 'customer' | 'driver_payout' | 'tds_certificate';
type InvoiceStatus = 'draft' | 'issued' | 'cancelled' | 'sent';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  type: InvoiceType;
  status: InvoiceStatus;
  customer?: { firstName?: string; lastName?: string; email?: string };
  driver?: { firstName?: string; lastName?: string };
  ride?: { _id: string; pickup?: { address?: string }; dropoff?: { address?: string } };
  receiverName?: string;
  totalAmount: number;
  totalTax: number;
  tdsApplicable: boolean;
  tdsAmount?: number;
  netPayable?: number;
  issuedAt?: string;
  createdAt: string;
}

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [type, setType] = useState<InvoiceType | ''>('');
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const listQ = useQuery({
    queryKey: ['invoices', page, type, status],
    queryFn: async () =>
      (
        await financeAPI.listInvoices({
          page,
          limit: 25,
          type: (type || undefined) as any,
          status: status || undefined,
        })
      ).data.data as { items: Invoice[]; total: number; pages: number },
  });

  const issueMut = useMutation({
    mutationFn: (id: string) => financeAPI.issueInvoice(id),
    onSuccess: () => {
      toast.success('Invoice issued');
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Issue failed'),
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      financeAPI.cancelInvoice(id, reason),
    onSuccess: () => {
      toast.success('Invoice cancelled');
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setDetail(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Cancel failed'),
  });

  const items = listQ.data?.items ?? [];

  const columns = [
    {
      key: 'invoice',
      header: 'Invoice',
      render: (i: Invoice) => (
        <div>
          <div className="font-mono text-xs">{i.invoiceNumber}</div>
          <div className="text-xs text-gray-500 capitalize">{i.type.replace(/_/g, ' ')}</div>
        </div>
      ),
    },
    {
      key: 'party',
      header: 'Party',
      render: (i: Invoice) => (
        <div className="text-xs">
          <div>
            {i.receiverName ||
              (i.customer
                ? `${i.customer.firstName ?? ''} ${i.customer.lastName ?? ''}`
                : i.driver
                ? `${i.driver.firstName ?? ''} ${i.driver.lastName ?? ''}`
                : '—')}
          </div>
          {i.ride && (
            <div className="text-gray-500 truncate max-w-xs">
              {i.ride.pickup?.address} → {i.ride.dropoff?.address}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (i: Invoice) => (
        <div className="text-xs">
          <div className="font-medium">₹{i.totalAmount.toFixed(2)}</div>
          {i.totalTax > 0 && <div className="text-gray-500">Tax: ₹{i.totalTax.toFixed(2)}</div>}
          {i.tdsApplicable && i.tdsAmount != null && (
            <div className="text-yellow-700">
              TDS: ₹{i.tdsAmount.toFixed(2)} · Net ₹{i.netPayable?.toFixed(2)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (i: Invoice) => (
        <StatusBadge
          status={i.status}
          variant={
            i.status === 'issued' || i.status === 'sent'
              ? 'success'
              : i.status === 'draft'
              ? 'warning'
              : 'danger'
          }
        />
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (i: Invoice) =>
        format(new Date(i.issuedAt || i.createdAt), 'dd MMM yy'),
    },
    {
      key: 'actions',
      header: '',
      render: (i: Invoice) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <a
            href={financeAPI.invoicePdfUrl(i._id)}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-gray-100 rounded"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </a>
          {i.status === 'draft' && (
            <button
              onClick={() => issueMut.mutate(i._id)}
              className="p-1.5 hover:bg-green-100 rounded text-green-700"
              title="Issue"
            >
              <FileText className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tax Invoices"
        subtitle="GST invoices for customers and TDS-applied driver payouts"
        actions={
          <div className="flex gap-2">
            <RefreshButton onRefresh={() => listQ.refetch()} isFetching={listQ.isFetching} />
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> New invoice
            </button>
          </div>
        }
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as any);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All</option>
            <option value="customer">Customer (GST)</option>
            <option value="driver_payout">Driver payout (TDS)</option>
            <option value="tds_certificate">TDS certificate</option>
          </select>
        </div>
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
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="sent">Sent</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns as any}
        data={items}
        keyExtractor={(i: Invoice) => i._id}
        isLoading={listQ.isLoading}
        emptyMessage="No invoices yet"
        onRowClick={(i: Invoice) => setDetail(i)}
      />

      {listQ.data && listQ.data.pages > 1 && (
        <Pagination
          page={page}
          totalPages={listQ.data.pages}
          onPageChange={setPage}
          total={listQ.data.total}
        />
      )}

      {showCreate && (
        <CreateInvoiceModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['invoices'] });
            setShowCreate(false);
          }}
        />
      )}

      {detail && (
        <Modal
          isOpen
          onClose={() => setDetail(null)}
          title={detail.invoiceNumber}
          size="md"
        >
          <div className="space-y-3 text-sm">
            <iframe
              src={financeAPI.invoicePdfUrl(detail._id)}
              className="w-full h-96 border rounded-lg"
              title="Invoice PDF"
            />
            <div className="flex justify-end gap-2">
              <a
                href={financeAPI.invoicePdfUrl(detail._id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <Download className="w-4 h-4" /> Download PDF
              </a>
              {detail.status !== 'cancelled' && (
                <button
                  onClick={() => { setCancelReason(''); setShowCancelModal(true); }}
                  className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {showCancelModal && detail && (
        <Modal
          isOpen
          onClose={() => setShowCancelModal(false)}
          title="Cancel Invoice"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will mark invoice <span className="font-mono font-medium">{detail.invoiceNumber}</span> as cancelled.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cancellation reason *</label>
              <input
                autoFocus
                className="input w-full"
                placeholder="Enter reason…"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn btn-secondary" onClick={() => setShowCancelModal(false)}>
                Back
              </button>
              <button
                className="btn btn-danger"
                disabled={!cancelReason.trim() || cancelMut.isPending}
                onClick={() => {
                  cancelMut.mutate({ id: detail._id, reason: cancelReason });
                  setShowCancelModal(false);
                }}
              >
                {cancelMut.isPending ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CreateInvoiceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState<'customer' | 'driver_payout'>('customer');
  const [rideId, setRideId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [grossAmount, setGrossAmount] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverGstin, setReceiverGstin] = useState('');
  const [receiverState, setReceiverState] = useState('');
  const [issue, setIssue] = useState(true);

  const create = useMutation({
    mutationFn: () => {
      if (type === 'customer') {
        return financeAPI.createCustomerInvoice({
          rideId,
          receiverName: receiverName || undefined,
          receiverGstin: receiverGstin || undefined,
          receiverState: receiverState || undefined,
          issue,
        });
      } else {
        return financeAPI.createDriverPayoutInvoice({
          driverId,
          rideId: rideId || undefined,
          grossAmount: grossAmount ? Number(grossAmount) : undefined,
          issue,
        });
      }
    },
    onSuccess: () => {
      toast.success('Invoice created');
      onCreated();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Create failed'),
  });

  return (
    <Modal isOpen onClose={onClose} title="Create invoice" size="md">
      <div className="space-y-3">
        <div className="flex gap-2 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={type === 'customer'}
              onChange={() => setType('customer')}
            />
            Customer (GST)
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={type === 'driver_payout'}
              onChange={() => setType('driver_payout')}
            />
            Driver payout (TDS)
          </label>
        </div>

        {type === 'customer' && (
          <>
            <Input label="Ride ID *" value={rideId} onChange={setRideId} />
            <Input label="Receiver name" value={receiverName} onChange={setReceiverName} />
            <Input label="Receiver GSTIN" value={receiverGstin} onChange={setReceiverGstin} />
            <Input
              label="Receiver state code (e.g. KA)"
              value={receiverState}
              onChange={setReceiverState}
            />
          </>
        )}
        {type === 'driver_payout' && (
          <>
            <Input label="Driver ID *" value={driverId} onChange={setDriverId} />
            <Input label="Ride ID (optional)" value={rideId} onChange={setRideId} />
            <Input
              label="Gross amount (overrides ride.driverEarnings)"
              value={grossAmount}
              onChange={setGrossAmount}
              type="number"
            />
          </>
        )}

        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={issue} onChange={(e) => setIssue(e.target.checked)} />
          Issue immediately (otherwise saved as draft)
        </label>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
            Cancel
          </button>
          <button
            disabled={create.isPending || (type === 'customer' ? !rideId : !driverId)}
            onClick={() => create.mutate()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {create.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      <input
        value={value}
        type={type}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      />
    </div>
  );
}
