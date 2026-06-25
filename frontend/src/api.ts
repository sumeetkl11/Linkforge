/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task, Activity, Channel, Message, User, WikiPage } from './types';

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch('/api/tasks');
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

export async function createTask(task: Task): Promise<Task> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Failed to create task');
  return res.json();
}

export async function updateTask(taskId: string, task: Partial<Task>): Promise<Task> {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Failed to update task');
  return res.json();
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete task');
  const data = await res.json();
  return data.success;
}

export async function fetchActivities(): Promise<Activity[]> {
  const res = await fetch('/api/activities');
  if (!res.ok) throw new Error('Failed to fetch activities');
  return res.json();
}

export async function createActivity(activity: Omit<Activity, 'id'>): Promise<Activity> {
  const res = await fetch('/api/activities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(activity),
  });
  if (!res.ok) throw new Error('Failed to create activity');
  return res.json();
}

export async function fetchChannels(): Promise<Channel[]> {
  const res = await fetch('/api/channels');
  if (!res.ok) throw new Error('Failed to fetch channels');
  return res.json();
}

export async function createChannel(channel: Omit<Channel, 'id'>): Promise<Channel> {
  const res = await fetch('/api/channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(channel),
  });
  if (!res.ok) throw new Error('Failed to create channel');
  return res.json();
}

export async function fetchMessages(chatId: string, type?: 'channel' | 'dm', currentUserId?: string): Promise<Message[]> {
  let url = `/api/messages/${chatId}`;
  if (type) {
    url += `?type=${type}`;
    if (currentUserId) {
      url += `&currentUserId=${currentUserId}`;
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch messages for ${chatId}`);
  return res.json();
}

export async function sendMessage(channelId: string | null, message: Message, receiverId?: string): Promise<Message> {
  const res = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelId, message, receiverId }),
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

export async function fetchUsers(excludeId?: string): Promise<User[]> {
  const url = excludeId ? `/api/users?exclude=${excludeId}` : '/api/users';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function createUser(user: User): Promise<User> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
  if (!res.ok) throw new Error('Failed to save user');
  return res.json();
}

export async function resetDatabase(): Promise<boolean> {
  const res = await fetch('/api/reset', {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to reset database');
  const data = await res.json();
  return data.success;
}

export async function fetchWikiPages(): Promise<WikiPage[]> {
  const res = await fetch('/api/wiki');
  if (!res.ok) throw new Error('Failed to fetch wiki pages');
  return res.json();
}

export async function saveWikiPage(wiki: Partial<WikiPage>): Promise<WikiPage> {
  const res = await fetch('/api/wiki', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(wiki),
  });
  if (!res.ok) throw new Error('Failed to save wiki page');
  return res.json();
}

export async function deleteWikiPage(id: string): Promise<boolean> {
  const res = await fetch(`/api/wiki/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete wiki page');
  const data = await res.json();
  return data.success;
}

export async function loginUser(email: string): Promise<User> {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || 'Authentication failed');
  }
  return res.json();
}

