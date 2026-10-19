import React from 'react';
import { Sparkles } from 'lucide-react';
import { User } from '../../types';

interface ChatMembersPanelProps {
  colleagues: User[];
  currentUser: User | null;
  onlineUserIds: Set<string>;
  onSwitchChat: (type: 'channel' | 'dm', chatId: string) => void;
  onOpenInvite: () => void;
}

export default function ChatMembersPanel({
  colleagues,
  currentUser,
  onlineUserIds,
  onSwitchChat,
  onOpenInvite,
}: ChatMembersPanelProps) {
  const totalCount = colleagues.length + (currentUser ? 1 : 0);
  const activeCount =
    colleagues.filter((u) => onlineUserIds.has(u.id)).length +
    (currentUser && onlineUserIds.has(currentUser.id) ? 1 : 0);
  const offlineCount =
    colleagues.filter((u) => !onlineUserIds.has(u.id)).length +
    (currentUser && !onlineUserIds.has(currentUser.id) ? 1 : 0);

  return (
    <aside className="w-64 h-full min-h-0 bg-surface-container-low border-l border-outline-variant hidden xl:flex flex-col flex-shrink-0">
      <div className="h-14 flex items-center justify-between px-4 border-b border-outline-variant">
        <span className="font-semibold text-on-surface text-xs">Members</span>
        <span className="text-xs font-mono text-on-surface-variant tabular-nums">{totalCount}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-6">
        {/* Active Members */}
        <div>
          <div className="px-3 py-1.5 text-xs font-medium text-on-surface-variant flex justify-between font-mono tabular-nums">
            <span>Online</span>
            <span>{activeCount}</span>
          </div>
          <div className="space-y-1 mt-1">
            {currentUser && onlineUserIds.has(currentUser.id) && (
              <div className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-surface-container transition-colors group">
                <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-outline-variant">
                  <img
                    src={
                      currentUser.avatar ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.name}`
                    }
                    alt={currentUser.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 right-0 w-2 h-2 bg-secondary rounded-full border border-surface-container-low" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-on-surface truncate">
                    {currentUser.name} (You)
                  </div>
                  <div className="text-[11px] text-on-surface-variant truncate">
                    {currentUser.role}
                  </div>
                </div>
              </div>
            )}
            {colleagues
              .filter((u) => onlineUserIds.has(u.id))
              .map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => onSwitchChat('dm', user.id)}
                  className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-surface-container cursor-pointer transition-colors group text-left"
                >
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-outline-variant">
                    <img
                      src={
                        user.avatar ||
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name}`
                      }
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 right-0 w-2 h-2 bg-secondary rounded-full border border-surface-container-low" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                      {user.name}
                    </div>
                    <div className="text-[11px] text-on-surface-variant truncate">{user.role}</div>
                  </div>
                </button>
              ))}
          </div>
        </div>

        {/* Away / Offline Members */}
        <div>
          <div className="px-3 py-1.5 text-xs font-medium text-on-surface-variant flex justify-between font-mono tabular-nums">
            <span>Offline</span>
            <span>{offlineCount}</span>
          </div>
          <div className="space-y-1 mt-1 opacity-65">
            {currentUser && !onlineUserIds.has(currentUser.id) && (
              <div className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg">
                <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 grayscale border border-outline-variant">
                  <img
                    src={
                      currentUser.avatar ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.name}`
                    }
                    alt={currentUser.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-on-surface truncate">
                    {currentUser.name} (You)
                  </div>
                  <div className="text-[11px] text-on-surface-variant truncate">Away</div>
                </div>
              </div>
            )}
            {colleagues
              .filter((u) => !onlineUserIds.has(u.id))
              .map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => onSwitchChat('dm', user.id)}
                  className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-surface-container cursor-pointer transition-colors group text-left"
                >
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 grayscale border border-outline-variant">
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
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-on-surface truncate">
                      {user.name}
                    </div>
                    <div className="text-[11px] text-on-surface-variant truncate">{user.role}</div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      </div>

      <div className="p-4 bg-surface-container border-t border-outline-variant">
        <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant flex flex-col gap-2.5">
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            Invite additional developers or reviewers to collaborate in real time.
          </p>
          <button
            type="button"
            onClick={onOpenInvite}
            className="w-full py-1.5 text-xs font-semibold bg-surface-container-highest hover:bg-primary hover:text-on-primary rounded-lg transition-colors text-on-surface cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Sparkles size={12} />
            <span>Invite Teammate</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
