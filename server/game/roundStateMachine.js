import { randomUUID } from 'crypto';
import { drawCard } from './shoe.js';
import { revealCard } from './hiLo.js';
import { handValue, isBust, isBlackjack, canSplit, canDouble, canSurrender, dealerUpCard } from './handEngine.js';
import { resolveHand, resolveInsurance } from './payout.js';
import { playDealerHand } from './dealerEngine.js';
import { canAddHand, MAX_HANDS } from '../rooms/roomManager.js';

export class GameError extends Error {}

function assertPhase(room, phase) {
  if (room.phase !== phase) {
    throw new GameError(`此動作在目前階段（${room.phase}）不可用`);
  }
}

export function placeBet(room, socketId, amount) {
  assertPhase(room, 'WAITING_FOR_BETS');
  const seat = room.players.get(socketId);
  if (!seat) throw new GameError('你不在這個房間裡');
  if (amount <= 0) throw new GameError('下注金額必須大於0');
  if (!canAddHand(room)) throw new GameError(`房間手牌數已達上限（${MAX_HANDS}手）`);

  const hand = {
    id: randomUUID(),
    ownerSocketId: socketId,
    cards: [],
    bet: amount,
    status: 'BETTING',
    splitDepth: 0,
    isSplitAces: false,
    wasDoubled: false,
    insuranceBet: null,
    evenMoneyEligible: false,
    evenMoneyTaken: null,
    result: null,
  };
  room.hands.push(hand);
  seat.handIds.push(hand.id);
  return hand;
}

export function startRound(room) {
  assertPhase(room, 'WAITING_FOR_BETS');
  if (room.hands.length === 0) throw new GameError('至少要有一手下注才能開局');

  room.roundNumber += 1;
  room.dealerHand = { cards: [] };

  // Deal order: one card to each hand, then the dealer's up card, then a second
  // card to each hand. The dealer's second (hole) card is only drawn once all
  // players have finished acting (see runDealerTurn) — there is no early peek.
  for (const hand of room.hands) {
    dealVisibleCard(room, hand.cards);
    hand.status = 'ACTING';
  }
  dealVisibleCard(room, room.dealerHand.cards);
  for (const hand of room.hands) {
    dealVisibleCard(room, hand.cards);
  }

  for (const hand of room.hands) {
    if (isBlackjack(hand.cards)) hand.status = 'BLACKJACK';
  }

  // Even money: a natural blackjack can lock in a guaranteed 1:1 payout right now
  // instead of waiting to see if the dealer also has blackjack (which would push).
  // Offered whenever the dealer's up card is an Ace or any 10-value card.
  const up = dealerUpCard(room.dealerHand);
  const evenMoneyEligible = ['A', '10', 'J', 'Q', 'K'].includes(up.rank);
  for (const hand of room.hands) {
    // Tracked separately from `status` because taking even money changes the
    // hand's status away from 'BLACKJACK', but this flag must keep remembering
    // "this hand needed an even-money decision, not an insurance one."
    hand.evenMoneyEligible = hand.status === 'BLACKJACK' && evenMoneyEligible;
    hand.evenMoneyTaken = hand.evenMoneyEligible ? null : false;
  }

  if (up.rank === 'A') {
    room.phase = 'INSURANCE';
    return;
  }
  if (room.hands.some((h) => h.evenMoneyTaken === null)) {
    room.phase = 'EVEN_MONEY';
    return;
  }
  beginPlayerTurns(room);
}

function dealVisibleCard(room, targetCards) {
  const card = drawCard(room.shoe);
  targetCards.push(card);
  revealCard(room, card);
}

export function decideInsurance(room, socketId, handId, takeInsurance) {
  assertPhase(room, 'INSURANCE');
  const hand = findOwnedHand(room, socketId, handId);
  if (hand.evenMoneyEligible) throw new GameError('這手牌是Blackjack，請用等額支付決定');
  if (hand.insuranceBet !== null) throw new GameError('已經做過保險決定');
  hand.insuranceBet = takeInsurance ? Math.floor(hand.bet / 2) : 0;
  checkSettlementPhaseComplete(room);
}

export function decideEvenMoney(room, socketId, handId, takeEvenMoney) {
  if (room.phase !== 'INSURANCE' && room.phase !== 'EVEN_MONEY') {
    throw new GameError('現在不是可以決定等額支付的時機');
  }
  const hand = findOwnedHand(room, socketId, handId);
  if (hand.status !== 'BLACKJACK') throw new GameError('這手牌沒有資格拿等額支付');
  if (hand.evenMoneyTaken !== null) throw new GameError('已經做過等額支付的決定');
  hand.evenMoneyTaken = takeEvenMoney;
  if (takeEvenMoney) hand.status = 'EVEN_MONEY';
  checkSettlementPhaseComplete(room);
}

// No early peek: insurance bets / even-money choices are made blind and settled at
// resolveRound() once the dealer's hole card is actually dealt (see runDealerTurn).
function checkSettlementPhaseComplete(room) {
  if (room.phase === 'INSURANCE') {
    const allDecided = room.hands.every((h) =>
      h.evenMoneyEligible ? h.evenMoneyTaken !== null : h.insuranceBet !== null
    );
    if (allDecided) beginPlayerTurns(room);
  } else if (room.phase === 'EVEN_MONEY') {
    const allDecided = room.hands.every((h) => h.evenMoneyTaken !== null);
    if (allDecided) beginPlayerTurns(room);
  }
}

function beginPlayerTurns(room) {
  room.phase = 'PLAYER_TURNS';
  room.activeHandIndex = 0;
  skipDoneHands(room);
  if (room.activeHandIndex >= room.hands.length) {
    runDealerTurn(room);
  }
}

function skipDoneHands(room) {
  while (
    room.activeHandIndex < room.hands.length &&
    room.hands[room.activeHandIndex].status !== 'ACTING'
  ) {
    room.activeHandIndex += 1;
  }
}

function findOwnedHand(room, socketId, handId) {
  const hand = room.hands.find((h) => h.id === handId);
  if (!hand) throw new GameError('找不到這手牌');
  if (hand.ownerSocketId !== socketId) throw new GameError('不能操作別人的手牌');
  return hand;
}

function assertActiveHand(room, socketId, handId) {
  assertPhase(room, 'PLAYER_TURNS');
  const hand = findOwnedHand(room, socketId, handId);
  const activeHand = room.hands[room.activeHandIndex];
  if (!activeHand || activeHand.id !== handId) {
    throw new GameError('現在不是這手牌的回合');
  }
  return hand;
}

function advanceTurn(room) {
  room.activeHandIndex += 1;
  skipDoneHands(room);
  if (room.activeHandIndex >= room.hands.length) {
    runDealerTurn(room);
  }
}

export function hit(room, socketId, handId) {
  const hand = assertActiveHand(room, socketId, handId);
  dealVisibleCard(room, hand.cards);
  if (isBust(hand.cards)) {
    hand.status = 'BUST';
    advanceTurn(room);
  } else if (handValue(hand.cards).total === 21) {
    hand.status = 'STAND';
    advanceTurn(room);
  }
}

export function stand(room, socketId, handId) {
  const hand = assertActiveHand(room, socketId, handId);
  hand.status = 'STAND';
  advanceTurn(room);
}

export function double(room, socketId, handId) {
  const hand = assertActiveHand(room, socketId, handId);
  if (!canDouble(hand)) throw new GameError('這手牌不能加倍');
  hand.bet *= 2;
  hand.wasDoubled = true;
  hand.status = 'DOUBLED';
  dealVisibleCard(room, hand.cards);
  if (isBust(hand.cards)) hand.status = 'BUST';
  advanceTurn(room);
}

export function surrender(room, socketId, handId) {
  const hand = assertActiveHand(room, socketId, handId);
  if (!canSurrender(hand)) throw new GameError('這手牌不能投降');
  hand.status = 'SURRENDERED';
  advanceTurn(room);
}

export function split(room, socketId, handId) {
  const hand = assertActiveHand(room, socketId, handId);
  if (!canSplit(hand)) throw new GameError('這手牌不能分牌');
  // The room-wide MAX_HANDS cap only limits how many hands players can open by
  // betting — split is capped independently, purely by canSplit's own
  // splitDepth rule, so a full table can still split into more hands.

  const seat = room.players.get(socketId);
  const isAceSplit = hand.cards[0].rank === 'A';
  const [cardA, cardB] = hand.cards;

  hand.cards = [cardA];
  hand.splitDepth += 1;
  hand.isSplitAces = isAceSplit;

  const newHand = {
    id: randomUUID(),
    ownerSocketId: socketId,
    cards: [cardB],
    bet: hand.bet,
    status: 'ACTING',
    splitDepth: hand.splitDepth,
    isSplitAces: isAceSplit,
    wasDoubled: false,
    insuranceBet: null,
    evenMoneyEligible: false,
    evenMoneyTaken: false,
    result: null,
  };

  // Deal one card to each resulting hand immediately.
  dealVisibleCard(room, hand.cards);
  dealVisibleCard(room, newHand.cards);

  room.hands.splice(room.activeHandIndex + 1, 0, newHand);
  seat.handIds.push(newHand.id);

  if (isAceSplit) {
    hand.status = 'STAND'; // split aces: exactly one card, no further action
    newHand.status = 'STAND';
    advanceTurn(room);
  } else if (isBust(hand.cards)) {
    hand.status = 'BUST';
    advanceTurn(room);
  } else if (handValue(hand.cards).total === 21) {
    hand.status = 'STAND';
    advanceTurn(room);
  }
  // else: player continues acting on the same activeHandIndex (now the reduced-to-1-card hand)
}

function runDealerTurn(room) {
  room.phase = 'DEALER_TURN';

  // The dealer's second card is dealt now, only after every player has finished.
  const hole = drawCard(room.shoe);
  room.dealerHand.cards.push(hole);
  revealCard(room, hole);

  const anyLive = room.hands.some((h) => h.status === 'STAND' || h.status === 'DOUBLED');
  if (anyLive) {
    playDealerHand(room);
  }
}

// Called by the socket layer once phase is DEALER_TURN (either from dealer blackjack
// short-circuit or normal play) to compute payouts. Returns per-hand results; does not
// touch the database — the caller applies chip balance changes and persists them.
export function resolveRound(room) {
  const dealerHasBlackjack = isBlackjack(room.dealerHand.cards);
  const results = [];

  for (const hand of room.hands) {
    const insurancePayout = resolveInsurance(hand, dealerHasBlackjack);
    let handResult;
    if (hand.status === 'BUST') {
      handResult = { result: 'LOSS', payout: -hand.bet };
    } else if (hand.status === 'SURRENDERED') {
      handResult = { result: 'SURRENDER', payout: -Math.floor(hand.bet / 2) };
    } else if (hand.status === 'EVEN_MONEY') {
      // Locked in already — 1:1 regardless of how the dealer's hand actually turns out.
      handResult = { result: 'EVEN_MONEY', payout: hand.bet };
    } else {
      handResult = resolveHand(hand, room.dealerHand, dealerHasBlackjack);
    }
    hand.result = handResult.result;
    results.push({
      handId: hand.id,
      ownerSocketId: hand.ownerSocketId,
      result: handResult.result,
      payout: handResult.payout + insurancePayout,
      insurancePayout,
    });
  }

  room.historyLog.push({
    roundNumber: room.roundNumber,
    dealerCards: room.dealerHand.cards,
    hands: room.hands.map((h) => ({ id: h.id, ownerSocketId: h.ownerSocketId, cards: h.cards, bet: h.bet, result: h.result })),
  });

  room.phase = 'PAYOUT';
  return results;
}

export function backToBetting(room) {
  for (const seat of room.players.values()) seat.handIds = [];
  room.hands = [];
  room.dealerHand = null;
  room.activeHandIndex = -1;
  room.phase = 'WAITING_FOR_BETS';
}
