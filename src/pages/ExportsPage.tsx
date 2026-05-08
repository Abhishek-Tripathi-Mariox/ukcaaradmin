import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, FileSpreadsheet } from 'lucide-react';
import { reportsAPI } from '@/services/api';
import { PageHeader } from '@/components/common';

interface ExportType {
  key: string;
  label: string;
  description: string;
  filters: Array<
    | { kind: 'select'; name: string; label: string; options: { value: string; label: string }[] }
    | { kind: 'text'; name: string; label: string }
  >;
}

const EXPORTS: ExportType[] = [
  {
    key: 'rides',
    label: 'Rides',
    description: 'All rides with customer/driver, fares, distance, payment.',
    filters: [
      {
        kind: 'select',
        name: 'status',
        label: 'Status',
        options: [
          { value: '', label: 'All' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
          { value: 'in_progress', label: 'In progress' },
          { value: 'searching', label: 'Searching' },
        ],
      },
      {
        kind: 'select',
        name: 'rideType',
        label: 'Ride type',
        options: [
          { value: '', label: 'All' },
          { value: 'economy', label: 'Economy' },
          { value: 'comfort', label: 'Comfort' },
          { value: 'premium', label: 'Premium' },
          { value: 'xl', label: 'XL' },
          { value: 'electric', label: 'Electric' },
        ],
      },
    ],
  },
  {
    key: 'payments',
    label: 'Payments',
    description: 'Payment transactions with Razorpay refs.',
    filters: [
      {
        kind: 'select',
        name: 'status',
        label: 'Status',
        options: [
          { value: '', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'completed', label: 'Completed' },
          { value: 'failed', label: 'Failed' },
          { value: 'refunded', label: 'Refunded' },
        ],
      },
    ],
  },
  {
    key: 'users',
    label: 'Customers',
    description: 'All customer accounts with verification status.',
    filters: [],
  },
  {
    key: 'drivers',
    label: 'Drivers',
    description: 'Driver accounts with vehicle info, earnings, ratings.',
    filters: [],
  },
  {
    key: 'settlements',
    label: 'Settlements',
    description: 'Razorpay settlement records and reconciliation status.',
    filters: [
      {
        kind: 'select',
        name: 'status',
        label: 'Status',
        options: [
          { value: '', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'matched', label: 'Matched' },
          { value: 'mismatch', label: 'Mismatch' },
          { value: 'reconciled', label: 'Reconciled' },
          { value: 'failed', label: 'Failed' },
        ],
      },
    ],
  },
  {
    key: 'invoices',
    label: 'Tax invoices',
    description: 'GST + TDS invoices.',
    filters: [
      {
        kind: 'select',
        name: 'type',
        label: 'Type',
        options: [
          { value: '', label: 'All' },
          { value: 'customer', label: 'Customer (GST)' },
          { value: 'driver_payout', label: 'Driver payout (TDS)' },
        ],
      },
    ],
  },
  {
    key: 'tickets',
    label: 'Support tickets',
    description: 'Tickets with status, priority, SLA, assignee.',
    filters: [
      {
        kind: 'select',
        name: 'status',
        label: 'Status',
        options: [
          { value: '', label: 'All' },
          { value: 'open', label: 'Open' },
          { value: 'in_progress', label: 'In progress' },
          { value: 'pending_user', label: 'Pending user' },
          { value: 'resolved', label: 'Resolved' },
          { value: 'closed', label: 'Closed' },
        ],
      },
    ],
  },
];

export default function ExportsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="CSV Exports"
        subtitle="Download data extracts for analytics or accounting"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {EXPORTS.map((e) => (
          <ExportCard key={e.key} type={e} />
        ))}
      </div>
    </div>
  );
}

function ExportCard({ type }: { type: ExportType }) {
  const [days, setDays] = useState(30);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const params: Record<string, string> = { startDate: start };
      Object.entries(filterValues).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      await reportsAPI.downloadCsv(type.key, params);
      toast.success(`${type.label} export downloaded`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Export failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2">
          <FileSpreadsheet className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">{type.label}</div>
            <div className="text-xs text-gray-500">{type.description}</div>
          </div>
        </div>
      </div>

      <div className="space-y-2 mt-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Date range</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
            <option value={3650}>All time</option>
          </select>
        </div>
        {type.filters.map((f) =>
          f.kind === 'select' ? (
            <div key={f.name}>
              <label className="block text-xs text-gray-600 mb-1">{f.label}</label>
              <select
                value={filterValues[f.name] ?? ''}
                onChange={(e) =>
                  setFilterValues((v) => ({ ...v, [f.name]: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div key={f.name}>
              <label className="block text-xs text-gray-600 mb-1">{f.label}</label>
              <input
                value={filterValues[f.name] ?? ''}
                onChange={(e) =>
                  setFilterValues((v) => ({ ...v, [f.name]: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )
        )}
      </div>

      <button
        disabled={downloading}
        onClick={download}
        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        {downloading ? 'Downloading…' : 'Download CSV'}
      </button>
    </div>
  );
}
