import { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { HandState } from '../types';
import { CardView } from './CardView';
import { useDealAnimation } from '../hooks/useDealAnimation';

const RESULT_LABEL: Record<string, string> = {
  WIN: '贏',
  LOSS: '輸',
  PUSH: '平手',
  BLACKJACK_WIN: '21點！',
  INSURANCE_WIN: '保險理賠',
  SURRENDER: '投降',
  EVEN_MONEY: '等額1:1',
};

const STATUS_LABEL: Record<string, string> = {
  BETTING: '下注中',
  ACTING: '行動中',
  STAND: '停牌',
  BUST: '爆牌',
  DOUBLED: '已加倍',
  BLACKJACK: '21點',
  SURRENDERED: '已投降',
  EVEN_MONEY: '已拿等額1:1',
  DONE: '完成',
};

// Renders a single hand's cards/chips/status/buttons. Positioning, the shared seat
// frame, and the owner's nickname (shown once per seat, not once per hand) all live
// one level up in SeatGroup — a split seat holds several of these side by side.
export function HandView({
  socket,
  hand,
  isMine,
  isActive,
  canDouble,
  canSplit,
  dealOrders,
  payout,
}: {
  socket: Socket;
  hand: HandState;
  isMine: boolean;
  isActive: boolean;
  canDouble: boolean;
  canSplit: boolean;
  dealOrders: number[];
  payout?: number;
}) {
  const [hint, setHint] = useState<string | null>(null);
  const total = handTotalLabel(hand);
  const dealInfo = useDealAnimation(hand.cards.length, dealOrders);

  function act(event: string) {
    socket.emit(`action:${event}`, { handId: hand.id });
    setHint(null);
  }

  function requestHint() {
    socket.emit('strategy:hint', { handId: hand.id }, (res: { action?: string; error?: string }) => {
      setHint(res.action ?? res.error ?? '無法取得建議');
    });
  }

  // A split hand's cards overlap front-to-back instead of fanning out, so several
  // hands can sit compactly side by side in the same seat. An unsplit hand keeps
  // the original fanned-out look.
  const isSplitHand = hand.splitDepth > 0;
  const fanCenter = (hand.cards.length - 1) / 2;

  return (
    <div className={`seat-column ${isActive ? 'seat-active' : ''}`}>
      <div className="seat-cards">
        {hand.cards.map((c, i) => (
          <div
            key={i}
            className={isSplitHand ? 'seat-card-stack' : 'seat-card-fan'}
            style={
              isSplitHand
                ? { marginTop: i === 0 ? 0 : -34 }
                : { marginLeft: i === 0 ? 0 : -12, transform: `rotate(${(i - fanCenter) * 10}deg)` }
            }
          >
            <CardView card={c} isNew={dealInfo[i]?.isNew} delayMs={dealInfo[i]?.delayMs} />
          </div>
        ))}
      </div>

      <div className="seat-square">
        <div className="chip-stack">
          {/* Doubling down places a second matching stack beside the original
              bet, same as a real table, instead of just showing one chip with
              the combined number. wasDoubled persists even if the hand later
              busts, so the stack doesn't collapse back to one chip. */}
          {(hand.wasDoubled ? [hand.bet / 2, hand.bet / 2] : [hand.bet]).map((amount, i) => (
            <div
              key={i}
              className={`seat-chip ${payout !== undefined && payout < 0 ? 'chip-collected' : ''}`}
            >
              {amount}
            </div>
          ))}
        </div>
        {payout !== undefined && payout > 0 && (
          <div className="seat-chip seat-chip-win">+{payout}</div>
        )}
      </div>

      <div className="seat-info">
        <div className="seat-total">
          <span>{total}</span>
          <span>{STATUS_LABEL[hand.status] ?? hand.status}</span>
          {hand.result && <span className="result-badge">{RESULT_LABEL[hand.result]}</span>}
        </div>
        {isMine && isActive && (
          <div className="action-row">
            <button onClick={() => act('hit')}>要牌</button>
            <button onClick={() => act('stand')}>停牌</button>
            <button disabled={!canDouble} onClick={() => act('double')}>加倍</button>
            <button disabled={!canSplit} onClick={() => act('split')}>分牌</button>
            {/* Surrender is only ever valid on the hand's first decision — same
                eligibility as doubling, so canDouble is reused here. */}
            <button disabled={!canDouble} onClick={() => act('surrender')}>投降</button>
          </div>
        )}
        {isMine && (
          <div className="hint-row">
            {hint ? <span className="hint-text">建議：{hint}</span> : (
              <button className="hint-btn" onClick={requestHint}>顯示策略建議</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function handTotalLabel(hand: HandState): string {
  let total = 0;
  let aces = 0;
  for (const c of hand.cards) {
    if (c.rank === 'A') { total += 11; aces += 1; }
    else if (['J', 'Q', 'K'].includes(c.rank)) total += 10;
    else total += Number(c.rank);
  }
  let reduced = 0;
  while (total - reduced * 10 > 21 && reduced < aces) reduced += 1;
  total -= reduced * 10;
  const soft = aces - reduced > 0;
  return soft ? `軟 ${total}` : `${total}`;
}
