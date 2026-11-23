import type { Track } from '../types';

type Listener = () => void;

/**
 * Liked songs — local-only, same spirit as followedArtistsStore (no
 * account, nothing synced). Kept separate from "followed artists"
 * because a like is per-track, not per-artist, but both feed Home's
 * personalization (see HomeScreen.buildPersonalizedShelves).
 *
 * Caches the array snapshot and only rebuilds it on an actual change —
 * useSyncExternalStore requires getSnapshot to return a stable
 * reference when nothing changed, or React re-renders forever.
 */
class LikedTracksStore {
  private tracks = new Map<string, Track>();
  private snapshot: Track[] = [];
  private listeners = new Set<Listener>();

  getTracks = (): Track[] => this.snapshot;

  isLiked = (trackId: string): boolean => this.tracks.has(trackId);

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  toggle(track: Track) {
    if (this.tracks.has(track.id)) this.tracks.delete(track.id);
    else this.tracks.set(track.id, track);
    this.snapshot = Array.from(this.tracks.values());
    this.listeners.forEach(l => l());
  }
}

export const likedTracksStore = new LikedTracksStore();
