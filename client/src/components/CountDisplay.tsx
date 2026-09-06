import type { CountInfo } from '../types';

export function CountDisplay({ count }: { count: CountInfo }) {
  return (
    <div className="count-box">
      <div className="count-title">Hi-Lo 算牌</div>
      <div>流水數 (Running Count)：<b>{count.runningCount}</b></div>
      <div>已出牌數：{count.cardsSeen} / 剩餘副數：{count.decksRemaining}</div>
      <div>
        真數 (True Count) = {count.runningCount} ÷ {count.decksRemaining} = <b>{count.trueCount}</b>
      </div>
    </div>
  );
}
