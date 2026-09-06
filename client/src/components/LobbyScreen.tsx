import { useState } from 'react';
import type { Socket } from 'socket.io-client';

export function LobbyScreen({
  socket,
  nickname,
  chipBalance,
  onJoined,
  onShowChangelog,
}: {
  socket: Socket;
  nickname: string;
  chipBalance: number;
  onJoined: (roomId: string) => void;
  onShowChangelog: () => void;
}) {
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="centered-screen">
      <div className="auth-card">
        <h1>歡迎，{nickname}</h1>
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
        <div className="divider" />
        <button onClick={onShowChangelog}>更新日誌</button>
      </div>
    </div>
  );
}
