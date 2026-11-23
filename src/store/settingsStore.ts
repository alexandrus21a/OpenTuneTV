type Listener = () => void;

export type CanvasQuality = 'off' | 'low' | 'high';

export interface SettingsState {
  canvasQuality: CanvasQuality;
}

/** JS equivalent of the Compose app's AppSettings — in-memory for now (no AsyncStorage yet). */
class SettingsStore {
  private state: SettingsState = { canvasQuality: 'low' };
  private listeners = new Set<Listener>();

  getState = (): SettingsState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setCanvasQuality(quality: CanvasQuality) {
    this.state = { ...this.state, canvasQuality: quality };
    this.listeners.forEach(l => l());
  }
}

export const settingsStore = new SettingsStore();
