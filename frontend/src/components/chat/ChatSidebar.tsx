import React from 'react';
import { Hash, Plus, Trash2 } from 'lucide-react';
import { Channel, User } from '../../types';
import { USERS } from '../../data';

interface ChatSidebarProps {
  channels: Channel[];
  colleagues: User[];
  activeChatType: 'channel' | 'dm';
  activeChatId: string;
  isLoading: boolean;
  isAdmin: boolean;
  currentUser: User | null;
  onlineUserIds: Set<string>;
  onSwitchChat: (type: 'channel' | 'dm', chatId: string) => void;
  onOpenCreateChannel: () => void;
  onOpenCreateDM: () => void;
  onConfirmDeleteChannel: (channelId: string) => void;
}

export default function ChatSidebar({
  channels,
  colleagues,
  activeChatType,
  activeChatId,
  isLoading,
  isAdmin,
  currentUser,
  onlineUserIds,
  onSwitchChat,
  onOpenCreateChannel,
  onOpenCreateDM,
  onConfirmDeleteChannel,
}: ChatSidebarProps) {
  return (
    <aside className="w-60 sm:w-64 h-full min-h-0 bg-surface-container-low border-r border-outline-variant hidden sm:flex flex-col flex-shrink-0">
      <div className="h-14 flex items-center px-4 border-b border-outline-variant">
        <span className="text-xs font-semibold tracking-tight text-on-surface">
          Inbox Workspace
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-6">
        {/* Channels Section */}
        <div>
          <div className="px-3 py-1.5 text-xs font-semibold text-on-surface-variant flex justify-between items-center">
            <span>Channels</span>
            <button
              type="button"
              onClick={onOpenCreateChannel}
              title="Create Channel"
              className="cursor-pointer hover:text-on-surface text-on-surface-variant transition-colors p-0.5 rounded"
            >
              <Plus size={13} />
            </button>
          </div>
          <div className="space-y-0.5 mt-1">
            {isLoading ? (
              <div className="space-y-2 px-3">
                <div className="h-7 w-full bg-outline-variant/20 rounded animate-pulse" />
                <div className="h-7 w-full bg-outline-variant/20 rounded animate-pulse" />
                <div className="h-7 w-full bg-outline-variant/20 rounded animate-pulse" />
              </div>
            ) : (
              channels.map((chan) => {
                const isActive = activeChatType === 'channel' && activeChatId === chan.id;
                return (
                  <div key={chan.id} className="relative group/chan">
                    <button
                      type="button"
                      onClick={() => onSwitchChat('channel', chan.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left text-xs cursor-pointer ${
                        isActive
                          ? 'bg-primary/15 text-primary font-semibold'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      }`}
                    >
                      <Hash size={14} className={isActive ? 'text-primary' : 'text-outline'} />
                      <span className="flex-1 truncate">{chan.name}</span>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onConfirmDeleteChannel(chan.id);
                        }}
                        title="Delete channel"
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/chan:opacity-100 p-1 rounded hover:bg-error/15 text-on-surface-variant hover:text-error transition-opacity cursor-pointer"
                      >
                        <Trash2 size={12} />
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
          <div className="px-3 py-1.5 text-xs font-semibold text-on-surface-variant flex justify-between items-center">
            <span>Direct Messages</span>
            <button
              type="button"
              onClick={onOpenCreateDM}
              title="Start Direct Message"
              className="cursor-pointer hover:text-on-surface text-on-surface-variant transition-colors p-0.5 rounded"
            >
              <Plus size={13} />
            </button>
          </div>
          <div className="space-y-0.5 mt-1">
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
                    type="button"
                    onClick={() => onSwitchChat('dm', user.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer group ${
                      isActive
                        ? 'bg-primary/15 text-primary font-semibold'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <div className="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-outline-variant">
                      <img
                        src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name}`}
                        alt={user.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full border border-surface-container-low ${
                          isOnline ? 'bg-secondary' : 'bg-outline'
                        }`}
                      />
                    </div>
                    <span className="truncate">
                      {user.username || user.name.toLowerCase().replace(' ', '_')}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Current User Footer */}
      <div className="p-3 bg-surface-container border-t border-outline-variant flex items-center gap-3">
        <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-outline-variant">
          <img
            src={currentUser?.avatar || USERS.alex.avatar}
            alt={currentUser?.name || 'Alex Rivera'}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="font-semibold text-xs text-on-surface truncate">
            {currentUser?.name || 'Alex Rivera'}
          </div>
          <div className="text-[11px] text-secondary font-mono truncate">
            Online · {currentUser?.role || 'Lead'}
          </div>
        </div>
      </div>
    </aside>
  );
}
