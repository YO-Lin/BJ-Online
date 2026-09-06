import { handValue, isBust, isBlackjack } from './handEngine.js';

// Resolves one hand against the final dealer hand. Returns { result, payout } where
// payout is the net chip change (can be negative) to apply to that hand's owner.
// Insurance is resolved separately (see resolveInsurance) since it settles before this.
export function resolveHand(hand, dealerHand, dealerHasBlackjack) {
  const bet = hand.bet;

  if (isBust(hand.cards)) {
    return { result: 'LOSS', payout: -bet };
  }

  const playerBJ = isBlackjack(hand.cards) && hand.splitDepth === 0;

  if (playerBJ && dealerHasBlackjack) {
    return { result: 'PUSH', payout: 0 };
  }
  if (playerBJ) {
    return { result: 'BLACKJACK_WIN', payout: Math.round(bet * 1.5) };
  }
  if (dealerHasBlackjack) {
    return { result: 'LOSS', payout: -bet };
  }

  if (isBust(dealerHand.cards)) {
    return { result: 'WIN', payout: bet };
  }

  const playerTotal = handValue(hand.cards).total;
  const dealerTotal = handValue(dealerHand.cards).total;

  if (playerTotal > dealerTotal) return { result: 'WIN', payout: bet };
  if (playerTotal < dealerTotal) return { result: 'LOSS', payout: -bet };
  return { result: 'PUSH', payout: 0 };
}

// Insurance pays 2:1 if the dealer has blackjack, otherwise the insurance stake is lost.
export function resolveInsurance(hand, dealerHasBlackjack) {
  if (!hand.insuranceBet) return 0;
  return dealerHasBlackjack ? hand.insuranceBet * 2 : -hand.insuranceBet;
}
