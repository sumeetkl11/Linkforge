/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'Online' | 'Offline' | 'Away';
  avatar: string;
  commits: number;
  reviews: number;
  proficiency: number;
  google_id?: string;
  username?: string;
  avatar_url?: string;
}

export interface Comment {
  id: string;
  user: {
    name: string;
    avatar: string;
    role?: string;
  };
  content: string;
  timestamp: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Backlog' | 'Todo' | 'In Progress' | 'Review' | 'Done';
  assignee: User;
  dueDate: string;
  commentsCount: number;
  attachmentsCount: number;
  tags: string[];
  comments: Comment[];
}

export interface Channel {
  id: string;
  name: string;
  description: string;
}

export interface Message {
  id: string;
  user: User;
  content: string;
  timestamp: string;
  codeSnippet?: string;
  fileAttachment?: {
    name: string;
    size: string;
    type: string;
  };
  reactions?: {
    emoji: string;
    count: number;
  }[];
}

export interface Activity {
  id: string;
  type: 'commit' | 'message' | 'task_completion' | 'comment';
  user: User;
  description: string;
  detail?: string;
  timestamp: string;
}

export interface WikiPage {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  updatedAt: string;
  updatedBy: string;
}

export interface AppNotification {
  id: string;
  text: string;
  time: string;
  read: boolean;
  type: 'task' | 'message' | 'channel' | 'system';
}
