/**
 * Singleton Socket.io client instance.
 *
 * Uses autoConnect: false so we control exactly when to connect
 * (on login) and disconnect (on logout).
 *
 * Auth: the JWT stored in localStorage is attached to every handshake
 * so the server's io.use() middleware can authenticate the socket
 * before the connection is accepted.
 */
import { io } from 'socket.io-client';
import { getToken } from '../api';

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

/**
 * Returns the singleton socket, always fresh-stamping the auth token
 * so a newly-minted token is picked up after login without creating
 * a second socket instance.
 */
function buildSocket() {
  return io(API_URL, {
    autoConnect: false,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    // Attach the current JWT so the server's io.use() guard accepts the connection.
    auth: (cb) => {
      cb({ token: getToken() ?? '' });
    },
  });
}

export const socket = buildSocket();
