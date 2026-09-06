import { TOTAL_CARDS } from './shoe.js';

const CARD_VALUE = {
  '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
  '7': 0, '8': 0, '9': 0,
  '10': -1, J: -1, Q: -1, K: -1, A: -1,
};

export function hiLoValue(card) {
  return CARD_VALUE[card.rank];
}

// Called every time a card becomes visible to the table.
export function revealCard(roomState, card) {
  roomState.count.running += hiLoValue(card);
}

export function decksRemaining(cardsSeen) {
  const remaining = (TOTAL_CARDS - cardsSeen) / 52;
  return Math.max(remaining, 0.5);
}

export function trueCount(roomState) {
  const remaining = decksRemaining(roomState.shoe.cardsSeen);
  const raw = roomState.count.running / remaining;
  return {
    runningCount: roomState.count.running,
    cardsSeen: roomState.shoe.cardsSeen,
    decksRemaining: Math.round(remaining * 100) / 100,
    trueCount: Math.round(raw * 10) / 10,
  };
}
