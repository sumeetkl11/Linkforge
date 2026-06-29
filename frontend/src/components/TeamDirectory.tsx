/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserPlus, GitCommit, CheckCircle, Award, Shield, X, Mail, Sparkles, Activity, Star, MoreVertical } from 'lucide-react';
import { User } from '../types';
import { USERS } from '../data';
import { banUser, deleteUser, fetchUsers, sendInviteEmail, updateUserAsAdmin } from '../api';

interface TeamDirectoryProps {
  searchVal: string;
  currentUser: User | null;
}

export default function TeamDirectory({ searchVal, currentUser }: TeamDirectoryProps) {
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('Frontend Developer');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [manageName, setManageName] = useState('');
  const [manageEmail, setManageEmail] = useState('');
  const [manageRole, setManageRole] = useState('');
  const [manageStatus, setManageStatus] = useState<User['status']>('Offline');
  const [manageError, setManageError] = useState<string | null>(null);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [isDeletingMember, setIsDeletingMember] = useState(false);
  const [isBanningMember, setIsBanningMember] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [actionMenuPosition, setActionMenuPosition] = useState({ top: 0, left: 0 });
  const isAdmin = currentUser?.role === 'Admin';

  const roleOptions = [
    'Admin',
    'Lead Developer',
    'Senior Developer',
    'Frontend Developer',
    'Backend Developer',
    'Lead Product Designer',
    'DevOps Engineer',
    'Product Manager',
    'Developer'
  ];

  useEffect(() => {
    fetchUsers(currentUser?.id)
      .then(users => {
        const filtered = users.filter(u => u.id !== currentUser?.id);
        setTeamMembers(filtered);
        if (filtered.length > 0) {
          setSelectedMember(filtered[0]);
        }
      })
      .catch(err => {
        console.error('Failed to load colleagues:', err);
        const staticUsers = Object.values(USERS).filter(u => u.id !== currentUser?.id);
        setTeamMembers(staticUsers);
        if (staticUsers.length > 0) {
          setSelectedMember(staticUsers[0]);
        }
      });
  }, [currentUser]);

  useEffect(() => {
    if (!openActionMenuId) return;

    const closeMenu = () => setOpenActionMenuId(null);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);

    return () => {
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [openActionMenuId]);

  // Filter members based on searchVal
  const filteredMembers = teamMembers.filter(member => 
    member.name.toLowerCase().includes(searchVal.toLowerCase()) ||
    member.role.toLowerCase().includes(searchVal.toLowerCase()) ||
    member.email.toLowerCase().includes(searchVal.toLowerCase())
  );
  const activeActionMember = teamMembers.find(member => member.id === openActionMenuId) || null;

  const openManageMember = (member: User) => {
    if (!isAdmin) return;
    setSelectedMember(member);
    setManageName(member.name);
    setManageEmail(member.email);
    setManageRole(member.role || 'Developer');
    setManageStatus(member.status || 'Offline');
    setManageError(null);
    setShowManageModal(true);
    setOpenActionMenuId(null);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || isSavingMember) return;
    if (!isAdmin) {
      setManageError('Only admins can manage users.');
      return;
    }

    const cleanName = manageName.trim();
    const cleanEmail = manageEmail.trim().toLowerCase();
    if (!cleanName || !cleanEmail) {
      setManageError('Name and email are required.');
      return;
    }

    setManageError(null);
    setIsSavingMember(true);

    const updatedMember: User = {
      ...selectedMember,
      name: cleanName,
      email: cleanEmail,
      role: manageRole.trim() || 'Developer',
      status: manageStatus
    };

    try {
      const savedMember = await updateUserAsAdmin(updatedMember);
      setTeamMembers(prev => prev.map(member => (
        member.id === savedMember.id ? savedMember : member
      )));
      setSelectedMember(savedMember);
      setShowManageModal(false);
    } catch (err) {
      console.error('Failed to update teammate:', err);
      setManageError((err as Error).message || 'Could not save this teammate. Check the backend/database connection and try again.');
    } finally {
      setIsSavingMember(false);
    }
  };

  const removeMemberFromList = (memberId: string) => {
    setTeamMembers(prev => {
      const nextMembers = prev.filter(member => member.id !== memberId);
      setSelectedMember(current => (
        current?.id === memberId ? (nextMembers[0] || null) : current
      ));
      return nextMembers;
    });
    setShowManageModal(false);
  };

  const handleMakeAdmin = async (member: User = selectedMember as User) => {
    if (!member || isSavingMember) return;
    if (!isAdmin) {
      setManageError('Only admins can manage users.');
      return;
    }
    setManageError(null);
    setIsSavingMember(true);

    try {
      const savedMember = await updateUserAsAdmin({ ...member, role: 'Admin' });
      setTeamMembers(prev => prev.map(item => (
        item.id === savedMember.id ? savedMember : item
      )));
      setSelectedMember(savedMember);
      setManageRole('Admin');
      setOpenActionMenuId(null);
    } catch (err) {
      console.error('Failed to make teammate admin:', err);
      setManageError((err as Error).message || 'Could not make this teammate an admin.');
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleDeleteMember = async (member: User = selectedMember as User) => {
    if (!member || isDeletingMember) return;
    if (!isAdmin) {
      setManageError('Only admins can manage users.');
      return;
    }
    const confirmed = window.confirm(`Delete ${member.name} from the team? This removes the user but does not ban their email.`);
    if (!confirmed) return;

    setManageError(null);
    setIsDeletingMember(true);

    try {
      await deleteUser(member.id);
      removeMemberFromList(member.id);
      setOpenActionMenuId(null);
    } catch (err) {
      console.error('Failed to delete teammate:', err);
      setManageError((err as Error).message || 'Could not delete this teammate.');
    } finally {
      setIsDeletingMember(false);
    }
  };

  const handleBanMember = async (
    member: User = selectedMember as User,
    banType: 'shadow' | 'permanent' = 'permanent',
    durationDays?: number
  ) => {
    if (!member || isBanningMember) return;
    if (!isAdmin) {
      setManageError('Only admins can manage users.');
      return;
    }
    const label = banType === 'shadow' ? `shadow ban ${member.email} for ${durationDays || 7} days` : `permanently ban ${member.email}`;
    const confirmed = window.confirm(`Confirm ${label}? This removes the user and blocks this email from login, invites, and being re-added${banType === 'shadow' ? ' until the ban expires' : ''}.`);
    if (!confirmed) return;

    setManageError(null);
    setIsBanningMember(true);

    try {
      await banUser(
        member.id,
        banType === 'shadow' ? `Shadow banned for ${durationDays || 7} days` : 'Permanently banned from Team Directory',
        { banType, durationDays }
      );
      removeMemberFromList(member.id);
      setOpenActionMenuId(null);
    } catch (err) {
      console.error('Failed to ban teammate:', err);
      setManageError((err as Error).message || 'Could not ban this teammate.');
    } finally {
      setIsBanningMember(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setInviteError('Only admins can invite users.');
      return;
    }
    const cleanEmail = inviteEmail.trim().toLowerCase();
    const cleanName = inviteName.trim();
    if (!cleanEmail || !cleanName || isInviting) return;

    setInviteError(null);
    setIsInviting(true);

    const newTeammate: User = {
      id: `u-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      role: inviteRole,
      status: 'Offline',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpTGNjAHl-U2LMIfDUZbXqbsqcWrtfYRQKRG9LhdNiORyE7TXhfIMXxUGlWNaSa5OJvaBgsJnfnB0xL1VuTe_i3lGTSh4nq-N5pSjRkIReQ993dVejAWBBIeHWXELy4g5tCQDyH3fJQTVQCdSxFRjjNz4Mu5fH__70tSpdmqUQgBUy4JZRFystiSb6mebMda75gD7NXsF948RMwuWygRHSvhFYHj7ibALAnoRMQdkCXu_h2GzKZc_EakaK5kFtdKl7pTuX_1Hj_sE', // Default avatar
      commits: 0,
      reviews: 0,
      proficiency: 50,
    };

    try {
      const savedTeammate = await sendInviteEmail(newTeammate);
      setTeamMembers(prev => {
        const withoutDuplicate = prev.filter(member => member.email.toLowerCase() !== savedTeammate.email.toLowerCase());
        return [...withoutDuplicate, savedTeammate];
      });
      setSelectedMember(savedTeammate);
      setInviteEmail('');
      setInviteName('');
      setShowInviteModal(false);
    } catch (err) {
      console.error('Failed to invite teammate:', err);
      setInviteError((err as Error).message || 'Could not send this invite. Check the backend/email configuration and try again.');
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
      
      {/* Directory Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <span className="text-[10px] font-bold text-primary tracking-widest uppercase font-mono">SyncForge Team Directory</span>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight mt-1 font-sans">Engineering Directory</h1>
        </div>

        {isAdmin && (
          <button 
            onClick={() => {
              setInviteError(null);
              setShowInviteModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-lg active:scale-[0.98] cursor-pointer"
          >
            <UserPlus size={14} className="stroke-[2.5]" />
            <span>Invite Member</span>
          </button>
        )}
      </div>

      {/* Grid Layout: Columns directory list (left) & Active profile details (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Team Members List Table Grid (8-cols) */}
        <div className="lg:col-span-8 glass-panel rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low/30">
            <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface">Colleagues List ({filteredMembers.length})</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/60 text-[10px] font-bold uppercase tracking-widest text-outline bg-surface-container/10">
                  <th className="px-6 py-3.5">Member</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5 hidden md:table-cell">Commits</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40 text-xs">
                {filteredMembers.map((member) => (
                  <tr 
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    className={`hover:bg-surface-container/30 transition-all cursor-pointer ${
                      selectedMember?.id === member.id ? 'bg-surface-container/50' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg overflow-hidden border border-outline-variant/30 flex-shrink-0">
                          <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-bold text-on-surface text-xs hover:text-primary transition-colors">{member.name}</p>
                          <p className="text-[10px] text-on-surface-variant/80 font-mono mt-0.5">{member.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        member.status === 'Online' 
                          ? 'bg-secondary/10 text-secondary border border-secondary/20' 
                          : member.status === 'Away'
                          ? 'bg-tertiary/10 text-tertiary border border-tertiary/20'
                          : 'bg-surface-container-highest/60 text-outline-variant border border-outline-variant/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          member.status === 'Online' ? 'bg-secondary' : member.status === 'Away' ? 'bg-tertiary' : 'bg-outline'
                        }`} />
                        <span>{member.status}</span>
                      </span>
                    </td>

                    <td className="px-6 py-4 text-on-surface font-sans font-medium">{member.role}</td>
                    
                    <td className="px-6 py-4 hidden md:table-cell font-mono text-primary font-bold">{member.commits}</td>

                    <td className="px-6 py-4 text-right relative">
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const menuWidth = 192;
                            const menuHeight = 260;
                            const gap = 8;
                            const left = Math.min(
                              window.innerWidth - menuWidth - 12,
                              Math.max(12, rect.right - menuWidth)
                            );
                            const top = rect.bottom + menuHeight + gap > window.innerHeight
                              ? Math.max(12, rect.top - menuHeight - gap)
                              : rect.bottom + gap;
                            setActionMenuPosition({ top, left });
                            setOpenActionMenuId(prev => prev === member.id ? null : member.id);
                          }}
                          className="relative z-10 inline-flex items-center justify-center w-9 h-9 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
                          title="User actions"
                        >
                          <MoreVertical size={16} />
                        </button>
                      ) : (
                        <span className="text-[10px] text-outline-variant">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Member Profile Card Details (4-cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {selectedMember ? (
              <motion.div 
                key={selectedMember.id}
                initial={{ opacity: 0, scale: 0.98, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 5 }}
                className="glass-panel rounded-xl overflow-hidden flex flex-col p-6 space-y-6"
              >
                {/* Profile Header */}
                <div className="flex flex-col items-center text-center space-y-3 pb-4 border-b border-outline-variant/40">
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/40 shadow-xl">
                    <img src={selectedMember.avatar} alt={selectedMember.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-on-surface leading-tight font-sans">{selectedMember.name}</h3>
                    <p className="text-xs text-primary font-mono mt-1 font-medium">{selectedMember.role}</p>
                    <p className="text-[10px] text-on-surface-variant font-mono mt-1 leading-none">{selectedMember.email}</p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => openManageMember(selectedMember)}
                      className="mt-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/15 border border-primary/30 rounded-lg text-[10px] font-bold uppercase tracking-wider text-primary transition-all cursor-pointer"
                    >
                      Manage User
                    </button>
                  )}
                </div>

                {/* Key Metrics statistics counters */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 text-center">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">Total Commits</div>
                    <div className="text-lg font-bold text-on-surface font-mono mt-1 flex items-center justify-center gap-1.5">
                      <GitCommit size={15} className="text-primary" />
                      <span>{selectedMember.commits}</span>
                    </div>
                  </div>
                  <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 text-center">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">Code Reviews</div>
                    <div className="text-lg font-bold text-on-surface font-mono mt-1 flex items-center justify-center gap-1.5">
                      <CheckCircle size={15} className="text-secondary" />
                      <span>{selectedMember.reviews}</span>
                    </div>
                  </div>
                </div>

                {/* Skill proficiency slider indicator */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    <span>Forge Proficiency Score</span>
                    <span className="font-mono text-primary font-bold">{selectedMember.proficiency}%</span>
                  </div>
                  <div className="w-full bg-surface-container-low rounded-full h-2 overflow-hidden border border-outline-variant/20">
                    <motion.div 
                      className="bg-primary h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${selectedMember.proficiency}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-[10px] text-outline-variant leading-tight">Proficiency scores reflect average compilation success rates and code test coverage percentages.</p>
                </div>

                {/* Verified badges */}
                <div className="pt-4 border-t border-outline-variant/40 space-y-3">
                  <div className="flex items-center gap-3.5 text-xs">
                    <Shield size={16} className="text-primary" />
                    <span className="text-on-surface font-semibold font-sans">Full Platform Access Verified</span>
                  </div>
                  <div className="flex items-center gap-3.5 text-xs">
                    <Award size={16} className="text-secondary" />
                    <span className="text-on-surface font-semibold font-sans">Elite Contributor Badge</span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="glass-panel rounded-xl p-6 text-center text-xs text-on-surface-variant/40 h-64 flex items-center justify-center border-dashed border-outline-variant">
                Select a member to view their profile statistics.
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {createPortal(
        <AnimatePresence>
          {isAdmin && activeActionMember && (
            <>
              <motion.button
                type="button"
                aria-label="Close user actions"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] cursor-default bg-transparent"
                onPointerDown={() => setOpenActionMenuId(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                style={{ top: actionMenuPosition.top, left: actionMenuPosition.left }}
                className="fixed z-[120] w-48 bg-surface-container-high border border-outline-variant rounded-lg shadow-2xl shadow-black/50 overflow-hidden text-left"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <button onClick={() => openManageMember(activeActionMember)} className="w-full px-3 py-2 text-xs text-on-surface hover:bg-surface-container-highest text-left">Edit</button>
                <button onClick={() => handleMakeAdmin(activeActionMember)} className="w-full px-3 py-2 text-xs text-on-surface hover:bg-surface-container-highest text-left">Make Admin</button>
                <button onClick={() => handleDeleteMember(activeActionMember)} className="w-full px-3 py-2 text-xs text-error hover:bg-error/10 text-left">Delete</button>
                <button onClick={() => handleBanMember(activeActionMember, 'permanent')} className="w-full px-3 py-2 text-xs text-error hover:bg-error/10 text-left">Ban Email</button>
                <button onClick={() => handleBanMember(activeActionMember, 'shadow', 7)} className="w-full px-3 py-2 text-xs text-error hover:bg-error/10 text-left">Shadow Ban 7 Days</button>
                <button onClick={() => handleBanMember(activeActionMember, 'shadow', 30)} className="w-full px-3 py-2 text-xs text-error hover:bg-error/10 text-left">Shadow Ban 30 Days</button>
                <button onClick={() => handleBanMember(activeActionMember, 'permanent')} className="w-full px-3 py-2 text-xs font-bold text-error hover:bg-error/10 text-left">Permanently Ban</button>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Invite Member dialog Modal popup */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-surface-container-low rounded-xl border border-outline-variant shadow-2xl overflow-hidden flex flex-col"
            >
              <header className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
                <h3 className="text-sm font-bold text-on-surface font-sans">Invite Colleague</h3>
                <button 
                  onClick={() => setShowInviteModal(false)}
                  className="p-1 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  <X size={16} />
                </button>
              </header>

              <form onSubmit={handleSendInvite} className="p-6 space-y-4">
                {/* Teammate Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Full Name</label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                {/* Teammate Email */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="john.doe@syncforge.io"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                {/* Role dropdown select */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Assigned Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  >
                    {roleOptions.map(role => (
                      <option key={role} className="bg-surface-container">{role}</option>
                    ))}
                  </select>
                </div>

                {inviteError && (
                  <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-[11px] text-error font-semibold">
                    {inviteError}
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider border border-outline-variant hover:bg-surface-container-low rounded-lg text-on-surface transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isInviting}
                    className="flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/95 rounded-lg text-on-primary transition-all cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isInviting ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manage Member dialog Modal popup */}
      <AnimatePresence>
        {showManageModal && selectedMember && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-surface-container-low rounded-xl border border-outline-variant shadow-2xl overflow-hidden flex flex-col"
            >
              <header className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
                <h3 className="text-sm font-bold text-on-surface font-sans">Manage User</h3>
                <button
                  onClick={() => setShowManageModal(false)}
                  className="p-1 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  <X size={16} />
                </button>
              </header>

              <form onSubmit={handleSaveMember} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Full Name</label>
                  <input
                    type="text"
                    required
                    value={manageName}
                    onChange={(e) => setManageName(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Email Address</label>
                  <input
                    type="email"
                    required
                    value={manageEmail}
                    onChange={(e) => setManageEmail(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Position / Access Role</label>
                  <select
                    value={manageRole}
                    onChange={(e) => setManageRole(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  >
                    {roleOptions.map(role => (
                      <option key={role} className="bg-surface-container">{role}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Availability Status</label>
                  <select
                    value={manageStatus}
                    onChange={(e) => setManageStatus(e.target.value as User['status'])}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  >
                    <option className="bg-surface-container" value="Online">Online</option>
                    <option className="bg-surface-container" value="Away">Away</option>
                    <option className="bg-surface-container" value="Offline">Offline</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => selectedMember && handleMakeAdmin(selectedMember)}
                  className="w-full py-2 text-center text-xs font-bold uppercase tracking-wider border border-primary/40 bg-primary/10 hover:bg-primary/15 rounded-lg text-primary transition-all cursor-pointer"
                >
                  Make Admin
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => selectedMember && handleDeleteMember(selectedMember)}
                    disabled={isDeletingMember || isBanningMember}
                    className="py-2 text-center text-xs font-bold uppercase tracking-wider border border-error/30 bg-error/10 hover:bg-error/15 rounded-lg text-error transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeletingMember ? 'Deleting...' : 'Delete User'}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectedMember && handleBanMember(selectedMember, 'permanent')}
                    disabled={isDeletingMember || isBanningMember}
                    className="py-2 text-center text-xs font-bold uppercase tracking-wider border border-error/50 bg-error/20 hover:bg-error/25 rounded-lg text-error transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isBanningMember ? 'Banning...' : 'Ban Email'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => selectedMember && handleBanMember(selectedMember, 'shadow', 7)}
                    disabled={isDeletingMember || isBanningMember}
                    className="py-2 text-center text-xs font-bold uppercase tracking-wider border border-error/30 bg-error/10 hover:bg-error/15 rounded-lg text-error transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Shadow Ban 7d
                  </button>
                  <button
                    type="button"
                    onClick={() => selectedMember && handleBanMember(selectedMember, 'permanent')}
                    disabled={isDeletingMember || isBanningMember}
                    className="py-2 text-center text-xs font-bold uppercase tracking-wider border border-error/50 bg-error/20 hover:bg-error/25 rounded-lg text-error transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Permanent Ban
                  </button>
                </div>

                {manageError && (
                  <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-[11px] text-error font-semibold">
                    {manageError}
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowManageModal(false)}
                    className="flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider border border-outline-variant hover:bg-surface-container-low rounded-lg text-on-surface transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingMember}
                    className="flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/95 rounded-lg text-on-primary transition-all cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingMember ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
