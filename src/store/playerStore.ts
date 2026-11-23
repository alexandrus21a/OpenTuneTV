import type { RepeatMode, Track } from '../types';
import { resolveAudioStream } from '../native/NewPipeModule';

export interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  /** True while resolveAudioStream() is in flight for the current track. */
  isBuffering: boolean;
  streamUrl: string | null;
  positionSeconds: number;
  durationSeconds: number;
  isShuffleEnabled: boolean;
  repeatMode: RepeatMode;
  error: string | null;
}

type Listener = () => void;

/**
 * Single source of truth for playback — JS equivalent of the Compose
 * app's PlayerManager (object + StateFlow), except this one actually
 * drives real audio: play()/skip() resolve a fresh stream URL via
 * NewPipeModule and GlobalAudioPlayer (see components/GlobalAudioPlayer)
 * renders the real <Video> element that streams it and reports
 * position/duration back in via reportProgress()/reportLoaded().
 *
 * Plain external store (subscribe/getState) rather than Zustand/Redux —
 * one listener set, no extra dependency for what's a handful of fields.
 */
class PlayerStore {
  private state: PlayerState = {
    currentTrack: null,
    queue: [],
    isPlaying: false,
    isBuffering: false,
    streamUrl: null,
    positionSeconds: 0,
    durationSeconds: 0,
    isShuffleEnabled: false,
    repeatMode: 'OFF',
    error: null,
  };

  private listeners = new Set<Listener>();
  /** Registered by GlobalAudioPlayer so seekTo() can reach the real <Video>. */
  private seekHandler: ((seconds: number) => void) | null = null;

  getState = (): PlayerState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(partial: Partial<PlayerState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(listener => listener());
  }

  registerSeekHandler(handler: ((seconds: number) => void) | null) {
    this.seekHandler = handler;
  }

  /** Starts playback of `track` with `queue` (its shelf) as Next/Previous context. */
  play(track: Track, queue: Track[] = [track]) {
    this.setState({
      currentTrack: track,
      queue,
      isPlaying: true,
      isBuffering: true,
      streamUrl: null,
      positionSeconds: 0,
      durationSeconds: track.durationSeconds,
      error: null,
    });
    this.resolveAndLoad(track);
  }

  private resolveAndLoad(track: Track) {
    resolveAudioStream(track.id)
      .then(resolved => {
        if (this.state.currentTrack?.id !== track.id) return; // superseded by a later play()/skip()
        if (!resolved) {
          this.setState({ isBuffering: false, error: 'No playable audio stream found.' });
          return;
        }
        this.setState({
          streamUrl: resolved.streamUrl,
          durationSeconds: resolved.durationSeconds || track.durationSeconds,
          isBuffering: false,
        });
      })
      .catch(e => {
        if (this.state.currentTrack?.id !== track.id) return;
        this.setState({ isBuffering: false, error: String(e?.message ?? e) });
      });
  }

  togglePlayPause() {
    if (!this.state.currentTrack) return;
    this.setState({ isPlaying: !this.state.isPlaying });
  }

  /** Called by GlobalAudioPlayer every ~250ms while playing. */
  reportProgress(positionSeconds: number) {
    this.setState({ positionSeconds });
  }

  /** Called by GlobalAudioPlayer once the real stream reports its duration. */
  reportLoaded(durationSeconds: number) {
    if (durationSeconds > 0) this.setState({ durationSeconds });
  }

  /** Called by GlobalAudioPlayer when the stream errors out after loading. */
  reportError(message: string) {
    this.setState({ error: message, isBuffering: false });
  }

  /** Called by GlobalAudioPlayer when the current stream finishes playing. */
  reportEnded() {
    const { repeatMode } = this.state;
    if (repeatMode === 'ONE') {
      this.seekHandler?.(0);
      this.setState({ positionSeconds: 0, isPlaying: true });
      return;
    }
    this.skip(1);
  }

  seekTo(seconds: number) {
    const clamped = Math.max(0, Math.min(seconds, this.state.durationSeconds || seconds));
    this.seekHandler?.(clamped);
    this.setState({ positionSeconds: clamped });
  }

  seekRelative(deltaSeconds: number) {
    this.seekTo(this.state.positionSeconds + deltaSeconds);
  }

  toggleShuffle() {
    this.setState({ isShuffleEnabled: !this.state.isShuffleEnabled });
  }

  cycleRepeatMode() {
    const next: Record<RepeatMode, RepeatMode> = { OFF: 'ALL', ALL: 'ONE', ONE: 'OFF' };
    this.setState({ repeatMode: next[this.state.repeatMode] });
  }

  skipNext = () => this.skip(1);
  skipPrevious = () => this.skip(-1);

  /** Removes a track from the queue. Removing the currently-playing one skips to the next. */
  removeFromQueue(trackId: string) {
    const { queue, currentTrack } = this.state;
    const filtered = queue.filter(t => t.id !== trackId);
    this.setState({ queue: filtered });
    if (currentTrack?.id === trackId) {
      const next = filtered[0];
      if (next) this.play(next, filtered);
      else this.setState({ currentTrack: null, isPlaying: false, streamUrl: null });
    }
  }

  /** Reorders the queue — direction -1 moves the track earlier, +1 later. No-op at the ends. */
  moveQueueItem(trackId: string, direction: -1 | 1) {
    const { queue } = this.state;
    const index = queue.findIndex(t => t.id === trackId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= queue.length) return;
    const reordered = [...queue];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    this.setState({ queue: reordered });
  }

  /** Appends tracks to the end of the current queue (e.g. "Add to queue" from Home). */
  addToQueue(tracks: Track[]) {
    this.setState({ queue: [...this.state.queue, ...tracks] });
  }

  private skip(offset: number) {
    const { queue, currentTrack, isShuffleEnabled, repeatMode } = this.state;
    if (!currentTrack || queue.length === 0) return;

    let next: Track | undefined;
    if (isShuffleEnabled) {
      const candidates = queue.filter(t => t.id !== currentTrack.id);
      next = candidates[Math.floor(Math.random() * candidates.length)] ?? currentTrack;
    } else {
      const index = queue.findIndex(t => t.id === currentTrack.id);
      if (index < 0) return;
      const nextIndex = index + offset;
      if (nextIndex >= 0 && nextIndex < queue.length) {
        next = queue[nextIndex];
      } else if (repeatMode === 'ALL') {
        next = queue[((nextIndex % queue.length) + queue.length) % queue.length];
      }
    }
    if (next) this.play(next, queue);
  }
}

export const playerStore = new PlayerStore();
