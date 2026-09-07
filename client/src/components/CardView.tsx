import type { Card, HiddenCard } from '../types';
import { isHidden } from '../types';
import { cardImageUrl } from '../cardImages';

export function CardView({
  card,
  isNew,
  delayMs,
}: {
  card: Card | HiddenCard;
  isNew?: boolean;
  delayMs?: number;
}) {
  const style = isNew && delayMs ? { animationDelay: `${delayMs}ms` } : undefined;
  const dealingClass = isNew ? 'card-dealing' : '';

  if (isHidden(card)) {
    return <div className={`card card-back ${dealingClass}`} style={style} aria-label="隱藏的牌" />;
  }
  return (
    <img
      className={`card card-image ${dealingClass}`}
      style={style}
      src={cardImageUrl(card.rank, card.suit)}
      alt={`${card.rank} of ${card.suit}`}
    />
  );
}
