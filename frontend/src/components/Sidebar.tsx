/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Home, MessageSquare, Layers, Users, Settings, HelpCircle, Plus, LogOut, Terminal, BookOpen, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { resolveAvatar } from '../utils/avatar';

interface SidebarProps {
  currentScreen: 'Dashboard' | 'Chat' | 'TaskBoard' | 'TeamDirectory' | 'Settings' | 'UserProfile' | 'Wiki';
  setScreen: (screen: 'Dashboard' | 'Chat' | 'TaskBoard' | 'TeamDirectory' | 'Settings' | 'UserProfile' | 'Wiki') => void;
  onLogout: () => void;
  onCreateProject?: () => void;
  currentUser: User | null;
  onTriggerToast: (msg: string) => void;
  isLoading?: boolean;
}

const primaryNav = [
  { id: 'Dashboard', label: 'Home', icon: Home },
  { id: 'Chat', label: 'Inbox', icon: MessageSquare },
  { id: 'TaskBoard', label: 'Projects', icon: Layers },
  { id: 'TeamDirectory', label: 'Team', icon: Users },
  { id: 'Wiki', label: 'Wiki', icon: BookOpen },
] as const;

type NavId = typeof primaryNav[number]['id'];

export default function Sidebar({
  currentScreen,
  setScreen,
  onLogout,
  onCreateProject,
  currentUser,
  onTriggerToast,
  isLoading,
}: SidebarProps) {
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const handleUserMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setUserMenuOpen(true);
  };

  const handleUserMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setUserMenuOpen(false);
    }, 250);
  };

  const userAvatar = resolveAvatar(currentUser);
  const userName = currentUser?.name || 'User';
  const userRole = currentUser?.role || 'Member';

  const statusColor =
    currentUser?.status === 'Online'
      ? 'bg-[var(--color-status-online)]'
      : currentUser?.status === 'Away'
      ? 'bg-[var(--color-status-away)]'
      : 'bg-[var(--color-status-offline)]';

  return (
    <aside className="hidden md:flex flex-col h-screen sticky top-0 bg-surface border-r border-outline-variant w-16 flex-shrink-0 z-50 items-center py-3 gap-1">

      {/* Brand Logo */}
      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary mb-3 flex-shrink-0">
        <Terminal size={20} className="stroke-[2.5]" />
      </div>

      {/* New Project Button */}
      <div className="relative group mb-2">
        <button
          onClick={onCreateProject}
          onMouseEnter={() => setTooltip('New Project')}
          onMouseLeave={() => setTooltip(null)}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary-container hover:bg-primary text-on-primary-container hover:text-on-primary transition-all duration-150 active:scale-95 cursor-pointer shadow-sm"
          title="New Project"
        >
          <Plus size={18} className="stroke-[2.5]" />
        </button>
        <AnimatePresence>
          {tooltip === 'New Project' && (
            <motion.div
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
            >
              <div className="bg-surface-container-highest border border-outline-variant text-on-surface text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
                New Project
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Divider */}
      <div className="w-8 h-px bg-outline-variant/60 my-1" />

      {/* Primary Navigation Icons */}
      <nav className="flex-1 flex flex-col items-center gap-1 w-full px-2">
        {primaryNav.map((item) => {
          const IconComponent = item.icon;
          const isActive = currentScreen === item.id;

          return (
            <div key={item.id} className="relative group w-full flex justify-center">
              <motion.button
                onClick={() => setScreen(item.id)}
                onMouseEnter={() => setTooltip(item.label)}
                onMouseLeave={() => setTooltip(null)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer relative ${
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/70'
                }`}
              >
                <IconComponent size={19} className={isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'} />
                {isActive && (
                  <motion.div
                    layoutId="activeRailPill"
                    className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
              </motion.button>

              {/* Tooltip */}
              <AnimatePresence>
                {tooltip === item.label && (
                  <motion.div
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
                  >
                    <div className="bg-surface-container-highest border border-outline-variant text-on-surface text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
                      {item.label}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="w-8 h-px bg-outline-variant/60 my-1" />

      {/* Footer Icons */}
      <div className="flex flex-col items-center gap-1 w-full px-2">
        {/* Settings */}
        <div className="relative group w-full flex justify-center">
          <motion.button
            onClick={() => setScreen('Settings')}
            onMouseEnter={() => setTooltip('Settings')}
            onMouseLeave={() => setTooltip(null)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
              currentScreen === 'Settings'
                ? 'bg-primary/15 text-primary'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/70'
            }`}
          >
            <Settings size={18} />
          </motion.button>
          <AnimatePresence>
            {tooltip === 'Settings' && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
              >
                <div className="bg-surface-container-highest border border-outline-variant text-on-surface text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
                  Settings
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Help */}
        <div className="relative group w-full flex justify-center">
          <motion.button
            onClick={() => onTriggerToast('Help & Support documentation coming soon.')}
            onMouseEnter={() => setTooltip('Help')}
            onMouseLeave={() => setTooltip(null)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/70 transition-all cursor-pointer"
          >
            <HelpCircle size={18} />
          </motion.button>
          <AnimatePresence>
            {tooltip === 'Help' && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
              >
                <div className="bg-surface-container-highest border border-outline-variant text-on-surface text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
                  Help & Support
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Avatar & Menu */}
        <div 
          ref={userMenuRef}
          onMouseEnter={handleUserMouseEnter}
          onMouseLeave={handleUserMouseLeave}
          className="relative w-full flex justify-center mt-1"
        >
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(prev => !prev)}
              title={`${userName} (${userRole})`}
              className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                currentScreen === 'UserProfile' || userMenuOpen
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-outline-variant/50 hover:border-outline-variant'
              }`}
            >
              {isLoading || !currentUser ? (
                <div className="w-full h-full bg-outline-variant/40 animate-pulse" />
              ) : (
                <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
              )}
            </button>
            {/* Status dot */}
            {currentUser && !isLoading && (
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface ${statusColor}`} />
            )}
          </div>

          {/* User Menu Card with Profile & Logout */}
          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, x: -6, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -6, scale: 0.98 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute left-full pl-2.5 bottom-0 z-50 pointer-events-auto"
              >
                <div className="bg-surface-container-highest border border-outline-variant rounded-xl shadow-2xl p-3 min-w-[180px] backdrop-blur-xl">
                  {/* User info */}
                  <div className="pb-2 mb-2 border-b border-outline-variant/30">
                    <p className="text-xs font-bold text-on-surface leading-tight truncate">{userName}</p>
                    <p className="text-[10px] text-on-surface-variant font-mono mt-0.5 truncate">{userRole}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => {
                        setScreen('UserProfile');
                        setUserMenuOpen(false);
                      }}
                      className="flex items-center gap-2 text-xs text-on-surface hover:text-primary hover:bg-surface-container-high px-2 py-1.5 rounded-lg transition-colors cursor-pointer w-full text-left"
                    >
                      <UserIcon size={14} className="text-primary" />
                      <span>Developer Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onLogout();
                      }}
                      className="flex items-center gap-2 text-xs text-error hover:bg-error/15 px-2 py-1.5 rounded-lg transition-colors font-medium cursor-pointer w-full text-left"
                    >
                      <LogOut size={14} />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}
