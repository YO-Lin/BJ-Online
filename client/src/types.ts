export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type Suit = 'S' | 'H' | 'D' | 'C';
export type Card = { rank: Rank; suit: Suit };
export type HiddenCard = { hidden: true };

export type HandStatus =
  | 'BETTING' | 'ACTING' | 'STAND' | 'BUST' | 'DOUBLED' | 'BLACKJACK' | 'SURRENDERED' | 'EVEN_MONEY' | 'DONE';

export type HandResult = 'WIN' | 'LOSS' | 'PUSH' | 'BLACKJACK_WIN' | 'INSURANCE_WIN' | 'SURRENDER' | 'EVEN_MONEY' | null;

export interface HandState {
  id: string;
  ownerSocketId: string;
  cards: Card[];
  bet: number;
  status: HandStatus;
  splitDepth: number;
  isSplitAces: boolean;
  insuranceBet: number | null;
  evenMoneyTaken: boolean | null;
  result: HandResult;
}

export interface PlayerSeat {
  socketId: string;
  nickname: string;
  connected: boolean;
  handIds: string[];
}

export type RoomPhase = 'WAITING_FOR_BETS' | 'INSURANCE' | 'EVEN_MONEY' | 'PLAYER_TURNS' | 'DEALER_TURN' | 'PAYOUT';

export interface CountInfo {
  runningCount: number;
  cardsSeen: number;
  decksRemaining: number;
  trueCount: number;
}

export interface HistoryEntry {
  roundNumber: number;
  dealerCards: Card[];
  hands: { id: string; ownerSocketId: string; cards: Card[]; bet: number; result: HandResult }[];
}

export interface RoomState {
  roomId: string;
  phase: RoomPhase;
  roundNumber: number;
  maxHands: number;
  players: PlayerSeat[];
  hands: HandState[];
  dealerCards: (Card | HiddenCard)[];
  activeHandId: string | null;
  count: CountInfo;
  historyLog: HistoryEntry[];
}

export function isHidden(c: Card | HiddenCard): c is HiddenCard {
  return (c as HiddenCard).hidden === true;
}
