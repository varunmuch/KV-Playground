import { useCallback, useEffect, useState } from 'react';

/** Step state for Back / Next / Play controls. Play advances every intervalMs and stops at the last step. */
export function useStepper(lastStep: number, intervalMs = 900, initialStep = 0) {
  const [step, setStepState] = useState(() => Math.max(0, Math.min(lastStep, initialStep)));
  const [playing, setPlaying] = useState(false);

  const setStep = useCallback(
    (next: number) => setStepState(Math.max(0, Math.min(lastStep, next))),
    [lastStep],
  );

  useEffect(() => {
    if (step > lastStep) setStepState(lastStep);
  }, [lastStep, step]);

  useEffect(() => {
    if (!playing) return;
    if (step >= lastStep) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setStepState((s) => Math.min(lastStep, s + 1)), intervalMs);
    return () => window.clearTimeout(timer);
  }, [playing, step, lastStep, intervalMs]);

  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    // Pressing Play at the end starts again from the beginning.
    if (step >= lastStep) setStepState(0);
    setPlaying(true);
  }, [playing, step, lastStep]);

  return { step, setStep, playing, togglePlay, stop: () => setPlaying(false) };
}
