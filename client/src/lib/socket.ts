import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Connects once per session; the server authenticates via the session cookie. */
export function connectSocket(): Socket {
  socket ??= io({ withCredentials: true });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
