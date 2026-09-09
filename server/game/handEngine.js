export function cardValue(rank) {
  if (rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  return Number(rank);
}

// Returns { total, soft } where soft = true if an Ace is still counted as 11.
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += cardValue(card.rank);
    if (card.rank === 'A') aces += 1;
  }
  let reduced = 0;
  while (total - reduced * 10 > 21 && reduced < aces) {
    reduced += 1;
  }
  total -= reduced * 10;
  const soft = aces - reduced > 0;
  return { total, soft };
}

export function isBust(cards) {
  return handValue(cards).total > 21;
}

export function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function isPair(cards) {
  if (cards.length !== 2) return false;
  return rankBucket(cards[0].rank) === rankBucket(cards[1].rank);
}

export function rankBucket(rank) {
  if (['10', 'J', 'Q', 'K'].includes(rank)) return '10';
  return rank;
}

export function canSplit(hand) {
  return isPair(hand.cards) && hand.splitDepth < 2 && !hand.isSplitAces;
}

export function canDouble(hand) {
  if (hand.cards.length !== 2) return false;
  if (hand.isSplitAces) return false;
  return true;
}

// Surrender is only ever a valid choice on the hand's very first decision —
// same eligibility as doubling (exactly 2 cards, not a split-aces hand).
export function canSurrender(hand) {
  return canDouble(hand);
}

export function dealerUpCard(dealerHand) {
  return dealerHand.cards[0];
}
