/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserPlus, GitCommit, CheckCircle, Award, Shield, X, Mail, Sparkles, Activity, Star } from 'lucide-react';
import { User } from '../types';
import { USERS } from '../data';
import { fetchUsers } from '../api';

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

  // Filter members based on searchVal
  const filteredMembers = teamMembers.filter(member => 
    member.name.toLowerCase().includes(searchVal.toLowerCase()) ||
    member.role.toLowerCase().includes(searchVal.toLowerCase()) ||
    member.email.toLowerCase().includes(searchVal.toLowerCase())
  );

  // Send Invite simulation
  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;

    const newTeammate: User = {
      id: `u-${Date.now()}`,
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
      status: 'Offline',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpTGNjAHl-U2LMIfDUZbXqbsqcWrtfYRQKRG9LhdNiORyE7TXhfIMXxUGlWNaSa5OJvaBgsJnfnB0xL1VuTe_i3lGTSh4nq-N5pSjRkIReQ993dVejAWBBIeHWXELy4g5tCQDyH3fJQTVQCdSxFRjjNz4Mu5fH__70tSpdmqUQgBUy4JZRFystiSb6mebMda75gD7NXsF948RMwuWygRHSvhFYHj7ibALAnoRMQdkCXu_h2GzKZc_EakaK5kFtdKl7pTuX_1Hj_sE', // Default avatar
      commits: 0,
      reviews: 0,
      proficiency: 50,
    };

    setTeamMembers(prev => [...prev, newTeammate]);
    setInviteEmail('');
    setInviteName('');
    setShowInviteModal(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
      
      {/* Directory Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <span className="text-[10px] font-bold text-primary tracking-widest uppercase font-mono">SyncForge Team Directory</span>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight mt-1 font-sans">Engineering Directory</h1>
        </div>

        <button 
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-lg active:scale-[0.98] cursor-pointer"
        >
          <UserPlus size={14} className="stroke-[2.5]" />
          <span>Invite Member</span>
        </button>
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
                  <th className="px-6 py-3.5 text-right">Details</th>
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

                    <td className="px-6 py-4 text-right">
                      <button className="text-primary hover:underline font-semibold font-sans">Profile</button>
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
                    <option className="bg-surface-container">Lead Developer</option>
                    <option className="bg-surface-container">Senior Developer</option>
                    <option className="bg-surface-container">Frontend Developer</option>
                    <option className="bg-surface-container">Backend Developer</option>
                    <option className="bg-surface-container">Lead Product Designer</option>
                    <option className="bg-surface-container">DevOps Engineer</option>
                    <option className="bg-surface-container">Product Manager</option>
                  </select>
                </div>

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
                    className="flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/95 rounded-lg text-on-primary transition-all cursor-pointer shadow-lg"
                  >
                    Send Invite
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
