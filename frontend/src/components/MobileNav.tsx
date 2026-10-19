import React from 'react';
import { Home, MessageSquare, Layers, Users, BookOpen, Settings } from 'lucide-react';

type ScreenId = 'Dashboard' | 'Chat' | 'TaskBoard' | 'TeamDirectory' | 'Settings' | 'UserProfile' | 'Wiki';

interface MobileNavProps {
  currentScreen: ScreenId;
  setScreen: (screen: ScreenId) => void;
}

const navItems: { id: ScreenId; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'Dashboard', label: 'Home', icon: Home },
  { id: 'Chat', label: 'Inbox', icon: MessageSquare },
  { id: 'TaskBoard', label: 'Board', icon: Layers },
  { id: 'TeamDirectory', label: 'Team', icon: Users },
  { id: 'Wiki', label: 'Wiki', icon: BookOpen },
  { id: 'Settings', label: 'Settings', icon: Settings },
];

export default function MobileNav({ currentScreen, setScreen }: MobileNavProps) {
  return (
    <nav
      aria-label="Mobile workspace navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-surface-container-low/95 backdrop-blur-md border-t border-outline-variant z-50 flex items-center justify-around px-2"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentScreen === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setScreen(item.id)}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isActive
                ? 'text-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Icon size={17} className={isActive ? 'stroke-[2.25]' : 'stroke-[1.75]'} />
            <span className="text-[10px] leading-none">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
