import type { HandState } from './types';

export function canDoubleHand(hand: HandState): boolean {
  return hand.cards.length === 2 && !hand.isSplitAces;
}

export function canSplitHand(hand: HandState): boolean {
  return (
    hand.cards.length === 2 &&
    hand.cards[0].rank === hand.cards[1].rank &&
    hand.splitDepth < 2 &&
    !hand.isSplitAces
  );
}
