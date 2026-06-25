/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Search, Bell, Grid, ChevronDown } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  searchVal: string;
  setSearchVal: (val: string) => void;
  placeholderText?: string;
  onSearchFocus?: () => void;
  onProfileClick?: () => void;
  currentUser: User | null;
  onTriggerToast: (msg: string) => void;
  isLoading?: boolean;
}

export default function Header({ 
  searchVal, 
  setSearchVal, 
  placeholderText = "Search tasks, docs, or people...", 
  onSearchFocus,
  onProfileClick,
  currentUser,
  onTriggerToast,
  isLoading
}: HeaderProps) {
  const userAvatar = currentUser?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuBsJEukRni_tXEjVv7G0fDSeT8UdSi7FbwsEUT_G6tuVIEpf16JpZRuFX9Hs_FA_0RK-PWTQiP2g1AJSXjN2wZYSWekIjl_rGMrQCRBsPWph1VIOC1vPr3_SwbvqdM3wRwGCpA4zNcAQMM_1dvktJR_72kVV_mDhptUSDmvvRXTiv0oDO-9Ju9648-WKlcjbCqDzbNky2qnML21LjdnbHOHIj_N01suFnRnYph8ldj4BavqC2-ThpGIx6LcHpm2MnUPe4Vwlg";
  const userName = currentUser?.name || "Alex Rivera";
  const userRole = currentUser?.role || "Lead Developer";

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
        </div>
      </div>

      {/* Action Tray */}
      <div className="flex items-center gap-2 ml-4">
        <button 
          onClick={() => onTriggerToast("Feature coming soon: Notifications system is currently under construction.")}
          title="Notifications"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-all cursor-pointer relative"
        >
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full ring-2 ring-surface"></span>
        </button>

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
