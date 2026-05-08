import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI, governanceAPI } from '@/services/api';
import type { Permission, AdminRole } from '@/config/permissions';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  adminRole?: AdminRole;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchProfile: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  hasPermission: (perm: Permission | Permission[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      permissions: [],
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await authAPI.login(email, password);
          const { user, token } = response.data.data;

          if (user.role !== 'admin') {
            throw new Error('Access denied. Admin privileges required.');
          }

          const permissions: Permission[] = Array.isArray(user.permissions)
            ? user.permissions
            : [];

          set({
            user,
            token,
            permissions,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(error.response?.data?.message || error.message || 'Login failed');
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          permissions: [],
          isAuthenticated: false,
        });
      },

      fetchProfile: async () => {
        if (!get().token) return;

        try {
          const response = await authAPI.getProfile();
          const data = response.data.data;
          // /auth/me returns { user, wallet } in this codebase
          const u = data?.user ?? data;
          set({ user: u });
          await get().refreshPermissions();
        } catch {
          get().logout();
        }
      },

      refreshPermissions: async () => {
        if (!get().token) return;
        try {
          const res = await governanceAPI.getMyPermissions();
          const { permissions, adminRole } = res.data.data;
          const u = get().user;
          set({
            permissions,
            user: u ? { ...u, adminRole } : u,
          });
        } catch {
          /* keep existing */
        }
      },

      hasPermission: (perm) => {
        const owned = new Set(get().permissions);
        const list = Array.isArray(perm) ? perm : [perm];
        return list.some((p) => owned.has(p));
      },
    }),
    {
      name: 'ukcaar-admin-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
