/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  ArrowUpDown,
  MessageSquare,
  Paperclip,
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { Task, User } from '../types';
import { USERS } from '../data';
import { createTask, fetchUsers, generateTaskDraft, updateTask } from '../api';
import { resolveAvatar } from '../utils/avatar';
import Dialog from './ui/Dialog';

interface TaskBoardProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  onSelectTask: (taskId: string) => void;
  searchVal: string;
}

type PriorityFilter = 'All' | 'High' | 'Medium' | 'Low';
type SortMode = 'default' | 'priority' | 'title';

const PRIORITY_WEIGHT: Record<Task['priority'], number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

export default function TaskBoard({ tasks, setTasks, onSelectTask, searchVal }: TaskBoardProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [newAssigneeId, setNewAssigneeId] = useState<string>(USERS.arjun.id);
  const [newTagsText, setNewTagsText] = useState('Frontend, UI');
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  // Interactive Board Filters & Sorting
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('All');
  const [sortMode, setSortMode] = useState<SortMode>('default');

  const columns = ['Backlog', 'Todo', 'In Progress', 'Review', 'Done'] as const;
  const assigneeOptions = teamMembers.length > 0 ? teamMembers : Object.values(USERS);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingMembers(true);
    fetchUsers()
      .then((users) => {
        if (!isMounted) return;
        setTeamMembers(users);
        if (users.length > 0 && !users.some((user) => user.id === newAssigneeId)) {
          setNewAssigneeId(users[0].id);
        }
      })
      .catch((err) => console.error('Failed to load task assignees:', err))
      .finally(() => {
        if (isMounted) setIsLoadingMembers(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter & Sort tasks based on search query, priority filter, assignee filter, and sort mode
  const filteredTasks = useMemo(() => {
    const q = searchVal.trim().toLowerCase();
    const list = tasks.filter((t) => {
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q));
      const matchesPriority = priorityFilter === 'All' || t.priority === priorityFilter;
      const matchesAssignee = assigneeFilter === 'All' || t.assignee?.id === assigneeFilter;
      return matchesSearch && matchesPriority && matchesAssignee;
    });

    if (sortMode === 'priority') {
      return [...list].sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
    }
    if (sortMode === 'title') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [tasks, searchVal, priorityFilter, assigneeFilter, sortMode]);

  const cycleSortMode = () => {
    setSortMode((prev) => (prev === 'default' ? 'priority' : prev === 'priority' ? 'title' : 'default'));
  };

  // Promote Task Status (Forward or Backward)
  const moveTask = (taskId: string, direction: 'forward' | 'backward') => {
    let targetNewStatus: 'Backlog' | 'Todo' | 'In Progress' | 'Review' | 'Done' | null = null;
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;

        const currentIndex = columns.indexOf(task.status);
        let newIndex = currentIndex;

        if (direction === 'forward' && currentIndex < columns.length - 1) {
          newIndex++;
        } else if (direction === 'backward' && currentIndex > 0) {
          newIndex--;
        }

        const newStatus = columns[newIndex];
        targetNewStatus = newStatus;

        return {
          ...task,
          status: newStatus,
        };
      })
    );

    if (targetNewStatus) {
      updateTask(taskId, { status: targetNewStatus }).catch((err) =>
        console.error('Database sync failed: ', err)
      );
    }
  };

  const completeTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: 'Done' } : task))
    );

    updateTask(taskId, { status: 'Done' }).catch((err) =>
      console.error('Database sync failed: ', err)
    );
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const assignee =
      assigneeOptions.find((u) => u.id === newAssigneeId) || assigneeOptions[0] || USERS.arjun;
    const cleanTags = newTagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const newTask: Task = {
      id: `SF-${Math.floor(100 + Math.random() * 900)}`,
      title: newTitle.trim(),
      description: newDesc.trim(),
      priority: newPriority,
      status: 'Backlog',
      assignee,
      dueDate: 'Oct 30, 2026',
      commentsCount: 0,
      attachmentsCount: 0,
      tags: cleanTags,
      comments: [],
    };

    setTasks((prev) => [newTask, ...prev]);
    createTask(newTask).catch((err) => console.error('Database insertion failed: ', err));

    setNewTitle('');
    setNewDesc('');
    setNewPriority('Medium');
    setNewTagsText('Frontend, UI');
    setAiPrompt('');
    setShowAddModal(false);
  };

  const handleGenerateTaskWithAi = async () => {
    if (isAiGenerating) return;

    setIsAiGenerating(true);
    setAiError('');
    try {
      const cleanTags = newTagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const draft = await generateTaskDraft({
        prompt: aiPrompt,
        title: newTitle,
        description: newDesc,
        priority: newPriority,
        tags: cleanTags,
        members: assigneeOptions,
      });

      if (draft.title) setNewTitle(draft.title);
      if (draft.description) setNewDesc(draft.description);
      if (draft.priority) setNewPriority(draft.priority);
      if (draft.tags?.length) setNewTagsText(draft.tags.join(', '));
      if (draft.assigneeId && assigneeOptions.some((user) => user.id === draft.assigneeId)) {
        setNewAssigneeId(draft.assigneeId);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI could not generate a task right now.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const totalBoardTasks = filteredTasks.length;
  const completedCount = filteredTasks.filter((t) => t.status === 'Done').length;
  const completionRate = totalBoardTasks > 0 ? Math.round((completedCount / totalBoardTasks) * 100) : 0;

  return (
    <div className="p-6 pb-20 md:pb-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Board Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-4 border-b border-outline-variant pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant font-mono tabular-nums">
            <span>Projects</span>
            <span aria-hidden="true">/</span>
            <span>Sprint Alpha-42</span>
            <span aria-hidden="true">·</span>
            <span className="text-primary font-semibold">{completionRate}% Complete</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight font-sans">
            Kanban Board
          </h1>
        </div>

        {/* Interactive Filter & Action Rail */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Priority Filter */}
          <div className="flex items-center gap-1 p-1 bg-surface-container-low border border-outline-variant rounded-lg">
            {(['All', 'High', 'Medium', 'Low'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setPriorityFilter(level)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  priorityFilter === level
                    ? 'bg-primary text-on-primary font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          {/* Assignee Filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            aria-label="Filter by assignee"
            className="px-3 py-1.5 bg-surface-container-low border border-outline-variant hover:border-outline rounded-lg text-xs font-medium text-on-surface outline-none cursor-pointer"
          >
            <option value="All">All Assignees</option>
            {assigneeOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>

          {/* Sort Button */}
          <button
            type="button"
            onClick={cycleSortMode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low border border-outline-variant hover:border-primary/50 rounded-lg text-xs font-medium text-on-surface transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowUpDown size={13} />
            <span>
              Sort: {sortMode === 'default' ? 'Default' : sortMode === 'priority' ? 'Priority' : 'Title'}
            </span>
          </button>

          {/* Primary Action */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 text-on-primary text-xs font-semibold rounded-lg transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus size={14} className="stroke-[2.5]" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Kanban Columns Stream */}
      <div className="flex gap-5 overflow-x-auto pb-4 select-none">
        {columns.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col);
          const colShare =
            totalBoardTasks > 0 ? Math.round((colTasks.length / totalBoardTasks) * 100) : 0;

          return (
            <div key={col} className="w-80 flex-shrink-0 flex flex-col gap-3">
              {/* Column Header with Live Telemetry & 2px Progress Bar */}
              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-on-surface tracking-tight">
                    {col}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-on-surface-variant tabular-nums">
                    <span className="text-on-surface font-semibold">{colTasks.length}</span>
                    <span aria-hidden="true">·</span>
                    <span>{colShare}%</span>
                  </div>
                </div>
                <div className="w-full h-0.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${colShare}%` }}
                  />
                </div>
              </div>

              {/* Column Cards Stream */}
              <div className="flex flex-col gap-3 min-h-[480px]">
                <AnimatePresence mode="popLayout">
                  {colTasks.length === 0 ? (
                    <motion.div
                      key={`empty-${col}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowAddModal(true)}
                      className="border border-dashed border-outline-variant rounded-xl p-6 text-center flex flex-col items-center justify-center h-32 bg-surface-container-lowest/40 hover:border-primary/50 hover:bg-surface-container-low transition-colors cursor-pointer group"
                    >
                      <Plus
                        size={16}
                        className="mb-1.5 text-on-surface-variant group-hover:text-primary transition-colors"
                      />
                      <span className="text-xs text-on-surface-variant">No tasks in {col}</span>
                      <span className="text-[11px] text-primary mt-0.5 font-medium">
                        Create Task
                      </span>
                    </motion.div>
                  ) : (
                    colTasks.map((task) => {
                      const dueDateStr = task.dueDate;
                      const isOverdue = (() => {
                        if (
                          !dueDateStr ||
                          dueDateStr === 'Completed' ||
                          dueDateStr.startsWith('Completed')
                        )
                          return false;
                        if (dueDateStr === 'Tomorrow') return false;
                        const d = new Date(dueDateStr);
                        return !isNaN(d.getTime()) && d < new Date();
                      })();
                      const isDueSoon = (() => {
                        if (
                          !dueDateStr ||
                          dueDateStr === 'Completed' ||
                          dueDateStr.startsWith('Completed')
                        )
                          return false;
                        if (dueDateStr === 'Tomorrow') return true;
                        const d = new Date(dueDateStr);
                        const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                        return !isNaN(diff) && diff >= 0 && diff <= 3;
                      })();

                      const dueDateClass = isOverdue
                        ? 'text-error font-semibold'
                        : isDueSoon
                        ? 'text-tertiary font-medium'
                        : 'text-on-surface-variant';

                      const priorityColorClass =
                        task.priority === 'High'
                          ? 'text-error'
                          : task.priority === 'Medium'
                          ? 'text-tertiary'
                          : 'text-secondary';

                      return (
                        <motion.div
                          layout
                          layoutId={`card-${task.id}`}
                          key={task.id}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                          onClick={() => onSelectTask(task.id)}
                          className="bg-surface-container border border-outline-variant hover:border-primary/50 p-4 rounded-xl transition-colors cursor-pointer relative group flex flex-col justify-between gap-3"
                        >
                          <div className="space-y-1.5">
                            {/* Clean unboxed metadata row */}
                            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-on-surface-variant">
                              <div className="flex items-center gap-1.5">
                                <span className={`font-semibold ${priorityColorClass}`}>
                                  {task.priority}
                                </span>
                                {task.tags?.[0] && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="truncate max-w-[110px]">{task.tags[0]}</span>
                                  </>
                                )}
                              </div>
                              <span>{task.id}</span>
                            </div>

                            {/* Task Title */}
                            <h4 className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors leading-snug line-clamp-1">
                              {task.title}
                            </h4>

                            {/* Description */}
                            <p className="text-[11px] text-on-surface-variant line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          </div>

                          {/* Card Footer */}
                          <div className="pt-2.5 border-t border-outline-variant/60 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 text-[11px] text-on-surface-variant font-mono tabular-nums">
                              {task.commentsCount > 0 && (
                                <span className="flex items-center gap-1" title="Comments">
                                  <MessageSquare size={11} />
                                  <span>{task.commentsCount}</span>
                                </span>
                              )}
                              {task.attachmentsCount > 0 && (
                                <span className="flex items-center gap-1" title="Attachments">
                                  <Paperclip size={11} />
                                  <span>{task.attachmentsCount}</span>
                                </span>
                              )}
                              <span className={`flex items-center gap-1 ${dueDateClass}`}>
                                <Calendar size={11} />
                                <span>{task.dueDate}</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {col !== 'Done' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    completeTask(task.id);
                                  }}
                                  title="Mark Complete"
                                  className="p-1.5 bg-secondary/10 hover:bg-secondary/20 border border-secondary/30 rounded-lg text-secondary transition-colors cursor-pointer"
                                >
                                  <Check size={11} />
                                </button>
                              )}

                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                {col !== 'Backlog' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveTask(task.id, 'backward');
                                    }}
                                    title="Move Left"
                                    className="p-1 hover:bg-surface-container-highest rounded text-on-surface-variant hover:text-on-surface cursor-pointer"
                                  >
                                    <ArrowLeft size={11} />
                                  </button>
                                )}
                                {col !== 'Done' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveTask(task.id, 'forward');
                                    }}
                                    title="Move Right"
                                    className="p-1 hover:bg-surface-container-highest rounded text-on-surface-variant hover:text-on-surface cursor-pointer"
                                  >
                                    <ArrowRight size={11} />
                                  </button>
                                )}
                              </div>

                              <div
                                className="w-6 h-6 rounded-full border border-outline-variant overflow-hidden flex-shrink-0"
                                title={`Assignee: ${task.assignee.name}`}
                              >
                                <img
                                  src={resolveAvatar(task.assignee)}
                                  alt={task.assignee.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {/* Accessible Dialog Modal for Creating & AI-Drafting Tasks */}
      <Dialog
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Create New Task"
        subtitle="Draft manually or auto-generate specifications with Gemini AI"
        headerRight={
          <button
            type="button"
            onClick={handleGenerateTaskWithAi}
            disabled={isAiGenerating}
            title="Generate or enhance task with AI"
            className="px-2.5 py-1 bg-primary/15 hover:bg-primary/25 border border-primary/30 rounded-lg text-primary text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-colors whitespace-nowrap"
          >
            <Sparkles size={13} className={isAiGenerating ? 'animate-spin' : ''} />
            <span>{isAiGenerating ? 'Drafting...' : 'AI Draft'}</span>
          </button>
        }
      >
        <form onSubmit={handleAddTask} className="space-y-4">
          {/* AI Prompt */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-on-surface-variant block">
              AI Task Brief
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe the feature or bug to auto-populate fields..."
                className="flex-1 min-w-0 bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              />
              <button
                type="button"
                onClick={handleGenerateTaskWithAi}
                disabled={isAiGenerating}
                title="Generate task"
                className="px-3 py-2 bg-primary/15 hover:bg-primary/25 border border-primary/30 rounded-lg text-primary disabled:opacity-50 cursor-pointer transition-colors flex-shrink-0"
              >
                <Sparkles size={14} className={isAiGenerating ? 'animate-spin' : ''} />
              </button>
            </div>
            {aiError && <p className="text-[11px] text-error font-medium">{aiError}</p>}
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-on-surface-variant block">Task Title</label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Implement Redis session caching"
              className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-on-surface-variant block">
              Description &amp; Acceptance Criteria
            </label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Technical scope and acceptance criteria..."
              rows={3}
              className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
            />
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-on-surface-variant block">
              Priority Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Low', 'Medium', 'High'] as const).map((level) => (
                <button
                  type="button"
                  key={level}
                  onClick={() => setNewPriority(level)}
                  className={`py-1.5 text-xs font-semibold rounded-lg border text-center transition-colors cursor-pointer ${
                    newPriority === level
                      ? 'bg-primary/15 text-primary border-primary'
                      : 'bg-surface-container border-outline-variant text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee Selection */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-on-surface-variant block">Assignee</label>
            <select
              value={newAssigneeId}
              onChange={(e) => setNewAssigneeId(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            >
              {isLoadingMembers && <option>Loading members...</option>}
              {assigneeOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </div>

          {/* Tags Category */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-on-surface-variant block">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={newTagsText}
              onChange={(e) => setNewTagsText(e.target.value)}
              placeholder="Database, SQL, Refactor"
              className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="flex-1 py-2 text-center text-xs font-semibold border border-outline-variant hover:bg-surface-container rounded-lg text-on-surface transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 text-center text-xs font-semibold bg-primary hover:bg-primary/90 rounded-lg text-on-primary transition-colors cursor-pointer"
            >
              Create Task
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
