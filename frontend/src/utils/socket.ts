/**
 * Singleton Socket.io client instance.
 * Uses autoConnect: false so we control exactly when to connect
 * (on login) and disconnect (on logout).
 */
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';

export const socket = io(API_BASE_URL || window.location.origin, {
  autoConnect: false,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
