import { useSyncExternalStore } from 'react';
import { playerStore, type PlayerState } from './playerStore';

export function usePlayerState(): PlayerState {
  return useSyncExternalStore(playerStore.subscribe, playerStore.getState);
}
