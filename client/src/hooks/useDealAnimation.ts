import { useRef } from 'react';

export interface DealInfo {
  isNew: boolean;
  delayMs: number;
}

// Monotonically increasing across the whole app lifetime. RoomScreen calls this hook
// once per hand (in a fixed seat order) and once for the dealer on every render, so
// cards discovered "new" earlier in that fixed order get an earlier stagger slot —
// giving a consistent one-at-a-time deal order across all connected clients, since
// everyone renders from the same room:state snapshot in the same order.
let globalDealCounter = 0;

const prevLengths = new Map<string, number>();
const seenKeys = new Set<string>();
const orderByKey = new Map<string, number>();

// Call this whenever a new round begins (e.g. phase transitions back to
// WAITING_FOR_BETS). Without it, the stagger delay would keep growing forever across
// a long session since globalDealCounter only ever increases.
export function resetDealAnimation() {
  globalDealCounter = 0;
  prevLengths.clear();
  seenKeys.clear();
  orderByKey.clear();
}

export function useDealAnimation(handKey: string, cardCount: number, staggerStepMs = 150): DealInfo[] {
  // Ref just to give each hook call a stable identity; the actual bookkeeping lives in
  // module-level maps keyed by handKey so it survives remounts of the hand component.
  useRef(handKey);

  const prevLen = prevLengths.get(handKey) ?? 0;
  const shrank = cardCount < prevLen;

  if (shrank) {
    for (const key of Array.from(seenKeys)) {
      if (key.startsWith(`${handKey}:`)) seenKeys.delete(key);
    }
  }

  const result: DealInfo[] = [];
  for (let i = 0; i < cardCount; i++) {
    const key = `${handKey}:${i}`;
    const isNew = !seenKeys.has(key);
    if (isNew) {
      seenKeys.add(key);
      if (!orderByKey.has(key)) {
        orderByKey.set(key, globalDealCounter++);
      }
    }
    const order = orderByKey.get(key) ?? 0;
    result.push({ isNew, delayMs: isNew ? order * staggerStepMs : 0 });
  }

  prevLengths.set(handKey, cardCount);
  return result;
}
