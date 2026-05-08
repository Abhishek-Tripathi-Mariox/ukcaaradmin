import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsAPI } from '@/services/api';
import { PageHeader } from '@/components/common';
import { Pagination } from '@/components/DataTable';
import { Bell, Send, Users, Car, Globe, History, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

type TabType = 'broadcast' | 'individual' | 'history';

interface SentNotification {
  _id: string;
  title: string;
  body: string;
  type: string;
  sentAt: string;
  recipientCount: number;
  readCount: number;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabType>('broadcast');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [broadcastData, setBroadcastData] = useState({
    title: '',
    body: '',
    targetRole: 'all' as 'all' | 'customers' | 'drivers',
  });
  const [individualData, setIndividualData] = useState({
    userId: '',
    title: '',
    body: '',
  });

  const broadcastMutation = useMutation({
    mutationFn: (data: { title: string; body: string; targetRole: 'all' | 'customers' | 'drivers' }) =>
      notificationsAPI.broadcast(data),
    onSuccess: () => {
      toast.success('Notification broadcast successfully');
      setBroadcastData({ title: '', body: '', targetRole: 'all' });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'sent'] });
    },
    onError: () => toast.error('Failed to broadcast notification'),
  });

  const sendToUserMutation = useMutation({
    mutationFn: (data: { userId: string; title: string; body: string }) =>
      notificationsAPI.sendToUser(data.userId, data.title, data.body),
    onSuccess: () => {
      toast.success('Notification sent successfully');
      setIndividualData({ userId: '', title: '', body: '' });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'sent'] });
    },
    onError: () => toast.error('Failed to send notification'),
  });

  const sentQuery = useQuery({
    queryKey: ['notifications', 'sent', historyPage, historySearch],
    queryFn: async () => {
      const res = await notificationsAPI.listSent({
        page: historyPage,
        limit: 20,
        search: historySearch || undefined,
      });
      return res.data?.data as {
        notifications: SentNotification[];
        pagination: { page: number; limit: number; total: number; pages: number };
      };
    },
    enabled: tab === 'history',
  });

  const targetRoleOptions = [
    { value: 'all', label: 'All Users', icon: Globe, color: 'bg-purple-100 text-purple-600' },
    { value: 'customers', label: 'Customers Only', icon: Users, color: 'bg-blue-100 text-blue-600' },
    { value: 'drivers', label: 'Drivers Only', icon: Car, color: 'bg-green-100 text-green-600' },
  ];

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Send push notifications to users"
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { key: 'broadcast', label: 'Broadcast', icon: Globe },
          { key: 'individual', label: 'Individual', icon: Users },
          { key: 'history', label: 'History', icon: History },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as TabType)}
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

      {/* Broadcast Tab */}
      {tab === 'broadcast' && (
        <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <Bell className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Broadcast Notification</h3>
              <p className="text-sm text-gray-500">Send a notification to multiple users</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Target Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Target Audience
              </label>
              <div className="grid grid-cols-3 gap-4">
                {targetRoleOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setBroadcastData({ ...broadcastData, targetRole: option.value as any })}
                    className={clsx(
                      'flex flex-col items-center p-4 rounded-lg border-2 transition-all',
                      broadcastData.targetRole === option.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center mb-2', option.color)}>
                      <option.icon className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={broadcastData.title}
                onChange={(e) => setBroadcastData({ ...broadcastData, title: e.target.value })}
                className="input"
                placeholder="Notification title..."
                maxLength={100}
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message *
              </label>
              <textarea
                value={broadcastData.body}
                onChange={(e) => setBroadcastData({ ...broadcastData, body: e.target.value })}
                className="input"
                rows={4}
                placeholder="Notification message..."
                maxLength={500}
              />
              <div className="text-xs text-gray-500 mt-1 text-right">
                {broadcastData.body.length}/500
              </div>
            </div>

            <button
              onClick={() => {
                if (broadcastData.title && broadcastData.body) {
                  broadcastMutation.mutate(broadcastData);
                }
              }}
              className="btn btn-primary w-full"
              disabled={!broadcastData.title || !broadcastData.body || broadcastMutation.isPending}
            >
              <Send className="w-4 h-4 mr-2" />
              {broadcastMutation.isPending ? 'Sending...' : 'Send Broadcast'}
            </button>
          </div>
        </div>
      )}

      {/* Individual Tab */}
      {tab === 'individual' && (
        <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Individual Notification</h3>
              <p className="text-sm text-gray-500">Send a notification to a specific user</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* User ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User ID *
              </label>
              <input
                type="text"
                value={individualData.userId}
                onChange={(e) => setIndividualData({ ...individualData, userId: e.target.value })}
                className="input"
                placeholder="Enter user ID..."
              />
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={individualData.title}
                onChange={(e) => setIndividualData({ ...individualData, title: e.target.value })}
                className="input"
                placeholder="Notification title..."
                maxLength={100}
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message *
              </label>
              <textarea
                value={individualData.body}
                onChange={(e) => setIndividualData({ ...individualData, body: e.target.value })}
                className="input"
                rows={4}
                placeholder="Notification message..."
                maxLength={500}
              />
              <div className="text-xs text-gray-500 mt-1 text-right">
                {individualData.body.length}/500
              </div>
            </div>

            <button
              onClick={() => {
                if (individualData.userId && individualData.title && individualData.body) {
                  sendToUserMutation.mutate(individualData);
                }
              }}
              className="btn btn-primary w-full"
              disabled={
                !individualData.userId ||
                !individualData.title ||
                !individualData.body ||
                sendToUserMutation.isPending
              }
            >
              <Send className="w-4 h-4 mr-2" />
              {sendToUserMutation.isPending ? 'Sending...' : 'Send Notification'}
            </button>
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <History className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Sent Notifications</h3>
                <p className="text-sm text-gray-500">
                  Notifications previously sent from the admin panel
                </p>
              </div>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                placeholder="Search title or message..."
                className="input pl-9 w-72"
              />
            </div>
          </div>

          {sentQuery.isLoading ? (
            <div className="py-12 text-center text-gray-500">Loading...</div>
          ) : sentQuery.isError ? (
            <div className="py-12 text-center text-red-500">Failed to load notifications</div>
          ) : !sentQuery.data || sentQuery.data.notifications.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Bell className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              No notifications have been sent yet.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-4">Sent At</th>
                      <th className="py-2 pr-4">Title</th>
                      <th className="py-2 pr-4">Message</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4 text-right">Recipients</th>
                      <th className="py-2 pr-4 text-right">Read</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentQuery.data.notifications.map((n) => (
                      <tr key={n._id} className="border-b border-gray-100 align-top">
                        <td className="py-3 pr-4 whitespace-nowrap text-gray-600">
                          {new Date(n.sentAt).toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 font-medium text-gray-900 max-w-xs">
                          {n.title}
                        </td>
                        <td className="py-3 pr-4 text-gray-700 max-w-md">
                          <div className="line-clamp-3 whitespace-pre-wrap">{n.body}</div>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs capitalize">
                            {n.type}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">{n.recipientCount}</td>
                        <td className="py-3 pr-4 text-right tabular-nums text-gray-500">
                          {n.readCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sentQuery.data.pagination.pages > 1 && (
                <Pagination
                  page={sentQuery.data.pagination.page}
                  totalPages={sentQuery.data.pagination.pages}
                  total={sentQuery.data.pagination.total}
                  onPageChange={setHistoryPage}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
