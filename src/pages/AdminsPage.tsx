import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { governanceAPI } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { DataTable, Pagination } from '@/components/DataTable';
import { Modal, ConfirmModal } from '@/components/Modal';
import { PageHeader, StatusBadge, LoadingSpinner, RefreshButton } from '@/components/common';
import {
  ADMIN_ROLES,
  ADMIN_ROLE_LABELS,
  PERMISSIONS,
  type AdminRole,
} from '@/config/permissions';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Plus, KeyRound, Edit, ShieldOff, ShieldCheck, Copy } from 'lucide-react';

interface AdminRow {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  adminRole?: AdminRole;
  adminPermissions?: string[];
  isActive: boolean;
  lastLoginAt?: string;
  lastLoginIp?: string;
  invitedAt?: string;
  disabledAt?: string;
  disabledReason?: string;
  createdAt: string;
}

export default function AdminsPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const myPerms = useAuthStore((s) => s.permissions);
  const canManage = myPerms.includes(PERMISSIONS.MANAGE_ADMINS);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [showInvite, setShowInvite] = useState(false);
  const [showEdit, setShowEdit] = useState<AdminRow | null>(null);
  const [confirmDisable, setConfirmDisable] = useState<AdminRow | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admins', page, search, roleFilter],
    queryFn: async () => {
      const res = await governanceAPI.listAdmins({
        page,
        limit: 20,
        search: search || undefined,
        adminRole: roleFilter || undefined,
      });
      return res.data.data as {
        items: AdminRow[];
        total: number;
        pages: number;
      };
    },
  });

  const inviteMut = useMutation({
    mutationFn: (payload: {
      email: string;
      firstName: string;
      lastName?: string;
      phone?: string;
      adminRole: string;
    }) => governanceAPI.inviteAdmin(payload),
    onSuccess: (res) => {
      const pwd = res.data?.data?.temporaryPassword;
      qc.invalidateQueries({ queryKey: ['admins'] });
      setShowInvite(false);
      setTempPassword(pwd ?? null);
      toast.success('Admin invited');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Invite failed'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => governanceAPI.updateAdmin(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      toast.success('Admin updated');
      setShowEdit(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Update failed'),
  });

  const disableMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      governanceAPI.updateAdmin(id, { isActive: false, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      toast.success('Admin disabled');
      setConfirmDisable(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed'),
  });

  const enableMut = useMutation({
    mutationFn: (id: string) => governanceAPI.updateAdmin(id, { isActive: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      toast.success('Admin re-enabled');
    },
    onError: () => toast.error('Failed to enable admin'),
  });

  const resetMut = useMutation({
    mutationFn: (id: string) => governanceAPI.resetAdminPassword(id),
    onSuccess: (res) => {
      const pwd = res.data?.data?.temporaryPassword;
      setTempPassword(pwd ?? null);
      toast.success('Password reset');
    },
    onError: () => toast.error('Reset failed'),
  });

  const columns = [
    {
      key: 'name',
      header: 'Admin',
      render: (a: AdminRow) => (
        <div>
          <div className="font-medium text-gray-900">
            {a.firstName} {a.lastName}
          </div>
          <div className="text-xs text-gray-500">{a.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (a: AdminRow) => (
        <span className="text-sm font-medium">
          {ADMIN_ROLE_LABELS[(a.adminRole ?? 'super_admin') as AdminRole]}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (a: AdminRow) => (
        <StatusBadge status={a.isActive ? 'active' : 'suspended'} />
      ),
    },
    {
      key: 'lastLogin',
      header: 'Last Login',
      render: (a: AdminRow) => (
        <div className="text-sm text-gray-600">
          {a.lastLoginAt ? format(new Date(a.lastLoginAt), 'PP p') : '—'}
          {a.lastLoginIp && (
            <div className="text-xs text-gray-400">{a.lastLoginIp}</div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (a: AdminRow) => (
        <div className="flex items-center justify-end gap-2">
          <button
            className="p-2 hover:bg-gray-100 rounded"
            disabled={!canManage}
            onClick={() => setShowEdit(a)}
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            className="p-2 hover:bg-gray-100 rounded"
            disabled={!canManage}
            onClick={() => {
              if (
                window.confirm(
                  "Reset this admin's password? Their current session will be signed out."
                )
              ) {
                resetMut.mutate(a._id);
              }
            }}
            title="Reset password"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          {a.isActive ? (
            <button
              className="p-2 hover:bg-red-50 rounded text-red-600"
              disabled={!canManage || a._id === me?._id}
              onClick={() => setConfirmDisable(a)}
              title="Disable"
            >
              <ShieldOff className="w-4 h-4" />
            </button>
          ) : (
            <button
              className="p-2 hover:bg-green-50 rounded text-green-600"
              disabled={!canManage}
              onClick={() => enableMut.mutate(a._id)}
              title="Re-enable"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Admin Users"
        subtitle="Manage admin accounts, roles, and permissions"
        actions={
          <div className="flex gap-2">
            <RefreshButton onRefresh={refetch} isFetching={isFetching} />
            {canManage && (
              <button
                onClick={() => setShowInvite(true)}
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Invite Admin
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="form-input flex-1"
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="form-input sm:w-48"
        >
          <option value="">All roles</option>
          {ADMIN_ROLES.map((r) => (
            <option key={r} value={r}>
              {ADMIN_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            keyExtractor={(a) => a._id}
            emptyMessage="No admins found"
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

      {/* Invite modal */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSubmit={(payload) => inviteMut.mutate(payload)}
          isLoading={inviteMut.isPending}
        />
      )}

      {/* Edit modal */}
      {showEdit && (
        <EditModal
          admin={showEdit}
          onClose={() => setShowEdit(null)}
          onSubmit={(data) => updateMut.mutate({ id: showEdit._id, data })}
          isLoading={updateMut.isPending}
          isSelf={showEdit._id === me?._id}
        />
      )}

      {/* Disable confirm */}
      {confirmDisable && (
        <ConfirmModal
          isOpen
          onClose={() => setConfirmDisable(null)}
          onConfirm={() =>
            disableMut.mutate({
              id: confirmDisable._id,
              reason: 'Disabled by admin',
            })
          }
          title="Disable admin?"
          message={`This will revoke access for ${confirmDisable.email}. They can be re-enabled later.`}
          confirmText="Disable"
          variant="danger"
        />
      )}

      {/* Temp password modal */}
      {tempPassword && (
        <Modal isOpen onClose={() => setTempPassword(null)} title="Temporary Password">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Share this password with the admin securely. It will not be shown again.
            </p>
            <div className="flex items-center gap-2 bg-gray-100 p-3 rounded font-mono text-sm">
              <code className="flex-1 break-all">{tempPassword}</code>
              <button
                className="p-1 hover:bg-gray-200 rounded"
                onClick={() => {
                  navigator.clipboard.writeText(tempPassword);
                  toast.success('Copied');
                }}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Invite modal ──────────────────────────────────────────────────────
function InviteModal({
  onClose,
  onSubmit,
  isLoading,
}: {
  onClose: () => void;
  onSubmit: (data: {
    email: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    adminRole: string;
  }) => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    adminRole: 'support' as AdminRole,
  });

  return (
    <Modal isOpen onClose={onClose} title="Invite Admin">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <input
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="form-input"
            />
          </Field>
          <Field label="Last name">
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="form-input"
            />
          </Field>
        </div>
        <Field label="Email" required>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="form-input"
          />
        </Field>
        <Field label="Phone (optional)">
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="form-input"
          />
        </Field>
        <Field label="Role" required>
          <select
            value={form.adminRole}
            onChange={(e) =>
              setForm({ ...form, adminRole: e.target.value as AdminRole })
            }
            className="form-input"
          >
            {ADMIN_ROLES.map((r) => (
              <option key={r} value={r}>
                {ADMIN_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading ? 'Inviting…' : 'Invite'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────
function EditModal({
  admin,
  onClose,
  onSubmit,
  isLoading,
  isSelf,
}: {
  admin: AdminRow;
  onClose: () => void;
  onSubmit: (data: { firstName?: string; lastName?: string; adminRole?: string }) => void;
  isLoading: boolean;
  isSelf: boolean;
}) {
  const [form, setForm] = useState({
    firstName: admin.firstName ?? '',
    lastName: admin.lastName ?? '',
    adminRole: (admin.adminRole ?? 'super_admin') as AdminRole,
  });

  return (
    <Modal isOpen onClose={onClose} title={`Edit ${admin.email}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Backend rejects any self-update containing adminRole, so omit it
          // when editing your own account (name edits still go through).
          if (isSelf) {
            const { adminRole: _omit, ...rest } = form;
            onSubmit(rest);
          } else {
            onSubmit(form);
          }
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="form-input"
            />
          </Field>
          <Field label="Last name">
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="form-input"
            />
          </Field>
        </div>
        <Field label="Role">
          <select
            disabled={isSelf}
            value={form.adminRole}
            onChange={(e) =>
              setForm({ ...form, adminRole: e.target.value as AdminRole })
            }
            className="form-input"
          >
            {ADMIN_ROLES.map((r) => (
              <option key={r} value={r}>
                {ADMIN_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          {isSelf && (
            <p className="text-xs text-gray-500 mt-1">
              You cannot change your own role.
            </p>
          )}
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
