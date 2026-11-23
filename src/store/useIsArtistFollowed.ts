import { useSyncExternalStore } from 'react';
import { followedArtistsStore } from './followedArtistsStore';

export function useIsArtistFollowed(artist: string): boolean {
  return useSyncExternalStore(
    followedArtistsStore.subscribe,
    () => followedArtistsStore.isFollowed(artist),
  );
}
