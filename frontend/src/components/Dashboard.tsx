/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, MessageSquare, TrendingUp, TrendingDown, GitCommit, MessageCircle, CheckCircle, Plus, Calendar, AlertCircle } from 'lucide-react';
import { Task, Activity } from '../types';
import { socket } from '../utils/socket';

interface DashboardProps {
  tasks: Task[];
  activities: Activity[];
  onNavigateToTab: (tab: 'Dashboard' | 'Chat' | 'TaskBoard' | 'TeamDirectory') => void;
  onSelectTask: (taskId: string) => void;
}

export default function Dashboard({ tasks, activities, onNavigateToTab, onSelectTask }: DashboardProps) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Statistics state variables
  const [activeUsersCount, setActiveUsersCount] = useState<string>("0");
  const [openTasksCount, setOpenTasksCount] = useState<number>(0);
  const [messageVolume, setMessageVolume] = useState<string>("0");

  const [workloadData, setWorkloadData] = useState([
    { day: 'Mon', value: 0, tasks: 0 },
    { day: 'Tue', value: 0, tasks: 0 },
    { day: 'Wed', value: 0, tasks: 0 },
    { day: 'Thu', value: 0, tasks: 0 },
    { day: 'Fri', value: 0, tasks: 0 },
    { day: 'Sat', value: 0, tasks: 0 },
    { day: 'Sun', value: 0, tasks: 0 },
  ]);

  const MOCK_WORKLOAD_DATA = [
    { day: 'Mon', value: 60, tasks: 8 },
    { day: 'Tue', value: 45, tasks: 5 },
    { day: 'Wed', value: 85, tasks: 11 },
    { day: 'Thu', value: 100, tasks: 14 },
    { day: 'Fri', value: 70, tasks: 9 },
    { day: 'Sat', value: 20, tasks: 2 },
    { day: 'Sun', value: 15, tasks: 1 },
  ];

  // Keep openTasksCount updated if tasks prop changes (only if not loading)
  useEffect(() => {
    if (!isLoading) {
      setOpenTasksCount(tasks.filter(t => t.status !== 'Done').length);
    }
  }, [tasks, isLoading]);

  // Connect to Socket.io for real-time overview updates
  useEffect(() => {
    const handleStats = (data: any) => {
      if (data.activeUsers !== undefined) setActiveUsersCount(data.activeUsers);
      if (data.openTasks !== undefined) setOpenTasksCount(data.openTasks);
      if (data.messageVolume !== undefined) setMessageVolume(data.messageVolume);
      setWorkloadData(MOCK_WORKLOAD_DATA);
      setIsLoading(false);
    };

    socket.on('dashboard_stats_update', handleStats);

    return () => {
      socket.off('dashboard_stats_update', handleStats);
    };
  }, []);

  // My Tasks list (High or Medium priority, in progress or todo)
  const myTasks = tasks.filter(t => t.status !== 'Done').slice(0, 3);

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Title / Welcome Banner */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight font-sans">Workspace Overview</h1>
          <p className="text-on-surface-variant text-sm mt-1 font-sans">Track real-time engineering metrics, system latency, and team velocity.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => onNavigateToTab('TaskBoard' as any)}
            className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant hover:border-primary/50 text-on-surface text-xs font-semibold uppercase tracking-wider rounded-lg transition-all cursor-pointer"
          >
            <span>View Board</span>
          </button>
          <button 
            onClick={() => onNavigateToTab('Chat' as any)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-lg active:scale-[0.98]"
          >
            <span>Open Workspace Chat</span>
          </button>
        </div>
      </div>

      {/* Statistics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Users */}
        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between h-32 relative overflow-hidden group hover:border-primary/40 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-sans">Active Users</span>
            <div className="p-1.5 bg-secondary-container/10 text-secondary rounded-lg">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-2 w-full">
            {isLoading ? (
              <div className="space-y-2 mt-1">
                <div className="h-6 w-16 bg-outline-variant/30 rounded animate-pulse" />
                <div className="h-3.5 w-28 bg-outline-variant/20 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-on-surface font-sans">{activeUsersCount}</div>
                <div className="flex items-center gap-1 text-secondary text-xs font-semibold mt-1">
                  {/* <TrendingUp size={14} /> */}
                  {/* <span>+12.5% vs last week</span> */}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Open Tasks */}
        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between h-32 relative overflow-hidden group hover:border-primary/40 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-sans">Open Tasks</span>
            <div className="p-1.5 bg-primary-container/10 text-primary rounded-lg">
              <AlertCircle size={16} />
            </div>
          </div>
          <div className="mt-2 w-full">
            {isLoading ? (
              <div className="space-y-2 mt-1">
                <div className="h-6 w-12 bg-outline-variant/30 rounded animate-pulse" />
                <div className="h-3.5 w-32 bg-outline-variant/20 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-on-surface font-sans">{openTasksCount}</div>
                <div className="text-[11px] text-on-surface-variant mt-1 font-mono">
                  {/* Avg. closure cycle: <span className="text-primary font-bold">3.2 days</span> */}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Message Volume */}
        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between h-32 relative overflow-hidden group hover:border-primary/40 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-sans">Message Volume</span>
            <div className="p-1.5 bg-tertiary-container/10 text-tertiary rounded-lg">
              <MessageSquare size={16} />
            </div>
          </div>
          <div className="mt-2 w-full">
            {isLoading ? (
              <div className="space-y-2 mt-1">
                <div className="h-6 w-16 bg-outline-variant/30 rounded animate-pulse" />
                <div className="h-3.5 w-24 bg-outline-variant/20 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-on-surface font-sans">{messageVolume}</div>
                <div className="flex items-center gap-1 text-error text-xs font-semibold mt-1">
                  {/* <TrendingDown size={14} /> */}
                  {/* <span>-4.2% daily trend</span> */}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bento Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Recent Activity Stream (Large 8-col panel) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="glass-panel rounded-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/30">
              <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface font-sans">Recent Activity</h3>
              <button 
                onClick={() => onNavigateToTab('Chat')} 
                className="text-primary hover:underline text-xs font-semibold uppercase tracking-wider font-sans"
              >
                View Live Stream
              </button>
            </div>
            
            <div className="flex-1 divide-y divide-outline-variant/50 max-h-[380px] overflow-y-auto">
              {activities.map((activity) => (
                <div 
                  key={activity.id} 
                  className="px-6 py-4 hover:bg-surface-container/30 transition-all duration-150 group cursor-pointer"
                >
                  <div className="flex gap-4">
                    {/* Activity Icon mapping */}
                    <div className="flex-shrink-0">
                      {activity.type === 'commit' && (
                        <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant">
                          <GitCommit size={16} />
                        </div>
                      )}
                      {activity.type === 'message' && (
                        <div className="w-8 h-8 rounded-lg bg-tertiary/10 flex items-center justify-center text-tertiary">
                          <MessageCircle size={16} />
                        </div>
                      )}
                      {activity.type === 'task_completion' && (
                        <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                          <CheckCircle size={16} />
                        </div>
                      )}
                      {activity.type === 'comment' && (
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          <MessageSquare size={16} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-xs text-on-surface">
                          <span className="font-bold hover:underline cursor-pointer">{activity.user.name}</span>
                          <span className="text-on-surface-variant ml-1 font-normal">{activity.description}</span>
                        </p>
                        <span className="text-[10px] text-on-surface-variant font-mono flex-shrink-0">{activity.timestamp}</span>
                      </div>
                      
                      {activity.detail && (
                        <div className="mt-2 font-mono text-xs text-on-surface-variant bg-surface-container-lowest/80 p-2.5 rounded-lg border border-outline-variant/30 truncate select-all">
                          {activity.detail}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Workload Timeline Widget */}
          <div className="glass-panel rounded-xl p-6 flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface">Team Workload Timeline</h3>
              <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-mono">Last 7 Days Velocity</span>
            </div>

            {/* Styled interactive Timeline bars */}
            <div className="h-44 w-full flex items-end gap-2 relative">
              {workloadData.map((data, index) => (
                <div 
                  key={data.day}
                  onMouseEnter={() => setHoveredBar(index)}
                  onMouseLeave={() => setHoveredBar(null)}
                  className="flex-1 flex flex-col items-center group relative cursor-pointer"
                >
                  {/* Tooltip Popup on Hover */}
                  <AnimatePresence>
                    {hoveredBar === index && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5, scale: 0.95 }}
                        animate={{ opacity: 1, y: -10, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                        className="absolute bottom-full mb-1 z-20 bg-surface-container-highest px-3 py-1.5 rounded-lg border border-outline-variant shadow-xl text-center min-w-[80px]"
                      >
                        <p className="text-[10px] text-on-surface font-bold">{data.day}</p>
                        <p className="text-[11px] text-primary font-mono mt-0.5">{data.tasks} Active Tasks</p>
                        <p className="text-[9px] text-secondary font-mono">Load: {data.value}%</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Visual Bar */}
                  <div className="w-full bg-surface-container-low/50 border border-outline-variant/30 rounded-t-lg overflow-hidden h-32 flex items-end">
                    <motion.div 
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        index === 3 
                          ? 'bg-primary-container' 
                          : 'bg-primary/20 hover:bg-primary/60 group-hover:bg-primary/40'
                      }`}
                      initial={{ height: 0 }}
                      animate={{ height: `${data.value}%` }}
                      transition={{ delay: index * 0.05, duration: 0.6, ease: "easeOut" }}
                    />
                  </div>

                  {/* Day label */}
                  <span className="text-[10px] font-mono text-on-surface-variant mt-2">{data.day}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-outline-variant/40 flex items-center justify-between">
              <span className="text-xs text-on-surface-variant font-sans">Active sprints summary</span>
              <span className="text-xs font-bold text-primary font-mono bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">Trending High (+18%)</span>
            </div>
          </div>
        </div>

        {/* Sidebar Widgets (Right 4-col panel) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* My Tasks Panel */}
          <div className="glass-panel rounded-xl flex flex-col">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/30">
              <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface">My Tasks</h3>
              <button 
                onClick={() => onNavigateToTab('TaskBoard')}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
                title="Go to Kanban Board"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {myTasks.map((task) => (
                <div 
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  className="p-4 rounded-xl bg-surface-container/40 hover:bg-surface-container-high border border-outline-variant transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
                      task.priority === 'High' 
                        ? 'bg-error-container/20 text-error border border-error/20' 
                        : 'bg-tertiary-container/20 text-tertiary border border-tertiary/20'
                    }`}>
                      {task.priority} Priority
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-mono font-medium">{task.id}</span>
                  </div>

                  <h4 className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors leading-tight mb-1">{task.title}</h4>
                  <p className="text-[11px] text-on-surface-variant line-clamp-2 leading-relaxed mb-3">{task.description}</p>

                  <div className="flex justify-between items-center pt-2 border-t border-outline-variant/20">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full border border-outline-variant/50 overflow-hidden">
                        <img src={task.assignee.avatar} alt={task.assignee.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[10px] text-on-surface-variant truncate font-sans max-w-[80px]">{task.assignee.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-on-surface-variant">
                      <Calendar size={11} />
                      <span className="text-[10px] font-mono leading-none">{task.dueDate}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => onNavigateToTab('TaskBoard')}
              className="w-full py-3 border-t border-outline-variant text-center text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-on-surface hover:bg-surface-container/20 transition-all cursor-pointer"
            >
              Go to board
            </button>
          </div>

          {/* System Status Widget */}
          <div className="glass-panel rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">System Status</h4>
              <div className="flex items-center gap-1.5 bg-secondary/10 px-2 py-0.5 rounded-full border border-secondary/20">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(103,223,112,0.8)] animate-pulse"></div>
                <span className="text-[9px] text-secondary font-bold uppercase tracking-wider font-mono">ALL SYSTEMS GO</span>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-sans">API Gateway</span>
                <span className="font-mono font-bold text-secondary">99.9% online</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-sans">Database Cluster</span>
                <span className="font-mono font-semibold text-secondary">Healthy</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-sans">Build Pipelines</span>
                <span className="font-mono text-tertiary">2 active actions</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
