import { useRef } from 'react';

export interface DealInfo {
  isNew: boolean;
  delayMs: number;
}

// Only cards that appear as part of the very first reveal (the hand/dealer going
// from 0 cards to some cards in one update) get staggered — that's the one moment
// multiple seats' cards actually land in the same room:state snapshot, so it's the
// only place a fake "dealt one at a time" order makes sense. Every later card (a
// hit, a double, a split, or the dealer's hole card and subsequent hits) arrives
// alone in its own update and should appear immediately, not queued behind a huge
// backlog of earlier stagger slots.
//
// initialOrders[i] gives the stagger slot for the initial deal's card at index i,
// so the caller can make the reveal follow the real round-robin dealing order
// (every seat's first card, then the dealer's up card, then every seat's second
// card) instead of just dealing each seat's two cards back to back.
export function useDealAnimation(cardCount: number, initialOrders: number[], staggerStepMs = 400): DealInfo[] {
  const prevLenRef = useRef(0);
  const seenRef = useRef<Set<number>>(new Set());

  const prevLen = prevLenRef.current;
  if (cardCount < prevLen) {
    // Hand shrank (e.g. a split moved a card out) — forget prior tracking for it.
    seenRef.current.clear();
  }
  const isInitialDeal = prevLen === 0 && cardCount > 0;

  const result: DealInfo[] = [];
  for (let i = 0; i < cardCount; i++) {
    const isNew = !seenRef.current.has(i);
    if (isNew) seenRef.current.add(i);
    const order = initialOrders[i] ?? 0;
    const delayMs = isNew && isInitialDeal ? order * staggerStepMs : 0;
    result.push({ isNew, delayMs });
  }

  prevLenRef.current = cardCount;
  return result;
}
