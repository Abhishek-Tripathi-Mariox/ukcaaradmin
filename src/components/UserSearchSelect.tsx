import { useEffect, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { usersAPI } from '@/services/api';
import { LoadingSpinner } from './common';

export type UserRole = 'customer' | 'driver';

export interface AdminUserLite {
  _id: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  email?: string;
  role: UserRole | 'admin';
}

interface Props {
  value: AdminUserLite | null;
  onChange: (user: AdminUserLite | null) => void;
  /** Which user-type tabs to offer. Defaults to both customer and driver. */
  roles?: UserRole[];
  /** Which type is selected first. Defaults to the first entry in `roles`. */
  defaultRole?: UserRole;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'Customer',
  driver: 'Driver',
};

/**
 * Search-and-pick control that replaces raw "User ID" text inputs across the
 * admin panel. The admin chooses a user type (customer/driver) and types a
 * mobile number; matching users are listed and one is picked. The parent
 * receives the full user object — read `_id` for the API call and `role` when
 * the user type also needs to be submitted (e.g. granting a subscription).
 *
 * Mirrors the original inline implementation on the Notifications page and
 * talks to the same `/admin/users?search=&role=` endpoint (phone is matched
 * via regex server-side).
 */
export function UserSearchSelect({
  value,
  onChange,
  roles = ['customer', 'driver'],
  defaultRole,
  label = 'User',
  required,
  disabled,
}: Props) {
  const [role, setRole] = useState<UserRole>(defaultRole ?? roles[0]);
  const [phone, setPhone] = useState('');
  const [debouncedPhone, setDebouncedPhone] = useState('');
  const [results, setResults] = useState<AdminUserLite[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounce so we don't fire a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPhone(phone.trim()), 350);
    return () => clearTimeout(t);
  }, [phone]);

  // Run the search once enough digits are entered to be meaningful.
  useEffect(() => {
    let cancelled = false;
    const digits = debouncedPhone.replace(/\D/g, '');
    if (value || digits.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    usersAPI
      .getAll({ search: debouncedPhone, role, limit: 10 })
      .then((res) => {
        if (!cancelled) setResults((res.data?.data?.users ?? []) as AdminUserLite[]);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedPhone, role, value]);

  const fullName = (u: AdminUserLite) =>
    [u.firstName, u.lastName].filter(Boolean).join(' ') || 'User';

  const enoughDigits = debouncedPhone.replace(/\D/g, '').length >= 3;

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* User-type tabs (hidden when only one type is allowed) */}
      {roles.length > 1 && (
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
          {roles.map((r) => (
            <button
              key={r}
              type="button"
              disabled={disabled}
              onClick={() => {
                setRole(r);
                onChange(null);
              }}
              className={clsx(
                'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                role === r
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      )}

      {value ? (
        // Selected recipient.
        <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-gray-900 truncate">{fullName(value)}</div>
              <div className="text-sm text-gray-500 truncate">
                {value.phone} · <span className="capitalize">{value.role}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-2 hover:bg-green-100 rounded-lg shrink-0"
            title="Change user"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              disabled={disabled}
              onChange={(e) => setPhone(e.target.value)}
              className="input pl-9"
              placeholder={`Search ${ROLE_LABELS[role].toLowerCase()} by mobile number…`}
            />
          </div>

          {enoughDigits && (
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-6 flex justify-center">
                  <LoadingSpinner size="sm" />
                </div>
              ) : results.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  No {ROLE_LABELS[role].toLowerCase()} found with that mobile number.
                </div>
              ) : (
                results.map((u) => (
                  <button
                    key={u._id}
                    type="button"
                    onClick={() => onChange(u)}
                    className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-blue-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{fullName(u)}</div>
                      <div className="text-sm text-gray-500 truncate">{u.phone}</div>
                    </div>
                    <span className="text-xs text-gray-400 capitalize shrink-0">{u.role}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
