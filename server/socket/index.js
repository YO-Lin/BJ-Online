import { socketAuthMiddleware } from '../auth/authMiddleware.js';
import { createRoom, getRoom, joinRoom, markDisconnected } from '../rooms/roomManager.js';
import { serializeRoom } from './serialize.js';
import { GameError, placeBet, startRound, decideInsurance, decideEvenMoney, hit, stand, double, split, surrender, runDealerTurn, resolveRound, backToBetting } from '../game/roundStateMachine.js';
import {
  applyChipDelta,
  findById,
  MIN_STARTING_BALANCE,
  MAX_STARTING_BALANCE,
} from '../db/usersRepo.js';
import { resetShoe } from '../game/shoe.js';
import { lookupAction } from '../game/basicStrategy.js';
import { dealerUpCard } from '../game/handEngine.js';

function broadcastRoom(io, room) {
  io.to(room.roomId).emit('room:state', serializeRoom(room));
}

function handleError(socket, err) {
  if (err instanceof GameError) {
    socket.emit('error', { code: 'GAME_ERROR', message: err.message });
  } else {
    console.error(err);
    socket.emit('error', { code: 'INTERNAL', message: '發生未預期的錯誤' });
  }
}

// Resolve payouts and apply chip deltas. Only called once the dealer's cards have
// had time to finish their reveal animation on the client (see
// scheduleDealerTurnAndSettle) — never right when DEALER_TURN starts. The room
// stays in PAYOUT phase (results visible) until a player explicitly triggers
// 'round:continue' to move back to betting for the next round.
async function settleRound(io, room) {
  if (room.phase !== 'DEALER_TURN') return;
  const results = resolveRound(room);

  const balances = [];
  for (const r of results) {
    const seat = room.players.get(r.ownerSocketId);
    if (!seat) continue;
    const newBalance = await applyChipDelta(seat.userId, r.payout);
    balances.push({ socketId: r.ownerSocketId, userId: seat.userId, newBalance });
  }

  io.to(room.roomId).emit('round:result', { results, roundNumber: room.roundNumber });
  for (const b of balances) {
    io.to(b.socketId).emit('chip:update', { newBalance: b.newBalance });
  }

  broadcastRoom(io, room);
}

// Pause after the last hand finishes before the dealer starts drawing, so players
// get a beat to see the last action land instead of the dealer barreling in
// immediately. Matches client/src/hooks/useDealAnimation.ts's defaults so the
// payout results don't arrive (and settle chip balances) until the dealer's card
// reveal animation has actually finished playing on screen.
const DEALER_START_DELAY_MS = 1000;
const DEALER_CARD_REVEAL_STEP_MS = 1500; // useDealAnimation's batchStepMs
const FINAL_CARD_ANIMATION_MS = 900; // covers the deal-in keyframe (800ms) + slack

function scheduleDealerTurnAndSettle(io, room) {
  if (room.phase !== 'PLAYER_TURNS' || room.activeHandIndex < room.hands.length) return;
  if (room._dealerTurnScheduled) return;
  room._dealerTurnScheduled = true;

  setTimeout(() => {
    try {
      const cardsBefore = room.dealerHand.cards.length;
      runDealerTurn(room);
      broadcastRoom(io, room);

      const newCardCount = room.dealerHand.cards.length - cardsBefore;
      const revealDurationMs = newCardCount > 1
        ? (newCardCount - 1) * DEALER_CARD_REVEAL_STEP_MS + FINAL_CARD_ANIMATION_MS
        : FINAL_CARD_ANIMATION_MS;

      setTimeout(() => {
        settleRound(io, room).catch((err) => console.error('Failed to settle round', err));
      }, revealDurationMs);
    } catch (err) {
      console.error('Failed to run dealer turn', err);
    }
  }, DEALER_START_DELAY_MS);
}

// Broadcasts the room exactly once after an action, then — if that action just made
// this the last hand to finish — schedules the dealer's turn and settlement with the
// intended pauses instead of resolving everything instantly in the same tick.
function afterAction(io, room) {
  broadcastRoom(io, room);
  scheduleDealerTurnAndSettle(io, room);
}

export function attachSocketServer(io) {
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    // Send the real balance the moment we connect — don't make the client wait
    // until it joins a room. Without this, the lobby screen showed whatever
    // chipBalance was cached in localStorage from the last login/register call,
    // which goes stale the moment a round is actually played.
    findById(socket.userId)
      .then((user) => socket.emit('chip:update', { newBalance: user?.chip_balance ?? 0 }))
      .catch((err) => console.error('Failed to send initial chip balance', err));

    socket.on('room:create', (_payload, ack) => {
      const room = createRoom();
      ack?.({ roomId: room.roomId });
    });

    socket.on('room:join', async (payload, ack) => {
      try {
        const room = getRoom(payload?.roomId);
        if (!room) return ack?.({ error: '找不到這個房間' });
        joinRoom(room, { socketId: socket.id, userId: socket.userId, nickname: socket.nickname });
        socket.join(room.roomId);
        socket.data.roomId = room.roomId;
        const user = await findById(socket.userId);
        socket.emit('chip:update', { newBalance: user?.chip_balance ?? 0 });
        ack?.({ ok: true, roomState: serializeRoom(room) });
        broadcastRoom(io, room);
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    // Lets an existing account top up its chip balance (this is a practice site,
    // not real money, and there was previously no way to recover once a returning
    // player's balance hit 0 — new accounts could pick a starting amount, old ones
    // had no equivalent).
    socket.on('chip:topup', async (payload, ack) => {
      try {
        const amount = Number(payload?.amount);
        if (!Number.isInteger(amount) || amount < MIN_STARTING_BALANCE || amount > MAX_STARTING_BALANCE) {
          throw new GameError(`儲值金額要介於 ${MIN_STARTING_BALANCE} 到 ${MAX_STARTING_BALANCE} 之間的整數`);
        }
        const newBalance = await applyChipDelta(socket.userId, amount);
        socket.emit('chip:update', { newBalance });
        ack?.({ ok: true, newBalance });
      } catch (err) {
        handleError(socket, err);
        ack?.({ error: err.message });
      }
    });

    socket.on('room:leave', () => {
      const room = getRoom(socket.data.roomId);
      if (!room) return;
      socket.leave(room.roomId);
      markDisconnected(room, socket.id);
      broadcastRoom(io, room);
    });

    socket.on('bet:place', (payload) => {
      const room = getRoom(socket.data.roomId);
      if (!room) return;
      try {
        placeBet(room, socket.id, Number(payload?.amount));
        broadcastRoom(io, room);
      } catch (err) {
        handleError(socket, err);
      }
    });

    socket.on('round:start', (_payload, ack) => {
      const room = getRoom(socket.data.roomId);
      if (!room) return;
      try {
        startRound(room);
        afterAction(io, room);
        ack?.({ ok: true });
      } catch (err) {
        handleError(socket, err);
        ack?.({ error: err.message });
      }
    });

    socket.on('insurance:decide', (payload) => {
      const room = getRoom(socket.data.roomId);
      if (!room) return;
      try {
        decideInsurance(room, socket.id, payload?.handId, !!payload?.takeInsurance);
        afterAction(io, room);
      } catch (err) {
        handleError(socket, err);
      }
    });

    socket.on('evenMoney:decide', (payload) => {
      const room = getRoom(socket.data.roomId);
      if (!room) return;
      try {
        decideEvenMoney(room, socket.id, payload?.handId, !!payload?.takeEvenMoney);
        afterAction(io, room);
      } catch (err) {
        handleError(socket, err);
      }
    });

    // Surrender pays out immediately (see surrender()'s comment in roundStateMachine.js),
    // so it needs its own handler to apply the chip delta — unlike hit/stand/double/split
    // below, which never touch chip balances themselves.
    socket.on('action:surrender', async (payload) => {
      const room = getRoom(socket.data.roomId);
      if (!room) return;
      try {
        const payout = surrender(room, socket.id, payload?.handId);
        const seat = room.players.get(socket.id);
        const newBalance = await applyChipDelta(seat.userId, payout);
        socket.emit('chip:update', { newBalance });
        afterAction(io, room);
      } catch (err) {
        handleError(socket, err);
      }
    });

    const actionMap = { hit, stand, double, split };
    for (const [event, fn] of Object.entries(actionMap)) {
      socket.on(`action:${event}`, (payload) => {
        const room = getRoom(socket.data.roomId);
        if (!room) return;
        try {
          fn(room, socket.id, payload?.handId);
          afterAction(io, room);
        } catch (err) {
          handleError(socket, err);
        }
      });
    }

    socket.on('round:continue', () => {
      const room = getRoom(socket.data.roomId);
      if (!room) return;
      try {
        if (room.phase !== 'PAYOUT') {
          throw new GameError('現在不是可以繼續下一局的時機');
        }
        backToBetting(room);
        broadcastRoom(io, room);
      } catch (err) {
        handleError(socket, err);
      }
    });

    socket.on('shoe:reset', () => {
      const room = getRoom(socket.data.roomId);
      if (!room) return;
      if (room.phase !== 'WAITING_FOR_BETS') {
        return handleError(socket, new GameError('回合進行中無法重置牌靴'));
      }
      resetShoe(room);
      broadcastRoom(io, room);
    });

    socket.on('strategy:hint', (payload, ack) => {
      const room = getRoom(socket.data.roomId);
      if (!room) return ack?.({ error: '找不到房間' });
      const hand = room.hands.find((h) => h.id === payload?.handId);
      if (!hand || hand.ownerSocketId !== socket.id) return ack?.({ error: '找不到這手牌' });
      const action = lookupAction(hand, dealerUpCard(room.dealerHand));
      ack?.({ action });
    });

    socket.on('disconnect', () => {
      const room = getRoom(socket.data.roomId);
      if (!room) return;
      markDisconnected(room, socket.id);
      broadcastRoom(io, room);
    });
  });
}
