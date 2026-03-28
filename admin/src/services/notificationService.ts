// @ts-ignore - socket.io-client types may not be recognized
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

/** Khi API là https://domain/api, Socket.IO phải dùng path /api/socket.io (Nginx rewrite → backend /socket.io). */
function getSocketConnectOptions(): { url: string; path: string } {
  const trimmed = API_BASE_URL.replace(/\/$/, '');
  if (trimmed.endsWith('/api')) {
    const origin = trimmed.slice(0, -4);
    return {
      url: `${origin}/notifications`,
      path: '/api/socket.io',
    };
  }
  return {
    url: `${trimmed}/notifications`,
    path: '/socket.io',
  };
}

class NotificationService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private lastConnectKey: string = '';

  connect(token: string) {
    const { url, path } = getSocketConnectOptions();
    const connectKey = `${url}|${path}|${token}`;
    if (this.socket?.connected && this.lastConnectKey === connectKey) {
      return;
    }

    this.disconnect();
    this.token = token;
    this.lastConnectKey = connectKey;

    this.socket = io(url, {
      path,
      auth: { token },
      query: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    this.socket.on('connect', () => {
      console.log('[notifications] connected', { path, url });
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('[notifications] disconnected', reason);
    });

    this.socket.on('new-order', (data: any) => {
      this.emitLocal('new-order', data);
    });

    this.socket.on('new-deposit-request', (data: any) => {
      this.emitLocal('new-deposit-request', data);
    });

    this.socket.on('new-withdraw-request', (data: any) => {
      this.emitLocal('new-withdraw-request', data);
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('[notifications] connect_error', error.message);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.lastConnectKey = '';
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emitLocal(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const notificationService = new NotificationService();
