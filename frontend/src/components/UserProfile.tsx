/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield, Mail, Terminal, Award, Check, RefreshCw, AlertCircle, Sparkles, Image, CheckCircle } from 'lucide-react';
import { User } from '../types';
import { createUser } from '../api';

interface UserProfileProps {
  currentUser: User | null;
  onUpdateUser: (updatedUser: User) => void;
}

export default function UserProfile({ currentUser, onUpdateUser }: UserProfileProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<'Online' | 'Offline' | 'Away'>('Online');
  const [avatar, setAvatar] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Sync state with prop when loaded
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setEmail(currentUser.email);
      setRole(currentUser.role);
      setStatus(currentUser.status);
      setAvatar(currentUser.avatar);
    }
  }, [currentUser]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError("Please select a valid image file.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const cloudName = (import.meta as any).env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = (import.meta as any).env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      setUploadError("Cloudinary configurations are missing in .env.");
      setIsUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image to Cloudinary.");
      }

      const data = await response.json();
      const imageUrl = data.secure_url;

      // Update local avatar state immediately
      setAvatar(imageUrl);

      const token = localStorage.getItem('token');
      const apiResponse = await fetch(`/api/users/${currentUser.id}/avatar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ avatarUrl: imageUrl }),
      });

      if (!apiResponse.ok) {
        throw new Error("Failed to save avatar update to database.");
      }

      // Update App state
      const updatedUserResult: User = {
        ...currentUser,
        avatar: imageUrl,
      };
      onUpdateUser(updatedUserResult);
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "Failed to upload avatar.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-[80vh] text-on-surface-variant font-sans gap-2">
        <RefreshCw size={20} className="animate-spin text-primary" />
        <span>Loading developer profile details...</span>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name cannot be empty.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const updated: User = {
        ...currentUser,
        name: name.trim(),
        email: email.trim(),
        role: role.trim(),
        status,
        avatar: avatar.trim(),
      };

      const result = await createUser(updated);
      onUpdateUser(result);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError('Could not sync updates to server database. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="p-6 max-w-4xl mx-auto space-y-6 font-sans text-on-surface"
      id="user-profile-view"
    >
      {/* Page Header */}
      <div className="flex flex-col gap-1 border-b border-outline-variant/30 pb-4">
        <div className="flex items-center gap-2">
          <Shield className="text-primary w-5 h-5" />
          <h1 className="text-xl font-bold tracking-tight">Developer Profile</h1>
        </div>
        <p className="text-xs text-on-surface-variant">
          Manage your development credentials, status, and engineering statistics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile Card & Stats Left Panel */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-surface-container-low border border-outline-variant/40 rounded-2xl p-5 flex flex-col items-center text-center shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary"></div>
            
            {/* Avatar block */}
            <div className="relative group mt-3">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary/40 p-1 bg-surface-container shadow-inner">
                <img 
                  src={avatar || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBsJEukRni_tXEjVv7G0fDSeT8UdSi7FbwsEUT_G6tuVIEpf16JpZRuFX9Hs_FA_0RK-PWTQiP2g1AJSXjN2wZYSWekIjl_rGMrQCRBsPWph1VIOC1vPr3_SwbvqdM3wRwGCpA4zNcAQMM_1dvktKD0ktJR_72kVV_mDhptUSDmvvRXTiv0oDO-9Ju9648-WKlcjbCqDzbNky2qnML21LjdnbHOHIj_N01suFnRnYph8ldj4BavqC2-ThpGIx6LcHpm2MnUPe4Vwlg'} 
                  alt={name} 
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBsJEukRni_tXEjVv7G0fDSeT8UdSi7FbwsEUT_G6tuVIEpf16JpZRuFX9Hs_FA_0RK-PWTQiP2g1AJSXjN2wZYSWekIjl_rGMrQCRBsPWph1VIOC1vPr3_SwbvqdM3wRwGCpA4zNcAQMM_1dvktKD0ktJR_72kVV_mDhptUSDmvvRXTiv0oDO-9Ju9648-WKlcjbCqDzbNky2qnML21LjdnbHOHIj_N01suFnRnYph8ldj4BavqC2-ThpGIx6LcHpm2MnUPe4Vwlg';
                  }}
                />
              </div>
              <span className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-surface-container-low ${
                status === 'Online' ? 'bg-success' : status === 'Away' ? 'bg-warning' : 'bg-outline'
              }`} />
            </div>

            {/* Upload Button */}
            <div className="mt-3 flex flex-col items-center gap-1.5 w-full">
              <label 
                htmlFor="avatar-upload-input"
                className={`flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/60 rounded-lg text-[10px] font-bold uppercase tracking-wider text-on-surface hover:text-primary transition-all cursor-pointer shadow-sm ${
                  isUploading ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {isUploading ? (
                  <>
                    <RefreshCw size={12} className="animate-spin text-primary" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Image size={12} />
                    <span>Upload New Avatar</span>
                  </>
                )}
              </label>
              <input 
                id="avatar-upload-input"
                type="file" 
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={isUploading}
                className="hidden"
              />
              {uploadError && (
                <p className="text-[9px] text-error font-medium leading-normal mt-1 max-w-[180px]">
                  {uploadError}
                </p>
              )}
            </div>

            <h2 className="text-base font-bold mt-4 leading-tight">{name || 'Developer Name'}</h2>
            <p className="text-xs text-primary font-medium mt-1 font-mono">{role || 'Engineering Member'}</p>
            <p className="text-[10px] text-on-surface-variant/80 mt-1 flex items-center gap-1">
              <Mail size={12} />
              <span>{email || 'developer@syncforge.io'}</span>
            </p>

            <div className="w-full h-[1px] bg-outline-variant/30 my-4"></div>

            {/* Proficiency progress */}
            <div className="w-full space-y-1.5 text-left">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">
                <span>Forge Proficiency</span>
                <span className="font-mono text-primary">{currentUser.proficiency}%</span>
              </div>
              <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500" 
                  style={{ width: `${currentUser.proficiency}%` }}
                />
              </div>
            </div>
          </div>

          {/* Productivity Stats Grid */}
          <div className="bg-surface-container-low border border-outline-variant/40 rounded-2xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
              <Award size={14} className="text-secondary" />
              <span>Workspace Stats</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/20 flex flex-col justify-center">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Commits</span>
                <span className="text-lg font-bold font-mono text-on-surface mt-1">{currentUser.commits}</span>
              </div>
              <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/20 flex flex-col justify-center">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Code Reviews</span>
                <span className="text-lg font-bold font-mono text-on-surface mt-1">{currentUser.reviews}</span>
              </div>
            </div>

            <div className="p-3.5 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-2.5">
              <Sparkles className="text-primary w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="text-[11px] leading-relaxed text-on-surface-variant">
                <strong className="text-on-surface font-semibold">Seniority Status:</strong> You are ranked in the top <span className="text-primary font-semibold font-mono">5%</span> of contributors for the active sprint compiler index.
              </div>
            </div>
          </div>

        </div>

        {/* Profile Settings Form Area */}
        <div className="md:col-span-2">
          <form onSubmit={handleSave} className="bg-surface-container-low border border-outline-variant/40 rounded-2xl p-6 shadow-sm space-y-6">
            <h3 className="text-sm font-semibold tracking-tight border-b border-outline-variant/20 pb-3 flex items-center gap-2">
              <Terminal size={16} className="text-primary" />
              <span>Edit Credentials</span>
            </h3>

            {error && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-xl flex items-start gap-2.5 text-xs text-error">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="p-3 bg-success/10 border border-success/20 rounded-xl flex items-start gap-2.5 text-xs text-success">
                <CheckCircle size={15} className="mt-0.5 flex-shrink-0" />
                <span>Developer profile has been successfully saved to the server!</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Full Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. alex.r@syncforge.io"
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
                />
              </div>

              {/* Role Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Role / Position</label>
                <input 
                  type="text" 
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Lead Software Engineer"
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
                />
              </div>

              {/* Status Switcher */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Active Status</label>
                <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface cursor-pointer"
                >
                  <option value="Online">🟢 Online (Active in IDE)</option>
                  <option value="Away">🟡 Away (Be back soon)</option>
                  <option value="Offline">⚫ Offline (DND / Sleeping)</option>
                </select>
              </div>

            </div>

            {/* Avatar URL Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant flex items-center gap-1">
                <Image size={13} />
                <span>Profile Avatar Image URL</span>
              </label>
              <input 
                type="url" 
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="https://..."
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
              />
              <p className="text-[10px] text-on-surface-variant/80">
                Provide any valid secure web image URL to customize your representative avatar across chat boards, tasks, and commits.
              </p>
            </div>

            <div className="pt-2 border-t border-outline-variant/20 flex justify-end">
              <button 
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-primary hover:bg-primary/95 text-on-primary font-bold rounded-lg text-xs uppercase tracking-wider transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Synchronizing...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} className="stroke-[2.5]" />
                    <span>Save Profile Changes</span>
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
