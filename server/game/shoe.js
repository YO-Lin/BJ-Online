const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['S', 'H', 'D', 'C'];
const DECK_COUNT = 6;
export const TOTAL_CARDS = DECK_COUNT * 52;

function buildSingleDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function createShoe() {
  let cards = [];
  for (let i = 0; i < DECK_COUNT; i++) {
    cards = cards.concat(buildSingleDeck());
  }
  shuffle(cards);
  return {
    cards,
    cardsSeen: 0,
    discardLog: [],
  };
}

export function drawCard(shoe) {
  if (shoe.cards.length === 0) {
    throw new Error('Shoe is empty — this should never happen with 312 cards, reset required');
  }
  const card = shoe.cards.pop();
  shoe.cardsSeen += 1;
  shoe.discardLog.push(card);
  return card;
}

export function resetShoe(roomState) {
  roomState.shoe = createShoe();
  roomState.count = { running: 0 };
  roomState.historyLog = [];
  roomState.roundNumber = 0;
}
