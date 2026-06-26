import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS, ADMIN_ROLE_LABELS, type AdminRole } from '@/config/permissions';
import {
  LayoutDashboard,
  Users,
  Car,
  MapPin,
  CreditCard,
  Tag,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  MessageCircle,
  ShieldCheck,
  ScrollText,
  Radar,
  Receipt,
  Flame,
  Map,
  Route as RouteIcon,
  Truck,
  Calculator,
  Repeat,
  Share2,
  HelpCircle,
  Wallet,
  FileText,
  FileDown,
  Crown,
  Gift,
  Award,
  MailPlus,
} from 'lucide-react';
import clsx from 'clsx';

type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  perm: string;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard, perm: PERMISSIONS.VIEW_DASHBOARD },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { name: 'Live Map', href: '/live-map', icon: Radar, perm: PERMISSIONS.MANAGE_RIDES },
      { name: 'Rides', href: '/rides', icon: MapPin, perm: PERMISSIONS.VIEW_RIDES },
      { name: 'Heatmap', href: '/heatmap', icon: Flame, perm: PERMISSIONS.VIEW_ANALYTICS },
      { name: 'Zones & Surge', href: '/zones', icon: Map, perm: PERMISSIONS.VIEW_ZONES },
      { name: 'Routes', href: '/routes', icon: RouteIcon, perm: PERMISSIONS.VIEW_ROUTES },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      { name: 'Users', href: '/users', icon: Users, perm: PERMISSIONS.VIEW_USERS },
      { name: 'Drivers', href: '/drivers', icon: Car, perm: PERMISSIONS.VIEW_DRIVERS },
      { name: 'Chat Support', href: '/chat', icon: MessageCircle, perm: PERMISSIONS.VIEW_CHATS },
      { name: 'Support', href: '/support', icon: MessageSquare, perm: PERMISSIONS.VIEW_TICKETS },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { name: 'Payments', href: '/payments', icon: CreditCard, perm: PERMISSIONS.VIEW_PAYMENTS },
      { name: 'Settlements', href: '/settlements', icon: Receipt, perm: PERMISSIONS.VIEW_SETTLEMENTS },
      { name: 'Invoices', href: '/invoices', icon: FileText, perm: PERMISSIONS.MANAGE_INVOICES },
      { name: 'Subscriptions', href: '/subscriptions', icon: Repeat, perm: PERMISSIONS.VIEW_PAYMENTS },
      { name: 'Fare Calculation', href: '/fare-calculation', icon: Calculator, perm: PERMISSIONS.VIEW_SETTINGS },
      { name: 'Exports', href: '/exports', icon: FileDown, perm: PERMISSIONS.EXPORT_REPORTS },
    ],
  },
  {
    id: 'growth',
    label: 'Growth',
    items: [
      { name: 'Promo Codes', href: '/promos', icon: Tag, perm: PERMISSIONS.VIEW_PROMOS },
      { name: 'Recharge Offers', href: '/recharge-offers', icon: Wallet, perm: PERMISSIONS.VIEW_PROMOS },
      { name: 'Referrals', href: '/referrals', icon: Share2, perm: PERMISSIONS.VIEW_REFERRALS },
      { name: 'OnePass', href: '/onepass', icon: Crown, perm: PERMISSIONS.VIEW_ONEPASS },
      { name: 'Loyalty', href: '/loyalty', icon: Gift, perm: PERMISSIONS.VIEW_LOYALTY },
      { name: 'Incentives', href: '/incentives', icon: Award, perm: PERMISSIONS.VIEW_INCENTIVES },
      { name: 'Notifications', href: '/notifications', icon: Bell, perm: PERMISSIONS.SEND_NOTIFICATIONS },
      { name: 'Notif. Templates', href: '/notification-templates', icon: MailPlus, perm: PERMISSIONS.VIEW_NOTIFICATION_TEMPLATES },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { name: 'Vehicle Types', href: '/vehicle-types', icon: Truck, perm: PERMISSIONS.VIEW_SETTINGS },
      { name: 'FAQs', href: '/faqs', icon: HelpCircle, perm: PERMISSIONS.VIEW_FAQS },
      { name: 'Settings', href: '/settings', icon: Settings, perm: PERMISSIONS.VIEW_SETTINGS },
      { name: 'Admin Users', href: '/admins', icon: ShieldCheck, perm: PERMISSIONS.MANAGE_ADMINS },
      { name: 'Audit Log', href: '/audit-logs', icon: ScrollText, perm: PERMISSIONS.VIEW_AUDIT_LOG },
    ],
  },
];

const COLLAPSED_KEY = 'ukcaar.admin.sidebar.collapsedGroups';

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);
  const { user, logout } = useAuthStore();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const navigate = useNavigate();

  const visibleGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => hasPermission(it.perm as never)),
    }))
    .filter((g) => g.items.length > 0);

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const adminRoleLabel =
    ADMIN_ROLE_LABELS[(user?.adminRole ?? 'super_admin') as AdminRole] ?? 'Admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop — z above Leaflet (panes 400, controls 800) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[1090] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — z above Leaflet (panes 400, controls 800) */}
      <aside
        className={clsx(
          'fixed top-0 left-0 z-[1100] h-full w-64 bg-white shadow-lg transform transition-transform duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <img
            src="/logo-ukcaar.png"
            alt="UKCAAR"
            className="h-10 w-auto object-contain"
          />
          <button
            className="lg:hidden p-1 hover:bg-gray-100 rounded"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-3 overflow-y-auto h-[calc(100%-4rem)]">
          {visibleGroups.map((group) => {
            const isCollapsed = !!collapsed[group.id];
            const isSingleton = group.items.length === 1 && group.id === 'overview';
            return (
              <div key={group.id}>
                {!isSingleton && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700"
                  >
                    <span>{group.label}</span>
                    <ChevronRight
                      className={clsx(
                        'w-3.5 h-3.5 transition-transform',
                        !isCollapsed && 'rotate-90'
                      )}
                    />
                  </button>
                )}
                {(isSingleton || !isCollapsed) && (
                  <div className="space-y-1 mt-1">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.name}
                        to={item.href}
                        end={item.href === '/'}
                        className={({ isActive }) =>
                          clsx('sidebar-link', isActive && 'active')
                        }
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon className="w-5 h-5" />
                        {item.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            <button
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1" />

            {/* User menu */}
            <div className="relative">
              <button
                className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-700">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </span>
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-gray-900">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="text-xs text-gray-500">{adminRoleLabel}</div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
