import { handValue, isPair, canDouble, canSplit, rankBucket } from './handEngine.js';

const COLS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

function row(values) {
  const r = {};
  COLS.forEach((c, i) => { r[c] = values[i]; });
  return r;
}

// From strategy1.jpg — hard totals 5-17 (18-21 always Stand, handled outside table)
export const HARD_TOTALS = {
  5: row(['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H']),
  6: row(['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H']),
  7: row(['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H']),
  8: row(['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H']),
  9: row(['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H']),
  10: row(['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H']),
  11: row(['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H']),
  12: row(['H', 'H', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H']),
  13: row(['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H']),
  14: row(['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H']),
  15: row(['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H']),
  16: row(['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H']),
  17: row(['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S']),
};

// From strategy1.jpg — soft totals A,2 .. A,9
export const SOFT_TOTALS = {
  'A,2': row(['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'H', 'H']),
  'A,3': row(['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'H', 'H']),
  'A,4': row(['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H']),
  'A,5': row(['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H']),
  'A,6': row(['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H']),
  'A,7': row(['S', 'DS', 'DS', 'DS', 'DS', 'S', 'S', 'H', 'H', 'H']),
  'A,8': row(['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S']),
  'A,9': row(['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S']),
};

// From strategy2.jpg — pairs
export const PAIRS = {
  '2,2': row(['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H']),
  '3,3': row(['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H']),
  '4,4': row(['H', 'H', 'H', 'P', 'P', 'H', 'H', 'H', 'H', 'H']),
  '5,5': row(['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H']),
  '6,6': row(['P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H', 'H']),
  '7,7': row(['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H']),
  '8,8': row(['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P']),
  '9,9': row(['P', 'P', 'P', 'P', 'P', 'S', 'P', 'P', 'S', 'S']),
  '10,10': row(['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S']),
  'A,A': row(['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P']),
};

function dealerCol(upCard) {
  return rankBucket(upCard.rank);
}

// hand: { cards, splitDepth, isSplitAces }, dealerUp: card
// Returns one of 'H' | 'S' | 'D' | 'P' (already resolved for D/DS fallback)
export function lookupAction(hand, dealerUp) {
  const col = dealerCol(dealerUp);
  const { total, soft } = handValue(hand.cards);

  if (isPair(hand.cards) && canSplit(hand)) {
    const key = `${rankBucket(hand.cards[0].rank)},${rankBucket(hand.cards[1].rank)}`;
    const action = PAIRS[key][col];
    if (action === 'P') return 'P';
    return resolveDouble(action, hand, total);
  }

  if (soft && total <= 21) {
    const otherCardTotal = total - 11; // value of the non-ace-as-11 portion
    const clamped = Math.min(Math.max(otherCardTotal, 2), 9);
    const key = `A,${clamped}`;
    const action = SOFT_TOTALS[key][col];
    return resolveDouble(action, hand, total);
  }

  const clampedTotal = Math.min(Math.max(total, 5), 17);
  if (total >= 18) return 'S';
  const action = HARD_TOTALS[clampedTotal][col];
  return resolveDouble(action, hand, total);
}

function resolveDouble(action, hand, total) {
  if (action === 'D') {
    return canDouble(hand) ? 'D' : 'H';
  }
  if (action === 'DS') {
    return canDouble(hand) ? 'D' : 'S';
  }
  return action;
}
