/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings as SettingsIcon,
  Sliders,
  Bell,
  Cpu,
  Shield,
  Palette,
  Check,
  Save,
  RefreshCw,
  Key,
  Globe,
  Database,
} from 'lucide-react';
import {
  ACCENT_PRESETS,
  AccentThemeId,
  applyAccentTheme,
  getStoredAccentTheme,
} from '../utils/theme';
import Dialog from './ui/Dialog';

interface SettingsProps {
  onResetWorkspace?: () => void;
  onTriggerToast?: (msg: string) => void;
}

type TabType = 'appearance' | 'general' | 'notifications' | 'security' | 'integrations';

export default function Settings({ onResetWorkspace, onTriggerToast }: SettingsProps) {
  const [activeSubTab, setActiveSubTab] = useState<TabType>('appearance');
  const [selectedAccent, setSelectedAccent] = useState<AccentThemeId>(() => getStoredAccentTheme());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // General Settings
  const [workspaceName, setWorkspaceName] = useState('SyncForge');
  const [defaultTab, setDefaultTab] = useState<'Dashboard' | 'Chat' | 'TaskBoard'>('Dashboard');
  const [enableSound, setEnableSound] = useState(true);

  // Notification Settings
  const [notifyMentions, setNotifyMentions] = useState(true);
  const [notifyCommits, setNotifyCommits] = useState(false);
  const [notifyTasks, setNotifyTasks] = useState(true);

  // Security / Tokens Settings
  const [workspaceKey] = useState('sf_live_a89bc2100df3f71c42');
  const [showKey, setShowKey] = useState(false);
  const [allowedRoles, setAllowedRoles] = useState('all');

  // Integrations Settings
  const [githubSync, setGithubSync] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('https://api.syncforge.io/webhooks/v1');

  useEffect(() => {
    setSelectedAccent(getStoredAccentTheme());
  }, []);

  const handleSelectAccent = (themeId: AccentThemeId) => {
    const applied = applyAccentTheme(themeId);
    setSelectedAccent(applied.id);
    if (onTriggerToast) {
      onTriggerToast(`Theme updated to ${applied.name}.`);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      if (onTriggerToast) {
        onTriggerToast('Workspace preferences saved.');
      }
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 400);
  };

  const tabs: { id: TabType; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: 'appearance', label: 'Appearance & Theme', icon: Palette },
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security & Access', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: Cpu },
  ];

  const activeThemeObj = ACCENT_PRESETS[selectedAccent] || ACCENT_PRESETS.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="p-6 pb-20 md:pb-8 max-w-5xl mx-auto space-y-6 font-sans text-on-surface"
      id="settings-view"
    >
      {/* Page Title Header */}
      <div className="flex flex-col gap-1 border-b border-outline-variant pb-4">
        <div className="flex items-center gap-2">
          <SettingsIcon className="text-primary w-5 h-5" />
          <h1 className="text-xl font-bold tracking-tight">Workspace Settings</h1>
        </div>
        <p className="text-xs text-on-surface-variant">
          Customize your workspace accent theme, notification preferences, access rules, and developer integrations.
        </p>
      </div>

      {saveSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-secondary/10 border border-secondary/30 rounded-xl flex items-center gap-2.5 text-xs text-secondary"
        >
          <Check size={15} className="stroke-[2.5]" />
          <span>Workspace preferences saved.</span>
        </motion.div>
      )}

      {/* Main Settings Panel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Navigation Tabs List */}
        <div className="md:col-span-1 flex flex-col gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left whitespace-nowrap ${
                  isActive
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60 border border-transparent'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <div className="h-px bg-outline-variant my-3" />

          {onResetWorkspace && (
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold text-error hover:bg-error/10 transition-colors cursor-pointer text-left whitespace-nowrap"
            >
              <Database size={15} />
              <span>Reset Database</span>
            </button>
          )}
        </div>

        {/* Dynamic settings form panel */}
        <div className="md:col-span-3">
          <form
            onSubmit={handleSaveSettings}
            className="bg-surface-container-low border border-outline-variant rounded-xl p-6 space-y-6"
          >
            <AnimatePresence mode="wait">
              {/* --- APPEARANCE & THEME --- */}
              {activeSubTab === 'appearance' && (
                <motion.div
                  key="appearance-tab"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-on-surface">Accent Color Palette</h3>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Select your preferred accent color. SyncForge automatically computes WCAG AA button contrast, hover luminance, and subtle surface tinting.
                    </p>
                  </div>

                  {/* 4-Preset Swatch Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {(Object.keys(ACCENT_PRESETS) as AccentThemeId[]).map((presetKey) => {
                      const preset = ACCENT_PRESETS[presetKey];
                      const isSelected = selectedAccent === preset.id;

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectAccent(preset.id)}
                          className={`group flex flex-col justify-between p-4 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-surface-container border-primary ring-1 ring-primary'
                              : 'bg-surface-container-lowest/60 border-outline-variant hover:border-outline'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 w-full">
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm border border-white/10"
                                style={{
                                  backgroundColor: preset.primary,
                                  color: preset.onPrimary,
                                }}
                              >
                                {isSelected && <Check size={14} className="stroke-[2.5]" />}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-on-surface truncate">
                                  {preset.name}
                                </div>
                                <div className="text-[11px] font-mono text-on-surface-variant tabular-nums">
                                  {preset.primary}
                                </div>
                              </div>
                            </div>

                            {isSelected && (
                              <span className="text-[11px] font-mono text-primary font-semibold shrink-0">
                                Active
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-on-surface-variant mt-3 leading-relaxed">
                            {preset.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Live Token Preview Strip */}
                  <div className="p-4 rounded-xl bg-surface-container border border-outline-variant space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-on-surface">
                        Live Token Preview · {activeThemeObj.name}
                      </span>
                      <span className="text-[11px] font-mono text-on-surface-variant tabular-nums">
                        Ink: {activeThemeObj.onPrimary}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <span className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold whitespace-nowrap">
                        Primary Action Button
                      </span>
                      <span className="px-3.5 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-medium whitespace-nowrap">
                        Active Filter State
                      </span>
                      <span className="text-xs font-mono text-primary tabular-nums">
                        @gemini · 99.8% Uptime
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --- GENERAL SETTINGS --- */}
              {activeSubTab === 'general' && (
                <motion.div
                  key="general-tab"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-5"
                >
                  <h3 className="text-sm font-semibold text-on-surface">Workspace Preferences</h3>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-on-surface-variant">Workspace Name</label>
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-on-surface-variant">Default Startup View</label>
                    <select
                      value={defaultTab}
                      onChange={(e) => setDefaultTab(e.target.value as 'Dashboard' | 'Chat' | 'TaskBoard')}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface cursor-pointer"
                    >
                      <option value="Dashboard">Home Screen (Dashboard)</option>
                      <option value="Chat">Inbox (Chat Threads)</option>
                      <option value="TaskBoard">Projects (Kanban Board)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-surface-container rounded-xl border border-outline-variant">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-on-surface">Enable Audio Cues</span>
                      <span className="text-[11px] text-on-surface-variant">
                        Play subtle sound notifications when builds complete or messages arrive.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEnableSound(!enableSound)}
                      className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                        enableSound ? 'bg-primary' : 'bg-outline-variant'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 bg-surface-container rounded-full shadow-md transform transition-transform ${
                          enableSound ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* --- NOTIFICATIONS SETTINGS --- */}
              {activeSubTab === 'notifications' && (
                <motion.div
                  key="notifications-tab"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <h3 className="text-sm font-semibold text-on-surface">Notification Preferences</h3>

                  <div className="flex items-center justify-between p-3.5 bg-surface-container rounded-xl border border-outline-variant">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-on-surface">Direct Mentions (@username)</span>
                      <span className="text-[11px] text-on-surface-variant">
                        Notify immediately when a teammate mentions you in a channel or thread.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotifyMentions(!notifyMentions)}
                      className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                        notifyMentions ? 'bg-primary' : 'bg-outline-variant'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 bg-surface-container rounded-full shadow-md transform transition-transform ${
                          notifyMentions ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-surface-container rounded-xl border border-outline-variant">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-on-surface">Repository Commit Activity</span>
                      <span className="text-[11px] text-on-surface-variant">
                        Display header notifications when commits are pushed to tracked branches.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotifyCommits(!notifyCommits)}
                      className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                        notifyCommits ? 'bg-primary' : 'bg-outline-variant'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 bg-surface-container rounded-full shadow-md transform transition-transform ${
                          notifyCommits ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-surface-container rounded-xl border border-outline-variant">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-on-surface">Kanban Task Assignments</span>
                      <span className="text-[11px] text-on-surface-variant">
                        Alert when a new task card is assigned to you or moves to Review.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotifyTasks(!notifyTasks)}
                      className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                        notifyTasks ? 'bg-primary' : 'bg-outline-variant'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 bg-surface-container rounded-full shadow-md transform transition-transform ${
                          notifyTasks ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* --- SECURITY & ACCESS --- */}
              {activeSubTab === 'security' && (
                <motion.div
                  key="security-tab"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <h3 className="text-sm font-semibold text-on-surface">Security & Access</h3>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
                      <Key size={13} />
                      <span>Workspace Webhook Token</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={workspaceKey}
                        readOnly
                        className="flex-1 bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs font-mono text-on-surface"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="px-3.5 py-2 bg-surface-container border border-outline-variant hover:bg-surface-container-highest transition-colors rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        {showKey ? 'Hide' : 'Reveal'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-on-surface-variant">Board Write Permissions</label>
                    <select
                      value={allowedRoles}
                      onChange={(e) => setAllowedRoles(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none text-on-surface cursor-pointer"
                    >
                      <option value="all">All workspace members (Collaborative)</option>
                      <option value="lead">Lead Developers &amp; Administrators only</option>
                      <option value="admins">Administrators only</option>
                    </select>
                  </div>
                </motion.div>
              )}

              {/* --- INTEGRATIONS --- */}
              {activeSubTab === 'integrations' && (
                <motion.div
                  key="integrations-tab"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <h3 className="text-sm font-semibold text-on-surface">Developer Integrations</h3>

                  <div className="flex items-center justify-between p-3.5 bg-surface-container rounded-xl border border-outline-variant">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                        <Globe size={13} className="text-primary" />
                        <span>GitHub Branch Sync</span>
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        Link task IDs (e.g. SF-104) to pull requests and commit status checks.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGithubSync(!githubSync)}
                      className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                        githubSync ? 'bg-primary' : 'bg-outline-variant'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 bg-surface-container rounded-full shadow-md transform transition-transform ${
                          githubSync ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-on-surface-variant">Outbound Webhook Endpoint</label>
                    <input
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs font-mono focus:outline-none text-on-surface"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form Footer Action */}
            <div className="pt-4 border-t border-outline-variant flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-lg text-xs transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Save Preferences</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Reset Database Confirmation Modal */}
      <Dialog
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title="Reset Workspace Database?"
        subtitle="This restores all tasks, channels, and logs back to default seeds."
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Any custom tasks or messages created during this session will be replaced with the initial workspace seed data.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setConfirmResetOpen(false)}
              className="px-4 py-2 bg-surface-container border border-outline-variant hover:border-outline text-on-surface text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmResetOpen(false);
                onResetWorkspace?.();
              }}
              className="px-4 py-2 bg-error text-on-error text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
            >
              Reset Database
            </button>
          </div>
        </div>
      </Dialog>
    </motion.div>
  );
}
