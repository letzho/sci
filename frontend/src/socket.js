import { io } from 'socket.io-client';
import { resolveSocketUrl } from './utils/apiHost';

const SOCKET_URL = resolveSocketUrl();

let socket = null;

/**
 * Lazily creates a single shared Socket.io connection for this browser tab.
 * Polling-first helps on mobile networks and corporate firewalls; upgrades to WebSocket when possible.
 */
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 25000,
    });
  }
  return socket;
}
