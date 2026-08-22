import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { MessageSquare, Send, ChevronLeft, User, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

export function Inbox() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: loadingConvs } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await api.get('/conversations');
      return res.data;
    }
  });

  const { data: messages, isLoading: loadingMsgs } = useQuery({
    queryKey: ['messages', activeConvId],
    queryFn: async () => {
      if (!activeConvId) return [];
      const res = await api.get(`/conversations/${activeConvId}/messages`);
      return res.data;
    },
    enabled: !!activeConvId
  });

  useEffect(() => {
    socketRef.current = io('/');
    socketRef.current.on('new_message', (data: any) => {
      // Invalidate queries to fetch new messages and update conversation list
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (data.conversationId === activeConvId) {
        queryClient.invalidateQueries({ queryKey: ['messages', activeConvId] });
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [activeConvId, queryClient]);

  useEffect(() => {
    // Scroll to bottom when messages load
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post(`/conversations/${activeConvId}/reply`, { content });
      return res.data;
    },
    onSuccess: () => {
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['messages', activeConvId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeConvId) return;
    replyMutation.mutate(replyText);
  };

  const activeConv = conversations?.find((c: any) => c.id === activeConvId);

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="bg-white border-b border-gray-200 shrink-0">
        <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
              <MessageSquare />
              Inbox
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversations List */}
        <div className="w-80 border-r border-gray-200 bg-gray-50 flex flex-col overflow-y-auto">
          {loadingConvs ? (
            <div className="p-4 text-gray-500 text-center text-sm">Loading conversations...</div>
          ) : conversations?.length === 0 ? (
            <div className="p-4 text-gray-500 text-center text-sm">No conversations yet</div>
          ) : (
            conversations?.map((conv: any) => (
              <div
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`p-4 border-b border-gray-200 cursor-pointer transition-colors ${activeConvId === conv.id ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-gray-900 truncate pr-2">{conv.customer?.name || 'Unknown User'}</h3>
                  <span className="text-xs text-gray-500 shrink-0">
                    {new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-gray-600 truncate">
                  {conv.messages?.[0]?.content || 'No messages yet'}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white relative">
          {activeConvId && activeConv ? (
            <>
              {/* Chat Header */}
              <div className="h-16 border-b border-gray-200 px-6 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                    {activeConv.customer?.name?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{activeConv.customer?.name || 'Unknown User'}</h2>
                    {activeConv.customer?.phone && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {activeConv.customer.phone}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                {loadingMsgs ? (
                  <div className="text-center text-gray-500 text-sm">Loading messages...</div>
                ) : messages?.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm">No messages yet.</div>
                ) : (
                  messages?.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.isIncoming ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm ${
                          msg.isIncoming 
                            ? 'bg-white text-gray-900 border border-gray-200 rounded-tl-sm' 
                            : 'bg-blue-600 text-white rounded-tr-sm'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <span className={`text-[10px] mt-1 block ${msg.isIncoming ? 'text-gray-400' : 'text-blue-200'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 bg-white border-t border-gray-200 shrink-0">
                <form onSubmit={handleSend} className="flex gap-2 relative">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 border border-gray-300 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    disabled={replyMutation.isPending}
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim() || replyMutation.isPending}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
              <h2 className="text-xl font-medium text-gray-900 mb-2">Your Inbox</h2>
              <p>Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
