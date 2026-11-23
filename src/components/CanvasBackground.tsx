import React, { useEffect, useState } from 'react';
import { Image, ImageBackground, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import { resolveCanvas } from '../native/NewPipeModule';
import { useSettingsState } from '../store/useSettingsState';

/**
 * Spotify-Canvas-style background for Now Playing: a few silent,
 * looping seconds of video behind the content, resolved on demand for
 * [youtubeVideoId] via NewPipeModule — ported from the Compose app's
 * CanvasBackground, minus the three-segment clipping (react-native-video
 * loops the whole (short, low-res) stream instead; good enough for a
 * background element and much simpler on the RN side).
 *
 * Falls back to [fallbackArtworkUrl] (shown blurred) whenever Canvas is
 * off in Settings, still resolving, or resolution fails — so Now
 * Playing always has *something* behind it, never a crash or a blank.
 */
export function CanvasBackground({
  youtubeVideoId,
  fallbackArtworkUrl,
}: {
  youtubeVideoId: string | null | undefined;
  fallbackArtworkUrl: string;
}): React.JSX.Element {
  const { canvasQuality } = useSettingsState();
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  useEffect(() => {
    setStreamUrl(null);
    if (canvasQuality === 'off' || !youtubeVideoId) return;
    let cancelled = false;
    resolveCanvas(youtubeVideoId, canvasQuality)
      .then(resolved => {
        if (!cancelled && resolved) setStreamUrl(resolved.streamUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [youtubeVideoId, canvasQuality]);

  if (canvasQuality === 'off' || !streamUrl) {
    return (
      <ImageBackground source={{ uri: fallbackArtworkUrl }} style={StyleSheet.absoluteFill} blurRadius={40} resizeMode="cover">
        <View style={styles.scrim} />
      </ImageBackground>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Video
        source={{ uri: streamUrl }}
        style={StyleSheet.absoluteFill}
        muted
        repeat
        paused={false}
        resizeMode="cover"
      />
      {/* A quick blurred artwork underlay while the video's first frame decodes, so there's never a flash of black. */}
      <Image source={{ uri: fallbackArtworkUrl }} style={[StyleSheet.absoluteFill, styles.hiddenUnderlay]} blurRadius={40} />
      <View style={styles.scrim} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  hiddenUnderlay: { zIndex: -1 },
});
