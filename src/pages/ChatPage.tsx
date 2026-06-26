import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chatAPI } from '@/services/api';
import { Modal } from '@/components/Modal';
import { PageHeader, LoadingSpinner, RefreshButton } from '@/components/common';
import { Search, MessageSquare, User } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

export default function ChatPage() {
  const [rideId, setRideId] = useState('');
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [showMessages, setShowMessages] = useState(false);

  const { data: chat, isLoading, refetch } = useQuery({
    queryKey: ['chat', rideId],
    queryFn: async () => {
      if (!rideId) return null;
      // Backend returns { data: { chat } } with messages embedded on the chat.
      const res = await chatAPI.getByRideId(rideId);
      return res.data.data.chat;
    },
    enabled: !!rideId,
  });

  // Map participant id → role so we can tell customer vs driver bubbles.
  // The chat endpoint populates `participants` (with role) but leaves each
  // message's `sender` as a raw id.
  const roleById: Record<string, string> = {};
  (selectedChat?.participants ?? []).forEach((p: any) => {
    if (p?._id) roleById[String(p._id)] = p.role;
  });

  const messages: any[] = selectedChat?.messages ?? [];

  const handleSearch = () => {
    if (rideId) {
      refetch();
    }
  };

  return (
    <div>
      <PageHeader
        title="Chat Support"
        subtitle="View ride chat conversations for support"
        actions={<RefreshButton onRefresh={refetch} isFetching={isLoading} />}
      />

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Search Chat by Ride ID</h3>
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={rideId}
              onChange={(e) => setRideId(e.target.value)}
              placeholder="Enter ride ID..."
              className="input pl-10"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button onClick={handleSearch} className="btn btn-primary">
            Search
          </button>
        </div>
      </div>

      {/* Chat Results */}
      {isLoading ? (
        <LoadingSpinner />
      ) : chat ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div
            className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
            onClick={() => {
              setSelectedChat(chat);
              setShowMessages(true);
            }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <div className="font-medium">
                  Chat for Ride #{rideId.slice(-8).toUpperCase()}
                </div>
                <div className="text-sm text-gray-500">
                  {chat.messages?.length || 0} messages
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {chat.createdAt && format(new Date(chat.createdAt), 'PPp')}
            </div>
          </div>
        </div>
      ) : rideId ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">
          No chat found for this ride ID
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">
          Enter a ride ID to search for chat conversations
        </div>
      )}

      {/* Messages Modal */}
      <Modal
        isOpen={showMessages}
        onClose={() => setShowMessages(false)}
        title={`Chat - Ride #${rideId.slice(-8).toUpperCase()}`}
        size="lg"
      >
        <div className="h-96 overflow-y-auto">
          {messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map((msg: any, index: number) => {
                const senderRole = roleById[String(msg.sender)] ?? 'driver';
                const isCustomer = senderRole === 'customer';
                return (
                  <div
                    key={msg._id ?? index}
                    className={clsx('flex gap-3', isCustomer ? 'justify-start' : 'justify-end')}
                  >
                    {isCustomer && (
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                    )}
                    <div
                      className={clsx(
                        'max-w-[70%] rounded-lg p-3',
                        isCustomer ? 'bg-gray-100 text-gray-900' : 'bg-primary-600 text-white'
                      )}
                    >
                      <div className="text-sm">{msg.content}</div>
                      <div
                        className={clsx(
                          'text-xs mt-1',
                          isCustomer ? 'text-gray-500' : 'text-primary-200'
                        )}
                      >
                        {msg.createdAt && format(new Date(msg.createdAt), 'HH:mm')}
                      </div>
                    </div>
                    {!isCustomer && (
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-primary-600" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No messages in this conversation
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
