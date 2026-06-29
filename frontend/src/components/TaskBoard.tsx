/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Filter, ArrowUpDown, MessageSquare, Paperclip, ArrowLeft, ArrowRight, X, Check, HelpCircle, Sparkles } from 'lucide-react';
import { Task, User } from '../types';
import { USERS } from '../data';
import { createTask, fetchUsers, generateTaskDraft, updateTask } from '../api';

interface TaskBoardProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  onSelectTask: (taskId: string) => void;
  searchVal: string;
}

// ============================================================================
// 🗄️ BACKEND NODE.JS & POSTGRESQL INTEGRATION PLACEHOLDERS
// Follow these clear instructions to connect to your real database:
//
// 1. Create a table schema in PostgreSQL:
//    CREATE TABLE tasks (
//      id VARCHAR(50) PRIMARY KEY,
//      title VARCHAR(255) NOT NULL,
//      description TEXT,
//      priority VARCHAR(20), -- 'Low', 'Medium', 'High'
//      status VARCHAR(30), -- 'Backlog', 'Todo', 'In Progress', 'Review', 'Done'
//      assignee_id VARCHAR(50) REFERENCES users(id),
//      due_date VARCHAR(50),
//      tags TEXT[] -- array of tags
//    );
//
// 2. Set up API endpoints in your Express server (e.g. server.ts):
//    app.get('/api/tasks', async (req, res) => {
//       const result = await db.query('SELECT * FROM tasks');
//       res.json(result.rows);
//    });
//
//    app.post('/api/tasks', async (req, res) => {
//       const { id, title, description, priority, status, assignee_id, due_date, tags } = req.body;
//       await db.query('INSERT INTO tasks VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [...]);
//       res.sendStatus(201);
//    });
//
//    app.patch('/api/tasks/:id/status', async (req, res) => {
//       const { status } = req.body;
//       await db.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, req.params.id]);
//       res.sendStatus(200);
//    });
// ============================================================================

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

  const columns = ['Backlog', 'Todo', 'In Progress', 'Review', 'Done'] as const;
  const assigneeOptions = teamMembers.length > 0 ? teamMembers : Object.values(USERS);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingMembers(true);
    fetchUsers()
      .then((users) => {
        if (!isMounted) return;
        setTeamMembers(users);
        if (users.length > 0 && !users.some(user => user.id === newAssigneeId)) {
          setNewAssigneeId(users[0].id);
        }
      })
      .catch(err => console.error('Failed to load task assignees:', err))
      .finally(() => {
        if (isMounted) setIsLoadingMembers(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter tasks based on Search value
  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchVal.toLowerCase()) ||
    t.description.toLowerCase().includes(searchVal.toLowerCase()) ||
    t.id.toLowerCase().includes(searchVal.toLowerCase()) ||
    t.tags.some(tag => tag.toLowerCase().includes(searchVal.toLowerCase()))
  );

  // Promote Task Status (Forward or Backward)
  const moveTask = (taskId: string, direction: 'forward' | 'backward') => {
    let targetNewStatus: "Backlog" | "Todo" | "In Progress" | "Review" | "Done" | null = null;
    setTasks(prev => prev.map(task => {
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
        status: newStatus
      };
    }));

    if (targetNewStatus) {
      updateTask(taskId, { status: targetNewStatus }).catch(err => console.error("Database sync failed: ", err));
    }
  };

  const completeTask = (taskId: string) => {
    setTasks(prev => prev.map(task => (
      task.id === taskId ? { ...task, status: 'Done' } : task
    )));

    updateTask(taskId, { status: 'Done' }).catch(err => console.error("Database sync failed: ", err));
  };

  // Submit new Task
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const assignee = assigneeOptions.find(u => u.id === newAssigneeId) || assigneeOptions[0] || USERS.arjun;
    const cleanTags = newTagsText.split(',').map(t => t.trim()).filter(Boolean);

    const newTask: Task = {
      id: `SF-${Math.floor(100 + Math.random() * 900)}`,
      title: newTitle,
      description: newDesc,
      priority: newPriority,
      status: 'Backlog',
      assignee,
      dueDate: 'Oct 30, 2026',
      commentsCount: 0,
      attachmentsCount: 0,
      tags: cleanTags,
      comments: []
    };

    setTasks(prev => [newTask, ...prev]);

    // Save to backend database
    createTask(newTask).catch(err => console.error("Database insertion failed: ", err));

    // Reset Form
    setNewTitle('');
    setNewDesc('');
    setNewPriority('Medium');
    setNewTagsText('Frontend, UI');
    setShowAddModal(false);
  };

  const handleGenerateTaskWithAi = async () => {
    if (isAiGenerating) return;

    setIsAiGenerating(true);
    setAiError('');
    try {
      const cleanTags = newTagsText.split(',').map(t => t.trim()).filter(Boolean);
      const draft = await generateTaskDraft({
        prompt: aiPrompt,
        title: newTitle,
        description: newDesc,
        priority: newPriority,
        tags: cleanTags,
        members: assigneeOptions
      });

      if (draft.title) setNewTitle(draft.title);
      if (draft.description) setNewDesc(draft.description);
      if (draft.priority) setNewPriority(draft.priority);
      if (draft.tags?.length) setNewTagsText(draft.tags.join(', '));
      if (draft.assigneeId && assigneeOptions.some(user => user.id === draft.assigneeId)) {
        setNewAssigneeId(draft.assigneeId);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI could not generate a task right now.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
      
      {/* Board Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <span className="text-[10px] font-bold text-primary tracking-widest uppercase font-mono">Projects / sprint Alpha-42</span>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight mt-1 font-sans">Kanban Board</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant hover:border-primary/40 rounded-lg text-xs font-semibold text-on-surface transition-all cursor-pointer">
            <Filter size={14} />
            <span>Filter</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant hover:border-primary/40 rounded-lg text-xs font-semibold text-on-surface transition-all cursor-pointer">
            <ArrowUpDown size={14} />
            <span>Sort</span>
          </button>
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-lg active:scale-[0.98] cursor-pointer"
          >
            <Plus size={14} className="stroke-[2.5]" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Kanban Grid Container (Horizontally scrolls on small screens, grid on large) */}
      <div className="flex gap-6 overflow-x-auto pb-4 select-none">
        
        {columns.map((col) => {
          const colTasks = filteredTasks.filter(t => t.status === col);
          
          return (
            <div key={col} className="w-80 flex-shrink-0 flex flex-col gap-4">
              
              {/* Column Header */}
              <div className="flex items-center justify-between px-2 py-1 bg-surface-container-low/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-outline">{col}</span>
                  <span className="bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {colTasks.length}
                  </span>
                </div>
              </div>

              {/* Column Cards Stream */}
              <div className="flex flex-col gap-3 min-h-[500px]">
                {colTasks.length === 0 ? (
                  <div className="border border-dashed border-outline-variant/30 rounded-xl p-6 text-center text-xs text-on-surface-variant/40 flex flex-col items-center justify-center h-32 bg-surface-container-lowest/10">
                    <HelpCircle size={18} className="mb-2 stroke-[1.5]" />
                    <span>No tasks here</span>
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <motion.div
                      layoutId={`card-${task.id}`}
                      key={task.id}
                      className="bg-surface-container border border-outline-variant hover:border-primary/50 p-4 rounded-xl transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between"
                      style={{ height: '170px' }}
                    >
                      {/* Priority Strip Indicator */}
                      {task.status === 'In Progress' && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                      )}

                      <div>
                        {/* Header Details */}
                        <div className="flex justify-between items-center mb-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide ${
                            task.priority === 'High' 
                              ? 'bg-error-container/20 text-error border border-error/20' 
                              : task.priority === 'Medium'
                              ? 'bg-tertiary-container/20 text-tertiary border border-tertiary/20'
                              : 'bg-surface-container-highest text-on-surface-variant border border-outline-variant/30'
                          }`}>
                            {task.priority}
                          </span>
                          <span className="text-[10px] text-on-surface-variant font-mono font-medium">{task.id}</span>
                        </div>

                        {/* Title & Description */}
                        <h4 
                          onClick={() => onSelectTask(task.id)}
                          className="text-xs font-bold text-on-surface hover:text-primary transition-colors leading-snug truncate"
                        >
                          {task.title}
                        </h4>
                        
                        <p className="text-[10px] text-on-surface-variant line-clamp-2 leading-relaxed mt-1 select-text">
                          {task.description}
                        </p>
                      </div>

                      {/* Footer Actions / Controls */}
                      <div className="mt-3 pt-3 border-t border-outline-variant/20 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-on-surface-variant font-sans">
                          {task.commentsCount > 0 && (
                            <div className="flex items-center gap-0.5 text-[10px]" title="Comments">
                              <MessageSquare size={11} />
                              <span>{task.commentsCount}</span>
                            </div>
                          )}
                          {task.attachmentsCount > 0 && (
                            <div className="flex items-center gap-0.5 text-[10px]" title="Attachments">
                              <Paperclip size={11} />
                              <span>{task.attachmentsCount}</span>
                            </div>
                          )}
                        </div>

                        {/* Assignee & Controls */}
                        <div className="flex items-center gap-2">
                          {col !== 'Done' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); completeTask(task.id); }}
                              title="Mark Complete"
                              className="p-1.5 bg-secondary/10 hover:bg-secondary/15 border border-secondary/20 rounded-lg text-secondary transition-colors cursor-pointer"
                            >
                              <Check size={11} />
                            </button>
                          )}

                          {/* Control arrows to move tasks easily without heavy drag drop client dependencies */}
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                            {col !== 'Backlog' && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); moveTask(task.id, 'backward'); }}
                                title="Move Left"
                                className="p-1 hover:bg-surface-container-highest rounded text-on-surface-variant hover:text-on-surface cursor-pointer"
                              >
                                <ArrowLeft size={10} />
                              </button>
                            )}
                            {col !== 'Done' && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); moveTask(task.id, 'forward'); }}
                                title="Move Right"
                                className="p-1 hover:bg-surface-container-highest rounded text-on-surface-variant hover:text-on-surface cursor-pointer"
                              >
                                <ArrowRight size={10} />
                              </button>
                            )}
                          </div>

                          <div className="w-6 h-6 rounded-full border border-outline-variant/50 overflow-hidden flex-shrink-0" title={`Assignee: ${task.assignee.name}`}>
                            <img src={task.assignee.avatar} alt={task.assignee.name} className="w-full h-full object-cover" />
                          </div>
                        </div>
                      </div>

                    </motion.div>
                  ))
                )}
              </div>

            </div>
          );
        })}

      </div>

      {/* Inline Add Task Dialog Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-surface-container-low rounded-xl border border-outline-variant shadow-2xl overflow-hidden flex flex-col"
            >
              <header className="px-6 py-4 border-b border-outline-variant flex justify-between items-center gap-3">
                <h3 className="text-sm font-bold text-on-surface font-sans">Forge New Task</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateTaskWithAi}
                    disabled={isAiGenerating}
                    title="Generate or enhance task with AI"
                    className="p-2 bg-primary/10 hover:bg-primary/15 border border-primary/25 rounded-lg text-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
                  >
                    <Sparkles size={15} className={isAiGenerating ? 'animate-pulse' : ''} />
                  </button>
                  <button 
                    onClick={() => setShowAddModal(false)}
                    className="p-1 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </header>

              <form onSubmit={handleAddTask} className="p-6 space-y-4 flex-1">
                {/* AI Prompt */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-sans block">AI Task Brief</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Describe the task or click the AI icon to enhance current fields"
                      className="flex-1 min-w-0 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateTaskWithAi}
                      disabled={isAiGenerating}
                      title="Generate task"
                      className="w-9 h-9 flex items-center justify-center bg-primary/10 hover:bg-primary/15 border border-primary/25 rounded-lg text-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all flex-shrink-0"
                    >
                      <Sparkles size={14} className={isAiGenerating ? 'animate-pulse' : ''} />
                    </button>
                  </div>
                  {aiError && (
                    <p className="text-[10px] text-error font-medium">{aiError}</p>
                  )}
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-sans block">Task Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Implement redis cache"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-sans block">Description</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Provide full description of technical boundaries and prerequisites..."
                    rows={3}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
                  />
                </div>

                {/* Priority */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-sans block">Priority Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Low', 'Medium', 'High'] as const).map((level) => (
                      <button
                        type="button"
                        key={level}
                        onClick={() => setNewPriority(level)}
                        className={`py-1.5 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                          newPriority === level
                            ? 'bg-primary/10 text-primary border-primary font-bold'
                            : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-on-surface-variant'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assignee Selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-sans block">Assignee</label>
                  <select
                    value={newAssigneeId}
                    onChange={(e) => setNewAssigneeId(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  >
                    {isLoadingMembers && (
                      <option className="bg-surface-container">Loading members...</option>
                    )}
                    {assigneeOptions.map((user) => (
                      <option key={user.id} value={user.id} className="bg-surface-container">
                        {user.name} ({user.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tags Category */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-sans block">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={newTagsText}
                    onChange={(e) => setNewTagsText(e.target.value)}
                    placeholder="Database, SQL, Refactor"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider border border-outline-variant hover:bg-surface-container-low rounded-lg text-on-surface transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/95 rounded-lg text-on-primary transition-all cursor-pointer shadow-lg"
                  >
                    Forge Task
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
