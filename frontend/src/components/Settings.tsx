/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings as SettingsIcon, Sliders, Bell, Cpu, Shield, HelpCircle, 
  Check, Save, RefreshCw, AlertCircle, Sparkles, Key, Globe, Database 
} from 'lucide-react';

interface SettingsProps {
  onResetWorkspace?: () => void;
}

type TabType = 'general' | 'notifications' | 'security' | 'integrations';

export default function Settings({ onResetWorkspace }: SettingsProps) {
  const [activeSubTab, setActiveSubTab] = useState<TabType>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // General Settings
  const [workspaceName, setWorkspaceName] = useState('SyncForge');
  const [defaultTab, setDefaultTab] = useState<'Dashboard' | 'Chat' | 'TaskBoard'>('Dashboard');
  const [enableSound, setEnableSound] = useState(true);

  // Notification Settings
  const [notifyMentions, setNotifyMentions] = useState(true);
  const [notifyCommits, setNotifyCommits] = useState(false);
  const [notifyTasks, setNotifyTasks] = useState(true);

  // Security / Tokens Settings
  const [workspaceKey, setWorkspaceKey] = useState('sf_live_a89bc2100df3f71c42');
  const [showKey, setShowKey] = useState(false);
  const [allowedRoles, setAllowedRoles] = useState('all');

  // Integrations Settings
  const [githubSync, setGithubSync] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('https://api.syncforge.io/webhooks/v1');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 1000);
  };

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security & Access', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: Cpu },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="p-6 max-w-4xl mx-auto space-y-6 font-sans text-on-surface"
      id="settings-view"
    >
      {/* Page Title Header */}
      <div className="flex flex-col gap-1 border-b border-outline-variant/30 pb-4">
        <div className="flex items-center gap-2">
          <SettingsIcon className="text-primary w-5 h-5 animate-[spin_5s_linear_infinite]" />
          <h1 className="text-xl font-bold tracking-tight">Workspace Settings</h1>
        </div>
        <p className="text-xs text-on-surface-variant">
          Configure SyncForge environmental preferences, security keys, notification matrices, and connected hooks.
        </p>
      </div>

      {saveSuccess && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-3 bg-success/10 border border-success/20 rounded-xl flex items-center gap-2.5 text-xs text-success"
        >
          <Check size={16} className="text-success stroke-[2.5]" />
          <span>Workspace preferences have been successfully committed to memory.</span>
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
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer text-left ${
                  isActive 
                    ? 'bg-primary/10 text-primary border-l-2 border-primary' 
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <div className="h-[1px] bg-outline-variant/30 my-3"></div>

          {/* Reset Workspace Quick Action */}
          {onResetWorkspace && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to restore the workspace database to its default factory seeds? This will refresh your task board and logs.')) {
                  onResetWorkspace();
                }
              }}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold text-error/80 hover:text-error hover:bg-error/10 transition-all cursor-pointer text-left"
            >
              <Database size={15} />
              <span>Reset Database</span>
            </button>
          )}
        </div>

        {/* Dynamic settings form panel */}
        <div className="md:col-span-3">
          <form onSubmit={handleSaveSettings} className="bg-surface-container-low border border-outline-variant/40 rounded-2xl p-6 shadow-sm space-y-6">
            
            <AnimatePresence mode="wait">
              
              {/* --- GENERAL SETTINGS --- */}
              {activeSubTab === 'general' && (
                <motion.div
                  key="general-tab"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-5"
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">Workspace Preferences</h3>
                  
                  {/* Workspace Name Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-on-surface-variant">Workspace Name</label>
                    <input 
                      type="text" 
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
                    />
                  </div>

                  {/* Default Tab Landing page selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-on-surface-variant">Default Dashboard Tab</label>
                    <select 
                      value={defaultTab}
                      onChange={(e) => setDefaultTab(e.target.value as any)}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface cursor-pointer"
                    >
                      <option value="Dashboard">Home Screen (Dashboard)</option>
                      <option value="Chat">Inbox (Chat Threads)</option>
                      <option value="TaskBoard">Projects (Task Board Columns)</option>
                    </select>
                  </div>

                  {/* Sound Alerts Checkbox */}
                  <div className="flex items-center justify-between p-3.5 bg-surface-container rounded-xl border border-outline-variant/20">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-on-surface">Enable Audio Alerts</span>
                      <span className="text-[10px] text-on-surface-variant">Play compilation chime and audio cues when actions occur.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEnableSound(!enableSound)}
                      className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${enableSound ? 'bg-primary' : 'bg-outline-variant'}`}
                    >
                      <span className={`w-5 h-5 bg-surface-container rounded-full shadow-md transform transition-transform ${enableSound ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* --- NOTIFICATIONS SETTINGS --- */}
              {activeSubTab === 'notifications' && (
                <motion.div
                  key="notifications-tab"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">Notification Matrix</h3>

                  {/* Toggle 1: Mentions */}
                  <div className="flex items-center justify-between p-3 bg-surface-container rounded-xl border border-outline-variant/20">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-on-surface">Mention &amp; Ping Notifications</span>
                      <span className="text-[10px] text-on-surface-variant">Get notified instantly when someone prefixes you with @ in chat room.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotifyMentions(!notifyMentions)}
                      className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${notifyMentions ? 'bg-primary' : 'bg-outline-variant'}`}
                    >
                      <span className={`w-5 h-5 bg-surface-container rounded-full shadow-md transform transition-transform ${notifyMentions ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Toggle 2: Commit alerts */}
                  <div className="flex items-center justify-between p-3 bg-surface-container rounded-xl border border-outline-variant/20">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-on-surface">Continuous Integration commits</span>
                      <span className="text-[10px] text-on-surface-variant">Log alert in header when a build is successfully pushed to staging.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotifyCommits(!notifyCommits)}
                      className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${notifyCommits ? 'bg-primary' : 'bg-outline-variant'}`}
                    >
                      <span className={`w-5 h-5 bg-surface-container rounded-full shadow-md transform transition-transform ${notifyCommits ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Toggle 3: Task allocations */}
                  <div className="flex items-center justify-between p-3 bg-surface-container rounded-xl border border-outline-variant/20">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-on-surface">Task Assignment Alerts</span>
                      <span className="text-[10px] text-on-surface-variant">Dispatch inbox alerts on assignment to new Scrum board card.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotifyTasks(!notifyTasks)}
                      className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${notifyTasks ? 'bg-primary' : 'bg-outline-variant'}`}
                    >
                      <span className={`w-5 h-5 bg-surface-container rounded-full shadow-md transform transition-transform ${notifyTasks ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* --- SECURITY & ACCESS --- */}
              {activeSubTab === 'security' && (
                <motion.div
                  key="security-tab"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">Security Credentials</h3>

                  {/* API Key field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-on-surface-variant flex items-center gap-1">
                      <Key size={13} />
                      <span>Workspace Access Key</span>
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type={showKey ? "text" : "password"}
                        value={workspaceKey}
                        readOnly
                        className="flex-1 bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs font-mono text-on-surface"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="px-3 py-2 bg-surface-container border border-outline-variant hover:bg-surface-container-highest transition-all rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        {showKey ? "Hide" : "Reveal"}
                      </button>
                    </div>
                  </div>

                  {/* Access role setting dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-on-surface-variant">Allowed Write Roles</label>
                    <select 
                      value={allowedRoles}
                      onChange={(e) => setAllowedRoles(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none text-on-surface cursor-pointer"
                    >
                      <option value="all">Every team member (Full Collaborative mode)</option>
                      <option value="lead">Lead Developers &amp; Administrators only</option>
                      <option value="admins">Workspace owners only</option>
                    </select>
                  </div>
                </motion.div>
              )}

              {/* --- INTEGRATIONS --- */}
              {activeSubTab === 'integrations' && (
                <motion.div
                  key="integrations-tab"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">Developer Tools Integrations</h3>

                  {/* Git integration toggle */}
                  <div className="flex items-center justify-between p-3 bg-surface-container rounded-xl border border-outline-variant/20">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                        <Globe size={13} className="text-primary" />
                        <span>Continuous GitHub Integration</span>
                      </span>
                      <span className="text-[10px] text-on-surface-variant">Sync active task progression back to repository branches automatically.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGithubSync(!githubSync)}
                      className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${githubSync ? 'bg-primary' : 'bg-outline-variant'}`}
                    >
                      <span className={`w-5 h-5 bg-surface-container rounded-full shadow-md transform transition-transform ${githubSync ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Webhook endpoint */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-on-surface-variant">Webhook Payload URL</label>
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
            <div className="pt-4 border-t border-outline-variant/20 flex justify-end">
              <button 
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-primary hover:bg-primary/95 text-on-primary font-bold rounded-lg text-xs uppercase tracking-wider transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center gap-2 disabled:opacity-50"
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
    </motion.div>
  );
}
