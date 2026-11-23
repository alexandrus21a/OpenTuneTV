import { useSyncExternalStore } from 'react';
import { settingsStore, type SettingsState } from './settingsStore';

export function useSettingsState(): SettingsState {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.getState);
}
