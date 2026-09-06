import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { RoomState } from '../types';
import { CardView } from './CardView';
import { HandView } from './HandView';
import { CountDisplay } from './CountDisplay';
import { HistoryLog } from './HistoryLog';

const PHASE_LABEL: Record<string, string> = {
  WAITING_FOR_BETS: '等待下注',
  INSURANCE: '保險決定中',
  PLAYER_TURNS: '玩家回合',
  DEALER_TURN: '莊家回合',
  PAYOUT: '結算中',
};

export function RoomScreen({
  socket,
  roomState,
  chipBalance,
  onLeave,
  onShowChangelog,
}: {
  socket: Socket;
  roomState: RoomState;
  chipBalance: number;
  onLeave: () => void;
  onShowChangelog: () => void;
}) {
  const [betAmount, setBetAmount] = useState(50);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    function onError(err: { message: string }) {
      setLastError(err.message);
      setTimeout(() => setLastError(null), 4000);
    }
    socket.on('error', onError);
    return () => {
      socket.off('error', onError);
    };
  }, [socket]);

  const mySocketId = socket.id;
  const myHandIds = new Set(
    roomState.players.find((p) => p.socketId === mySocketId)?.handIds ?? []
  );
  const myHands = roomState.hands.filter((h) => myHandIds.has(h.id));
  const totalHands = roomState.hands.length;

  function placeBet() {
    socket.emit('bet:place', { amount: betAmount });
  }
  function startRound() {
    socket.emit('round:start', {}, (res: { error?: string }) => {
      if (res?.error) setLastError(res.error);
    });
  }
  function resetShoe() {
    socket.emit('shoe:reset');
  }
  function decideInsurance(handId: string, take: boolean) {
    socket.emit('insurance:decide', { handId, takeInsurance: take });
  }

  const insuranceHandsPending = myHands.filter((h) => h.insuranceBet === null);

  return (
    <div className="room-screen">
      <header className="room-header">
        <div>房號：<b>{roomState.roomId}</b>（分享給朋友加入）</div>
        <div>階段：{PHASE_LABEL[roomState.phase]} · 第 {roomState.roundNumber} 局 · 手牌 {totalHands}/{roomState.maxHands}</div>
        <div>籌碼：<b>{chipBalance}</b></div>
        <button onClick={onShowChangelog}>更新日誌</button>
        <button onClick={onLeave}>離開房間</button>
      </header>

      {lastError && <div className="error-banner">{lastError}</div>}

      <section className="dealer-area">
        <div className="count-title">莊家</div>
        <div className="cards-row">
          {roomState.dealerCards.map((c, i) => (
            <CardView key={i} card={c} />
          ))}
        </div>
      </section>

      {roomState.phase === 'INSURANCE' && insuranceHandsPending.length > 0 && (
        <section className="insurance-box">
          <p>莊家明牌是 A，是否購買保險？（最高下注一半，理賠 2:1）</p>
          {insuranceHandsPending.map((h) => (
            <div key={h.id} className="insurance-row">
              <span>下注 {h.bet} 的手牌</span>
              <button onClick={() => decideInsurance(h.id, true)}>買保險 ({Math.floor(h.bet / 2)})</button>
              <button onClick={() => decideInsurance(h.id, false)}>不買</button>
            </div>
          ))}
        </section>
      )}

      <section className="hands-area">
        {roomState.hands.map((h) => {
          const owner = roomState.players.find((p) => p.socketId === h.ownerSocketId);
          return (
            <HandView
              key={h.id}
              socket={socket}
              hand={h}
              ownerNickname={owner?.nickname ?? '?'}
              isMine={h.ownerSocketId === mySocketId}
              isActive={roomState.activeHandId === h.id}
              canDouble={h.cards.length === 2 && !h.isSplitAces}
              canSplit={
                h.cards.length === 2 &&
                h.cards[0].rank === h.cards[1].rank &&
                h.splitDepth < 3 &&
                !h.isSplitAces &&
                totalHands < roomState.maxHands
              }
            />
          );
        })}
      </section>

      {roomState.phase === 'WAITING_FOR_BETS' && (
        <section className="bet-controls">
          <label>
            下注金額
            <input
              type="number"
              min={1}
              max={chipBalance}
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
            />
          </label>
          <button
            className="primary"
            disabled={totalHands >= roomState.maxHands || betAmount <= 0 || betAmount > chipBalance}
            onClick={placeBet}
          >
            下注（可多次下注開多手）
          </button>
          <button className="primary" disabled={totalHands === 0} onClick={startRound}>
            開始發牌
          </button>
          <button onClick={resetShoe}>重置牌靴（洗回6副牌）</button>
        </section>
      )}

      <section className="players-list">
        {roomState.players.map((p) => (
          <span key={p.socketId} className={`player-chip ${p.connected ? '' : 'disconnected'}`}>
            {p.nickname}{p.socketId === mySocketId ? '（我）' : ''}{!p.connected ? ' · 已離線' : ''}
          </span>
        ))}
      </section>

      <CountDisplay count={roomState.count} />
      <HistoryLog history={roomState.historyLog} />
    </div>
  );
}
