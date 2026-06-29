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
import { Task, Activity, User, Message, AppNotification } from './types';
import { INITIAL_TASKS, RECENT_ACTIVITIES } from './data';
import { fetchTasks, fetchActivities, fetchUsers, resetDatabase, validateSession, fetchChannels } from './api';
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
  const [signInError, setSignInError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [channelNames, setChannelNames] = useState<Record<string, string>>({});
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

  const endSession = (message?: string) => {
    socket.disconnect();
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentScreen('Dashboard');
    setSelectedTaskId(null);
    setTasks([]);
    setActivities([]);
    setIsLoadingUser(false);
    if (message) {
      setToastMessage(message);
    }
  };

  // Capture Google OAuth token from URL or localStorage on boot
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const authError = urlParams.get('auth_error');
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;

    if (authError) {
      window.history.replaceState({}, document.title, cleanUrl);
      localStorage.removeItem('token');
      setSignInError(authError);
      setIsLoadingUser(false);
      return;
    }

    if (token) {
      localStorage.setItem('token', token);
      
      // Clean query parameters from URL for security
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
      setIsLoadingUser(true);
      validateSession()
        .then(user => {
          setCurrentUser(user);
          setIsLoadingUser(false);
        })
        .catch(err => {
          console.error('Failed to validate session:', err);
          endSession((err as Error).message || 'Your session has expired. Please log in again.');
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
      fetchChannels()
        .then(channels => {
          setChannelNames(Object.fromEntries(channels.map(channel => [channel.id, channel.name])));
        })
        .catch(err => console.error('Failed to load channels for notifications:', err));
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

    const handleAuthBanned = (payload?: { message?: string }) => {
      endSession(payload?.message || 'Your account access has been revoked.');
    };

    const handleMessageReceived = (message: Message & { receiverId?: string | null; receiver_id?: string | null; channelId?: string | null; channel_id?: string | null; workspace_id?: string | null }) => {
      if (!message?.user || message.user.id === currentUser.id) return;

      const receiverId = message.receiverId || message.receiver_id;
      const channelId = message.channelId || message.channel_id || message.workspace_id;
      const isDirectMessage = Boolean(receiverId);
      const senderLabel = message.user.name || 'A teammate';
      const preview = message.content?.trim() ? `: ${message.content.trim().slice(0, 80)}` : '';
      const text = isDirectMessage
        ? `${senderLabel} sent you a direct message${preview}`
        : `${senderLabel} posted in ${channelId ? `#${channelNames[channelId] || channelId}` : 'a channel'}${preview}`;

      setNotifications(prev => [
        {
          id: `notif-${message.id}-${Date.now()}`,
          text,
          time: 'Just now',
          read: false,
          type: 'message' as const
        },
        ...prev
      ].slice(0, 50));

      if (currentScreen !== 'Chat') {
        setToastMessage(text);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:deleted', handleTaskDeleted);
    socket.on('auth:banned', handleAuthBanned);
    socket.on('message:received', handleMessageReceived);

    // If already connected (e.g. fast re-render), emit join immediately
    if (socket.connected) handleConnect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('task:created', handleTaskCreated);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('task:deleted', handleTaskDeleted);
      socket.off('auth:banned', handleAuthBanned);
      socket.off('message:received', handleMessageReceived);
    };
  }, [isLoggedIn, currentUser, currentScreen, channelNames]);

  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;

    const checkSession = () => {
      validateSession()
        .then(user => setCurrentUser(user))
        .catch(err => {
          console.error('Session revoked:', err);
          endSession((err as Error).message || 'Your session has expired. Please log in again.');
        });
    };

    window.addEventListener('focus', checkSession);
    const intervalId = window.setInterval(checkSession, 15000);

    return () => {
      window.removeEventListener('focus', checkSession);
      window.clearInterval(intervalId);
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
    console.log('[Socket] 🔌 Disconnected on logout.');
    endSession();
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
          setSignInError(null);
          setCurrentUser(user);
          setIsLoggedIn(true);
        }} initialError={signInError} />
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
          notifications={notifications}
          onClearNotifications={() => setNotifications([])}
          onMarkAllRead={() => setNotifications(prev => prev.map(notification => ({ ...notification, read: true })))}
        />

        {/* Dynamic Inner Panel Viewport */}
        <div className={`flex-1 min-h-0 bg-surface-container-lowest/20 ${
          currentScreen === 'Chat' ? 'overflow-hidden' : 'overflow-y-auto'
        }`}>
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
            currentUser={currentUser}
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
