import { socketAuthMiddleware } from '../auth/authMiddleware.js';
import { createRoom, getRoom, joinRoom, markDisconnected } from '../rooms/roomManager.js';
import { serializeRoom } from './serialize.js';
import { GameError, placeBet, startRound, decideInsurance, decideEvenMoney, hit, stand, double, split, surrender, resolveRound, backToBetting } from '../game/roundStateMachine.js';
import { applyChipDelta, findById } from '../db/usersRepo.js';
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

// If the round has reached DEALER_TURN, resolve payouts and apply chip deltas.
// The room stays in PAYOUT phase (results visible) until a player explicitly
// triggers 'round:continue' to move back to betting for the next round.
async function settleIfDealerTurn(io, room) {
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

export function attachSocketServer(io) {
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
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
        broadcastRoom(io, room);
        settleIfDealerTurn(io, room);
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
        broadcastRoom(io, room);
        settleIfDealerTurn(io, room);
      } catch (err) {
        handleError(socket, err);
      }
    });

    socket.on('evenMoney:decide', (payload) => {
      const room = getRoom(socket.data.roomId);
      if (!room) return;
      try {
        decideEvenMoney(room, socket.id, payload?.handId, !!payload?.takeEvenMoney);
        broadcastRoom(io, room);
        settleIfDealerTurn(io, room);
      } catch (err) {
        handleError(socket, err);
      }
    });

    const actionMap = { hit, stand, double, split, surrender };
    for (const [event, fn] of Object.entries(actionMap)) {
      socket.on(`action:${event}`, (payload) => {
        const room = getRoom(socket.data.roomId);
        if (!room) return;
        try {
          fn(room, socket.id, payload?.handId);
          broadcastRoom(io, room);
          settleIfDealerTurn(io, room);
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
