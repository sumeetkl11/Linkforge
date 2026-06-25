/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Info, X } from 'lucide-react';
import SignIn from './components/SignIn';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Chat from './components/Chat';
import TaskBoard from './components/TaskBoard';
import TeamDirectory from './components/TeamDirectory';
import TaskDetailsModal from './components/TaskDetailsModal';
import Settings from './components/Settings';
import UserProfile from './components/UserProfile';
import Wiki from './components/Wiki';
import { Task, Activity, User } from './types';
import { INITIAL_TASKS, RECENT_ACTIVITIES } from './data';
import { fetchTasks, fetchActivities, fetchUsers, resetDatabase } from './api';
import { socket } from './utils/socket';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'Dashboard' | 'Chat' | 'TaskBoard' | 'TeamDirectory' | 'Settings' | 'UserProfile' | 'Wiki'>('Dashboard');
  const [searchVal, setSearchVal] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState<boolean>(true);

  // Auto-clear Toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleTriggerToast = (msg: string) => {
    setToastMessage(msg);
  };

  // Capture Google OAuth token from URL or localStorage on boot
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      localStorage.setItem('token', token);
      
      // Clean query parameters from URL for security
      const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      
      setIsLoggedIn(true);
    } else {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        setIsLoggedIn(true);
      } else {
        setIsLoadingUser(false);
      }
    }
  }, []);

  // Load user data on login
  useEffect(() => {
    if (isLoggedIn && !currentUser) {
      const storedToken = localStorage.getItem('token');
      let targetUserId: string | null = null;
      
      if (storedToken) {
        try {
          const parts = storedToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            targetUserId = payload.id;
          }
        } catch (e) {
          console.error('Error decoding JWT token:', e);
        }
      }
      
      setIsLoadingUser(true);
      fetchUsers()
        .then(users => {
          const user = users.find(u => u.id === targetUserId) || users.find(u => u.id === 'u1') || users[0];
          if (user) {
            setCurrentUser(user);
          }
          setIsLoadingUser(false);
        })
        .catch(err => {
          console.error('Failed to load user credentials:', err);
          setIsLoadingUser(false);
        });
    } else if (isLoggedIn && currentUser) {
      setIsLoadingUser(false);
    }
  }, [isLoggedIn, currentUser]);

  // Sync data on login or screen change
  useEffect(() => {
    if (isLoggedIn) {
      fetchTasks().then(setTasks).catch(err => {
        console.error('Failed to load tasks, using initial data:', err);
        setTasks(INITIAL_TASKS);
      });
      fetchActivities().then(setActivities).catch(err => {
        console.error('Failed to load activities, using initial data:', err);
        setActivities(RECENT_ACTIVITIES);
      });
    }
  }, [isLoggedIn, currentScreen]);

  // Global Socket lifecycle — connect on login, disconnect on logout
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;

    // Connect the singleton socket
    socket.connect();

    const handleConnect = () => {
      // Register user room with backend so DMs and private events route here
      socket.emit('user:join', currentUser.id);
      console.log(`[Socket] ✅ Connected — joined user room: ${currentUser.id}`);
    };

    const handleTaskCreated = (newTask: Task) => {
      setTasks(prev => {
        if (prev.some(t => t.id === newTask.id)) return prev;
        return [newTask, ...prev];
      });
    };

    const handleTaskUpdated = (updatedTask: Task) => {
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    };

    const handleTaskDeleted = (deletedId: string) => {
      setTasks(prev => prev.filter(t => t.id !== deletedId));
    };

    socket.on('connect', handleConnect);
    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:deleted', handleTaskDeleted);

    // If already connected (e.g. fast re-render), emit join immediately
    if (socket.connected) handleConnect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('task:created', handleTaskCreated);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('task:deleted', handleTaskDeleted);
    };
  }, [isLoggedIn, currentUser]);


  // Refresh tasks and activities
  const handleRefreshData = () => {
    fetchTasks().then(setTasks).catch(console.error);
    fetchActivities().then(setActivities).catch(console.error);
  };

  // Reset workspace database
  const handleResetDatabase = async () => {
    try {
      await resetDatabase();
      handleRefreshData();
      const users = await fetchUsers();
      const alex = users.find(u => u.id === 'u1') || users[0];
      if (alex) {
        setCurrentUser(alex);
      }
      setCurrentScreen('Dashboard');
    } catch (err) {
      console.error('Failed to reset workspace database:', err);
    }
  };

  // Save updated user detail back
  const handleUpdateUser = (updatedUser: User) => {
    setCurrentUser(updatedUser);
  };

  // Logout trigger — disconnect socket cleanly
  const handleLogout = () => {
    socket.disconnect();
    console.log('[Socket] 🔌 Disconnected on logout.');
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentScreen('Dashboard');
  };

  // Switch screens
  const handleNavigateToTab = (tab: 'Dashboard' | 'Chat' | 'TaskBoard' | 'TeamDirectory' | 'Settings' | 'UserProfile' | 'Wiki') => {
    setCurrentScreen(tab);
    setSearchVal(''); // Reset search on tab navigation for clean UX
  };

  // Open Task Modal Detail selection
  const handleSelectTask = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  // If session is unauthenticated, show high-fidelity login canvas
  if (!isLoggedIn) {
    return (
      <AnimatePresence mode="wait">
        <SignIn onLogin={(user) => {
          setCurrentUser(user);
          setIsLoggedIn(true);
        }} />
      </AnimatePresence>
    );
  }

  // Active Workspace layout shell
  return (
    <div className="flex bg-surface text-on-surface h-screen w-screen overflow-hidden font-sans">
      
      {/* Sidebar Navigation */}
      <Sidebar 
        currentScreen={currentScreen} 
        setScreen={handleNavigateToTab} 
        onLogout={handleLogout}
        onCreateProject={() => handleNavigateToTab('TaskBoard')}
        currentUser={currentUser}
        onTriggerToast={handleTriggerToast}
        isLoading={isLoadingUser}
      />

      {/* Main content body panel */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        
        {/* Workspace Top Application Bar */}
        <Header 
          searchVal={searchVal} 
          setSearchVal={setSearchVal} 
          placeholderText={
            currentScreen === 'TeamDirectory' 
              ? 'Search team members by name or role...' 
              : currentScreen === 'TaskBoard'
              ? 'Filter board by task name, tag, or priority...'
              : 'Search tasks, threads, or workspace logs...'
          }
          onProfileClick={() => handleNavigateToTab('UserProfile')}
          currentUser={currentUser}
          onTriggerToast={handleTriggerToast}
          isLoading={isLoadingUser}
        />

        {/* Dynamic Inner Panel Viewport */}
        <div className="flex-1 overflow-y-auto bg-surface-container-lowest/20">
          <AnimatePresence mode="wait">
            {currentScreen === 'Dashboard' && (
              <Dashboard 
                tasks={tasks}
                activities={activities}
                onNavigateToTab={handleNavigateToTab}
                onSelectTask={handleSelectTask}
              />
            )}

            {currentScreen === 'Chat' && (
              <Chat currentUser={currentUser} />
            )}

            {currentScreen === 'TaskBoard' && (
              <TaskBoard 
                tasks={tasks}
                setTasks={setTasks}
                onSelectTask={handleSelectTask}
                searchVal={searchVal}
              />
            )}

            {currentScreen === 'TeamDirectory' && (
              <TeamDirectory 
                searchVal={searchVal}
                currentUser={currentUser}
              />
            )}

            {currentScreen === 'Settings' && (
              <Settings 
                onResetWorkspace={handleResetDatabase}
              />
            )}

            {currentScreen === 'UserProfile' && (
              <UserProfile 
                currentUser={currentUser}
                onUpdateUser={handleUpdateUser}
              />
            )}

            {currentScreen === 'Wiki' && (
              <Wiki />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Task Details Popup Overlay Modal */}
      <AnimatePresence>
        {selectedTaskId && (
          <TaskDetailsModal 
            taskId={selectedTaskId}
            tasks={tasks}
            setTasks={setTasks}
            onClose={() => setSelectedTaskId(null)}
          />
        )}
      </AnimatePresence>

      {/* Toast Notification Overlay */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-surface-container-high border border-primary/30 text-on-surface rounded-xl shadow-lg shadow-black/40 max-w-sm backdrop-blur-xl"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <Info size={16} />
            </div>
            <div className="flex-1 text-xs font-medium font-sans pr-2">
              {toastMessage}
            </div>
            <button 
              onClick={() => setToastMessage(null)}
              className="p-1 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
