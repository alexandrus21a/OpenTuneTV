import { useCallback, useEffect, useRef, useState } from 'react';
import { useTVEventHandler, type HWEvent } from 'react-native';

/**
 * True once [timeoutMs] has passed with no remote-control activity —
 * drives screensaver-style UI (hide controls, keep the ambient
 * background). Resets on every TV remote event (useTVEventHandler
 * fires for every D-pad move/press, not just focus changes within a
 * particular screen), so it works regardless of which element has
 * focus.
 */
export function useIdle(timeoutMs: number): boolean {
  const [isIdle, setIsIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdle = useCallback(() => {
    setIsIdle(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setIsIdle(true), timeoutMs);
  }, [timeoutMs]);

  useTVEventHandler((_event: HWEvent) => resetIdle());

  useEffect(() => {
    resetIdle();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [resetIdle]);

  return isIdle;
}
