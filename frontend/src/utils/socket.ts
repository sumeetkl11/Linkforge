/**
 * Singleton Socket.io client instance.
 * Uses autoConnect: false so we control exactly when to connect
 * (on login) and disconnect (on logout).
 */
import { io } from 'socket.io-client';

export const socket = io('http://localhost:5000', {
  autoConnect: false,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
