import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationTemplatesAPI } from '@/services/api';
import { Modal, ConfirmModal } from '@/components/Modal';
import { PageHeader, StatusBadge, LoadingSpinner, RefreshButton } from '@/components/common';
import { Plus, Pencil, Trash2, Send, Eye, MailPlus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const TYPE_OPTIONS = ['ride', 'payment', 'promo', 'safety', 'system'] as const;
const CHANNEL_OPTIONS = ['push', 'inapp', 'both'] as const;
const LOCALE_OPTIONS = ['en', 'hi', 'fr', 'es', 'ar'];

interface Template {
  _id: string;
  key: string;
  name: string;
  description?: string;
  type: (typeof TYPE_OPTIONS)[number];
  channel: (typeof CHANNEL_OPTIONS)[number];
  locale: string;
  titleTemplate: string;
  bodyTemplate: string;
  defaultData?: Record<string, any>;
  variables?: string[];
  isActive: boolean;
  updatedAt: string;
}

export default function NotificationTemplatesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [testing, setTesting] = useState<Template | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['notification-templates', search, typeFilter],
    queryFn: async () =>
      (
        await notificationTemplatesAPI.list({
          search: search || undefined,
          type: typeFilter || undefined,
        })
      ).data?.data?.templates as Template[] | undefined,
  });

  const del = useMutation({
    mutationFn: (id: string) => notificationTemplatesAPI.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-templates'] });
      toast.success('Template deleted');
      setDeleting(null);
    },
    onError: () => toast.error('Failed to delete template'),
  });

  return (
    <div>
      <PageHeader
        title="Notification Templates"
        subtitle="Authorable push + in-app messages with variables and locale variants"
        actions={<RefreshButton onRefresh={refetch} isFetching={isFetching} />}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by key or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input sm:w-48"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button onClick={() => setCreating(true)} className="btn btn-primary whitespace-nowrap">
          <Plus className="w-4 h-4 mr-1" /> New template
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.length ? (
        <div className="bg-white border rounded-lg p-10 text-center">
          <MailPlus className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            No templates yet. Create one — e.g. <code>ride.accepted</code> — and reference it
            from backend code via <code>sendTemplated()</code>.
          </p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Key</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Locale</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((t) => (
                <tr key={t._id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{t.key}</code>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{t.name}</div>
                    {t.description && (
                      <div className="text-xs text-gray-500 line-clamp-1">{t.description}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{t.type}</span>
                  </td>
                  <td className="px-3 py-2 text-center text-xs">{t.channel}</td>
                  <td className="px-3 py-2 text-center text-xs">{t.locale}</td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge status={t.isActive ? 'active' : 'inactive'} />
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-gray-500">
                    {format(new Date(t.updatedAt), 'PP')}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setTesting(t)}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Test send"
                      >
                        <Send className="w-4 h-4 text-primary-600" />
                      </button>
                      <button
                        onClick={() => setEditing(t)}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => setDeleting(t)}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <TemplateFormModal
          template={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => qc.invalidateQueries({ queryKey: ['notification-templates'] })}
        />
      )}

      {testing && (
        <TestSendModal template={testing} onClose={() => setTesting(null)} />
      )}

      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting._id)}
        title="Delete template"
        message={`Delete "${deleting?.name}"? Code that references "${deleting?.key}" will fall back to its hardcoded copy.`}
        confirmText="Delete"
        variant="danger"
        isLoading={del.isPending}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// FORM MODAL — create/edit with live preview
// ════════════════════════════════════════════════════════════════════

function TemplateFormModal({
  template,
  onClose,
  onSaved,
}: {
  template: Template | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!template;
  const [key, setKey] = useState(template?.key ?? '');
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [type, setType] = useState(template?.type ?? 'system');
  const [channel, setChannel] = useState(template?.channel ?? 'both');
  const [locale, setLocale] = useState(template?.locale ?? 'en');
  const [titleTemplate, setTitleTemplate] = useState(template?.titleTemplate ?? '');
  const [bodyTemplate, setBodyTemplate] = useState(template?.bodyTemplate ?? '');
  const [variablesText, setVariablesText] = useState(
    (template?.variables ?? []).join(', '),
  );
  const [defaultDataText, setDefaultDataText] = useState(
    JSON.stringify(template?.defaultData ?? {}, null, 2),
  );
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [previewVarsText, setPreviewVarsText] = useState('{\n  "name": "Alex"\n}');

  // Detected variables from {{var}} in either template (for the preview hint).
  const detectedVars = useMemo(() => {
    const re = /\{\{\s*([\w.]+)\s*\}\}/g;
    const set = new Set<string>();
    [titleTemplate, bodyTemplate].forEach((s) => {
      let m: RegExpExecArray | null;
      while ((m = re.exec(s))) set.add(m[1]);
    });
    return Array.from(set);
  }, [titleTemplate, bodyTemplate]);

  const renderedPreview = useMemo(() => {
    let vars: Record<string, any> = {};
    try {
      vars = JSON.parse(previewVarsText || '{}');
    } catch {
      return { title: '⚠ invalid JSON in preview vars', body: '' };
    }
    const merged = { ...safeJsonParse(defaultDataText), ...vars };
    const sub = (s: string) =>
      s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, p: string) => {
        const segs = p.split('.');
        let cur: any = merged;
        for (const seg of segs) {
          if (cur == null) return '';
          cur = cur[seg];
        }
        return cur == null ? '' : String(cur);
      });
    return { title: sub(titleTemplate), body: sub(bodyTemplate) };
  }, [titleTemplate, bodyTemplate, previewVarsText, defaultDataText]);

  const save = useMutation({
    mutationFn: async () => {
      let defaultData: any = {};
      try {
        defaultData = JSON.parse(defaultDataText || '{}');
      } catch {
        throw new Error('defaultData must be valid JSON');
      }
      const variables = variablesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const body = {
        key,
        name,
        description,
        type,
        channel,
        locale,
        titleTemplate,
        bodyTemplate,
        defaultData,
        variables,
        isActive,
      };
      if (isEdit) return notificationTemplatesAPI.update(template!._id, body);
      return notificationTemplatesAPI.create(body);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Template updated' : 'Template created');
      onSaved();
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || e?.message || 'Save failed'),
  });

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? 'Edit template' : 'New template'} size="xl">
      <div className="grid lg:grid-cols-2 gap-4">
        {/* LEFT — form */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600">Key</label>
            <input
              className="input font-mono text-sm"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="ride.accepted"
              disabled={isEdit}
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Stable identifier used by backend code. Cannot be changed after creation.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-600">Name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Locale</label>
              <select
                className="input"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
              >
                {LOCALE_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600">Description</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-600">Type</label>
              <select
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Channel</label>
              <select
                className="input"
                value={channel}
                onChange={(e) => setChannel(e.target.value as any)}
              >
                {CHANNEL_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 pb-1">
              <input
                type="checkbox"
                id="t-active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="t-active" className="text-sm">
                Active
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600">Title template</label>
            <input
              className="input"
              value={titleTemplate}
              onChange={(e) => setTitleTemplate(e.target.value)}
              placeholder="Hi {{name}}, your ride is on the way"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Body template</label>
            <textarea
              className="input"
              rows={4}
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.target.value)}
              placeholder="{{driver}} is arriving in {{eta}} mins."
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">
              Variables (comma-separated; for documentation)
            </label>
            <input
              className="input text-xs"
              value={variablesText}
              onChange={(e) => setVariablesText(e.target.value)}
              placeholder="name, driver, eta"
            />
            {detectedVars.length > 0 && (
              <p className="text-[10px] text-gray-500 mt-1">
                Detected in templates: {detectedVars.map((v) => `{{${v}}}`).join(' ')}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-600">Default data (JSON)</label>
            <textarea
              className="input font-mono text-xs"
              rows={3}
              value={defaultDataText}
              onChange={(e) => setDefaultDataText(e.target.value)}
            />
          </div>
        </div>

        {/* RIGHT — live preview */}
        <div className="space-y-3">
          <div className="bg-gray-50 border rounded p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-2">
              <Eye className="w-3.5 h-3.5" /> Live preview
            </div>
            <label className="text-xs text-gray-600">Preview variables (JSON)</label>
            <textarea
              className="input font-mono text-xs"
              rows={5}
              value={previewVarsText}
              onChange={(e) => setPreviewVarsText(e.target.value)}
            />
          </div>

          {/* Phone-style notification preview */}
          <div className="bg-gradient-to-b from-gray-100 to-gray-200 rounded-xl p-4">
            <div className="bg-white rounded-lg shadow p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded bg-primary-600 flex items-center justify-center">
                  <MailPlus className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-gray-500">UKCAAR</span>
              </div>
              <div className="font-semibold text-sm">
                {renderedPreview.title || (
                  <span className="text-gray-400 italic">Title…</span>
                )}
              </div>
              <div className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap">
                {renderedPreview.body || (
                  <span className="text-gray-400 italic">Body…</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
        <button onClick={onClose} className="btn btn-secondary">
          Cancel
        </button>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || !key || !name || !titleTemplate || !bodyTemplate}
          className="btn btn-primary"
        >
          {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create template'}
        </button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════
// TEST SEND MODAL
// ════════════════════════════════════════════════════════════════════

function TestSendModal({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  const [userId, setUserId] = useState('');
  const [varsText, setVarsText] = useState(
    JSON.stringify(template.defaultData ?? {}, null, 2),
  );

  const send = useMutation({
    mutationFn: async () => {
      let vars: Record<string, any> = {};
      try {
        vars = JSON.parse(varsText || '{}');
      } catch {
        throw new Error('vars must be valid JSON');
      }
      return notificationTemplatesAPI.test(template._id, { userId, vars });
    },
    onSuccess: (res) => {
      const d = res.data?.data;
      toast.success(
        d?.usedFallback ? 'Sent (used fallback copy)' : 'Sent successfully',
      );
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || e?.message || 'Test send failed'),
  });

  return (
    <Modal isOpen onClose={onClose} title={`Test send — ${template.key}`} size="md">
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-600">User ID</label>
          <input
            className="input font-mono text-sm"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="MongoDB ObjectId"
          />
          <p className="text-[10px] text-gray-500 mt-1">
            Find a user ID from the Users page. The notification respects the user's locale and
            FCM tokens.
          </p>
        </div>
        <div>
          <label className="text-xs text-gray-600">Variables (JSON)</label>
          <textarea
            className="input font-mono text-xs"
            rows={6}
            value={varsText}
            onChange={(e) => setVarsText(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => send.mutate()}
            disabled={send.isPending || !userId}
            className="btn btn-primary"
          >
            <Send className="w-4 h-4 mr-1" />
            {send.isPending ? 'Sending…' : 'Send test'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function safeJsonParse(s: string): Record<string, any> {
  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
}
