import type { HistoryEntry } from '../types';

const RESULT_LABEL: Record<string, string> = {
  WIN: '贏', LOSS: '輸', PUSH: '平手', BLACKJACK_WIN: '21點', INSURANCE_WIN: '保險',
  SURRENDER: '投降', EVEN_MONEY: '等額1:1',
};

export function HistoryLog({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return <div className="history-box"><div className="count-title">牌局紀錄</div><p>尚無紀錄</p></div>;
  }
  return (
    <div className="history-box">
      <div className="count-title">牌局紀錄</div>
      <div className="history-list">
        {[...history].reverse().map((entry) => (
          <div key={entry.roundNumber} className="history-entry">
            <div>第 {entry.roundNumber} 局 — 莊家：{entry.dealerCards.map((c) => `${c.rank}${c.suit}`).join(' ')}</div>
            {entry.hands.map((h) => (
              <div key={h.id} className="history-hand-line">
                {h.cards.map((c) => `${c.rank}${c.suit}`).join(' ')} (注 {h.bet}) — {h.result ? RESULT_LABEL[h.result] : '-'}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
