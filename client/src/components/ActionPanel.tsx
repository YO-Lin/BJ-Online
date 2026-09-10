import { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { HandState } from '../types';

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

// The sidebar's control panel for whichever hand is currently active — only shown
// when it's this player's own turn (see RoomScreen). Replaces the action/hint
// buttons that used to sit directly under each hand's cards on the table.
export function ActionPanel({
  socket,
  hand,
  canDouble,
  canSplit,
}: {
  socket: Socket;
  hand: HandState;
  canDouble: boolean;
  canSplit: boolean;
}) {
  const [hint, setHint] = useState<string | null>(null);

  function act(event: string) {
    socket.emit(`action:${event}`, { handId: hand.id });
    setHint(null);
  }

  function requestHint() {
    socket.emit('strategy:hint', { handId: hand.id }, (res: { action?: string; error?: string }) => {
      setHint(res.action ?? res.error ?? '無法取得建議');
    });
  }

  return (
    <section className="action-panel">
      <div className="seat-total">
        <span>{STATUS_LABEL[hand.status] ?? hand.status}</span>
      </div>
      <div className="action-row">
        <button onClick={() => act('hit')}>要牌</button>
        <button onClick={() => act('stand')}>停牌</button>
        <button disabled={!canDouble} onClick={() => act('double')}>加倍</button>
        <button disabled={!canSplit} onClick={() => act('split')}>分牌</button>
        {/* Surrender is only ever valid on the hand's first decision — same
            eligibility as doubling, so canDouble is reused here. */}
        <button disabled={!canDouble} onClick={() => act('surrender')}>投降</button>
      </div>
      <div className="hint-row">
        {hint ? <span className="hint-text">建議：{hint}</span> : (
          <button className="hint-btn" onClick={requestHint}>顯示策略建議</button>
        )}
      </div>
    </section>
  );
}
