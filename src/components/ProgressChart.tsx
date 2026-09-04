import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDay } from '../lib/format';
import type { ProgressionPoint } from '../lib/progression';

interface ProgressChartProps {
  points: ProgressionPoint[];
  /** Whether this metric has any data at all, before the time-range filter was applied. */
  hasHistory: boolean;
  formatValue: (value: number) => string;
}

const HEIGHT = 180;
const MARGIN = { top: 16, right: 12, bottom: 24, left: 44 };

/** Hand-rolled SVG line chart for a progression series. Responsive width, fixed height. */
export function ProgressChart({ points, hasHistory, formatValue }: ProgressChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (points.length === 0) {
    return (
      <p className="empty">
        {hasHistory ? (
          'No data in this range.'
        ) : (
          <strong>Log some sets to see progress.</strong>
        )}
      </p>
    );
  }

  const times = points.map((p) => new Date(p.date).getTime());
  const values = points.map((p) => p.value);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const sameValue = minValue === maxValue;
  // Pad the value range so a flat or single-point series isn't squashed to the plot's edge.
  const valuePad = sameValue ? Math.max(Math.abs(maxValue) * 0.1, 1) : (maxValue - minValue) * 0.15;
  const yMin = minValue - valuePad;
  const yMax = maxValue + valuePad;

  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 1);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  const xFor = (time: number) =>
    maxTime === minTime ? MARGIN.left + plotWidth / 2 : MARGIN.left + ((time - minTime) / (maxTime - minTime)) * plotWidth;
  const yFor = (value: number) => MARGIN.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;

  const coords = points.map((p, i) => ({ x: xFor(times[i]), y: yFor(p.value), point: p }));
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  function handlePointer(clientX: number) {
    const el = containerRef.current;
    if (!el || coords.length === 0) return;
    const x = clientX - el.getBoundingClientRect().left;
    let nearest = 0;
    let nearestDist = Infinity;
    coords.forEach((c, i) => {
      const dist = Math.abs(c.x - x);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setActiveIndex(nearest);
  }

  const active = activeIndex !== null ? coords[activeIndex] : undefined;

  return (
    <div
      className="progress-chart"
      ref={containerRef}
      onPointerMove={(e) => handlePointer(e.clientX)}
      onPointerDown={(e) => handlePointer(e.clientX)}
      onPointerLeave={() => setActiveIndex(null)}
    >
      <svg viewBox={`0 0 ${width} ${HEIGHT}`} width="100%" height={HEIGHT} role="img" aria-label="Progression chart">
        <line x1={MARGIN.left} y1={yFor(yMax)} x2={width - MARGIN.right} y2={yFor(yMax)} className="chart-gridline" />
        <line x1={MARGIN.left} y1={yFor(yMin)} x2={width - MARGIN.right} y2={yFor(yMin)} className="chart-gridline" />

        {sameValue ? (
          <text x={MARGIN.left - 6} y={yFor(minValue) + 4} textAnchor="end" className="chart-axis-label">
            {formatValue(minValue)}
          </text>
        ) : (
          <>
            <text x={MARGIN.left - 6} y={yFor(maxValue) + 4} textAnchor="end" className="chart-axis-label">
              {formatValue(maxValue)}
            </text>
            <text x={MARGIN.left - 6} y={yFor(minValue) + 4} textAnchor="end" className="chart-axis-label">
              {formatValue(minValue)}
            </text>
          </>
        )}

        {points.length > 1 ? (
          <>
            <text x={MARGIN.left} y={HEIGHT - 6} className="chart-axis-label">
              {formatDay(points[0].date, now)}
            </text>
            <text x={width - MARGIN.right} y={HEIGHT - 6} textAnchor="end" className="chart-axis-label">
              {formatDay(points[points.length - 1].date, now)}
            </text>
          </>
        ) : (
          <text x={width / 2} y={HEIGHT - 6} textAnchor="middle" className="chart-axis-label">
            {formatDay(points[0].date, now)}
          </text>
        )}

        {coords.length > 1 && <path d={path} className="chart-line" fill="none" />}
        {coords.map((c, i) => (
          <circle key={c.point.date} cx={c.x} cy={c.y} r={i === activeIndex ? 5 : 3} className="chart-point" />
        ))}
        {active && (
          <line x1={active.x} y1={MARGIN.top} x2={active.x} y2={HEIGHT - MARGIN.bottom} className="chart-guide" />
        )}
      </svg>
      {active && (
        <div className="chart-tooltip" style={{ left: `${(active.x / width) * 100}%` }}>
          <strong>{formatValue(active.point.value)}</strong>
          <span>{formatDay(active.point.date, now)}</span>
        </div>
      )}
    </div>
  );
}
