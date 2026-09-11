import { useState } from 'react';
import type { Socket } from 'socket.io-client';

export function LobbyScreen({
  socket,
  nickname,
  chipBalance,
  onJoined,
  onLogout,
}: {
  socket: Socket;
  nickname: string;
  chipBalance: number;
  onJoined: (roomId: string) => void;
  onLogout: () => void;
}) {
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [topUpInput, setTopUpInput] = useState('1000');
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);

  function createRoom() {
    setBusy(true);
    setError(null);
    socket.emit('room:create', {}, ({ roomId }: { roomId: string }) => {
      joinRoom(roomId);
    });
  }

  function joinRoom(roomId: string) {
    setBusy(true);
    setError(null);
    socket.emit('room:join', { roomId }, (res: { ok?: boolean; error?: string }) => {
      setBusy(false);
      if (res.error) setError(res.error);
      else onJoined(roomId);
    });
  }

  function topUp() {
    const amount = Number(topUpInput);
    if (!amount) return;
    setTopUpBusy(true);
    setTopUpError(null);
    socket.emit('chip:topup', { amount }, (res: { ok?: boolean; error?: string }) => {
      setTopUpBusy(false);
      if (res?.error) setTopUpError(res.error);
    });
  }

  return (
    <div className="centered-screen">
      <div className="auth-card">
        <div className="lobby-header">
          <h1>歡迎，{nickname}</h1>
          <button onClick={onLogout}>登出</button>
        </div>
        <p className="chip-line">目前籌碼：{chipBalance}</p>
        <button className="primary" disabled={busy} onClick={createRoom}>建立新房間</button>
        <div className="divider">或</div>
        <label>
          輸入房號加入
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="例如 A1B2C3"
            maxLength={6}
          />
        </label>
        <button disabled={busy || joinCode.length < 4} onClick={() => joinRoom(joinCode)}>
          加入房間
        </button>
        {error && <p className="error-text">{error}</p>}
        <div className="divider">籌碼不夠了？</div>
        <label>
          補充籌碼金額
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={topUpInput}
            onChange={(e) => setTopUpInput(e.target.value.replace(/[^0-9]/g, ''))}
          />
        </label>
        <button disabled={topUpBusy || !Number(topUpInput)} onClick={topUp}>
          儲值籌碼
        </button>
        {topUpError && <p className="error-text">{topUpError}</p>}
      </div>
    </div>
  );
}
