import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '@/services/api';
import { StatCard, PageHeader, LoadingSpinner, RefreshButton } from '@/components/common';
import {
  Users,
  Car,
  MapPin,
  CreditCard,
  Crown,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { DashboardMetrics } from '@/types';

export default function DashboardPage() {
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics, isFetching: metricsFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await dashboardAPI.getMetrics();
      return res.data.data as DashboardMetrics;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: rideAnalytics, refetch: refetchRideAnalytics } = useQuery({
    queryKey: ['analytics', 'rides'],
    queryFn: async () => {
      const res = await dashboardAPI.getRideAnalytics('7d');
      return res.data.data;
    },
  });

  const { data: revenueAnalytics, refetch: refetchRevenueAnalytics } = useQuery({
    queryKey: ['analytics', 'revenue'],
    queryFn: async () => {
      const res = await dashboardAPI.getRevenueAnalytics('7d');
      return res.data.data;
    },
  });

  if (metricsLoading) {
    return <LoadingSpinner size="lg" />;
  }

  const rideStatusData = metrics ? [
    { name: 'Active', value: metrics.rides.active, color: '#3b82f6' },
    { name: 'Completed', value: metrics.rides.completed, color: '#22c55e' },
    { name: 'Cancelled', value: metrics.rides.cancelled, color: '#ef4444' },
  ] : [];

  const driverStatusData = metrics ? [
    { name: 'Online', value: metrics.drivers.online, color: '#22c55e' },
    { name: 'Offline', value: metrics.drivers.verified - metrics.drivers.online, color: '#94a3b8' },
    { name: 'Pending', value: metrics.drivers.pending, color: '#f59e0b' },
  ] : [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back! Here's what's happening with UKCAAR today."
        actions={
          <RefreshButton
            onRefresh={() => { refetchMetrics(); refetchRideAnalytics(); refetchRevenueAnalytics(); }}
            isFetching={metricsFetching}
          />
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Customers"
          value={metrics?.customers.total.toLocaleString() || '0'}
          icon={<Users className="w-6 h-6" />}
          color="primary"
        />
        <StatCard
          title="Active Drivers"
          value={`${metrics?.drivers.online || 0} / ${metrics?.drivers.verified || 0}`}
          icon={<Car className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Today's Rides"
          value={metrics?.rides.today.toLocaleString() || '0'}
          icon={<MapPin className="w-6 h-6" />}
          color="yellow"
        />
        <StatCard
          title="Today's Revenue"
          value={`₹${metrics?.revenue.today?.toFixed(2) || '0.00'}`}
          icon={<CreditCard className="w-6 h-6" />}
          color="purple"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="OnePass Drivers"
          value={metrics?.drivers.onePass || 0}
          icon={<Crown className="w-6 h-6" />}
          color="yellow"
        />
        <StatCard
          title="Completion Rate"
          value={`${metrics?.rides.completionRate || 0}%`}
          icon={<CheckCircle className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Pending Approvals"
          value={metrics?.drivers.pending || 0}
          icon={<Clock className="w-6 h-6" />}
          color="yellow"
        />
        <StatCard
          title="Weekly Revenue"
          value={`₹${metrics?.revenue.thisWeek?.toFixed(2) || '0.00'}`}
          icon={<TrendingUp className="w-6 h-6" />}
          color="primary"
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-8 bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/drivers?tab=applications"
            className="flex flex-col items-center p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            <Clock className="w-8 h-8 text-yellow-600 mb-2" />
            <span className="text-sm font-medium text-yellow-700">
              Review Applications
            </span>
            <span className="text-xs text-yellow-600 mt-1">
              {metrics?.drivers.pending || 0} pending
            </span>
          </Link>
          <Link
            to="/rides?tab=live"
            className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <MapPin className="w-8 h-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-blue-700">Live Rides</span>
            <span className="text-xs text-blue-600 mt-1">
              {metrics?.rides.active || 0} active
            </span>
          </Link>
          <Link
            to="/rides?tab=disputes"
            className="flex flex-col items-center p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <XCircle className="w-8 h-8 text-red-600 mb-2" />
            <span className="text-sm font-medium text-red-700">Disputes</span>
            <span className="text-xs text-red-600 mt-1">Review issues</span>
          </Link>
          <Link
            to="/payments"
            className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <CreditCard className="w-8 h-8 text-purple-600 mb-2" />
            <span className="text-sm font-medium text-purple-700">Payments</span>
            <span className="text-xs text-purple-600 mt-1">Manage transactions</span>
          </Link>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Rides Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Rides Overview (7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rideAnalytics?.chartData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rides"
                  stroke="#0ea5e9"
                  fill="#0ea5e9"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Overview (7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueAnalytics?.chartData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                  formatter={(value: any) => [`₹${Number(value || 0).toFixed(2)}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pie Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ride Status Distribution */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ride Status Distribution</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rideStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {rideStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {rideStatusData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-600">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Driver Status Distribution */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Driver Status Distribution</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={driverStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {driverStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {driverStatusData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-600">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
