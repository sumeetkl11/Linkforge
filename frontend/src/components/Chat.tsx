/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hash, Plus, Send, Smile, Paperclip, Bold, Italic, Code, Link, List, Download, FileText, AtSign, Users, Sparkles, MessageCircle, Copy, Check, Trash2, AlertTriangle } from 'lucide-react';
import { Channel, Message, User } from '../types';
import { CHANNELS, INITIAL_MESSAGES, USERS } from '../data';
import { fetchMessages, sendMessage, fetchChannels, deleteMessage, deleteChannel, clearDMConversation } from '../api';
import { apiUrl } from '../config';

import { socket } from '../utils/socket';

interface ChatProps {
  currentUser: User | null;
  onlineUserIds?: Set<string>;
}

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
  
  // Active channel/DM specific messages state helper
  const [channelMessages, setChannelMessages] = useState<Record<string, Message[]>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isAdmin = currentUser?.role === 'Admin';

  // Global socket listener for workspace channel creations + deletions
  useEffect(() => {
    const handleChannelCreated = (newChan: Channel) => {
      setChannels(prev => {
        if (prev.some(c => c.id === newChan.id)) return prev;
        return [...prev, newChan];
      });
    };

    const handleChannelDeleted = (payload: { id: string }) => {
      setChannels(prev => prev.filter(c => c.id !== payload.id));
      // If we're currently viewing this channel, switch away
      setActiveChatId(current => {
        if (current === payload.id) return '';
        return current;
      });
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
        const users = await fetch(apiUrl(`/api/users${excludeParam}`)).then(res => res.json());
        setColleagues(users);

        if (availableChannels.length > 0) {
          setActiveChatType('channel');
          setActiveChatId(current => current || availableChannels[0].id);
        }
        if (users.length > 0) {
          setSelectedDMColleagueId(users[0].id);
        }
      } catch (err) {
        console.error('Failed to load initial workspace data:', err);
        setChannels(CHANNELS);
        setActiveChatType('channel');
        setActiveChatId(current => current || CHANNELS[0]?.id || '');
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
      .then(msgs => {
        setChannelMessages(prev => ({
          ...prev,
          [activeChatId]: msgs
        }));
      })
      .catch(err => console.error('Failed to fetch messages:', err));

    // Join the correct room for this chat
    if (activeChatType === 'channel' && activeChatId) {
      socket.emit('room:join', activeChatId);
    } else if (activeChatType === 'dm' && currentUser) {
      socket.emit('user:join', currentUser.id);
    }

    const handleMessage = (receivedMsg: Message) => {
      const receiver_id = (receivedMsg as any).receiverId || (receivedMsg as any).receiver_id;
      const channel_id = (receivedMsg as any).channelId || (receivedMsg as any).channel_id || (receivedMsg as any).workspace_id;
      const targetChatId = receiver_id && currentUser
        ? (receivedMsg.user.id === currentUser.id ? receiver_id : receivedMsg.user.id)
        : channel_id;

      if (!targetChatId) return;

      setChannelMessages(prev => {
        const currentStream = prev[targetChatId] || [];
        if (currentStream.some(m => m.id === receivedMsg.id)) return prev;
        return {
          ...prev,
          [targetChatId]: [...currentStream, receivedMsg]
        };
      });
    };

    const handleMessageDeleted = (payload: { id: string }) => {
      setChannelMessages(prev => {
        const updated: Record<string, Message[]> = {};
        for (const [chatId, msgs] of Object.entries(prev)) {
          updated[chatId] = msgs.filter(m => m.id !== payload.id);
        }
        return updated;
      });
    };

    const handleDMCleared = (payload: { userId1: string; userId2: string }) => {
      if (!currentUser) return;
      const otherId = payload.userId1 === currentUser.id ? payload.userId2 : payload.userId1;
      setChannelMessages(prev => ({ ...prev, [otherId]: [] }));
    };

    socket.on('message:received', handleMessage);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('dm:cleared', handleDMCleared);

    return () => {
      socket.off('message:received', handleMessage);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('dm:cleared', handleDMCleared);
    };
  }, [activeChatId, activeChatType, currentUser?.id]);

  // Handle Send Message
  const handleSendMessage = () => {
    if (!inputText.trim() || !activeChatId) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      user: currentUser || USERS.alex,
      content: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // 1. Update UI state locally
    const updatedMessages = [...(channelMessages[activeChatId] || []), newMessage];
    setChannelMessages(prev => ({
      ...prev,
      [activeChatId]: updatedMessages
    }));

    // 2. Clear input
    setInputText('');

    // Save message to database
    sendMessage(
      activeChatType === 'channel' ? activeChatId : null,
      newMessage,
      activeChatType === 'dm' ? activeChatId : undefined
    ).catch(err =>
      console.error('Failed to save message to server:', err)
    );
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
    const nextBeforeCaret = beforeCaret.replace(/(^|\s)@([a-zA-Z0-9_.-]*)$/, `$1@${mentionLabel} `);
    const nextValue = `${nextBeforeCaret}${afterCaret}`;

    setInputText(nextValue);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(nextBeforeCaret.length, nextBeforeCaret.length);
    });
  };

  const renderMessageContent = (content: string) => {
    const parts = content.split(/(@[a-zA-Z0-9_.-]+)/g);
    return parts.map((part, index) => (
      part.startsWith('@') ? (
        <span key={`${part}-${index}`} className="text-primary font-bold bg-primary/10 rounded px-0.5">{part}</span>
      ) : (
        <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
      )
    ));
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
          workspaceId: 'w1'
        })
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
      // Optimistic local removal — socket event will sync other clients
      setChannelMessages(prev => {
        const updated: Record<string, Message[]> = {};
        for (const [chatId, msgs] of Object.entries(prev)) {
          updated[chatId] = msgs.filter(m => m.id !== messageId);
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
      setChannelMessages(prev => ({ ...prev, [activeChatId]: [] }));
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
    if (format === 'bold') setInputText(prev => prev + '**bold_text**');
    if (format === 'italic') setInputText(prev => prev + '*italic_text*');
    if (format === 'code') setInputText(prev => prev + '```\n// code here\n```');
    if (format === 'link') setInputText(prev => prev + '[label](url)');
  };

  const activeChan = activeChatType === 'channel' ? channels.find(c => c.id === activeChatId) : null;
  const activeColleague = activeChatType === 'dm' ? (colleagues.find(c => c.id === activeChatId) || Object.values(USERS).find(c => c.id === activeChatId)) : null;

  const activeStream = channelMessages[activeChatId] || [];
  const mentionCandidates = mentionQuery === null
    ? []
    : [currentUser, ...colleagues]
        .filter((user): user is User => Boolean(user))
        .filter(user => {
          const username = user.username || user.name.toLowerCase().replace(/\s+/g, '.');
          return user.name.toLowerCase().includes(mentionQuery) || username.toLowerCase().includes(mentionQuery);
        })
        .slice(0, 6);

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      
      {/* Channels / DM List Sidebar */}
      <aside className="w-64 h-full min-h-0 bg-surface-container-low border-r border-outline-variant flex flex-col flex-shrink-0">
        <div className="h-14 flex items-center px-4 border-b border-outline-variant bg-surface-container-low/50">
          <span className="text-sm font-bold uppercase tracking-wider text-on-surface">Inbox Workspace</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-6">
          {/* Channels Section */}
          <div>
            <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-outline flex justify-between items-center">
              <span>Channels</span>
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                title="Create Channel"
                className="cursor-pointer hover:text-on-surface text-outline-variant hover:scale-110 transition-all p-0.5"
              >
                <Plus size={12} />
              </button>
            </div>
            <div className="space-y-0.5 mt-2">
              {isLoading ? (
                <div className="space-y-2 px-3">
                  <div className="h-6 w-full bg-outline-variant/20 rounded animate-pulse" />
                  <div className="h-6 w-full bg-outline-variant/20 rounded animate-pulse" />
                  <div className="h-6 w-full bg-outline-variant/20 rounded animate-pulse" />
                </div>
              ) : (
                channels.map((chan) => {
                  const isActive = activeChatType === 'channel' && activeChatId === chan.id;
                  return (
                    <div key={chan.id} className="relative group/chan">
                      <button
                        onClick={() => handleSwitchChat('channel', chan.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left text-xs cursor-pointer ${
                          isActive
                            ? 'bg-surface-container-highest text-primary font-bold border-l-2 border-primary'
                            : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-on-surface'
                        }`}
                      >
                        <Hash size={14} className="text-outline-variant" />
                        <span className="flex-1 truncate">{chan.name}</span>
                      </button>
                      {/* Channel delete — admin only, shows on hover */}
                      {isAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteChannelId(chan.id); }}
                          title="Delete channel"
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/chan:opacity-100 p-1 rounded hover:bg-red-500/20 text-outline-variant hover:text-red-400 transition-all cursor-pointer"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Direct Messages Section */}
          <div>
            <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-outline flex justify-between items-center font-sans">
              <span>Direct Messages</span>
              <button 
                onClick={() => setIsCreateDMModalOpen(true)}
                title="Start Direct Message"
                className="cursor-pointer hover:text-on-surface text-outline-variant hover:scale-110 transition-all p-0.5"
              >
                <Plus size={12} />
              </button>
            </div>
            <div className="space-y-1 mt-2">
              {isLoading ? (
                <div className="space-y-2 px-3">
                  <div className="h-7 w-full bg-outline-variant/20 rounded animate-pulse" />
                  <div className="h-7 w-full bg-outline-variant/20 rounded animate-pulse" />
                </div>
              ) : (
                colleagues.map((user) => {
                  const isActive = activeChatType === 'dm' && activeChatId === user.id;
                  const isOnline = onlineUserIds.has(user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => handleSwitchChat('dm', user.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-all cursor-pointer group ${
                        isActive
                          ? 'bg-surface-container-highest text-primary font-bold border-l-2 border-primary'
                          : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-on-surface'
                      }`}
                    >
                      <div className="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-outline-variant/30">
                        <img src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name}`} alt={user.name} className="w-full h-full object-cover" />
                        <span className={`absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full border border-surface-container-low ${
                          isOnline ? 'bg-secondary' : 'bg-outline-variant'
                        }`}></span>
                      </div>
                      <span className="truncate">{user.username || user.name.toLowerCase().replace(' ', '_')}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Live Status indicator bottom corner */}
        <div className="p-3 bg-surface-container border-t border-outline-variant flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-outline-variant/50">
            <img src={currentUser?.avatar || USERS.alex.avatar} alt={currentUser?.name || "Alex Rivera"} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="font-bold text-xs text-on-surface truncate">{currentUser?.name || "Alex Rivera"}</div>
            <div className="text-[10px] text-secondary font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-secondary rounded-full inline-block animate-pulse"></span>
              <span>Online • {currentUser?.role || "Lead"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Feed Area */}
      <main className="flex-1 min-h-0 flex flex-col bg-background relative min-w-0">
        
        {/* Chat Stream Header */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-outline-variant bg-surface/30 backdrop-blur-md z-10">
          <div className="flex items-center gap-2 min-w-0">
            {activeChatType === 'channel' ? (
              <Hash size={16} className="text-outline-variant flex-shrink-0" />
            ) : (
              <AtSign size={16} className="text-outline-variant flex-shrink-0" />
            )}
            <h2 className="text-sm font-bold text-on-surface truncate">
              {activeChatType === 'channel' ? activeChan?.name : activeColleague?.name}
            </h2>
            <span className="w-[1px] h-4 bg-outline-variant mx-2 flex-shrink-0"></span>
            <p className="text-xs text-on-surface-variant truncate font-sans">
              {activeChatType === 'channel' ? activeChan?.description : `@${activeColleague?.username || activeColleague?.name.toLowerCase().replace(' ', '_')}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* DM clear conversation button */}
            {activeChatType === 'dm' && activeChatId && (
              <button
                onClick={() => setConfirmClearDM(true)}
                title="Clear conversation"
                className="p-2 text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button className="p-2 text-on-surface-variant hover:text-on-surface rounded-lg cursor-pointer">
              <Users size={16} />
            </button>
          </div>
        </header>

        {/* Messages Feed */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-6">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-outline-variant/25 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-outline-variant/30 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-outline-variant/20 rounded animate-pulse" />
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-outline-variant/25 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 bg-outline-variant/30 rounded animate-pulse" />
                  <div className="h-4 w-2/3 bg-outline-variant/20 rounded animate-pulse" />
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-outline-variant/25 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 bg-outline-variant/30 rounded animate-pulse" />
                  <div className="h-4 w-1/3 bg-outline-variant/20 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Historical Date Divider */}
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-outline-variant/30"></div>
                <span className="flex-shrink mx-4 text-[10px] font-bold uppercase tracking-widest text-outline font-sans">October 24, 2026</span>
                <div className="flex-grow border-t border-outline-variant/30"></div>
              </div>

              {activeStream.map((message) => {
                const isOwnMessage = message.user.id === currentUser?.id;
                const canDelete = isOwnMessage || isAdmin;
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={message.id} 
                    className="flex gap-4 group hover:bg-surface-container/10 p-2 -mx-2 rounded-xl transition-all relative"
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 border border-outline-variant/50">
                      <img src={message.user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${message.user.name}`} alt={message.user.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary hover:underline cursor-pointer">{message.user.name}</span>
                        <span className="text-[10px] text-outline-variant font-mono">{message.timestamp}</span>
                      </div>
                      
                      <p className="mt-1 text-xs text-on-surface leading-relaxed whitespace-pre-wrap">{renderMessageContent(message.content)}</p>

                      {/* Styled Code Snippet blocks */}
                      {message.codeSnippet && (
                        <div className="mt-3 p-4 bg-surface-container-lowest border border-outline-variant rounded-xl font-mono text-xs text-on-surface-variant overflow-x-auto select-all">
                          <pre className="whitespace-pre"><code>{message.codeSnippet}</code></pre>
                        </div>
                      )}

                      {/* Design File Attachment components */}
                      {message.fileAttachment && (
                        <div className="mt-3 p-3 bg-surface-container-low border border-outline-variant rounded-xl w-fit flex items-center gap-4 hover:border-primary/40 transition-colors">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                            <FileText size={20} />
                          </div>
                          <div>
                            <div className="font-bold text-xs text-on-surface">{message.fileAttachment.name}</div>
                            <div className="text-[10px] text-on-surface-variant font-mono uppercase tracking-tight mt-0.5">{message.fileAttachment.size} • {message.fileAttachment.type}</div>
                          </div>
                          <button 
                            title="Download Attachment"
                            className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-all cursor-pointer"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      )}

                      {/* Emoji reactions */}
                      {message.reactions && message.reactions.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {message.reactions.map((reaction, i) => (
                            <span 
                              key={i}
                              className="px-2 py-0.5 bg-surface-container border border-outline-variant rounded-full text-[11px] flex items-center gap-1 cursor-pointer hover:border-primary transition-colors font-sans"
                            >
                              <span>{reaction.emoji}</span>
                              <span className="text-on-surface-variant font-bold text-[10px]">{reaction.count}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Delete message button — own messages or admin, on hover */}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteMessage(message.id)}
                        title="Delete message"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/15 text-outline-variant hover:text-red-400 transition-all cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </motion.div>
                );
              })}
              <div ref={chatEndRef} />
            </>
          )}
        </div>

        {/* Rich Input Editor Box */}
        <div className="p-6 pt-0">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-1.5 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
            {/* Formatting tool rail */}
            <div className="flex items-center gap-1 px-2 py-1 border-b border-outline-variant/30 mb-1">
              <button onClick={() => insertFormatting('bold')} className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" title="Bold"><Bold size={14} /></button>
              <button onClick={() => insertFormatting('italic')} className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" title="Italic"><Italic size={14} /></button>
              <button onClick={() => insertFormatting('code')} className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" title="Code Block"><Code size={14} /></button>
              <button onClick={() => insertFormatting('link')} className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" title="Link"><Link size={14} /></button>
              <span className="w-[1px] h-4 bg-outline-variant mx-1"></span>
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
            </div>

            {/* Input fields */}
            <div className="flex items-end gap-2 px-2 py-1.5">
              <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">
                <Paperclip size={16} />
              </button>
              
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={handleInputChange}
                onClick={(e) => updateMentionQuery(inputText, e.currentTarget.selectionStart)}
                onKeyUp={(e) => updateMentionQuery(inputText, e.currentTarget.selectionStart)}
                onKeyDown={handleKeyPress}
                placeholder={activeChatType === 'channel' ? `Message #${activeChan?.name || ''}` : `Message @${activeColleague?.username || activeColleague?.name.toLowerCase().replace(' ', '_')}`}
                rows={1}
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none text-xs text-on-surface py-1 max-h-36 placeholder:text-on-surface-variant/60 outline-none"
                style={{ height: 'auto' }}
              />

              {mentionCandidates.length > 0 && (
                <div className="absolute left-14 right-20 bottom-20 z-30 bg-surface-container-high border border-outline-variant rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-outline border-b border-outline-variant/40">
                    Mention teammate
                  </div>
                  {mentionCandidates.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => insertMention(user)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-container-highest transition-colors cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg overflow-hidden border border-outline-variant/40 flex-shrink-0">
                        <img src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name}`} alt={user.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-on-surface truncate">{user.name}</div>
                        <div className="text-[10px] text-primary font-mono truncate">@{user.username || user.name.toLowerCase().replace(/\s+/g, '.')}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <button className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">
                  <Smile size={16} />
                </button>
                <button 
                  onClick={handleSendMessage}
                  className="p-2 bg-primary hover:bg-primary/90 text-on-primary rounded-lg transition-all shadow-lg active:scale-95 cursor-pointer flex-shrink-0"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-outline flex justify-between px-2 font-sans">
            <span>Press <b>Return</b> to send • <b>Shift + Return</b> for new line</span>
            <span>Markdown text rendering supported</span>
          </div>
        </div>
      </main>

      {/* Right Sidebar: Members List panel */}
      <aside className="w-64 h-full min-h-0 bg-surface-container-low border-l border-outline-variant hidden xl:flex flex-col flex-shrink-0">
        <div className="h-14 flex items-center px-4 border-b border-outline-variant">
          <span className="font-bold text-on-surface text-xs font-sans">Members — {colleagues.length + (currentUser ? 1 : 0)}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-6">
          {/* Active Members */}
          <div>
            <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-outline">
              Active — {colleagues.filter(u => onlineUserIds.has(u.id)).length + (currentUser && onlineUserIds.has(currentUser.id) ? 1 : 0)}
            </div>
            <div className="space-y-1 mt-2">
              {currentUser && onlineUserIds.has(currentUser.id) && (
                <div className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-surface-container-high cursor-pointer transition-all group">
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-outline-variant/30">
                    <img src={currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.name}`} alt={currentUser.name} className="w-full h-full object-cover" />
                    <div className="absolute bottom-[-1px] right-[-1px] w-2.5 h-2.5 bg-secondary rounded-full border-2 border-surface-container-low"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-on-surface truncate group-hover:text-primary transition-colors">{currentUser.name} (You)</div>
                    <div className="text-[10px] text-on-surface-variant truncate font-sans">{currentUser.role}</div>
                  </div>
                </div>
              )}
              {colleagues.filter(u => onlineUserIds.has(u.id)).map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleSwitchChat('dm', user.id)}
                  className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-surface-container-high cursor-pointer transition-all group"
                >
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-outline-variant/30">
                    <img src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name}`} alt={user.name} className="w-full h-full object-cover" />
                    <div className="absolute bottom-[-1px] right-[-1px] w-2.5 h-2.5 bg-secondary rounded-full border-2 border-surface-container-low"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-on-surface truncate group-hover:text-primary transition-colors">{user.name}</div>
                    <div className="text-[10px] text-on-surface-variant truncate font-sans">{user.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Away / Offline Members */}
          <div>
            <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-outline">
              Away / Offline — {colleagues.filter(u => !onlineUserIds.has(u.id)).length + (currentUser && !onlineUserIds.has(currentUser.id) ? 1 : 0)}
            </div>
            <div className="space-y-1 mt-2 opacity-60">
              {currentUser && !onlineUserIds.has(currentUser.id) && (
                <div className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-surface-container-high cursor-pointer transition-all group">
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 grayscale border border-outline-variant/30">
                    <img src={currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.name}`} alt={currentUser.name} className="w-full h-full object-cover" />
                    <div className={`absolute bottom-[-1px] right-[-1px] w-2.5 h-2.5 rounded-full border-2 border-surface-container-low ${
                      currentUser.status === 'Away' ? 'bg-tertiary' : 'bg-outline-variant'
                    }`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-on-surface truncate">{currentUser.name} (You)</div>
                    <div className="text-[10px] text-on-surface-variant truncate font-sans">Away</div>
                  </div>
                </div>
              )}
              {colleagues.filter(u => !onlineUserIds.has(u.id)).map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleSwitchChat('dm', user.id)}
                  className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-surface-container-high cursor-pointer transition-all group"
                >
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 grayscale border border-outline-variant/30">
                    <img src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name}`} alt={user.name} className="w-full h-full object-cover" />
                    <div className={`absolute bottom-[-1px] right-[-1px] w-2.5 h-2.5 rounded-full border-2 border-surface-container-low ${
                      user.status === 'Away' ? 'bg-tertiary' : 'bg-outline-variant'
                    }`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-on-surface truncate">{user.name}</div>
                    <div className="text-[10px] text-on-surface-variant truncate font-sans">{user.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Invite widget banner */}
        <div className="p-4 bg-surface-container border-t border-outline-variant">
          <div className="bg-surface-container-lowest p-3 rounded-lg border border-outline-variant flex flex-col gap-3">
            <p className="text-[11px] text-on-surface-variant leading-tight">Need to loop in another developer or reviewer? Invite them to the forge workspace.</p>
            <button 
              onClick={() => setIsInviteModalOpen(true)}
              className="w-full py-1.5 text-[10px] uppercase font-bold tracking-wider bg-outline-variant/40 hover:bg-outline-variant/75 rounded transition-all text-on-surface cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Sparkles size={11} className="text-primary" />
              <span>Invite Team Member</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Create Channel Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface-container-low border border-outline-variant rounded-2xl p-6 w-full max-w-sm shadow-2xl relative"
            >
              <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-4 font-sans">Create a New Channel</h3>
              <form onSubmit={handleCreateChannel} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant font-sans">Channel Name</label>
                  <input
                    type="text"
                    required
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="e.g. frontend-sprint"
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface font-sans"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setNewChannelName('');
                    }}
                    className="px-4 py-1.5 bg-surface-container border border-outline-variant hover:border-primary/50 text-on-surface text-xs font-semibold rounded-lg transition-all cursor-pointer font-sans"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-lg transition-all cursor-pointer shadow-md active:scale-[0.98] font-sans"
                  >
                    Create Channel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Start Direct Message Modal */}
      <AnimatePresence>
        {isCreateDMModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface-container-low border border-outline-variant rounded-2xl p-6 w-full max-w-sm shadow-2xl relative"
            >
              <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-4 font-sans">Start a Direct Message</h3>
              <form onSubmit={handleStartDM} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant font-sans">Select Colleague</label>
                  <select
                    value={selectedDMColleagueId}
                    onChange={(e) => setSelectedDMColleagueId(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface font-sans cursor-pointer"
                  >
                    {colleagues.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateDMModalOpen(false);
                    }}
                    className="px-4 py-1.5 bg-surface-container border border-outline-variant hover:border-primary/50 text-on-surface text-xs font-semibold rounded-lg transition-all cursor-pointer font-sans"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-lg transition-all cursor-pointer shadow-md active:scale-[0.98] font-sans"
                  >
                    Start Chat
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Channel Modal */}
      <AnimatePresence>
        {confirmDeleteChannelId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface-container-low border border-red-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 flex-shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface font-sans">Delete Channel?</h3>
                  <p className="text-[11px] text-on-surface-variant font-sans">This will permanently delete the channel and all its messages.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setConfirmDeleteChannelId(null)}
                  className="px-4 py-1.5 bg-surface-container border border-outline-variant hover:border-primary/50 text-on-surface text-xs font-semibold rounded-lg transition-all cursor-pointer font-sans"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteChannel(confirmDeleteChannelId)}
                  className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-md active:scale-[0.98] font-sans"
                >
                  Delete Channel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Clear DM Modal */}
      <AnimatePresence>
        {confirmClearDM && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface-container-low border border-red-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 flex-shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface font-sans">Clear Conversation?</h3>
                  <p className="text-[11px] text-on-surface-variant font-sans">All messages in this DM will be permanently deleted for both users.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setConfirmClearDM(false)}
                  className="px-4 py-1.5 bg-surface-container border border-outline-variant hover:border-primary/50 text-on-surface text-xs font-semibold rounded-lg transition-all cursor-pointer font-sans"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearDM}
                  className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-md active:scale-[0.98] font-sans"
                >
                  Clear All Messages
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
