/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Home, Inbox, Layers, Users, Settings, HelpCircle, Plus, LogOut, Terminal, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '../types';

interface SidebarProps {
  currentScreen: 'Dashboard' | 'Chat' | 'TaskBoard' | 'TeamDirectory' | 'Settings' | 'UserProfile' | 'Wiki';
  setScreen: (screen: 'Dashboard' | 'Chat' | 'TaskBoard' | 'TeamDirectory' | 'Settings' | 'UserProfile' | 'Wiki') => void;
  onLogout: () => void;
  onCreateProject?: () => void;
  currentUser: User | null;
  onTriggerToast: (msg: string) => void;
  isLoading?: boolean;
}

export default function Sidebar({ currentScreen, setScreen, onLogout, onCreateProject, currentUser, onTriggerToast, isLoading }: SidebarProps) {
  const menuItems = [
    { id: 'Dashboard', label: 'Home', icon: Home },
    { id: 'Chat', label: 'Inbox', icon: Inbox },
    { id: 'TaskBoard', label: 'Projects', icon: Layers },
    { id: 'TeamDirectory', label: 'Team', icon: Users },
    { id: 'Wiki', label: 'Wiki', icon: BookOpen },
  ] as const;

  const userAvatar = currentUser?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuBsJEukRni_tXEjVv7G0fDSeT8UdSi7FbwsEUT_G6tuVIEpf16JpZRuFX9Hs_FA_0RK-PWTQiP2g1AJSXjN2wZYSWekIjl_rGMrQCRBsPWph1VIOC1vPr3_SwbvqdM3wRwGCpA4zNcAQMM_1dvktJR_72kVV_mDhptUSDmvvRXTiv0oDO-9Ju9648-WKlcjbCqDzbNky2qnML21LjdnbHOHIj_N01suFnRnYph8ldj4BavqC2-ThpGIx6LcHpm2MnUPe4Vwlg";
  const userName = currentUser?.name || "Alex Rivera";
  const userRole = currentUser?.role || "Lead Developer";

  return (
    <aside className="flex flex-col h-screen sticky top-0 bg-surface border-r border-outline-variant w-64 flex-shrink-0 z-50">
      {/* Brand Header */}
      <div className="p-5 flex items-center gap-3">
        <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-on-primary">
          <Terminal size={20} className="stroke-[2.5]" />
        </div>
        <div className="flex flex-col">
          <span className="font-headline-md text-lg font-bold text-on-surface leading-none tracking-tight">SyncForge</span>
          <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mt-1">Engineering Team</span>
        </div>
      </div>

      {/* Action Button */}
      <div className="px-4 mt-2 mb-6">
        <button 
          onClick={onCreateProject}
          className="w-full py-2.5 px-4 bg-primary-container hover:bg-primary-container/90 text-on-primary-container font-bold rounded-lg flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all duration-150 active:scale-[0.98] cursor-pointer shadow-sm"
        >
          <Plus size={16} className="stroke-[2.5]" />
          <span>New Project</span>
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-2 space-y-1">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = currentScreen === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all text-sm font-medium relative group cursor-pointer ${
                isActive
                  ? 'text-primary font-bold bg-surface-container-high border-r-2 border-primary'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60'
              }`}
            >
              <IconComponent 
                size={18} 
                className={`transition-colors ${isActive ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'}`} 
              />
              <span>{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute right-0 top-0 bottom-0 w-0.5 bg-primary"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / User Profile Area */}
      <div className="mt-auto border-t border-outline-variant p-2 space-y-1">
        <button 
          onClick={() => setScreen('Settings')}
          className={`w-full flex items-center gap-4 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${
            currentScreen === 'Settings'
              ? 'text-primary font-bold bg-surface-container-high border-r-2 border-primary'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60'
          }`}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>
        <button 
          onClick={() => onTriggerToast("Feature coming soon: Help & Support documentation library.")}
          className="w-full flex items-center gap-4 px-4 py-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60 transition-colors text-sm font-medium cursor-pointer"
        >
          <HelpCircle size={18} />
          <span>Help &amp; Support</span>
        </button>

        {/* User Card */}
        <div className={`flex items-center justify-between gap-2 p-3 mt-2 rounded-xl border transition-all ${
          currentScreen === 'UserProfile'
            ? 'bg-primary/5 border-primary/40'
            : 'bg-surface-container-low/50 border-outline-variant/30 hover:border-outline-variant/70'
        }`}>
          <button 
            onClick={() => setScreen('UserProfile')}
            className="flex items-center gap-3 overflow-hidden text-left cursor-pointer flex-1 min-w-0"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/50 flex-shrink-0 bg-surface-container-highest">
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
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-bold text-on-surface truncate">{userName}</p>
              <p className="text-[10px] text-on-surface-variant truncate font-mono">{userRole}</p>
            </div>
          </button>
          
          <button 
            onClick={() => {
              if (window.confirm("Are you sure you want to sign out?")) {
                onLogout();
              }
            }}
            title="Sign Out"
            className="p-1.5 hover:bg-error/10 rounded-lg text-on-surface-variant hover:text-error transition-all cursor-pointer flex-shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
