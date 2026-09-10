import { trueCount } from '../game/hiLo.js';
import { MAX_HANDS } from '../rooms/roomManager.js';

const HOLE_HIDDEN_PHASES = new Set(['INSURANCE', 'EVEN_MONEY', 'PLAYER_TURNS']);

export function serializeRoom(room) {
  const dealerCards = room.dealerHand
    ? room.dealerHand.cards.map((c, i) => {
        if (i === 1 && HOLE_HIDDEN_PHASES.has(room.phase)) return { hidden: true };
        return c;
      })
    : [];

  return {
    roomId: room.roomId,
    phase: room.phase,
    roundNumber: room.roundNumber,
    maxHands: MAX_HANDS,
    players: [...room.players.values()].map((s) => ({
      socketId: s.socketId,
      nickname: s.nickname,
      connected: s.connected,
      handIds: s.handIds,
    })),
    hands: room.hands.map((h) => ({
      id: h.id,
      ownerSocketId: h.ownerSocketId,
      groupId: h.groupId,
      cards: h.cards,
      bet: h.bet,
      status: h.status,
      splitDepth: h.splitDepth,
      isSplitAces: h.isSplitAces,
      wasDoubled: h.wasDoubled,
      insuranceBet: h.insuranceBet,
      evenMoneyTaken: h.evenMoneyTaken,
      result: h.result,
    })),
    dealerCards,
    activeHandId: room.hands[room.activeHandIndex]?.id ?? null,
    count: trueCount(room),
    historyLog: room.historyLog,
  };
}
