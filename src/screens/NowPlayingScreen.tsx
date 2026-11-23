import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { usePlayerState } from '../store/usePlayerState';
import { playerStore } from '../store/playerStore';
import { followedArtistsStore } from '../store/followedArtistsStore';
import { useIsArtistFollowed } from '../store/useIsArtistFollowed';
import { likedTracksStore } from '../store/likedTracksStore';
import { useIsTrackLiked } from '../store/useIsTrackLiked';
import { MiniTrackCard } from '../components/MiniTrackCard';
import { CanvasBackground } from '../components/CanvasBackground';
import type { Track } from '../types';

const ACCENT = '#FF5500';
const BAR_COUNT = 56;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Deterministic pseudo-random bar heights seeded off the track id — a status indicator (real progress), not decoration. */
function seededAmplitudes(seed: string, count: number): number[] {
  let x = Array.from(seed).reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
  const next = () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 0xffffffff;
  };
  return Array.from({ length: count }, () => 0.25 + next() * 0.75);
}

/**
 * Press feedback on pointer-down, not release (Apple: "response on
 * pointer-down... waiting for release feels dead") — scale(0.97) via a
 * critically-damped spring, so it can be interrupted/retargeted cleanly
 * if the user presses again quickly.
 */
function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, damping: 18, stiffness: 300 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 300 }).start();
  return { scale, onPressIn, onPressOut };
}

function PillButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress}>
      <Animated.View style={[styles.pillButton, active && styles.pillButtonActive, { transform: [{ scale }] }]}>
        <Icon name={icon} size={15} color={active ? ACCENT : 'rgba(255,255,255,0.85)'} />
        <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function MetaActions({ currentTrack }: { currentTrack: Track }) {
  const liked = useIsTrackLiked(currentTrack.id);
  const followed = useIsArtistFollowed(currentTrack.artist);
  return (
    <View style={styles.metaActions}>
      <PillButton
        icon={liked ? 'heart' : 'heart-outline'}
        label={liked ? 'Liked' : 'Like'}
        active={liked}
        onPress={() => likedTracksStore.toggle(currentTrack)}
      />
      <PillButton
        icon={followed ? 'checkmark-circle' : 'add-circle-outline'}
        label={followed ? 'Following' : 'Follow'}
        active={followed}
        onPress={() => followedArtistsStore.toggle(currentTrack.artist)}
      />
    </View>
  );
}

/**
 * Now Playing: full-bleed blurred artwork as the ambient background, a
 * crisp static artwork card with real depth (shadow, not a gimmick
 * decoration — Apple's "craft" favors restraint over ornament), and a
 * seeded "waveform" that doubles as the progress bar — a real status
 * indicator, not decoration, so it's exempt from the "don't animate
 * things people see constantly" rule. The queue is a separate panel
 * (QueueModal) that slides in from the right edge it lives on and
 * exits the same way (Apple: "enter and exit along the same path").
 */
export function NowPlayingScreen(): React.JSX.Element {
  const state = usePlayerState();
  const { currentTrack, isPlaying, isBuffering, positionSeconds, durationSeconds, queue } = state;
  const playFocusRef = useRef<any>(null);
  const [queueOpen, setQueueOpen] = useState(false);

  useEffect(() => {
    playFocusRef.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!queueOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setQueueOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [queueOpen]);

  const amplitudes = useMemo(
    () => (currentTrack ? seededAmplitudes(currentTrack.id, BAR_COUNT) : []),
    [currentTrack],
  );

  if (!currentTrack) {
    return (
      <View style={styles.root}>
        <Text style={styles.emptyText}>Nothing playing yet.</Text>
      </View>
    );
  }

  const progress = durationSeconds > 0 ? positionSeconds / durationSeconds : 0;

  return (
    <View style={styles.root}>
      <CanvasBackground youtubeVideoId={currentTrack.canvasYoutubeVideoId} fallbackArtworkUrl={currentTrack.artworkUrl} />

      <View style={styles.main}>
        <View style={styles.meta}>
          <Text style={styles.label}>NOW PLAYING</Text>
          <Text style={styles.title} numberOfLines={2}>
            {currentTrack.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
          <MetaActions currentTrack={currentTrack} />
          {state.error && <Text style={styles.error}>{state.error}</Text>}

          <Waveform amplitudes={amplitudes} progress={progress} />
          <View style={styles.progressTimes}>
            <Text style={styles.timeText}>{formatTime(positionSeconds)}</Text>
            <Text style={styles.timeText}>{formatTime(durationSeconds)}</Text>
          </View>

          <View style={styles.transport}>
            <TransportButton icon="shuffle" active={state.isShuffleEnabled} onPress={() => playerStore.toggleShuffle()} />
            <TransportButton icon="play-skip-back" onPress={() => playerStore.skipPrevious()} />
            <TransportButton
              ref={playFocusRef}
              icon={isBuffering ? 'hourglass' : isPlaying ? 'pause' : 'play'}
              primary
              onPress={() => playerStore.togglePlayPause()}
            />
            <TransportButton icon="play-skip-forward" onPress={() => playerStore.skipNext()} />
            <TransportButton
              icon={state.repeatMode === 'ONE' ? 'repeat-outline' : 'repeat'}
              active={state.repeatMode !== 'OFF'}
              onPress={() => playerStore.cycleRepeatMode()}
            />
            <TransportButton icon="list" onPress={() => setQueueOpen(true)} />
          </View>
        </View>

        <View style={styles.artworkCard}>
          <Image source={{ uri: currentTrack.artworkUrl }} style={styles.artworkImage} resizeMode="cover" />
        </View>
      </View>

      <QueueModal visible={queueOpen} queue={queue} currentTrack={currentTrack} onClose={() => setQueueOpen(false)} />
    </View>
  );
}

function Waveform({ amplitudes, progress }: { amplitudes: number[]; progress: number }) {
  const playedCount = Math.round(progress * amplitudes.length);
  return (
    <View style={styles.waveform}>
      {amplitudes.map((amp, i) => (
        <View
          key={i}
          style={[
            styles.waveformBar,
            { height: 6 + amp * 38 },
            i < playedCount ? styles.waveformBarPlayed : styles.waveformBarUnplayed,
          ]}
        />
      ))}
    </View>
  );
}

const TransportButton = React.forwardRef<any, { icon: string; primary?: boolean; active?: boolean; onPress: () => void }>(
  ({ icon, primary, active, onPress }, ref) => {
    const [focused, setFocused] = React.useState(false);
    const { scale, onPressIn, onPressOut } = usePressScale();
    return (
      <Pressable
        ref={ref}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}>
        <Animated.View
          style={[
            styles.transportButton,
            primary && styles.transportButtonPrimary,
            active && styles.transportButtonActive,
            focused && styles.transportButtonFocused,
            { transform: [{ scale }] },
          ]}>
          <Icon
            name={icon}
            size={primary ? 26 : 20}
            color={primary ? '#000' : active ? ACCENT : '#fff'}
          />
        </Animated.View>
      </Pressable>
    );
  },
);

/**
 * Slides in from the right edge it lives on, and exits the same way —
 * Apple's spatial-consistency rule ("if something disappears one way,
 * it should emerge from where it came"). A fixed-size panel rather than
 * a flexed-to-fill list container: a FlatList nested inside chained
 * `flex: 1` views never got a non-zero height on this RN setup, while a
 * plain fixed-size panel renders its list reliably.
 */
function QueueModal({
  visible,
  queue,
  currentTrack,
  onClose,
}: {
  visible: boolean;
  queue: Track[];
  currentTrack: Track;
  onClose: () => void;
}) {
  const translateX = useRef(new Animated.Value(420)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 150, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 420, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setRendered(false));
    }
  }, [visible, translateX, backdropOpacity]);

  if (!rendered) return <></>;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.modalBackdropFill, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.modalPanel, { transform: [{ translateX }] }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.queueTitle}>Up next ({queue.length})</Text>
            <Pressable onPress={onClose} style={styles.modalCloseButton}>
              <Icon name="close" size={16} color="#fff" />
            </Pressable>
          </View>
          <FlatList
            data={queue}
            keyExtractor={(t, i) => `${t.id}_${i}`}
            style={styles.queueList}
            renderItem={({ item }) => (
              <MiniTrackCard
                track={item}
                isCurrent={item.id === currentTrack.id}
                onPress={t => playerStore.play(t, queue)}
                onRemove={t => playerStore.removeFromQueue(t.id)}
                onMoveUp={t => playerStore.moveQueueItem(t.id, -1)}
                onMoveDown={t => playerStore.moveQueueItem(t.id, 1)}
              />
            )}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060606' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  emptyText: { color: 'rgba(255,255,255,0.7)', margin: 'auto', fontSize: 16 },
  main: { flexDirection: 'row', padding: 56, paddingBottom: 24, gap: 56, alignItems: 'center' },
  meta: { flex: 1 },
  label: { color: ACCENT, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { color: '#fff', fontSize: 38, fontWeight: '800', marginTop: 10, marginBottom: 6, letterSpacing: -0.5 },
  artist: { color: 'rgba(255,255,255,0.8)', fontSize: 19 },
  metaActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  pillButtonActive: { backgroundColor: 'rgba(255,85,0,0.25)', borderColor: ACCENT },
  pillLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  pillLabelActive: { color: ACCENT },
  error: { color: '#ff6b6b', fontSize: 13, marginTop: 8 },
  waveform: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 44, marginTop: 28 },
  waveformBar: { flex: 1, borderRadius: 3 },
  waveformBarPlayed: { backgroundColor: ACCENT },
  waveformBarUnplayed: { backgroundColor: 'rgba(255,255,255,0.22)' },
  progressTimes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  timeText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  transport: { flexDirection: 'row', gap: 16, marginTop: 28, alignItems: 'center' },
  transportButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  transportButtonPrimary: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  transportButtonActive: { backgroundColor: 'rgba(255,85,0,0.3)' },
  transportButtonFocused: { borderWidth: 2.5, borderColor: ACCENT },
  transportLabel: { color: '#fff', fontSize: 20 },
  transportLabelPrimary: { color: '#000', fontSize: 26 },
  artworkCard: {
    width: 280,
    height: 280,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  artworkImage: { width: '100%', height: '100%' },
  modalRoot: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  modalBackdropFill: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalPanel: {
    width: 420,
    height: '100%',
    backgroundColor: 'rgba(17,17,17,0.97)',
    paddingTop: 40,
    paddingHorizontal: 20,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modalCloseLabel: { color: '#fff', fontSize: 14 },
  queueTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  queueList: { height: 900 },
});
