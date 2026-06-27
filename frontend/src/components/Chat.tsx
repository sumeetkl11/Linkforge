/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hash, Plus, Send, Smile, Paperclip, Bold, Italic, Code, Link, List, Download, FileText, AtSign, Users, Sparkles, MessageCircle, Copy, Check } from 'lucide-react';
import { Channel, Message, User } from '../types';
import { CHANNELS, INITIAL_MESSAGES, USERS } from '../data';
import { fetchMessages, sendMessage, fetchChannels, fetchUsers } from '../api';

import { socket } from '../utils/socket';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import EmojiPicker, { Theme } from 'emoji-picker-react';

interface ChatProps {
  currentUser: User | null;
}

export default function Chat({ currentUser }: ChatProps) {
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
  
  // Active channel/DM specific messages state helper
  const [channelMessages, setChannelMessages] = useState<Record<string, Message[]>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<{file: File, previewUrl: string}[]>([]);

  // Global socket listener for workspace channel creations
  useEffect(() => {
    const handleChannelCreated = (newChan: Channel) => {
      setChannels(prev => {
        if (prev.some(c => c.id === newChan.id)) return prev;
        return [...prev, newChan];
      });
    };

    socket.on('channel_created', handleChannelCreated);

    return () => {
      socket.off('channel_created', handleChannelCreated);
    };
  }, []);

  // Load initial workspace channels and colleagues
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const chans = await fetchChannels();
        setChannels(chans);

        // Use fetchUsers() from api.ts so the Authorization header is included.
        // The previous raw fetch('/api/users') had no auth header — always 401'd.
        const users = await fetchUsers(currentUser?.id);
        // Always ensure colleagues is an array, even if the API returns something unexpected.
        setColleagues(Array.isArray(users) ? users : []);

        if (chans.length > 0) {
          setActiveChatId(chans[0].id);
        }
        if (Array.isArray(users) && users.length > 0) {
          setSelectedDMColleagueId(users[0].id);
        }
      } catch (err) {
        console.error('Failed to load initial workspace data:', err);
        // Ensure colleagues is always an array so .map() never throws.
        setColleagues([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [currentUser]);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages, activeChatId]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea height on content changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputText]);

  // Fetch messages from backend for the active chat & setup socket sync
  useEffect(() => {
    // Don't fetch until we have a valid chatId (channels haven't loaded yet).
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
      
      const isForCurrentChat =
        (activeChatType === 'channel' && !receiver_id && (channel_id === activeChatId)) ||
        (activeChatType === 'dm' && receiver_id && currentUser &&
          ((receivedMsg.user.id === currentUser.id && receiver_id === activeChatId) ||
           (receivedMsg.user.id === activeChatId && receiver_id === currentUser.id)));

      if (isForCurrentChat) {
        setChannelMessages(prev => {
          const currentStream = prev[activeChatId] || [];
          if (currentStream.some(m => m.id === receivedMsg.id)) return prev;
          return {
            ...prev,
            [activeChatId]: [...currentStream, receivedMsg]
          };
        });
      }
    };

    socket.on('message:received', handleMessage);

    return () => {
      socket.off('message:received', handleMessage);
    };
  }, [activeChatId, activeChatType, currentUser]);

  // Handle Send Message
  const handleSendMessage = async () => {
    if (!inputText.trim() && attachments.length === 0) return;

    let finalContent = inputText;
    setIsUploading(true);

    try {
      if (attachments.length > 0) {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

        if (!cloudName || !uploadPreset) {
          throw new Error('Cloudinary environment configuration missing');
        }

        // Concurrently upload all attachments to Cloudinary auto-upload endpoint
        const uploadPromises = attachments.map(async ({ file }) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', uploadPreset);

          const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Upload of ${file.name} failed (${response.status}): ${errText}`);
          }

          const data = await response.json();
          return {
            name: file.name,
            type: file.type,
            secureUrl: data.secure_url as string
          };
        });

        const uploadedFiles = await Promise.all(uploadPromises);

        // Format each uploaded file as dynamic Markdown
        const markdownStrings = uploadedFiles.map(file => {
          if (file.type.startsWith('image/')) {
            return `\n![${file.name}](${file.secureUrl})\n`;
          } else {
            return `\n[📎 ${file.name}](${file.secureUrl})\n`;
          }
        });

        finalContent = `${finalContent}${markdownStrings.join('')}`;
      }

      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        user: currentUser || USERS.alex,
        content: finalContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      // 1. Update UI state locally
      const updatedMessages = [...(channelMessages[activeChatId] || []), newMessage];
      setChannelMessages(prev => ({
        ...prev,
        [activeChatId]: updatedMessages
      }));

      // 2. Clear input & attachments
      setInputText('');
      attachments.forEach(att => URL.revokeObjectURL(att.previewUrl));
      setAttachments([]);

      // 3. Save message to database & trigger real-time socket
      await sendMessage(
        activeChatType === 'channel' ? activeChatId : null,
        newMessage,
        activeChatType === 'dm' ? activeChatId : undefined
      );

    } catch (err: any) {
      console.error('Failed to send message:', err);
      alert(`Failed to send message: ${err.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    try {
      const response = await fetch('/api/channels', {
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

  const handleSwitchChat = (type: 'channel' | 'dm', chatId: string) => {
    setActiveChatType(type);
    setActiveChatId(chatId);
  };

  const insertFormatting = (format: 'bold' | 'italic' | 'code' | 'link') => {
    const el = textareaRef.current;
    if (!el) {
      if (format === 'bold') setInputText(prev => prev + '**bold text**');
      if (format === 'italic') setInputText(prev => prev + '*italic text*');
      if (format === 'code') setInputText(prev => prev + '```\ncode here\n```');
      if (format === 'link') setInputText(prev => prev + '[link text](url)');
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selection = el.value.substring(start, end);

    let wrappedText = '';
    let newCursorStart = start;
    let newCursorEnd = end;

    if (format === 'bold') {
      const textToWrap = selection || 'bold text';
      wrappedText = `**${textToWrap}**`;
      if (!selection) {
        newCursorStart = start + 2;
        newCursorEnd = start + 2 + textToWrap.length;
      } else {
        newCursorStart = newCursorEnd = start + wrappedText.length;
      }
    } else if (format === 'italic') {
      const textToWrap = selection || 'italic text';
      wrappedText = `*${textToWrap}*`;
      if (!selection) {
        newCursorStart = start + 1;
        newCursorEnd = start + 1 + textToWrap.length;
      } else {
        newCursorStart = newCursorEnd = start + wrappedText.length;
      }
    } else if (format === 'code') {
      const textToWrap = selection || 'code here';
      wrappedText = `\`\`\`\n${textToWrap}\n\`\`\``;
      if (!selection) {
        newCursorStart = start + 4;
        newCursorEnd = start + 4 + textToWrap.length;
      } else {
        newCursorStart = newCursorEnd = start + wrappedText.length;
      }
    } else if (format === 'link') {
      const textToWrap = selection || 'link text';
      wrappedText = `[${textToWrap}](url)`;
      if (!selection) {
        newCursorStart = start + 1;
        newCursorEnd = start + 1 + textToWrap.length;
      } else {
        newCursorStart = newCursorEnd = start + wrappedText.length;
      }
    }

    const before = el.value.substring(0, start);
    const after = el.value.substring(end);
    setInputText(before + wrappedText + after);

    // Focus and select the placeholder text or set the new cursor position
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(newCursorStart, newCursorEnd);
    }, 0);
  };

  const handleEmojiClick = (emojiData: any) => {
    const emoji = emojiData.emoji;
    const el = textareaRef.current;
    if (!el) {
      setInputText(prev => prev + emoji);
      setShowEmojiPicker(false);
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = el.value.substring(0, start);
    const after = el.value.substring(end);
    setInputText(before + emoji + after);
    setShowEmojiPicker(false);

    setTimeout(() => {
      el.focus();
      const newPos = start + emoji.length;
      el.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newAttachments = Array.from(selectedFiles).map(file => ({
      file,
      previewUrl: URL.createObjectURL(file)
    }));

    setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const activeChan = activeChatType === 'channel' ? channels.find(c => c.id === activeChatId) : null;
  const activeColleague = activeChatType === 'dm' ? (colleagues.find(c => c.id === activeChatId) || Object.values(USERS).find(c => c.id === activeChatId)) : null;

  const activeStream = channelMessages[activeChatId] || [];

  return (
    <div className="flex flex-1 h-screen overflow-hidden">
      
      {/* Channels / DM List Sidebar */}
      <aside className="w-64 bg-surface-container-low border-r border-outline-variant flex flex-col">
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
                    <button
                      key={chan.id}
                      onClick={() => handleSwitchChat('channel', chan.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left text-xs cursor-pointer ${
                        isActive
                          ? 'bg-surface-container-highest text-primary font-bold border-l-2 border-primary'
                          : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-on-surface'
                      }`}
                    >
                      <Hash size={14} className="text-outline-variant" />
                      <span>{chan.name}</span>
                    </button>
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
                          user.status === 'Online' ? 'bg-secondary' : user.status === 'Away' ? 'bg-tertiary' : 'bg-outline-variant'
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
      <main className="flex-1 flex flex-col bg-background relative min-w-0">
        
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

          <div className="flex items-center gap-3">
            <button className="p-2 text-on-surface-variant hover:text-on-surface rounded-lg cursor-pointer">
              <Users size={16} />
            </button>
          </div>
        </header>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

              {activeStream.map((message) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={message.id} 
                  className="flex gap-4 group hover:bg-surface-container/10 p-2 -mx-2 rounded-xl transition-all"
                >
                  <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 border border-outline-variant/50">
                    <img src={message.user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${message.user.name}`} alt={message.user.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary hover:underline cursor-pointer">{message.user.name}</span>
                      <span className="text-[10px] text-outline-variant font-mono">{message.timestamp}</span>
                    </div>
                    
                    <div className="mt-1 text-xs text-on-surface leading-relaxed markdown-content">
                      <ReactMarkdown
                        components={{
                          code({ className, children, ...props }: any) {
                            const { ref, ...rest } = props;
                            const match = /language-(\w+)/.exec(className || '');
                            return match ? (
                              <SyntaxHighlighter
                                style={dracula as any}
                                language={match[1]}
                                PreTag="div"
                                className="rounded-lg border border-outline-variant/30 my-2 text-xs overflow-x-auto"
                                {...rest}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            ) : (
                              <code className={`${className || ''} bg-surface-container-highest px-1.5 py-0.5 rounded text-[11px] font-mono`} {...props}>
                                {children}
                              </code>
                            );
                          },
                          img({ src, alt, ...props }: any) {
                            return (
                              <img
                                src={src}
                                alt={alt || 'Image Attachment'}
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: '350px',
                                  borderRadius: '8px',
                                  objectFit: 'contain'
                                }}
                                className="my-2 border border-outline-variant/30 shadow-md"
                                {...props}
                              />
                            );
                          },
                          a({ href, children, ...props }: any) {
                            return (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                                {...props}
                              >
                                {children}
                              </a>
                            );
                          }
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>

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
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </>
          )}
        </div>

        {/* Rich Input Editor Box */}
        <div className="p-6 pt-0 relative">
          {showEmojiPicker && (
            <div className="absolute bottom-20 right-6 z-50">
              <EmojiPicker
                theme={Theme.DARK}
                onEmojiClick={handleEmojiClick}
                searchDisabled
                skinTonesDisabled
                previewConfig={{ showPreview: false }}
                height={350}
                width={300}
              />
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <div className="bg-surface-container border border-outline-variant rounded-xl p-1.5 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
            {/* Formatting tool rail */}
            <div className="flex items-center gap-1 px-2 py-1 border-b border-outline-variant/30 mb-1">
              <button onClick={() => insertFormatting('bold')} className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" title="Bold"><Bold size={14} /></button>
              <button onClick={() => insertFormatting('italic')} className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" title="Italic"><Italic size={14} /></button>
              <button onClick={() => insertFormatting('code')} className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" title="Code Block"><Code size={14} /></button>
              <button onClick={() => insertFormatting('link')} className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" title="Link"><Link size={14} /></button>
              {activeChatType === 'channel' && (
                <>
                  <span className="w-[1px] h-4 bg-outline-variant mx-1"></span>
                  <button className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" title="Mentions"><AtSign size={14} /></button>
                </>
              )}
            </div>

            {/* Thumbnail previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 border-b border-outline-variant/30 max-h-28 overflow-y-auto">
                {attachments.map((att, index) => {
                  const isImage = att.file.type.startsWith('image/');
                  return (
                    <div key={index} className="relative flex items-center gap-2 p-1.5 bg-surface-container-high border border-outline-variant rounded-lg max-w-[200px] group transition-all">
                      {isImage ? (
                        <img 
                          src={att.previewUrl} 
                          alt="preview" 
                          className="w-10 h-10 rounded object-cover border border-outline-variant/30"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                          <FileText size={18} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="text-[10px] font-bold text-on-surface truncate leading-tight">{att.file.name}</div>
                        <div className="text-[9px] text-on-surface-variant font-mono mt-0.5 uppercase">{(att.file.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(index)}
                        className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                        title="Remove file"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Input fields */}
            <div className="flex items-end gap-2 px-2 py-1.5">
              <button 
                onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <Paperclip size={16} />
              </button>
              
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={isUploading ? "Uploading image..." : (activeChatType === 'channel' ? `Message #${activeChan?.name || ''}` : `Message @${activeColleague?.username || activeColleague?.name.toLowerCase().replace(' ', '_')}`)}
                disabled={isUploading}
                rows={1}
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none text-xs text-on-surface py-1 max-h-36 placeholder:text-on-surface-variant/60 outline-none disabled:opacity-50"
                style={{ height: 'auto' }}
              />

              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setShowEmojiPicker(prev => !prev)}
                  className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                >
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
      <aside className="w-64 bg-surface-container-low border-l border-outline-variant hidden xl:flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-outline-variant">
          <span className="font-bold text-on-surface text-xs font-sans">Members — {colleagues.length + (currentUser ? 1 : 0)}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-6">
          {/* Active Members */}
          <div>
            <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-outline">
              Active — {colleagues.filter(u => u.status === 'Online').length + (currentUser?.status === 'Online' ? 1 : 0)}
            </div>
            <div className="space-y-1 mt-2">
              {currentUser?.status === 'Online' && (
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
              {colleagues.filter(u => u.status === 'Online').map((user) => (
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
              Away / Offline — {colleagues.filter(u => u.status !== 'Online').length + (currentUser?.status !== 'Online' ? 1 : 0)}
            </div>
            <div className="space-y-1 mt-2 opacity-60">
              {currentUser && currentUser.status !== 'Online' && (
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
              {colleagues.filter(u => u.status !== 'Online').map((user) => (
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

    </div>
  );
}
