import type { CSSProperties } from 'react';
import type { HandState } from '../types';
import { HandView } from './HandView';

// One seat on the table. Normally holds exactly one hand; after a split it holds
// several (all sharing the same groupId), rendered side by side inside this one
// shared frame instead of each getting its own separate seat slot on the arc.
export function SeatGroup({
  hands,
  ownerNickname,
  mySocketId,
  activeHandId,
  style,
  seatIndex,
  maxHands,
  payouts,
}: {
  hands: HandState[];
  ownerNickname: string;
  mySocketId?: string;
  activeHandId: string | null;
  style?: CSSProperties;
  seatIndex: number;
  maxHands: number;
  payouts: Record<string, number>;
}) {
  const isMineGroup = hands[0]?.ownerSocketId === mySocketId;

  return (
    <div className="seat-group" style={style}>
      <div className="seat-group-name">{ownerNickname}{isMineGroup ? '（我）' : ''}</div>
      <div className="seat-group-hands">
        {hands.map((hand) => (
          <HandView
            key={hand.id}
            hand={hand}
            isActive={activeHandId === hand.id}
            dealOrders={[seatIndex, maxHands + 1 + seatIndex]}
            payout={payouts[hand.id]}
          />
        ))}
      </div>
    </div>
  );
}
