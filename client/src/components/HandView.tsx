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

// Renders a single hand's cards/chips/status — purely informational. Actions (hit/
// stand/double/split/surrender/hint) for whichever hand is active now live in the
// sidebar's ActionPanel instead, so a split seat doesn't get buttons crowding each
// of its hands. Positioning, the shared seat frame, and the owner's nickname (shown
// once per seat, not once per hand) all live one level up in SeatGroup.
export function HandView({
  hand,
  isActive,
  dealOrders,
  payout,
}: {
  hand: HandState;
  isActive: boolean;
  dealOrders: number[];
  payout?: number;
}) {
  const total = handTotalLabel(hand);
  const dealInfo = useDealAnimation(hand.cards.length, dealOrders);

  // A split hand's cards overlap front-to-back instead of fanning out, so several
  // hands can sit compactly side by side in the same seat. An unsplit hand keeps
  // the original fanned-out look.
  const isSplitHand = hand.splitDepth > 0;
  const fanCenter = (hand.cards.length - 1) / 2;

  return (
    <div className={`seat-column ${isActive ? 'seat-active' : ''}`}>
      {/* Tells everyone at the table (not just the acting player) which seat/hand
          the sidebar's action panel is currently controlling, since the buttons
          no longer sit directly under this hand's own cards. */}
      {isActive && <div className="active-turn-badge">▶ 行動中</div>}
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
