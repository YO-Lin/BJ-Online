import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { RoomState } from '../types';
import { CardView } from './CardView';
import { HandView } from './HandView';
import { CountDisplay } from './CountDisplay';
import { HistoryLog } from './HistoryLog';
import { useDealAnimation } from '../hooks/useDealAnimation';
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
}: {
  socket: Socket;
  roomState: RoomState;
  chipBalance: number;
  onLeave: () => void;
}) {
  const [betAmountInput, setBetAmountInput] = useState('50');
  const betAmount = Number(betAmountInput) || 0;
  const [lastError, setLastError] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<Record<string, number>>({});
  // Real round-robin deal order: every seat's first card (slots 0..maxHands-1),
  // then the dealer's up card (slot maxHands), then every seat's second card
  // (slots maxHands+1..2*maxHands).
  const dealerDealInfo = useDealAnimation(roomState.dealerCards.length, [roomState.maxHands]);

  useEffect(() => {
    function onError(err: { message: string }) {
      setLastError(err.message);
      setTimeout(() => setLastError(null), 4000);
    }
    function onRoundResult(payload: { results: { handId: string; payout: number }[] }) {
      const next: Record<string, number> = {};
      for (const r of payload.results) next[r.handId] = r.payout;
      setPayouts(next);
    }
    socket.on('error', onError);
    socket.on('round:result', onRoundResult);
    return () => {
      socket.off('error', onError);
      socket.off('round:result', onRoundResult);
    };
  }, [socket]);

  useEffect(() => {
    if (roomState.phase === 'WAITING_FOR_BETS') setPayouts({});
  }, [roomState.phase]);

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
  function continueToNextRound() {
    socket.emit('round:continue');
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
          <button onClick={onLeave}>離開房間</button>
        </header>

        {lastError && <div className="error-banner">{lastError}</div>}

        <div className="table-wrapper">
        <div className="table-felt">
          <svg className="table-svg" viewBox="0 0 1000 500" preserveAspectRatio="none">
            <defs>
              <path id="arcTitle" d="M 160 150 A 480 400 0 0 1 840 150" fill="none" />
              <path id="arcDealerRule" d="M 90 280 Q 500 100 910 280" fill="none" />
              <path id="seatArc" d="M 50 390 Q 500 60 950 390" fill="none" />
            </defs>
            <text fontSize="42" fill="#d4af37" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="bold">
              <textPath href="#arcTitle" startOffset="50%">BLACK JACK</textPath>
            </text>
            <text fontSize="20" fill="#c62828" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="bold">
              <textPath href="#arcTitle" startOffset="50%" dy="32">PAYS 3 TO 2</textPath>
            </text>
            <text fontSize="15" fill="#d4af37" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic">
              <textPath href="#arcDealerRule" startOffset="50%">Dealer must stand on 17 and must draw to 16</textPath>
            </text>
            <text fontSize="15" fill="#0b3d24" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="bold">
              <textPath href="#seatArc" startOffset="50%">INSURANCE PAYS 2 TO 1</textPath>
            </text>
          </svg>

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
            // Seats fill right-to-left: the first hand created sits in the rightmost slot.
            const arcIndex = roomState.maxHands - 1 - seatIndex;
            const { left, top } = getSeatTransform(arcIndex, roomState.maxHands);
            const seatStyle = {
              left: `${left}%`,
              top: `${top}%`,
              transform: 'translate(-50%, -50%)',
            };

            if (!hand) {
              return (
                <div key={`empty-${seatIndex}`} className="seat-square seat-square-empty" style={seatStyle} />
              );
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
                dealOrders={[seatIndex, roomState.maxHands + 1 + seatIndex]}
                payout={payouts[hand.id]}
              />
            );
          })}
        </div>
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
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={betAmountInput}
                onChange={(e) => setBetAmountInput(e.target.value.replace(/[^0-9]/g, ''))}
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

        {roomState.phase === 'PAYOUT' && (
          <section className="bet-controls">
            <button className="primary" onClick={continueToNextRound}>
              確認，開始下一局
            </button>
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
