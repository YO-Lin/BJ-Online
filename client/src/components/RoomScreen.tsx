import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { RoomState } from '../types';
import { CardView } from './CardView';
import { HandView } from './HandView';
import { CountDisplay } from './CountDisplay';
import { HistoryLog } from './HistoryLog';
import { useDealAnimation, resetDealAnimation } from '../hooks/useDealAnimation';
import { getSeatTransform } from '../tableSeats';

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
  const dealerDealInfo = useDealAnimation('dealer', roomState.dealerCards.length);

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

  useEffect(() => {
    if (roomState.phase === 'WAITING_FOR_BETS') {
      resetDealAnimation();
    }
  }, [roomState.phase, roomState.roundNumber]);

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
      <div className="room-main">
        <header className="room-header">
          <div>房號：<b>{roomState.roomId}</b>（分享給朋友加入）</div>
          <div>階段：{PHASE_LABEL[roomState.phase]} · 第 {roomState.roundNumber} 局 · 手牌 {totalHands}/{roomState.maxHands}</div>
          <div>籌碼：<b>{chipBalance}</b></div>
          <button onClick={onShowChangelog}>更新日誌</button>
          <button onClick={onLeave}>離開房間</button>
        </header>

        {lastError && <div className="error-banner">{lastError}</div>}

        <div className="table-felt">
          <svg className="table-svg" viewBox="0 0 1000 500" preserveAspectRatio="none">
            <defs>
              <path id="arcTitle" d="M 160 150 A 480 400 0 0 1 840 150" fill="none" />
              <path id="arcMain" d="M 55 330 A 500 300 0 0 1 945 330" fill="none" />
            </defs>
            <text fontSize="42" fill="#d4af37" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="bold">
              <textPath href="#arcTitle" startOffset="50%">BLACK JACK</textPath>
            </text>
            <text fontSize="20" fill="#c62828" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="bold">
              <textPath href="#arcTitle" startOffset="50%" dy="32">PAYS 3 TO 2</textPath>
            </text>
            <text fontSize="17" fill="#d4af37" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic">
              <textPath href="#arcMain" startOffset="50%">Dealer must stand on 17 and must draw to 16</textPath>
            </text>
          </svg>
          <div className="corner-text corner-text-left">2 TO 1</div>
          <div className="corner-text corner-text-right">INSURANCE PAYS 2 TO 1</div>

          <div className="dealer-area">
            <div className="count-title">莊家</div>
            <div className="cards-row">
              {roomState.dealerCards.map((c, i) => (
                <CardView key={i} card={c} isNew={dealerDealInfo[i]?.isNew} delayMs={dealerDealInfo[i]?.delayMs} />
              ))}
            </div>
          </div>

          {Array.from({ length: roomState.maxHands }).map((_, seatIndex) => {
            const hand = roomState.hands[seatIndex];
            const { left, top, rotation } = getSeatTransform(seatIndex, roomState.maxHands);
            const seatStyle = {
              left: `${left}%`,
              top: `${top}%`,
              transform: `translate(-50%, -50%) rotate(${45 + rotation}deg)`,
            };

            if (!hand) {
              return <div key={`empty-${seatIndex}`} className="seat-slot-empty" style={seatStyle} />;
            }

            const owner = roomState.players.find((p) => p.socketId === hand.ownerSocketId);
            return (
              <HandView
                key={hand.id}
                socket={socket}
                hand={hand}
                ownerNickname={owner?.nickname ?? '?'}
                isMine={hand.ownerSocketId === mySocketId}
                isActive={roomState.activeHandId === hand.id}
                canDouble={hand.cards.length === 2 && !hand.isSplitAces}
                canSplit={
                  hand.cards.length === 2 &&
                  hand.cards[0].rank === hand.cards[1].rank &&
                  hand.splitDepth < 3 &&
                  !hand.isSplitAces &&
                  totalHands < roomState.maxHands
                }
                style={seatStyle}
              />
            );
          })}
        </div>

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
      </div>

      <div className="room-sidebar">
        <CountDisplay count={roomState.count} />
        <HistoryLog history={roomState.historyLog} />
      </div>
    </div>
  );
}
