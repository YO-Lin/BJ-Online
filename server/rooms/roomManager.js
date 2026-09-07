import { randomUUID } from 'crypto';
import { createShoe } from '../game/shoe.js';

const rooms = new Map();
const MAX_SEATS = 6;
const MAX_HANDS = 7;
const EMPTY_ROOM_TTL_MS = 2 * 60 * 1000;

function makeRoomId() {
  return randomUUID().slice(0, 6).toUpperCase();
}

export function createRoom() {
  let roomId = makeRoomId();
  while (rooms.has(roomId)) roomId = makeRoomId();

  const room = {
    roomId,
    players: new Map(), // socketId -> seat
    seatOrder: [],
    shoe: createShoe(),
    count: { running: 0 },
    historyLog: [],
    roundNumber: 0,
    hands: [],
    dealerHand: null,
    phase: 'WAITING_FOR_BETS',
    activeHandIndex: -1,
    emptySince: null,
  };
  rooms.set(roomId, room);
  return room;
}

export function getRoom(roomId) {
  return rooms.get(roomId);
}

export function totalHandCount(room) {
  let n = 0;
  for (const seat of room.players.values()) n += seat.handIds.length;
  return n;
}

export function canAddHand(room) {
  return totalHandCount(room) < MAX_HANDS;
}

export function joinRoom(room, { socketId, userId, nickname }) {
  // Reconnect: same userId already has a seat under a different (stale) socketId.
  for (const [oldSocketId, seat] of room.players.entries()) {
    if (seat.userId === userId && oldSocketId !== socketId) {
      room.players.delete(oldSocketId);
      const idx = room.seatOrder.indexOf(oldSocketId);
      if (idx !== -1) room.seatOrder[idx] = socketId;
      seat.socketId = socketId;
      seat.connected = true;
      room.hands.forEach((h) => {
        if (h.ownerSocketId === oldSocketId) h.ownerSocketId = socketId;
      });
      room.players.set(socketId, seat);
      room.emptySince = null;
      return seat;
    }
  }

  if (room.players.has(socketId)) {
    room.players.get(socketId).connected = true;
    return room.players.get(socketId);
  }

  if (room.players.size >= MAX_SEATS) {
    throw new Error('房間已滿（最多6位玩家）');
  }

  const seat = { socketId, userId, nickname, connected: true, handIds: [] };
  room.players.set(socketId, seat);
  room.seatOrder.push(socketId);
  room.emptySince = null;
  return seat;
}

export function markDisconnected(room, socketId) {
  const seat = room.players.get(socketId);
  if (seat) seat.connected = false;
  if ([...room.players.values()].every((s) => !s.connected)) {
    room.emptySince = Date.now();
  }
}

export function sweepEmptyRooms() {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (room.emptySince && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
      rooms.delete(roomId);
    }
  }
}

export { MAX_SEATS, MAX_HANDS };
