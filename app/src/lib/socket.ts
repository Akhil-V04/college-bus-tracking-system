import { io, Socket } from 'socket.io-client';

import { API_ORIGIN } from '@/lib/api';

export function createLiveSocket(token?: string | null): Socket {
  return io(API_ORIGIN, {
    autoConnect: false,
    transports: ['websocket'],
    auth: token ? { token } : undefined,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
}
