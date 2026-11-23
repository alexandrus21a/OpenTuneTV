import { useSyncExternalStore } from 'react';
import { likedTracksStore } from './likedTracksStore';

export function useIsTrackLiked(trackId: string): boolean {
  return useSyncExternalStore(likedTracksStore.subscribe, () => likedTracksStore.isLiked(trackId));
}
