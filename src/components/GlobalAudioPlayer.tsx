import React, { useEffect, useRef } from 'react';
import Video, { type VideoRef } from 'react-native-video';
import { playerStore } from '../store/playerStore';
import { usePlayerState } from '../store/usePlayerState';

/**
 * Mounted exactly once (see App.tsx) — the one real audio player in the
 * app. Every screen only ever talks to playerStore; this component is
 * what turns that state into actual sound, same split as the Compose
 * app's "PlayerManager owns state, a real player is wired in later"
 * design, except here the player really is wired in.
 *
 * Rendered with zero size: react-native-video plays audio-only sources
 * fine without a visible surface, and this app doesn't need to show the
 * YouTube video track, only hear the audio one NewPipeModule resolved.
 */
export function GlobalAudioPlayer(): React.JSX.Element {
  const { streamUrl, isPlaying } = usePlayerState();
  const ref = useRef<VideoRef>(null);

  useEffect(() => {
    playerStore.registerSeekHandler(seconds => ref.current?.seek(seconds));
    return () => playerStore.registerSeekHandler(null);
  }, []);

  if (!streamUrl) return <></>;

  return (
    <Video
      ref={ref}
      source={{ uri: streamUrl }}
      style={{ width: 0, height: 0 }}
      paused={!isPlaying}
      playInBackground
      ignoreSilentSwitch="ignore"
      progressUpdateInterval={250}
      onLoad={e => playerStore.reportLoaded(e.duration)}
      onProgress={e => playerStore.reportProgress(e.currentTime)}
      onEnd={() => playerStore.reportEnded()}
      onError={e => playerStore.reportError(JSON.stringify(e))}
    />
  );
}
