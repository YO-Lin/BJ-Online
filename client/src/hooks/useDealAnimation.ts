import { useRef } from 'react';

export interface DealInfo {
  isNew: boolean;
  delayMs: number;
}

// Only cards that appear as part of the very first reveal (the hand/dealer going
// from 0 cards to some cards in one update) get staggered using the caller-supplied
// order — that's the one moment multiple seats' cards actually land in the same
// room:state snapshot, so it's the only place a fake "dealt in round-robin order"
// makes sense.
//
// initialOrders[i] gives the stagger slot for the initial deal's card at index i,
// so the caller can make the reveal follow the real round-robin dealing order
// (every seat's first card, then the dealer's up card, then every seat's second
// card) instead of just dealing each seat's two cards back to back.
//
// Any later reveal is either:
// - a single card (a player hit/double/split, or the dealer's hole card arriving
//   alone) — shown immediately, no delay, since it's a real-time isolated event; or
// - a batch of 2+ cards landing in one update (the dealer's hole card PLUS however
//   many hits it takes to reach 17+, all resolved synchronously server-side and
//   broadcast together) — staggered one at a time via batchStepMs so the dealer's
//   own turn still reads as "dealt one at a time" instead of dumping every card at
//   once.
export function useDealAnimation(
  cardCount: number,
  initialOrders: number[],
  staggerStepMs = 400,
  batchStepMs = 1500
): DealInfo[] {
  const prevLenRef = useRef(0);
  const seenRef = useRef<Set<number>>(new Set());

  const prevLen = prevLenRef.current;
  if (cardCount < prevLen) {
    // Hand shrank (e.g. a split moved a card out) — forget prior tracking for it.
    seenRef.current.clear();
  }
  const isInitialDeal = prevLen === 0 && cardCount > 0;
  const newCount = Math.max(cardCount - prevLen, 0);
  const isBatchReveal = !isInitialDeal && newCount > 1;

  const result: DealInfo[] = [];
  for (let i = 0; i < cardCount; i++) {
    const isNew = !seenRef.current.has(i);
    if (isNew) seenRef.current.add(i);

    let delayMs = 0;
    if (isNew && isInitialDeal) {
      delayMs = (initialOrders[i] ?? 0) * staggerStepMs;
    } else if (isNew && isBatchReveal) {
      delayMs = (i - prevLen) * batchStepMs;
    }
    result.push({ isNew, delayMs });
  }

  prevLenRef.current = cardCount;
  return result;
}
