import { useState } from 'react';
import { formatInt, formatMs } from '../../lib/format';

interface LineSeries {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  points: { x: number; y: number }[];
}

interface LineChartProps {
  series: LineSeries[];
  label: string;
  xLabel: string;
  yLabel: string;
}

const W = 640;
const H = 300;
const M = { top: 34, right: 110, bottom: 44, left: 64 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Lines on a log2 x axis (prompt length doubles each step), linear y from zero, end labels and a hover crosshair. */
export function LineChart({ series, label, xLabel, yLabel }: LineChartProps) {
  const [hoverX, setHoverX] = useState<number | null>(null);
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
  const yMax = niceMax(Math.max(...series.flatMap((s) => s.points.map((p) => p.y)), 0));
  const lx = (x: number) => Math.log2(x);
  const [x0, x1] = [lx(xs[0]), lx(xs[xs.length - 1])];
  const sx = (x: number) => M.left + ((lx(x) - x0) / (x1 - x0 || 1)) * (W - M.left - M.right);
  const sy = (y: number) => H - M.bottom - (y / yMax) * (H - M.top - M.bottom);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax);

  // Spread end labels so they do not overlap.
  const ends = series
    .map((s) => ({ s, y: sy(s.points[s.points.length - 1]?.y ?? 0) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;

  const nearest = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    return xs.reduce((best, x) => (Math.abs(sx(x) - px) < Math.abs(sx(best) - px) ? x : best), xs[0]);
  };

  return (
    <div className="line-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        onMouseMove={(e) => setHoverX(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onMouseLeave={() => setHoverX(null)}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} className="grid-line" />
            <text x={M.left - 8} y={sy(t) + 4} textAnchor="end" className="axis-text">{formatMs(t)}</text>
          </g>
        ))}
        {xs
          // Skip a tick label that would collide with the one before it.
          .filter((x, i) => i === 0 || sx(x) - sx(xs[i - 1]) >= 36 || i === xs.length - 1)
          .filter((x, i, kept) => i === kept.length - 1 || sx(kept[i + 1]) - sx(x) >= 36)
          .map((x) => (
            <text key={x} x={sx(x)} y={H - M.bottom + 18} textAnchor="middle" className="axis-text">{formatInt(x)}</text>
          ))}
        <text x={(M.left + W - M.right) / 2} y={H - 6} textAnchor="middle" className="axis-title">{xLabel}</text>
        <text x={M.left} y={14} className="axis-title">{yLabel}</text>
        {hoverX !== null && <line x1={sx(hoverX)} x2={sx(hoverX)} y1={M.top} y2={H - M.bottom} className="crosshair" />}
        {series.map((s) => (
          <g key={s.id}>
            <polyline
              points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? '6 4' : undefined}
            />
            {s.points.map((p) => (
              <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
            ))}
          </g>
        ))}
        {ends.map(({ s, y }) => (
          <text key={s.id} x={W - M.right + 10} y={y + 4} className="end-label">{s.label}</text>
        ))}
      </svg>
      {hoverX !== null && (
        <div className="tooltip tooltip--chart" role="presentation">
          <strong>{formatInt(hoverX)} prompt tokens</strong>
          {series.map((s) => {
            const p = s.points.find((pt) => pt.x === hoverX);
            return p ? (
              <span key={s.id}>
                <i className="tooltip__key" style={{ background: s.color }} /> {s.label}: {formatMs(p.y)}
              </span>
            ) : null;
          })}
        </div>
      )}
      <ul className="legend">
        {series.map((s) => (
          <li key={s.id} className="legend__item">
            <span className={`line-key${s.dashed ? ' line-key--dashed' : ''}`} style={{ borderColor: s.color }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
