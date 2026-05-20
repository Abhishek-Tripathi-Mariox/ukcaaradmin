import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { faqsAPI, Faq, FaqAudience } from '@/services/api';
import { Modal, ConfirmModal } from '@/components/Modal';
import { PageHeader, LoadingSpinner, RefreshButton } from '@/components/common';

const QUERY_KEY = 'admin-faqs';

const AUDIENCE_LABELS: Record<FaqAudience, string> = {
  user: 'Customer app',
  driver: 'Driver app',
  both: 'Both apps',
};

const AUDIENCE_BADGE: Record<FaqAudience, string> = {
  user: 'bg-blue-100 text-blue-700',
  driver: 'bg-purple-100 text-purple-700',
  both: 'bg-teal-100 text-teal-700',
};

type AudienceFilter = 'all' | FaqAudience;

export default function FaqsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<AudienceFilter>('all');
  const [editing, setEditing] = useState<Faq | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Faq | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () =>
      (await faqsAPI.list()).data?.data?.faqs as Faq[] | undefined,
  });

  const remove = useMutation({
    mutationFn: (id: string) => faqsAPI.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('FAQ deleted');
      setDeleting(null);
    },
    onError: () => toast.error('Failed to delete FAQ'),
  });

  const faqs = (data ?? []).filter(
    (f) => filter === 'all' || f.audience === filter,
  );

  return (
    <div>
      <PageHeader
        title="FAQs"
        subtitle="Manage the Help & Support questions shown in the customer and driver apps"
        actions={
          <RefreshButton
            onRefresh={() => qc.refetchQueries({ queryKey: [QUERY_KEY] })}
          />
        }
      />

      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex gap-1 border rounded-lg p-1 bg-white">
          {(['all', 'user', 'driver', 'both'] as AudienceFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === f
                  ? 'bg-brand-teal text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'all' ? 'All' : AUDIENCE_LABELS[f]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCreating(true)}
          className="btn btn-primary whitespace-nowrap"
        >
          <Plus className="w-4 h-4 mr-1" /> New FAQ
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !faqs.length ? (
        <div className="bg-white border rounded-lg p-10 text-center">
          <HelpCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            No FAQs yet. Create one to populate the apps' Help &amp; Support
            screens.
          </p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2 text-center w-16">Order</th>
                <th className="px-3 py-2 text-left">Question &amp; answer</th>
                <th className="px-3 py-2 text-center w-32">Audience</th>
                <th className="px-3 py-2 text-center w-24">Status</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {faqs.map((row) => (
                <tr key={row._id} className="align-top">
                  <td className="px-3 py-3 text-center text-gray-500">
                    {row.order}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-gray-900">
                      {row.question}
                    </div>
                    <div className="text-gray-500 mt-0.5 line-clamp-2">
                      {row.answer}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${
                        AUDIENCE_BADGE[row.audience]
                      }`}
                    >
                      {AUDIENCE_LABELS[row.audience]}
                    </span>
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
              ))}
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
                await faqsAPI.update(editing._id, payload);
                toast.success('FAQ updated');
              } else {
                await faqsAPI.create(payload);
                toast.success('FAQ created');
              }
              qc.invalidateQueries({ queryKey: [QUERY_KEY] });
              setEditing(null);
              setCreating(false);
            } catch (err: any) {
              toast.error(err?.response?.data?.message ?? 'Failed to save FAQ');
            }
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          isOpen
          title="Delete FAQ?"
          message={`"${deleting.question}" will no longer appear in the apps.`}
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
  initial?: Faq;
  onClose: () => void;
  onSave: (payload: Partial<Faq>) => void | Promise<void>;
}

function EditModal({ initial, onClose, onSave }: EditModalProps) {
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [answer, setAnswer] = useState(initial?.answer ?? '');
  const [audience, setAudience] = useState<FaqAudience>(
    initial?.audience ?? 'both',
  );
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    onSave({
      question: question.trim(),
      answer: answer.trim(),
      audience,
      order,
      isActive,
    });
  };

  return (
    <Modal isOpen title={initial ? 'Edit FAQ' : 'New FAQ'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Question
          </label>
          <input
            className="input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How do I cancel a ride?"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Answer
          </label>
          <textarea
            className="input min-h-[120px]"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Write the answer riders/drivers will read…"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Show in
          </label>
          <select
            className="input"
            value={audience}
            onChange={(e) => setAudience(e.target.value as FaqAudience)}
          >
            <option value="both">Both apps</option>
            <option value="user">Customer app only</option>
            <option value="driver">Driver app only</option>
          </select>
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
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active (visible in apps)
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
