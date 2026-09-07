import type { Rank, Suit } from './types';

const RANK_WORD: Record<Rank, string> = {
  '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six',
  '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten',
  J: 'jack', Q: 'queen', K: 'king', A: 'ace',
};

const SUIT_WORD: Record<Suit, string> = {
  S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs',
};

export function cardImageUrl(rank: Rank, suit: Suit): string {
  return `/cards/${RANK_WORD[rank]}-of-${SUIT_WORD[suit]}.jpeg`;
}
