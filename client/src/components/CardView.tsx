import type { Card, HiddenCard } from '../types';
import { isHidden } from '../types';

const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED_SUITS = new Set(['H', 'D']);

export function CardView({ card }: { card: Card | HiddenCard }) {
  if (isHidden(card)) {
    return <div className="card card-back" aria-label="隱藏的牌" />;
  }
  const red = RED_SUITS.has(card.suit);
  return (
    <div className={`card ${red ? 'card-red' : 'card-black'}`}>
      <span>{card.rank}</span>
      <span>{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}
