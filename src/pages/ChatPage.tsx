import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chatAPI } from '@/services/api';
import { Modal } from '@/components/Modal';
import { PageHeader, LoadingSpinner } from '@/components/common';
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
      const res = await chatAPI.getByRideId(rideId);
      return res.data.data;
    },
    enabled: !!rideId,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['chat', 'messages', selectedChat?._id],
    queryFn: async () => {
      if (!selectedChat) return [];
      const res = await chatAPI.getMessages(selectedChat._id);
      return res.data.data;
    },
    enabled: !!selectedChat?._id,
  });

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
          {messagesLoading ? (
            <LoadingSpinner />
          ) : messages && messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map((msg: any, index: number) => (
                <div
                  key={index}
                  className={clsx(
                    'flex gap-3',
                    msg.senderType === 'customer' ? 'justify-start' : 'justify-end'
                  )}
                >
                  {msg.senderType === 'customer' && (
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                  )}
                  <div
                    className={clsx(
                      'max-w-[70%] rounded-lg p-3',
                      msg.senderType === 'customer'
                        ? 'bg-gray-100 text-gray-900'
                        : 'bg-primary-600 text-white'
                    )}
                  >
                    <div className="text-sm">{msg.message}</div>
                    <div
                      className={clsx(
                        'text-xs mt-1',
                        msg.senderType === 'customer' ? 'text-gray-500' : 'text-primary-200'
                      )}
                    >
                      {format(new Date(msg.createdAt), 'HH:mm')}
                    </div>
                  </div>
                  {msg.senderType === 'driver' && (
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary-600" />
                    </div>
                  )}
                </div>
              ))}
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
