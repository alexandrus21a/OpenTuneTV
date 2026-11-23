import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  canInstallUpdates,
  checkForUpdate,
  downloadUpdate,
  installUpdate,
  openInstallPermissionSettings,
  subscribeOtaProgress,
  type UpdateInfo,
} from '../native/OtaModule';

const ACCENT = '#FF5500';

type Phase =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'upToDate' }
  | { kind: 'available'; update: UpdateInfo }
  | { kind: 'downloading'; update: UpdateInfo; fraction: number }
  | { kind: 'readyToInstall'; apkPath: string }
  | { kind: 'needsPermission'; update: UpdateInfo }
  | { kind: 'error'; message: string };

/**
 * Sideloaded-app self-update: check → download → install, all driven
 * from here since there's no Play Store to push updates through. Lives
 * in Settings as a manual "Check for updates" action — no silent
 * background install, the user always sees and confirms each step
 * (TV remote install flows need the system installer screen anyway).
 */
export function UpdateSection(): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => () => unsubRef.current?.(), []);

  const onCheck = useCallback(async () => {
    setPhase({ kind: 'checking' });
    try {
      const update = await checkForUpdate();
      setPhase(update ? { kind: 'available', update } : { kind: 'upToDate' });
    } catch (e) {
      setPhase({ kind: 'error', message: String((e as Error)?.message ?? e) });
    }
  }, []);

  const onDownload = useCallback(async (update: UpdateInfo) => {
    const allowed = await canInstallUpdates().catch(() => true);
    if (!allowed) {
      setPhase({ kind: 'needsPermission', update });
      return;
    }
    setPhase({ kind: 'downloading', update, fraction: 0 });
    unsubRef.current = subscribeOtaProgress(fraction => setPhase({ kind: 'downloading', update, fraction }));
    try {
      const apkPath = await downloadUpdate(update.apkUrl);
      unsubRef.current?.();
      setPhase({ kind: 'readyToInstall', apkPath });
    } catch (e) {
      unsubRef.current?.();
      setPhase({ kind: 'error', message: String((e as Error)?.message ?? e) });
    }
  }, []);

  const onInstall = useCallback(async (apkPath: string) => {
    try {
      await installUpdate(apkPath);
    } catch (e) {
      setPhase({ kind: 'error', message: String((e as Error)?.message ?? e) });
    }
  }, []);

  return (
    <View>
      <Text style={styles.groupTitle}>App updates</Text>
      <Text style={styles.groupDescription}>This build has no store auto-update — check manually here.</Text>

      {phase.kind === 'idle' || phase.kind === 'upToDate' || phase.kind === 'error' ? (
        <View>
          <ActionButton label="Check for updates" onPress={onCheck} autoFocus />
          {phase.kind === 'upToDate' && <Text style={styles.statusText}>You're on the latest version.</Text>}
          {phase.kind === 'error' && <Text style={styles.errorText}>{phase.message}</Text>}
        </View>
      ) : null}

      {phase.kind === 'checking' && <Text style={styles.statusText}>Checking for updates…</Text>}

      {phase.kind === 'available' && (
        <View>
          <Text style={styles.statusText}>
            Version {phase.update.versionName} is available{phase.update.notes ? `: ${phase.update.notes}` : '.'}
          </Text>
          <ActionButton label="Download update" onPress={() => onDownload(phase.update)} autoFocus />
        </View>
      )}

      {phase.kind === 'needsPermission' && (
        <View>
          <Text style={styles.statusText}>
            This app needs permission to install updates it downloads. Grant it in the system settings, then try again.
          </Text>
          <ActionButton label="Open permission settings" onPress={openInstallPermissionSettings} autoFocus />
        </View>
      )}

      {phase.kind === 'downloading' && (
        <View>
          <Text style={styles.statusText}>Downloading {Math.round(phase.fraction * 100)}%…</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(phase.fraction * 100)}%` }]} />
          </View>
        </View>
      )}

      {phase.kind === 'readyToInstall' && (
        <View>
          <Text style={styles.statusText}>Update downloaded — install now?</Text>
          <ActionButton label="Install update" onPress={() => onInstall(phase.apkPath)} autoFocus />
        </View>
      )}
    </View>
  );
}

function ActionButton({ label, onPress, autoFocus }: { label: string; onPress: () => void; autoFocus?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      hasTVPreferredFocus={autoFocus}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[styles.button, focused && styles.buttonFocused]}>
      <Text style={[styles.buttonLabel, focused && styles.buttonLabelFocused]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  groupTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  groupDescription: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4, marginBottom: 16 },
  statusText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 12, maxWidth: 480 },
  errorText: { color: '#ff6b5e', fontSize: 13, marginTop: 8, maxWidth: 480 },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  buttonFocused: { backgroundColor: ACCENT, borderColor: ACCENT },
  buttonLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  buttonLabelFocused: { color: '#000' },
  progressTrack: { width: 280, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: ACCENT },
});
