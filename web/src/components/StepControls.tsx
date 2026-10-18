interface StepControlsProps {
  step: number;
  lastStep: number;
  playing: boolean;
  onStep: (step: number) => void;
  onTogglePlay: () => void;
  /** Show a numbered button for every step. */
  showNumbers?: boolean;
  label: string;
}

export function StepControls({ step, lastStep, playing, onStep, onTogglePlay, showNumbers = true, label }: StepControlsProps) {
  return (
    <div className="step-controls" role="group" aria-label={label}>
      <div className="step-controls__main">
        <button type="button" className="btn btn--secondary" onClick={() => onStep(step - 1)} disabled={step === 0}>
          ← Back
        </button>
        <button type="button" className="btn btn--primary step-controls__play" onClick={onTogglePlay}>
          {playing ? 'Pause' : step >= lastStep ? 'Replay' : 'Play'}
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => onStep(step + 1)} disabled={step === lastStep}>
          Next →
        </button>
      </div>
      {showNumbers && (
        <div className="step-controls__numbers">
          {Array.from({ length: lastStep + 1 }, (_, i) => (
            <button
              key={i}
              type="button"
              className="btn step-controls__num mono"
              aria-pressed={i === step}
              aria-label={`Step ${i}`}
              onClick={() => onStep(i)}
            >
              {i}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
