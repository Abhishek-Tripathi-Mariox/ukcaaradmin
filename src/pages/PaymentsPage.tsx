import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsAPI, walletsAPI } from '@/services/api';
import { DataTable, Pagination } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { PageHeader, StatusBadge, LoadingSpinner, RefreshButton } from '@/components/common';
import { UserSearchSelect, type AdminUserLite } from '@/components/UserSearchSelect';
import {
  Search,
  Eye,
  RefreshCw,
  Wallet,
  CreditCard,
  ArrowUpCircle,
  ArrowDownCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { Payment } from '@/types';

type TabType = 'payments' | 'payouts';

export default function PaymentsPage() {
  const [tab, setTab] = useState<TabType>('payments');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState('');
  const [walletUser, setWalletUser] = useState<AdminUserLite | null>(null);
  const [walletAmount, setWalletAmount] = useState(0);
  const [walletType, setWalletType] = useState<'credit' | 'debit'>('credit');
  const [walletReason, setWalletReason] = useState('');
  const [selectedPayouts, setSelectedPayouts] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['payments', tab, page, search, typeFilter, statusFilter],
    queryFn: async () => {
      if (tab === 'payouts') {
        const res = await paymentsAPI.getPendingPayouts();
        return { data: res.data.data, pagination: null };
      }
      const params: any = { page, limit: 10 };
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await paymentsAPI.getAll(params);
      return {
        data: res.data?.data?.payments ?? [],
        pagination: res.data?.data?.pagination ?? null,
      };
    },
  });

  const refundMutation = useMutation({
    mutationFn: ({ id, amount, reason }: { id: string; amount: number; reason: string }) =>
      paymentsAPI.refund(id, amount, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Refund processed');
      setShowRefundModal(false);
      setRefundAmount(0);
      setRefundReason('');
    },
    onError: () => toast.error('Failed to process refund'),
  });

  const processPayoutsMutation = useMutation({
    mutationFn: (driverIds: string[]) => paymentsAPI.processPayouts(driverIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payouts processed');
      setSelectedPayouts([]);
    },
    onError: () => toast.error('Failed to process payouts'),
  });

  const adjustWalletMutation = useMutation({
    mutationFn: ({ userId, amount, type, reason }: { userId: string; amount: number; type: 'credit' | 'debit'; reason: string }) =>
      walletsAPI.adjustBalance(userId, amount, type, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Wallet adjusted');
      setShowWalletModal(false);
      setWalletUser(null);
      setWalletAmount(0);
      setWalletReason('');
    },
    onError: () => toast.error('Failed to adjust wallet'),
  });

  const getPaymentTypeIcon = (type: string) => {
    switch (type) {
      case 'ride_payment':
        return <CreditCard className="w-4 h-4 text-blue-500" />;
      case 'subscription':
        return <RefreshCw className="w-4 h-4 text-purple-500" />;
      case 'refund':
        return <ArrowDownCircle className="w-4 h-4 text-red-500" />;
      case 'payout':
        return <ArrowUpCircle className="w-4 h-4 text-green-500" />;
      case 'wallet_topup':
        return <Wallet className="w-4 h-4 text-yellow-500" />;
      default:
        return <CreditCard className="w-4 h-4 text-gray-500" />;
    }
  };

  const columns = [
    {
      key: 'payment',
      header: 'Payment',
      render: (payment: Payment) => (
        <div className="flex items-center gap-3">
          {getPaymentTypeIcon(payment.type)}
          <div>
            <div className="font-medium text-gray-900">
              #{payment._id.slice(-8).toUpperCase()}
            </div>
            <div className="text-sm text-gray-500 capitalize">
              {payment.type.replace(/_/g, ' ')}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'User',
      render: (payment: Payment) => (
        <div className="text-sm">
          <div className="font-medium">
            {payment.user?.firstName} {payment.user?.lastName}
          </div>
          <div className="text-gray-500">{payment.user?.email}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (payment: Payment) => (
        <div className={clsx(
          'font-medium',
          payment.type === 'refund' ? 'text-red-600' : 'text-gray-900'
        )}>
          {payment.type === 'refund' ? '-' : ''}₹{payment.amount.toFixed(2)}
        </div>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (payment: Payment) => (
        <span className="capitalize">{payment.method}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (payment: Payment) => <StatusBadge status={payment.status} />,
    },
    {
      key: 'date',
      header: 'Date',
      render: (payment: Payment) => (
        <span className="text-gray-600">
          {format(new Date(payment.createdAt), 'MMM d, yyyy HH:mm')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (payment: Payment) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPayment(payment);
              setShowDetails(true);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="View Details"
          >
            <Eye className="w-4 h-4 text-gray-500" />
          </button>
          {payment.status === 'completed' && payment.type === 'ride_payment' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPayment(payment);
                setRefundAmount(payment.amount);
                setShowRefundModal(true);
              }}
              className="p-2 hover:bg-red-50 rounded-lg"
              title="Refund"
            >
              <RefreshCw className="w-4 h-4 text-red-500" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Payment Management"
        subtitle="Manage transactions, refunds, and payouts"
        actions={
          <div className="flex gap-2">
            <RefreshButton onRefresh={refetch} isFetching={isFetching} />
            <button
              onClick={() => setShowWalletModal(true)}
              className="btn btn-primary"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Adjust Wallet
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { key: 'payments', label: 'All Payments', icon: CreditCard },
          { key: 'payouts', label: 'Pending Payouts', icon: ArrowUpCircle },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              setTab(key as TabType);
              setPage(1);
            }}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {tab === 'payments' && (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by payment ID or user..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input pl-10"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="input w-full sm:w-40"
          >
            <option value="">All Types</option>
            <option value="ride_payment">Ride Payment</option>
            <option value="subscription">Subscription</option>
            <option value="refund">Refund</option>
            <option value="payout">Payout</option>
            <option value="wallet_topup">Wallet Top-up</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="input w-full sm:w-40"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      )}

      {/* Payouts View */}
      {tab === 'payouts' && (
        <>
          {(data?.data || []).length > 0 && (
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">
                {selectedPayouts.length} selected
              </span>
              <button
                onClick={() => processPayoutsMutation.mutate(selectedPayouts)}
                className="btn btn-success"
                disabled={selectedPayouts.length === 0 || processPayoutsMutation.isPending}
              >
                Process Selected Payouts
              </button>
            </div>
          )}
          <div className="space-y-3">
            {(data?.data || []).map((payout: any) => (
              <div
                key={payout.driverId}
                className="flex items-center justify-between bg-white rounded-lg shadow-sm p-4"
              >
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={selectedPayouts.includes(payout.driverId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPayouts([...selectedPayouts, payout.driverId]);
                      } else {
                        setSelectedPayouts(selectedPayouts.filter((id) => id !== payout.driverId));
                      }
                    }}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-700">
                      {payout.driverName?.[0] || 'D'}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium">{payout.driverName}</div>
                    <div className="text-sm text-gray-500">{payout.driverEmail}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-green-600">
                    ₹{payout.pendingAmount?.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {payout.ridesCount} rides
                  </div>
                </div>
              </div>
            ))}
            {(data?.data || []).length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No pending payouts
              </div>
            )}
          </div>
        </>
      )}

      {/* Table */}
      {tab === 'payments' && (
        isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <DataTable
              columns={columns}
              data={data?.data || []}
              keyExtractor={(payment) => payment._id}
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
        )
      )}

      {/* Payment Details Modal */}
      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        title="Payment Details"
        size="lg"
      >
        {selectedPayment && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getPaymentTypeIcon(selectedPayment.type)}
                <div>
                  <div className="text-lg font-semibold">
                    #{selectedPayment._id.slice(-8).toUpperCase()}
                  </div>
                  <div className="text-sm text-gray-500 capitalize">
                    {selectedPayment.type.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>
              <StatusBadge status={selectedPayment.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">Amount</div>
                <div className="text-2xl font-bold">
                  ₹{selectedPayment.amount.toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">Method</div>
                <div className="text-2xl font-bold capitalize">
                  {selectedPayment.method}
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3">User Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Name:</span>
                  <span className="ml-2">
                    {selectedPayment.user?.firstName} {selectedPayment.user?.lastName}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Email:</span>
                  <span className="ml-2">{selectedPayment.user?.email}</span>
                </div>
              </div>
            </div>

            {selectedPayment.stripePaymentId && (
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-2">Stripe Details</h4>
                <div className="text-sm">
                  <span className="text-gray-500">Payment ID:</span>
                  <span className="ml-2 font-mono">{selectedPayment.stripePaymentId}</span>
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="text-sm text-gray-500">
                Created: {format(new Date(selectedPayment.createdAt), 'PPpp')}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Refund Modal */}
      <Modal
        isOpen={showRefundModal}
        onClose={() => {
          setShowRefundModal(false);
          setRefundAmount(0);
          setRefundReason('');
        }}
        title="Process Refund"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Original Amount
            </label>
            <div className="text-lg font-semibold">
              ₹{selectedPayment?.amount.toFixed(2)}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Refund Amount *
            </label>
            <input
              type="number"
              value={refundAmount}
              onChange={(e) => setRefundAmount(Number(e.target.value))}
              className="input"
              step="0.01"
              min={0}
              max={selectedPayment?.amount || 0}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason *
            </label>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="input"
              rows={3}
              placeholder="Enter reason..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowRefundModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedPayment && refundReason) {
                  refundMutation.mutate({
                    id: selectedPayment._id,
                    amount: refundAmount,
                    reason: refundReason,
                  });
                }
              }}
              className="btn btn-danger"
              disabled={!refundReason || refundAmount <= 0 || refundMutation.isPending}
            >
              Process Refund
            </button>
          </div>
        </div>
      </Modal>

      {/* Wallet Adjustment Modal */}
      <Modal
        isOpen={showWalletModal}
        onClose={() => {
          setShowWalletModal(false);
          setWalletUser(null);
          setWalletAmount(0);
          setWalletReason('');
        }}
        title="Adjust User Wallet"
      >
        <div className="space-y-4">
          <UserSearchSelect
            label="User"
            required
            value={walletUser}
            onChange={setWalletUser}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="credit"
                  checked={walletType === 'credit'}
                  onChange={() => setWalletType('credit')}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-sm">Credit (Add)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="debit"
                  checked={walletType === 'debit'}
                  onChange={() => setWalletType('debit')}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-sm">Debit (Subtract)</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount *
            </label>
            <input
              type="number"
              value={walletAmount}
              onChange={(e) => setWalletAmount(Number(e.target.value))}
              className="input"
              step="0.01"
              min={0}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason *
            </label>
            <textarea
              value={walletReason}
              onChange={(e) => setWalletReason(e.target.value)}
              className="input"
              rows={3}
              placeholder="Enter reason..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowWalletModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => {
                if (walletUser && walletAmount > 0 && walletReason) {
                  adjustWalletMutation.mutate({
                    userId: walletUser._id,
                    amount: walletAmount,
                    type: walletType,
                    reason: walletReason,
                  });
                }
              }}
              className="btn btn-primary"
              disabled={!walletUser || walletAmount <= 0 || !walletReason || adjustWalletMutation.isPending}
            >
              Adjust Wallet
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
