import { useState, type CSSProperties } from 'react';
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
};

const STATUS_LABEL: Record<string, string> = {
  BETTING: '下注中',
  ACTING: '行動中',
  STAND: '停牌',
  BUST: '爆牌',
  DOUBLED: '已加倍',
  BLACKJACK: '21點',
  DONE: '完成',
};

export function HandView({
  socket,
  hand,
  ownerNickname,
  isMine,
  isActive,
  canDouble,
  canSplit,
  style,
}: {
  socket: Socket;
  hand: HandState;
  ownerNickname: string;
  isMine: boolean;
  isActive: boolean;
  canDouble: boolean;
  canSplit: boolean;
  style?: CSSProperties;
}) {
  const [hint, setHint] = useState<string | null>(null);
  const total = handTotalLabel(hand);
  const dealInfo = useDealAnimation(hand.id, hand.cards.length);

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
    <div className={`hand-box ${isActive ? 'hand-active' : ''}`} style={style}>
      <div className="hand-header">
        <span>{ownerNickname}</span>
        <span>下注 {hand.bet}</span>
      </div>
      <div className="cards-row">
        {hand.cards.map((c, i) => (
          <CardView key={i} card={c} isNew={dealInfo[i]?.isNew} delayMs={dealInfo[i]?.delayMs} />
        ))}
      </div>
      <div className="hand-footer">
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
