import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSettingsState } from '../store/useSettingsState';
import { settingsStore, type CanvasQuality } from '../store/settingsStore';
import { UpdateSection } from '../components/UpdateSection';

const ACCENT = '#FF5500';

const QUALITY_OPTIONS: Array<{ value: CanvasQuality; label: string; description: string }> = [
  { value: 'off', label: 'Off', description: 'Plain background, never streams video.' },
  { value: 'low', label: 'Low', description: 'Smallest stream — lowest data use.' },
  { value: 'high', label: 'High', description: 'Sharper loop — more data/decode cost.' },
];

export function SettingsScreen(): React.JSX.Element {
  const { canvasQuality } = useSettingsState();

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Settings</Text>
      <Text style={styles.section}>PLAYBACK & DISPLAY</Text>

      <Text style={styles.groupTitle}>Canvas backgrounds</Text>
      <Text style={styles.groupDescription}>Looping video behind Now Playing — quality or off entirely.</Text>
      <View style={styles.segmentRow}>
        {QUALITY_OPTIONS.map((option, index) => (
          <QualityOption
            key={option.value}
            label={option.label}
            description={option.description}
            selected={canvasQuality === option.value}
            autoFocus={index === 0}
            onPress={() => settingsStore.setCanvasQuality(option.value)}
          />
        ))}
      </View>

      <Text style={styles.section}>UPDATES</Text>
      <UpdateSection />
    </View>
  );
}

function QualityOption({
  label,
  description,
  selected,
  autoFocus,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  autoFocus?: boolean;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      hasTVPreferredFocus={autoFocus}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected, focused && styles.optionFocused]}>
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
      <Text style={styles.optionDescription}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: 112, paddingTop: 48 },
  heading: { color: '#fff', fontSize: 32, fontWeight: '700' },
  section: { color: ACCENT, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginTop: 32, marginBottom: 20 },
  groupTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  groupDescription: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4, marginBottom: 16 },
  segmentRow: { flexDirection: 'row', gap: 14 },
  option: {
    flex: 1,
    maxWidth: 240,
    padding: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  optionSelected: { backgroundColor: 'rgba(255,85,0,0.15)', borderColor: ACCENT },
  optionFocused: { borderColor: ACCENT, borderWidth: 2 },
  optionLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  optionLabelSelected: { color: ACCENT },
  optionDescription: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 6 },
});
