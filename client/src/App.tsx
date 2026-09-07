import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { AuthResponse } from './api';
import type { RoomState } from './types';
import { createSocket } from './socket';
import { AuthScreen } from './components/AuthScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { RoomScreen } from './components/RoomScreen';
import './App.css';

const STORAGE_KEY = 'bj-auth';

export default function App() {
  const [auth, setAuth] = useState<AuthResponse | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [chipBalance, setChipBalance] = useState<number>(auth?.chipBalance ?? 0);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!auth) return;
    const newSocket = createSocket(auth.token);

    newSocket.on('room:state', (state: RoomState) => setRoomState(state));
    newSocket.on('chip:update', ({ newBalance }: { newBalance: number }) => setChipBalance(newBalance));
    newSocket.on('connect_error', (err: Error) => {
      console.error('連線失敗', err.message);
      if (err.message.includes('登入')) handleLogout();
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      setSocket(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  function handleAuthed(result: AuthResponse) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    setChipBalance(result.chipBalance);
    setAuth(result);
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
    setRoomState(null);
  }

  function handleLeaveRoom() {
    socket?.emit('room:leave');
    setRoomState(null);
  }

  if (!auth) {
    return <AuthScreen onAuthed={handleAuthed} />;
  }

  if (!socket) {
    return <div className="centered-screen">連線中...</div>;
  }

  if (!roomState) {
    return (
      <LobbyScreen
        socket={socket}
        nickname={auth.nickname}
        chipBalance={chipBalance}
        onJoined={() => {}}
      />
    );
  }

  return (
    <RoomScreen
      socket={socket}
      roomState={roomState}
      chipBalance={chipBalance}
      onLeave={handleLeaveRoom}
    />
  );
}
