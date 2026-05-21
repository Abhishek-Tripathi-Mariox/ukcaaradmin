import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Wallet, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { rechargeOffersAPI, RechargeOffer } from '@/services/api';
import { Modal, ConfirmModal } from '@/components/Modal';
import { PageHeader, LoadingSpinner, RefreshButton } from '@/components/common';

const QUERY_KEY = 'admin-recharge-offers';
const GST_RATE = 0.18;

/** Mirror of the backend computeRechargeQuote — kept in sync for the preview. */
function computeQuote(amount: number, bonusAmount = 0, discountPercent = 0) {
  const denomination = Math.max(0, Math.round(amount));
  const bonus = Math.max(0, Math.round(bonusAmount));
  const dp = Math.min(Math.max(discountPercent, 0), 100);
  const discount = Math.round((denomination * dp) / 100);
  const payableBeforeGst = Math.max(0, denomination - discount);
  const gst = Math.round(payableBeforeGst * GST_RATE);
  const total = payableBeforeGst + gst;
  const walletCredit = denomination + bonus;
  return { discount, gst, total, walletCredit };
}

export default function RechargeOffersPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<RechargeOffer | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<RechargeOffer | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () =>
      (await rechargeOffersAPI.list()).data?.data?.offers as RechargeOffer[] | undefined,
  });

  const remove = useMutation({
    mutationFn: (id: string) => rechargeOffersAPI.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Offer deleted');
      setDeleting(null);
    },
    onError: () => toast.error('Failed to delete offer'),
  });

  const offers = data ?? [];

  return (
    <div>
      <PageHeader
        title="Recharge Offers"
        subtitle="Wallet top-up denominations shown in the customer app, with bonus credit and discounts"
        actions={
          <RefreshButton onRefresh={() => qc.refetchQueries({ queryKey: [QUERY_KEY] })} />
        }
      />

      <div className="flex items-center justify-end mb-3">
        <button onClick={() => setCreating(true)} className="btn btn-primary whitespace-nowrap">
          <Plus className="w-4 h-4 mr-1" /> New offer
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !offers.length ? (
        <div className="bg-white border rounded-lg p-10 text-center">
          <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            No recharge offers yet. Create one to populate the wallet top-up screen.
          </p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2 text-center w-16">Order</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Bonus</th>
                <th className="px-3 py-2 text-right">Discount</th>
                <th className="px-3 py-2 text-right">Pays</th>
                <th className="px-3 py-2 text-right">Gets</th>
                <th className="px-3 py-2 text-center w-24">Status</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {offers.map((row) => {
                const q = computeQuote(row.amount, row.bonusAmount, row.discountPercent);
                return (
                  <tr key={row._id} className="align-middle">
                    <td className="px-3 py-3 text-center text-gray-500">{row.order}</td>
                    <td className="px-3 py-3 text-right font-medium text-gray-900">
                      ₹{row.amount.toLocaleString()}
                      {row.isPopular && (
                        <Star className="w-3.5 h-3.5 inline ml-1 text-amber-500 fill-amber-400" />
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-green-600">
                      {row.bonusAmount > 0 ? `+₹${row.bonusAmount}` : '—'}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">
                      {row.discountPercent > 0 ? `${row.discountPercent}%` : '—'}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">
                      ₹{q.total.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-gray-900">
                      ₹{q.walletCredit.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          row.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {row.isActive ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditing(row)}
                        className="text-gray-400 hover:text-brand-teal p-1"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleting(row)}
                        className="text-gray-400 hover:text-red-600 p-1"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(editing || creating) && (
        <EditModal
          initial={editing ?? undefined}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={async (payload) => {
            try {
              if (editing) {
                await rechargeOffersAPI.update(editing._id, payload);
                toast.success('Offer updated');
              } else {
                await rechargeOffersAPI.create(payload);
                toast.success('Offer created');
              }
              qc.invalidateQueries({ queryKey: [QUERY_KEY] });
              setEditing(null);
              setCreating(false);
            } catch (err: any) {
              toast.error(err?.response?.data?.message ?? 'Failed to save offer');
            }
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          isOpen
          title="Delete offer?"
          message={`The ₹${deleting.amount} offer will no longer appear in the customer app.`}
          confirmText="Delete"
          variant="danger"
          onConfirm={() => remove.mutate(deleting._id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

interface EditModalProps {
  initial?: RechargeOffer;
  onClose: () => void;
  onSave: (payload: Partial<RechargeOffer>) => void | Promise<void>;
}

function EditModal({ initial, onClose, onSave }: EditModalProps) {
  const [amount, setAmount] = useState<number>(initial?.amount ?? 100);
  const [bonusAmount, setBonusAmount] = useState<number>(initial?.bonusAmount ?? 0);
  const [discountPercent, setDiscountPercent] = useState<number>(
    initial?.discountPercent ?? 0,
  );
  const [label, setLabel] = useState(initial?.label ?? '');
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [isPopular, setIsPopular] = useState(initial?.isPopular ?? false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const q = computeQuote(amount, bonusAmount, discountPercent);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;
    onSave({
      amount,
      bonusAmount,
      discountPercent,
      label: label.trim(),
      order,
      isPopular,
      isActive,
    });
  };

  return (
    <Modal isOpen title={initial ? 'Edit offer' : 'New offer'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (₹)
            </label>
            <input
              type="number"
              className="input"
              value={amount}
              min={1}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bonus credit (₹)
            </label>
            <input
              type="number"
              className="input"
              value={bonusAmount}
              min={0}
              onChange={(e) => setBonusAmount(parseInt(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Discount (%)
            </label>
            <input
              type="number"
              className="input"
              value={discountPercent}
              min={0}
              max={100}
              onChange={(e) => setDiscountPercent(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tile label (optional)
          </label>
          <input
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={
              bonusAmount > 0
                ? `Default: "Get ₹${bonusAmount} Extra"`
                : discountPercent > 0
                ? `Default: "${discountPercent}% OFF"`
                : 'e.g. Best value'
            }
          />
        </div>

        {/* Live preview of what the customer sees */}
        <div className="rounded-lg border border-dashed border-teal-300 bg-teal-50/50 p-3 text-sm">
          <div className="flex justify-between py-0.5">
            <span className="text-gray-600">Customer pays (incl. 18% GST)</span>
            <span className="font-semibold text-gray-900">₹{q.total.toLocaleString()}</span>
          </div>
          {q.discount > 0 && (
            <div className="flex justify-between py-0.5">
              <span className="text-gray-600">Discount applied</span>
              <span className="text-green-600">− ₹{q.discount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between py-0.5">
            <span className="text-gray-600">Credited to wallet</span>
            <span className="font-semibold text-gray-900">
              ₹{q.walletCredit.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort order
            </label>
            <input
              type="number"
              className="input"
              value={order}
              onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-end pb-2 gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isPopular}
                onChange={(e) => setIsPopular(e.target.checked)}
              />
              Most popular
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
