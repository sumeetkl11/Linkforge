/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Calendar, MessageSquare, Send, Tag, Shield, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Task, Comment, User } from '../types';
import { USERS } from '../data';
import { updateTask } from '../api';

interface TaskDetailsModalProps {
  taskId: string | null;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  currentUser: User | null;
  onClose: () => void;
}

function getCommentDate(comment: Comment) {
  const parsedTimestamp = Date.parse(comment.timestamp);
  if (!Number.isNaN(parsedTimestamp)) {
    return new Date(parsedTimestamp);
  }

  const idTimestamp = comment.id.match(/^comm-(\d+)$/)?.[1];
  if (idTimestamp) {
    const parsedIdTimestamp = Number(idTimestamp);
    if (Number.isFinite(parsedIdTimestamp)) {
      return new Date(parsedIdTimestamp);
    }
  }

  return null;
}

function formatCommentTimestamp(comment: Comment) {
  const commentDate = getCommentDate(comment);
  if (!commentDate) return comment.timestamp;

  const diffMs = Date.now() - commentDate.getTime();
  if (diffMs < 0) return 'Just now';

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return 'Just now';
  if (diffMs < hour) {
    const minutes = Math.floor(diffMs / minute);
    return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (diffMs < 7 * day) {
    const days = Math.floor(diffMs / day);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return commentDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: commentDate.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
  });
}

export default function TaskDetailsModal({ taskId, tasks, setTasks, currentUser, onClose }: TaskDetailsModalProps) {
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [isPostingComment, setIsPostingComment] = useState(false);

  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;
  const comments = Array.isArray(task.comments) ? task.comments : [];

  // Add Comment Handler
  const handleAddComment = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = commentText.trim();
    if (!content || isPostingComment) return;

    setCommentError(null);
    setIsPostingComment(true);

    const commentUser = currentUser || USERS.alex;
    const createdAt = new Date();
    const newComment: Comment = {
      id: `comm-${createdAt.getTime()}`,
      user: {
        name: commentUser.name,
        avatar: commentUser.avatar,
        role: commentUser.role
      },
      content,
      timestamp: createdAt.toISOString()
    };

    const updatedComments = [...comments, newComment];
    const updatedCommentsCount = updatedComments.length;

    setTasks(prev => prev.map(existingTask => {
      if (existingTask.id !== task.id) return existingTask;
      return {
        ...existingTask,
        commentsCount: updatedCommentsCount,
        comments: updatedComments
      };
    }));

    setCommentText('');

    try {
      const savedTask = await updateTask(task.id, {
        commentsCount: updatedCommentsCount,
        comments: updatedComments
      });

      setTasks(prev => prev.map(existingTask => (
        existingTask.id === savedTask.id ? savedTask : existingTask
      )));
    } catch (err) {
      console.error('Failed to update task comments on server:', err);
      setCommentError('Comment posted locally, but server sync failed. Try refreshing after the database is back online.');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  // Change Task Status directly from within detail modal
  const handleStatusChange = (newStatus: Task['status']) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== task.id) return t;
      return { ...t, status: newStatus };
    }));
    updateTask(task.id, { status: newStatus }).catch(err =>
      console.error('Failed to update task status on server:', err)
    );
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-4xl h-[90vh] md:h-[80vh] bg-surface-container-low border border-outline-variant rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
      >
        {/* Left Side: Title, Description, and Comments stream */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 flex flex-col">
          {/* Modal Header */}
          <div className="flex justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary">{task.id}</span>
                <span className="w-[1px] h-3 bg-outline-variant"></span>
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider font-sans">{task.status}</span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight mt-1 leading-snug">{task.title}</h2>
            </div>
            
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer md:hidden"
            >
              <X size={18} />
            </button>
          </div>

          {/* Description Block */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Description</h3>
            <div className="bg-surface-container-lowest/55 p-5 rounded-xl border border-outline-variant/35 text-xs text-on-surface-variant leading-relaxed font-sans select-text">
              {task.description}
            </div>
          </div>

          {/* Comments and Conversations Log Section */}
          <div className="space-y-4 pt-4 flex-1 flex flex-col">
            <div className="flex items-center gap-2 border-b border-outline-variant/40 pb-2">
              <MessageSquare size={16} className="text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Comments ({comments.length})</h3>
            </div>

            {/* Comments List */}
            <div className="space-y-4 flex-1 overflow-y-auto max-h-72 pr-2">
              {comments.length === 0 ? (
                <p className="text-xs text-on-surface-variant/40 italic py-6 text-center">No team comments posted yet on this task. Be the first to add one below!</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 bg-surface-container/30 p-3 rounded-xl border border-outline-variant/20">
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-outline-variant/30 flex-shrink-0">
                      <img src={comment.user.avatar} alt={comment.user.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-on-surface">{comment.user.name}</span>
                        {comment.user.role && (
                          <span className="text-[9px] bg-surface-container-highest px-1.5 py-0.5 rounded text-outline font-mono uppercase">{comment.user.role}</span>
                        )}
                        <span className="text-[10px] text-on-surface-variant font-mono">{formatCommentTimestamp(comment)}</span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1 leading-relaxed font-sans">{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Post comment form */}
            <form onSubmit={handleAddComment} className="flex gap-2 items-end mt-auto pt-3">
              <div className="flex-1 bg-surface-container border border-outline-variant focus-within:border-primary rounded-xl p-2 flex items-center gap-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={handleCommentKeyDown}
                  placeholder="Post comment or link technical references..."
                  rows={1}
                  className="flex-grow bg-transparent border-none text-xs text-on-surface placeholder:text-on-surface-variant/50 outline-none resize-none px-1"
                />
              </div>
              <button 
                type="submit"
                disabled={isPostingComment || !commentText.trim()}
                className="p-2.5 bg-primary hover:bg-primary/95 text-on-primary rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={14} />
              </button>
            </form>
            {commentError && (
              <p className="text-[10px] text-error font-semibold">{commentError}</p>
            )}
          </div>
        </div>

        {/* Right Side: Sidebar Task Attributes details panel */}
        <aside className="w-full md:w-72 bg-surface-container-high border-t md:border-t-0 md:border-l border-outline-variant p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            {/* Action Bar desktop close */}
            <div className="hidden md:flex justify-end">
              <button 
                onClick={onClose}
                className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                title="Close Panel"
              >
                <X size={16} />
              </button>
            </div>

            {/* Change Status select box */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-sans">Task Status</label>
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value as Task['status'])}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs font-semibold text-on-surface focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              >
                {['Backlog', 'Todo', 'In Progress', 'Review', 'Done'].map(statusOption => (
                  <option key={statusOption} value={statusOption} className="bg-surface-container-low font-sans">
                    {statusOption}
                  </option>
                ))}
              </select>
            </div>

            {task.status !== 'Done' && (
              <button
                type="button"
                onClick={() => handleStatusChange('Done')}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-secondary/10 hover:bg-secondary/15 border border-secondary/30 rounded-lg text-xs font-bold text-secondary transition-all cursor-pointer"
              >
                <CheckCircle size={14} />
                <span>Mark Complete</span>
              </button>
            )}

            {/* Assignee Information */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Assignee</label>
              <div className="flex items-center gap-3 bg-surface-container p-3 rounded-xl border border-outline-variant/30">
                <div className="w-9 h-9 rounded-full overflow-hidden border border-outline-variant/50">
                  <img src={task.assignee.avatar} alt={task.assignee.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-xs font-bold text-on-surface">{task.assignee.name}</div>
                  <div className="text-[10px] text-on-surface-variant">{task.assignee.role}</div>
                </div>
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Due Date</label>
              <div className="flex items-center gap-2.5 text-xs text-on-surface font-sans bg-surface-container px-3 py-2.5 rounded-xl border border-outline-variant/30">
                <Calendar size={14} className="text-primary" />
                <span className="font-mono">{task.dueDate}</span>
              </div>
            </div>

            {/* Priority Indicator */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Priority Level</label>
              <div className="flex items-center gap-2 text-xs text-on-surface bg-surface-container px-3 py-2.5 rounded-xl border border-outline-variant/30">
                <AlertCircle size={14} className={task.priority === 'High' ? 'text-error' : task.priority === 'Medium' ? 'text-tertiary' : 'text-outline-variant'} />
                <span className="font-semibold">{task.priority} Priority</span>
              </div>
            </div>

            {/* Tags Collection */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag, i) => (
                  <span 
                    key={i} 
                    className="px-2.5 py-0.5 bg-surface-container-highest/60 border border-outline-variant/30 rounded text-[10px] font-semibold text-primary flex items-center gap-1"
                  >
                    <Tag size={10} />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Actions at the bottom of panel */}
          <div className="pt-4 border-t border-outline-variant/30 text-center">
            <span className="text-[10px] uppercase font-bold tracking-widest text-outline">SyncForge Verified</span>
          </div>
        </aside>
      </motion.div>
    </div>
  );
}
