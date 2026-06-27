import { io } from 'socket.io-client';
import { resolveSocketUrl } from './utils/apiHost';

const SOCKET_URL = resolveSocketUrl();

let socket = null;

/**
 * Lazily creates a single shared Socket.io connection for this browser tab.
 * The Agent Console and Client Portal are opened as separate browser
 * windows/tabs in the demo, so each naturally gets its own socket instance.
 */
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, { autoConnect: true, transports: ['websocket', 'polling'] });
  }
  return socket;
}
