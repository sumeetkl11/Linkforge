/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Hash,
  Send,
  Smile,
  Paperclip,
  Bold,
  Italic,
  Code,
  Link,
  AtSign,
  Users,
  Sparkles,
  Copy,
  Check,
  Trash2,
} from 'lucide-react';
import { Channel, Message, User } from '../types';
import { CHANNELS, USERS } from '../data';
import {
  fetchMessages,
  sendMessage,
  fetchChannels,
  deleteMessage,
  deleteChannel,
  clearDMConversation,
} from '../api';
import { apiUrl } from '../config';
import { socket } from '../utils/socket';
import ChatSidebar from './chat/ChatSidebar';
import ChatMessageList from './chat/ChatMessageList';
import ChatMembersPanel from './chat/ChatMembersPanel';
import Dialog from './ui/Dialog';

interface ChatProps {
  currentUser: User | null;
  onlineUserIds?: Set<string>;
}

const GEMINI_COPILOT: User = {
  id: 'u-gemini',
  name: 'Gemini Copilot',
  email: 'gemini@syncforge.io',
  role: 'AI Engineering Copilot',
  status: 'Online',
  username: 'gemini',
  avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=gemini-ai',
  commits: 0,
  reviews: 0,
  proficiency: 100,
};

export default function Chat({ currentUser, onlineUserIds = new Set() }: ChatProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [colleagues, setColleagues] = useState<User[]>([]);
  const [activeChatType, setActiveChatType] = useState<'channel' | 'dm'>('channel');
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [isCreateDMModalOpen, setIsCreateDMModalOpen] = useState(false);
  const [selectedDMColleagueId, setSelectedDMColleagueId] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [confirmDeleteChannelId, setConfirmDeleteChannelId] = useState<string | null>(null);
  const [confirmClearDM, setConfirmClearDM] = useState(false);
  const [aiTypingChats, setAiTypingChats] = useState<Record<string, boolean>>({});
  const [channelMessages, setChannelMessages] = useState<Record<string, Message[]>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isAdmin = currentUser?.role === 'Admin';

  // Global socket listener for workspace channel creations + deletions
  useEffect(() => {
    const handleChannelCreated = (newChan: Channel) => {
      setChannels((prev) => {
        if (prev.some((c) => c.id === newChan.id)) return prev;
        return [...prev, newChan];
      });
    };

    const handleChannelDeleted = (payload: { id: string }) => {
      setChannels((prev) => prev.filter((c) => c.id !== payload.id));
      setActiveChatId((current) => (current === payload.id ? '' : current));
    };

    socket.on('channel_created', handleChannelCreated);
    socket.on('channel:deleted', handleChannelDeleted);

    return () => {
      socket.off('channel_created', handleChannelCreated);
      socket.off('channel:deleted', handleChannelDeleted);
    };
  }, []);

  // Load initial workspace channels and colleagues
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const chans = await fetchChannels();
        const availableChannels = chans.length > 0 ? chans : CHANNELS;
        setChannels(availableChannels);

        const excludeParam = currentUser ? `?exclude=${currentUser.id}` : '';
        const users = await fetch(apiUrl(`/api/users${excludeParam}`)).then((res) => res.json());
        setColleagues(users);

        if (availableChannels.length > 0) {
          setActiveChatType('channel');
          setActiveChatId((current) => current || availableChannels[0].id);
        }
        if (users.length > 0) {
          setSelectedDMColleagueId(users[0].id);
        }
      } catch (err) {
        console.error('Failed to load initial workspace data:', err);
        setChannels(CHANNELS);
        setActiveChatType('channel');
        setActiveChatId((current) => current || CHANNELS[0]?.id || '');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [currentUser?.id]);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages, activeChatId]);

  // Fetch messages from backend for the active chat & setup socket sync
  useEffect(() => {
    if (!activeChatId) return;

    fetchMessages(activeChatId, activeChatType, currentUser?.id)
      .then((msgs) => {
        setChannelMessages((prev) => ({
          ...prev,
          [activeChatId]: msgs,
        }));
      })
      .catch((err) => console.error('Failed to fetch messages:', err));

    if (activeChatType === 'channel' && activeChatId) {
      socket.emit('room:join', activeChatId);
    } else if (activeChatType === 'dm' && currentUser) {
      socket.emit('user:join', currentUser.id);
    }

    const handleMessage = (receivedMsg: Message) => {
      const receiver_id = (receivedMsg as any).receiverId || (receivedMsg as any).receiver_id;
      const channel_id =
        (receivedMsg as any).channelId ||
        (receivedMsg as any).channel_id ||
        (receivedMsg as any).workspace_id;
      const targetChatId =
        receiver_id && currentUser
          ? receivedMsg.user.id === currentUser.id
            ? receiver_id
            : receivedMsg.user.id
          : channel_id;

      if (!targetChatId) return;

      setChannelMessages((prev) => {
        const currentStream = prev[targetChatId] || [];
        if (currentStream.some((m) => m.id === receivedMsg.id)) return prev;
        return {
          ...prev,
          [targetChatId]: [...currentStream, receivedMsg],
        };
      });
    };

    const handleMessageDeleted = (payload: { id: string }) => {
      setChannelMessages((prev) => {
        const updated: Record<string, Message[]> = {};
        for (const [chatId, msgs] of Object.entries(prev)) {
          updated[chatId] = msgs.filter((m) => m.id !== payload.id);
        }
        return updated;
      });
    };

    const handleDMCleared = (payload: { userId1: string; userId2: string }) => {
      if (!currentUser) return;
      const otherId = payload.userId1 === currentUser.id ? payload.userId2 : payload.userId1;
      setChannelMessages((prev) => ({ ...prev, [otherId]: [] }));
    };

    const handleAiTyping = (payload: {
      chatId?: string;
      channelId?: string | null;
      receiverId?: string | null;
      isTyping: boolean;
    }) => {
      const targetId = payload.channelId || payload.chatId || payload.receiverId;
      if (!targetId) return;
      setAiTypingChats((prev) => ({
        ...prev,
        [targetId]: Boolean(payload.isTyping),
      }));
    };

    socket.on('message:received', handleMessage);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('dm:cleared', handleDMCleared);
    socket.on('ai:typing', handleAiTyping);

    return () => {
      socket.off('message:received', handleMessage);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('dm:cleared', handleDMCleared);
      socket.off('ai:typing', handleAiTyping);
    };
  }, [activeChatId, activeChatType, currentUser?.id]);

  const handleSendMessage = () => {
    if (!inputText.trim() || !activeChatId) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      user: currentUser || USERS.alex,
      content: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...(channelMessages[activeChatId] || []), newMessage];
    setChannelMessages((prev) => ({
      ...prev,
      [activeChatId]: updatedMessages,
    }));

    setInputText('');

    sendMessage(
      activeChatType === 'channel' ? activeChatId : null,
      newMessage,
      activeChatType === 'dm' ? activeChatId : undefined
    ).catch((err) => console.error('Failed to save message to server:', err));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const updateMentionQuery = (value: string, caretPosition: number) => {
    const beforeCaret = value.slice(0, caretPosition);
    const match = beforeCaret.match(/(^|\s)@([a-zA-Z0-9_.-]*)$/);
    setMentionQuery(match ? match[2].toLowerCase() : null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    updateMentionQuery(e.target.value, e.target.selectionStart);
  };

  const insertMention = (user: User) => {
    const input = inputRef.current;
    const caretPosition = input?.selectionStart ?? inputText.length;
    const beforeCaret = inputText.slice(0, caretPosition);
    const afterCaret = inputText.slice(caretPosition);
    const mentionLabel = user.username || user.name.toLowerCase().replace(/\s+/g, '.');
    const nextBeforeCaret = beforeCaret.replace(
      /(^|\s)@([a-zA-Z0-9_.-]*)$/,
      `$1@${mentionLabel} `
    );
    const nextValue = `${nextBeforeCaret}${afterCaret}`;

    setInputText(nextValue);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(nextBeforeCaret.length, nextBeforeCaret.length);
    });
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    try {
      const response = await fetch(apiUrl('/api/channels'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChannelName.trim(),
          description: 'A new channel in the workspace.',
          workspaceId: 'w1',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create channel');
      }

      setIsCreateModalOpen(false);
      setNewChannelName('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartDM = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDMColleagueId) return;
    handleSwitchChat('dm', selectedDMColleagueId);
    setIsCreateDMModalOpen(false);
  };

  const handleCopyInviteLink = () => {
    const inviteLink = `${window.location.origin}?invite=syncforge-workspace`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    });
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!currentUser) return;
    try {
      await deleteMessage(messageId, currentUser.id);
      setChannelMessages((prev) => {
        const updated: Record<string, Message[]> = {};
        for (const [chatId, msgs] of Object.entries(prev)) {
          updated[chatId] = msgs.filter((m) => m.id !== messageId);
        }
        return updated;
      });
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      await deleteChannel(channelId);
      setConfirmDeleteChannelId(null);
    } catch (err) {
      console.error('Failed to delete channel:', err);
    }
  };

  const handleClearDM = async () => {
    if (!currentUser || activeChatType !== 'dm' || !activeChatId) return;
    try {
      await clearDMConversation(currentUser.id, activeChatId);
      setChannelMessages((prev) => ({ ...prev, [activeChatId]: [] }));
      setConfirmClearDM(false);
    } catch (err) {
      console.error('Failed to clear DM:', err);
    }
  };

  const handleSwitchChat = (type: 'channel' | 'dm', chatId: string) => {
    setActiveChatType(type);
    setActiveChatId(chatId);
  };

  const insertFormatting = (format: 'bold' | 'italic' | 'code' | 'link') => {
    if (format === 'bold') setInputText((prev) => prev + '**bold_text**');
    if (format === 'italic') setInputText((prev) => prev + '*italic_text*');
    if (format === 'code') setInputText((prev) => prev + '```\n// code here\n```');
    if (format === 'link') setInputText((prev) => prev + '[label](url)');
  };

  const activeChan =
    activeChatType === 'channel' ? channels.find((c) => c.id === activeChatId) : null;
  const activeColleague =
    activeChatType === 'dm'
      ? colleagues.find((c) => c.id === activeChatId) ||
        Object.values(USERS).find((c) => c.id === activeChatId)
      : null;

  const activeStream = channelMessages[activeChatId] || [];
  const isAiTypingHere = Boolean(aiTypingChats[activeChatId]);
  const mentionCandidates =
    mentionQuery === null
      ? []
      : [GEMINI_COPILOT, currentUser, ...colleagues]
          .filter((user): user is User => Boolean(user))
          .filter((user) => {
            const username = user.username || user.name.toLowerCase().replace(/\s+/g, '.');
            return (
              user.name.toLowerCase().includes(mentionQuery) ||
              username.toLowerCase().includes(mentionQuery)
            );
          })
          .slice(0, 6);

  return (
    <div className="flex h-full min-h-0 overflow-hidden pb-14 md:pb-0">
      {/* Left Sidebar: Channels & DMs */}
      <ChatSidebar
        channels={channels}
        colleagues={colleagues}
        activeChatType={activeChatType}
        activeChatId={activeChatId}
        isLoading={isLoading}
        isAdmin={Boolean(isAdmin)}
        currentUser={currentUser}
        onlineUserIds={onlineUserIds}
        onSwitchChat={handleSwitchChat}
        onOpenCreateChannel={() => setIsCreateModalOpen(true)}
        onOpenCreateDM={() => setIsCreateDMModalOpen(true)}
        onConfirmDeleteChannel={(id) => setConfirmDeleteChannelId(id)}
      />

      {/* Main Chat Feed Area */}
      <main className="flex-1 min-h-0 flex flex-col bg-surface relative min-w-0">
        {/* Chat Stream Header */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-outline-variant bg-surface-container-low/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-2 min-w-0">
            {activeChatType === 'channel' ? (
              <Hash size={15} className="text-outline flex-shrink-0" />
            ) : (
              <AtSign size={15} className="text-outline flex-shrink-0" />
            )}
            <h2 className="text-sm font-semibold text-on-surface truncate">
              {activeChatType === 'channel' ? activeChan?.name : activeColleague?.name}
            </h2>
            <span className="w-px h-4 bg-outline-variant mx-1.5 flex-shrink-0" />
            <p className="text-xs text-on-surface-variant truncate">
              {activeChatType === 'channel'
                ? activeChan?.description
                : `@${
                    activeColleague?.username ||
                    activeColleague?.name.toLowerCase().replace(' ', '_')
                  }`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeChatType === 'dm' && activeChatId && (
              <button
                type="button"
                onClick={() => setConfirmClearDM(true)}
                title="Clear conversation"
                className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCreateDMModalOpen(true)}
              title="Switch DM or view teammates"
              className="p-2 text-on-surface-variant hover:text-on-surface rounded-lg cursor-pointer"
            >
              <Users size={15} />
            </button>
          </div>
        </header>

        {/* Decomposed Message List */}
        <ChatMessageList
          isLoading={isLoading}
          messages={activeStream}
          currentUser={currentUser}
          isAdmin={Boolean(isAdmin)}
          isAiTypingHere={isAiTypingHere}
          geminiCopilot={GEMINI_COPILOT}
          chatEndRef={chatEndRef}
          onDeleteMessage={handleDeleteMessage}
        />

        {/* Rich Composer Box */}
        <div className="p-4 sm:p-6 pt-0">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-1.5 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
            {/* Formatting tool rail */}
            <div className="flex items-center gap-1 px-2 py-1 border-b border-outline-variant mb-1">
              <button
                type="button"
                onClick={() => insertFormatting('bold')}
                className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                title="Bold"
              >
                <Bold size={14} />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('italic')}
                className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                title="Italic"
              >
                <Italic size={14} />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('code')}
                className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                title="Code Block"
              >
                <Code size={14} />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('link')}
                className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                title="Link"
              >
                <Link size={14} />
              </button>
              <span className="w-px h-4 bg-outline-variant mx-1" />
              <button
                type="button"
                onClick={() => {
                  const separator = inputText && !inputText.endsWith(' ') ? ' ' : '';
                  const nextValue = `${inputText}${separator}@`;
                  setInputText(nextValue);
                  setMentionQuery('');
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
                className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                title="Mentions"
              >
                <AtSign size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const separator = inputText && !inputText.endsWith(' ') ? ' ' : '';
                  const nextValue = `${inputText}${separator}@gemini `;
                  setInputText(nextValue);
                  setMentionQuery(null);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
                className="ml-auto px-2.5 py-1 bg-primary/15 hover:bg-primary/25 border border-primary/30 rounded-lg text-xs font-medium text-primary flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Ask @gemini AI Copilot in this channel"
              >
                <Sparkles size={12} />
                <span>Ask @gemini</span>
              </button>
            </div>

            {/* Input fields */}
            <div className="flex items-end gap-2 px-2 py-1.5">
              <button
                type="button"
                onClick={() => insertFormatting('code')}
                title="Insert code snippet"
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <Paperclip size={15} />
              </button>

              <textarea
                ref={inputRef}
                value={inputText}
                onChange={handleInputChange}
                onClick={(e) => updateMentionQuery(inputText, e.currentTarget.selectionStart)}
                onKeyUp={(e) => updateMentionQuery(inputText, e.currentTarget.selectionStart)}
                onKeyDown={handleKeyPress}
                placeholder={
                  activeChatType === 'channel'
                    ? `Message #${activeChan?.name || ''}`
                    : `Message @${
                        activeColleague?.username ||
                        activeColleague?.name.toLowerCase().replace(' ', '_')
                      }`
                }
                rows={1}
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none text-xs text-on-surface py-1 max-h-36 placeholder:text-on-surface-variant/60 outline-none"
              />

              {mentionCandidates.length > 0 && (
                <div className="absolute left-12 right-16 bottom-20 z-30 bg-surface-container-high border border-outline-variant rounded-xl shadow-2xl overflow-hidden">
                  <div className="px-3 py-2 text-[11px] font-semibold text-on-surface-variant border-b border-outline-variant">
                    Mention teammate or AI Copilot
                  </div>
                  {mentionCandidates.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => insertMention(user)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-container-highest transition-colors cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg overflow-hidden border border-outline-variant flex-shrink-0">
                        <img
                          src={
                            user.avatar ||
                            `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name}`
                          }
                          alt={user.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-on-surface truncate">
                          {user.name}
                        </div>
                        <div className="text-[11px] text-primary font-mono truncate">
                          @{user.username || user.name.toLowerCase().replace(/\s+/g, '.')}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setInputText((prev) => `${prev} 🚀`)}
                  title="Add reaction emoji"
                  className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                >
                  <Smile size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleSendMessage}
                  className="p-2 bg-primary hover:bg-primary/90 text-on-primary rounded-lg transition-all active:scale-95 cursor-pointer flex-shrink-0"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
          <div className="mt-1.5 text-[11px] text-on-surface-variant flex justify-between px-2">
            <span>
              Press <b>Return</b> to send · <b>Shift + Return</b> for new line
            </span>
            <span className="hidden sm:inline">Mention @gemini for AI assistance</span>
          </div>
        </div>
      </main>

      {/* Right Sidebar: Members List */}
      <ChatMembersPanel
        colleagues={colleagues}
        currentUser={currentUser}
        onlineUserIds={onlineUserIds}
        onSwitchChat={handleSwitchChat}
        onOpenInvite={() => setIsInviteModalOpen(true)}
      />

      {/* Create Channel Modal */}
      <Dialog
        open={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setNewChannelName('');
        }}
        title="Create New Channel"
        subtitle="Add a dedicated topic channel to your workspace"
        maxWidthClass="max-w-sm"
      >
        <form onSubmit={handleCreateChannel} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-on-surface-variant">Channel Name</label>
            <input
              type="text"
              required
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="e.g. frontend-sprint"
              className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false);
                setNewChannelName('');
              }}
              className="px-4 py-1.5 bg-surface-container border border-outline-variant hover:border-outline text-on-surface text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-on-primary text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Create Channel
            </button>
          </div>
        </form>
      </Dialog>

      {/* Start Direct Message Modal */}
      <Dialog
        open={isCreateDMModalOpen}
        onClose={() => setIsCreateDMModalOpen(false)}
        title="Start Direct Message"
        subtitle="Select a teammate to open a private conversation"
        maxWidthClass="max-w-sm"
      >
        <form onSubmit={handleStartDM} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-on-surface-variant">Select Teammate</label>
            <select
              value={selectedDMColleagueId}
              onChange={(e) => setSelectedDMColleagueId(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface cursor-pointer"
            >
              {colleagues.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateDMModalOpen(false)}
              className="px-4 py-1.5 bg-surface-container border border-outline-variant hover:border-outline text-on-surface text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-on-primary text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Open Chat
            </button>
          </div>
        </form>
      </Dialog>

      {/* Invite Teammate Modal */}
      <Dialog
        open={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite Teammate"
        subtitle="Share your workspace invite link with developers"
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Anyone with this link can register or sign in to join your SyncForge workspace channels.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}?invite=syncforge-workspace`}
              className="flex-1 bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs font-mono text-on-surface"
            />
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="px-3 py-2 bg-primary text-on-primary text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {inviteCopied ? <Check size={13} /> : <Copy size={13} />}
              <span>{inviteCopied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </Dialog>

      {/* Confirm Delete Channel Modal */}
      <Dialog
        open={Boolean(confirmDeleteChannelId)}
        onClose={() => setConfirmDeleteChannelId(null)}
        title="Delete Channel?"
        subtitle="This will permanently delete the channel and all its messages."
        maxWidthClass="max-w-sm"
      >
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setConfirmDeleteChannelId(null)}
            className="px-4 py-1.5 bg-surface-container border border-outline-variant hover:border-outline text-on-surface text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => confirmDeleteChannelId && handleDeleteChannel(confirmDeleteChannelId)}
            className="px-4 py-1.5 bg-error text-on-error text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
          >
            Delete Channel
          </button>
        </div>
      </Dialog>

      {/* Confirm Clear DM Modal */}
      <Dialog
        open={confirmClearDM}
        onClose={() => setConfirmClearDM(false)}
        title="Clear Conversation?"
        subtitle="All messages in this direct message thread will be permanently removed."
        maxWidthClass="max-w-sm"
      >
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setConfirmClearDM(false)}
            className="px-4 py-1.5 bg-surface-container border border-outline-variant hover:border-outline text-on-surface text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleClearDM}
            className="px-4 py-1.5 bg-error text-on-error text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
          >
            Clear Messages
          </button>
        </div>
      </Dialog>
    </div>
  );
}
