import { io, Socket } from 'socket.io-client';

import { getApiOrigin } from '@/lib/api';

export function createLiveSocket(token?: string | null): Socket {
  return io(getApiOrigin(), {
    autoConnect: false,
    transports: ['websocket'],
    auth: token ? { token } : undefined,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
}
