import { useState } from 'react';
import { formatMs } from '../../lib/format';

interface WhiskerDatum {
  label: string;
  p50: number;
  p95: number;
  color: string;
}

/** Median bars with a p95 whisker. Horizontal so long method names fit at 375px. */
export function WhiskerChart({ data, label }: { data: WhiskerDatum[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.p95), 0) * 1.08 || 1;
  const pct = (v: number) => `${(v / max) * 100}%`;

  return (
    <div className="whisker" role="list" aria-label={label}>
      {data.map((d, i) => (
        <div
          key={d.label}
          className="whisker__row"
          role="listitem"
          tabIndex={0}
          aria-label={`${d.label}: median ${formatMs(d.p50)}, p95 ${formatMs(d.p95)}`}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(null)}
        >
          <span className="whisker__label">{d.label}</span>
          <span className="whisker__track" aria-hidden="true">
            <span className="whisker__bar" style={{ width: pct(d.p50), background: d.color }} />
            <span className="whisker__line" style={{ left: pct(d.p50), width: `calc(${pct(d.p95)} - ${pct(d.p50)})` }} />
            <span className="whisker__cap" style={{ left: pct(d.p95) }} />
            <span className="whisker__value mono" style={{ left: `calc(${pct(d.p95)} + 8px)` }}>
              {formatMs(d.p50)}
            </span>
          </span>
          {hover === i && (
            <span className="tooltip" role="presentation">
              <strong>{d.label}</strong>
              <span>Median {formatMs(d.p50)}</span>
              <span>p95 {formatMs(d.p95)}</span>
            </span>
          )}
        </div>
      ))}
      <p className="whisker__key muted small">Bar: typical time (median). Line: slow end (95th percentile). Lower is better.</p>
    </div>
  );
}
