import { handValue } from './handEngine.js';
import { drawCard } from './shoe.js';
import { revealCard } from './hiLo.js';

// Dealer stands on soft 17 (S17): hit while total < 17, or total == 17 with soft === false is a stand too.
// So: hit whenever total < 17, regardless of soft/hard, and stand at any 17+.
export function playDealerHand(roomState) {
  const dealerHand = roomState.dealerHand;
  while (true) {
    const { total } = handValue(dealerHand.cards);
    if (total >= 17) break;
    const card = drawCard(roomState.shoe);
    dealerHand.cards.push(card);
    revealCard(roomState, card);
  }
  return dealerHand;
}
