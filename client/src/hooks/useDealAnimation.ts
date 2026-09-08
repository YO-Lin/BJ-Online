import { useRef } from 'react';

export interface DealInfo {
  isNew: boolean;
  delayMs: number;
}

// How many card slots each seat gets before the ordering formula would start
// overlapping with the next seat's cards — generous headroom for hits/splits.
export const CARD_SLOT_STRIDE = 12;

// Deterministic stagger order: cardCount/baseOrder alone decide each card's delay,
// so the deal order (players first, dealer last) doesn't depend on React's hook-call
// order — the caller picks baseOrder (e.g. seatIndex * CARD_SLOT_STRIDE for a hand,
// maxHands * CARD_SLOT_STRIDE for the dealer, which always sorts after every seat).
export function useDealAnimation(cardCount: number, baseOrder: number, staggerStepMs = 550): DealInfo[] {
  const prevLenRef = useRef(0);
  const seenRef = useRef<Set<number>>(new Set());

  if (cardCount < prevLenRef.current) {
    // Hand shrank (e.g. a split moved a card out) — forget prior tracking for it.
    seenRef.current.clear();
  }

  const result: DealInfo[] = [];
  for (let i = 0; i < cardCount; i++) {
    const isNew = !seenRef.current.has(i);
    if (isNew) seenRef.current.add(i);
    result.push({ isNew, delayMs: isNew ? (baseOrder + i) * staggerStepMs : 0 });
  }

  prevLenRef.current = cardCount;
  return result;
}
