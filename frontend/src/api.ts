/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task, Activity, Channel, Message, User, WikiPage } from './types';

// ── Auth token helpers ───────────────────────────────────────────────────────
// JWT is stored in localStorage and attached to every authenticated request.

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string): void {
  localStorage.setItem('token', token);
}

export function clearToken(): void {
  localStorage.removeItem('token');
}

// Decode the JWT payload (no verification — that's the server's job).
export function decodeToken(token: string): { id?: string; email?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

// Build headers with the Authorization bearer token when available.
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ── Tasks ────────────────────────────────────────────────────────────────────
export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch('/api/tasks', { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

export async function createTask(task: Task): Promise<Task> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Failed to create task');
  return res.json();
}

export async function updateTask(taskId: string, task: Partial<Task>): Promise<Task> {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Failed to update task');
  return res.json();
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete task');
  const data = await res.json();
  return data.success;
}

// ── Activities ───────────────────────────────────────────────────────────────
export async function fetchActivities(): Promise<Activity[]> {
  const res = await fetch('/api/activities', { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch activities');
  return res.json();
}

export async function createActivity(activity: Omit<Activity, 'id'>): Promise<Activity> {
  const res = await fetch('/api/activities', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(activity),
  });
  if (!res.ok) throw new Error('Failed to create activity');
  return res.json();
}

// ── Channels ─────────────────────────────────────────────────────────────────
export async function fetchChannels(): Promise<Channel[]> {
  const res = await fetch('/api/channels', { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch channels');
  return res.json();
}

export async function createChannel(channel: Omit<Channel, 'id'>): Promise<Channel> {
  const res = await fetch('/api/channels', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(channel),
  });
  if (!res.ok) throw new Error('Failed to create channel');
  return res.json();
}

// ── Messages ─────────────────────────────────────────────────────────────────
export async function fetchMessages(chatId: string, type?: 'channel' | 'dm', currentUserId?: string): Promise<Message[]> {
  let url = `/api/messages/${chatId}`;
  if (type) {
    url += `?type=${type}`;
    if (currentUserId) {
      url += `&currentUserId=${currentUserId}`;
    }
  }
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch messages for ${chatId}`);
  return res.json();
}

export async function sendMessage(channelId: string | null, message: Message, receiverId?: string): Promise<Message> {
  const res = await fetch('/api/messages', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ channelId, message, receiverId }),
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

// ── Users ────────────────────────────────────────────────────────────────────
export async function fetchUsers(excludeId?: string): Promise<User[]> {
  const url = excludeId ? `/api/users?exclude=${excludeId}` : '/api/users';
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function createUser(user: User): Promise<User> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(user),
  });
  if (!res.ok) throw new Error('Failed to save user');
  return res.json();
}

export async function resetDatabase(): Promise<boolean> {
  const res = await fetch('/api/reset', {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to reset database');
  const data = await res.json();
  return data.success;
}

// ── Wiki ─────────────────────────────────────────────────────────────────────
export async function fetchWikiPages(): Promise<WikiPage[]> {
  const res = await fetch('/api/wiki', { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch wiki pages');
  return res.json();
}

export async function saveWikiPage(wiki: Partial<WikiPage>): Promise<WikiPage> {
  const res = await fetch('/api/wiki', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(wiki),
  });
  if (!res.ok) throw new Error('Failed to save wiki page');
  return res.json();
}

export async function deleteWikiPage(id: string): Promise<boolean> {
  const res = await fetch(`/api/wiki/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete wiki page');
  const data = await res.json();
  return data.success;
}

// ── Authentication ───────────────────────────────────────────────────────────
// Login now requires a password (verified with bcrypt on the server).
export async function loginUser(email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || 'Authentication failed');
  }
  const data = await res.json();
  setToken(data.token);
  return { token: data.token, user: data.user };
}

export async function registerUser(email: string, password: string, name?: string): Promise<{ token: string; user: User }> {
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || 'Registration failed');
  }
  const data = await res.json();
  setToken(data.token);
  return { token: data.token, user: data.user };
}

// Validate the stored token against the server and return the current user.
export async function fetchCurrentUser(): Promise<User> {
  const res = await fetch('/api/auth/me', { headers: authHeaders() });
  if (!res.ok) throw new Error('Session invalid');
  return res.json();
}
