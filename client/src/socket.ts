import { io, Socket } from 'socket.io-client';

export function createSocket(token: string): Socket {
  return io({
    auth: { token },
    autoConnect: true,
  });
}
