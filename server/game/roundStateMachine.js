import { randomUUID } from 'crypto';
import { drawCard } from './shoe.js';
import { revealCard } from './hiLo.js';
import { handValue, isBust, isBlackjack, canSplit, canDouble, dealerUpCard } from './handEngine.js';
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
    insuranceBet: null,
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

  // Deal two cards to each hand, then two to the dealer (first up, second hole).
  for (const hand of room.hands) {
    dealVisibleCard(room, hand.cards);
    dealVisibleCard(room, hand.cards);
    hand.status = 'ACTING';
  }
  const up = drawCard(room.shoe);
  room.dealerHand.cards.push(up);
  revealCard(room, up); // up-card is visible immediately
  const hole = drawCard(room.shoe); // hole card, not revealed/counted yet
  room.dealerHand.cards.push(hole);

  for (const hand of room.hands) {
    if (isBlackjack(hand.cards)) hand.status = 'BLACKJACK';
  }

  const up_ = dealerUpCard(room.dealerHand);
  if (up_.rank === 'A') {
    room.phase = 'INSURANCE';
    return;
  }
  if (['10', 'J', 'Q', 'K'].includes(up_.rank)) {
    // Silent peek, no insurance offer.
    if (isBlackjack(room.dealerHand.cards)) {
      finishWithDealerBlackjack(room);
      return;
    }
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
  if (hand.insuranceBet !== null) throw new GameError('已經做過保險決定');
  hand.insuranceBet = takeInsurance ? Math.floor(hand.bet / 2) : 0;

  const allDecided = room.hands.every((h) => h.insuranceBet !== null);
  if (allDecided) {
    resolveInsurancePhase(room);
  }
}

function resolveInsurancePhase(room) {
  if (isBlackjack(room.dealerHand.cards)) {
    finishWithDealerBlackjack(room);
  } else {
    beginPlayerTurns(room);
  }
}

function finishWithDealerBlackjack(room) {
  // Reveal hole card now since the round is ending.
  revealCard(room, room.dealerHand.cards[1]);
  room.phase = 'DEALER_TURN'; // transient, immediately resolved by caller via resolveRound
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
  hand.status = 'DOUBLED';
  dealVisibleCard(room, hand.cards);
  if (isBust(hand.cards)) hand.status = 'BUST';
  advanceTurn(room);
}

export function split(room, socketId, handId) {
  const hand = assertActiveHand(room, socketId, handId);
  if (!canSplit(hand)) throw new GameError('這手牌不能分牌');
  if (!canAddHand(room)) throw new GameError(`房間手牌數已達上限（${MAX_HANDS}手），無法分牌`);

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
    insuranceBet: null,
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
  const anyLive = room.hands.some((h) => h.status === 'STAND' || h.status === 'DOUBLED');
  if (anyLive) {
    revealCard(room, room.dealerHand.cards[1]);
    playDealerHand(room);
  } else {
    revealCard(room, room.dealerHand.cards[1]);
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
