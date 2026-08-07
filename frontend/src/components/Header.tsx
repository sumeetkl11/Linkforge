/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Grid, ChevronDown, X, CheckCheck, MessageCircle, CheckSquare, Hash, Zap } from 'lucide-react';
import { User, AppNotification } from '../types';
import { resolveAvatar } from '../utils/avatar';

interface HeaderProps {
  searchVal: string;
  setSearchVal: (val: string) => void;
  placeholderText?: string;
  onSearchFocus?: () => void;
  onProfileClick?: () => void;
  currentUser: User | null;
  onTriggerToast: (msg: string) => void;
  isLoading?: boolean;
  notifications?: AppNotification[];
  onClearNotifications?: () => void;
  onMarkAllRead?: () => void;
}

const notifIcon: Record<AppNotification['type'], React.ReactNode> = {
  task: <CheckSquare size={13} className="text-primary" />,
  message: <MessageCircle size={13} className="text-secondary" />,
  channel: <Hash size={13} className="text-tertiary" />,
  system: <Zap size={13} className="text-on-surface-variant" />,
};

export default function Header({ 
  searchVal, 
  setSearchVal, 
  placeholderText = "Search tasks, docs, or people...", 
  onSearchFocus,
  onProfileClick,
  currentUser,
  onTriggerToast,
  isLoading,
  notifications = [],
  onClearNotifications,
  onMarkAllRead,
}: HeaderProps) {
  const [isBellOpen, setIsBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const userAvatar = resolveAvatar(currentUser);
  const userName = currentUser?.name || 'User';
  const userRole = currentUser?.role || 'Member';

  const unreadCount = notifications.filter(n => !n.read).length;
  const displayBadge = unreadCount > 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setIsBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="flex justify-between items-center w-full h-14 px-6 sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-outline-variant">
      {/* Interactive Search Field */}
      <div className="flex items-center flex-1 max-w-xl">
        <div className="relative w-full group">
          <Search 
            size={16} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary" 
          />
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            onFocus={onSearchFocus}
            placeholder={placeholderText}
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-10 pr-4 py-1.5 text-xs font-sans text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:bg-surface-container transition-all"
          />
          {searchVal && (
            <button
              onClick={() => setSearchVal('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Action Tray */}
      <div className="flex items-center gap-2 ml-4">
        
        {/* Notification Bell */}
        <div ref={bellRef} className="relative">
          <button 
            onClick={() => setIsBellOpen(prev => !prev)}
            title="Notifications"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-all cursor-pointer relative"
          >
            <Bell size={18} />
            {displayBadge && (
              <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] flex items-center justify-center bg-error rounded-full ring-2 ring-surface text-[9px] font-bold text-white px-0.5">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown Panel */}
          {isBellOpen && (
            <div className="absolute right-0 top-11 w-80 bg-surface-container-low border border-outline-variant rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden">
              {/* Panel Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/50">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface">
                  Notifications {displayBadge && <span className="text-primary">({unreadCount} new)</span>}
                </span>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <>
                      <button
                        onClick={() => { onMarkAllRead?.(); }}
                        title="Mark all as read"
                        className="text-[10px] text-on-surface-variant hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <CheckCheck size={12} /> All read
                      </button>
                      <button
                        onClick={() => { onClearNotifications?.(); }}
                        title="Clear all"
                        className="text-[10px] text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Grouped Notification List */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-on-surface-variant">
                    <Bell size={24} className="opacity-30" />
                    <span className="text-xs font-sans">You're all caught up!</span>
                  </div>
                ) : (
                  (['message', 'task', 'channel', 'system'] as Array<AppNotification['type']>).map(type => {
                    const labels: Record<AppNotification['type'], string> = {
                      message: 'Messages', task: 'Tasks', channel: 'Channels', system: 'System'
                    };
                    const groupItems = notifications.filter(n => n.type === type);
                    if (groupItems.length === 0) return null;
                    const groupUnread = groupItems.filter(n => !n.read).length;
                    return (
                      <div key={type}>
                        <div className="flex items-center gap-2 px-4 py-2 border-b border-outline-variant/20 bg-surface-container/40">
                          <span className="w-4 h-4 flex items-center justify-center">{notifIcon[type]}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant flex-1">{labels[type]}</span>
                          {groupUnread > 0 && (
                            <span className="text-[9px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{groupUnread} new</span>
                          )}
                        </div>
                        {groupItems.slice(0, 5).map(n => (
                          <div
                            key={n.id}
                            className={`flex items-start gap-3 px-4 py-3 border-b border-outline-variant/10 transition-colors ${!n.read ? 'bg-primary/5' : 'hover:bg-surface-container'}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] leading-snug ${!n.read ? 'text-on-surface font-medium' : 'text-on-surface-variant'}`}>{n.text}</p>
                              <span className="text-[10px] text-outline font-mono mt-0.5 block">{n.time}</span>
                            </div>
                            {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                          </div>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <button 
          onClick={() => onTriggerToast("Feature coming soon: SyncForge applications grid console.")}
          title="Apps Launcher"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-all cursor-pointer"
        >
          <Grid size={18} />
        </button>

        <div className="h-5 w-[1px] bg-outline-variant mx-2"></div>

        {/* Profile Droptrigger */}
        <button 
          onClick={onProfileClick}
          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-surface-container-highest transition-all text-left cursor-pointer"
        >
          <div className="text-right hidden sm:block">
            <p className="text-[11px] font-bold text-on-surface leading-tight font-sans">{userName}</p>
            <p className="text-[9px] text-on-surface-variant font-mono font-medium leading-none">{userRole}</p>
          </div>
          <div className="w-8 h-8 rounded-full border border-outline-variant overflow-hidden flex-shrink-0 bg-surface-container-highest">
            {isLoading || !currentUser ? (
              <div className="w-full h-full bg-outline-variant/40 animate-pulse rounded-full" />
            ) : (
              <img 
                src={userAvatar} 
                alt={userName}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <ChevronDown size={14} className="text-on-surface-variant hidden sm:block" />
        </button>
      </div>
    </header>
  );
}
