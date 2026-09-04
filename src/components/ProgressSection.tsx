import { useMemo, useState } from 'react';
import { formatWeightKg } from '../lib/format';
import {
  distinctWeights,
  estimatedOneRepMax,
  filterByRange,
  repsAtWeight,
  sessionVolume,
  topWeightPerSession,
  type ProgressionPoint,
  type ProgressionRange,
} from '../lib/progression';
import type { Entry } from '../types';
import { ProgressChart } from './ProgressChart';

type Metric = 'oneRepMax' | 'topWeight' | 'volume' | 'repsAtWeight';

const METRICS: { id: Metric; label: string }[] = [
  { id: 'oneRepMax', label: 'Est. 1RM' },
  { id: 'topWeight', label: 'Top Weight' },
  { id: 'volume', label: 'Volume' },
  { id: 'repsAtWeight', label: 'Reps @ Weight' },
];

const RANGES: { id: ProgressionRange; label: string }[] = [
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: '1y', label: '1Y' },
  { id: 'all', label: 'All' },
];

function formatValueFor(metric: Metric): (value: number) => string {
  switch (metric) {
    case 'oneRepMax':
    case 'topWeight':
      return formatWeightKg;
    case 'volume':
      return (v) => Math.round(v).toLocaleString();
    case 'repsAtWeight':
      return (v) => String(Math.round(v));
  }
}

/** Metric switcher, time-range filter, and the resulting progression chart for one exercise. */
export function ProgressSection({ entries }: { entries: Entry[] }) {
  const [metric, setMetric] = useState<Metric>('oneRepMax');
  const [range, setRange] = useState<ProgressionRange>('all');
  const [chosenWeightKg, setChosenWeightKg] = useState<number | undefined>(undefined);

  const weights = useMemo(() => distinctWeights(entries), [entries]);
  const activeWeight = chosenWeightKg ?? weights[0];

  const fullSeries = useMemo((): ProgressionPoint[] => {
    switch (metric) {
      case 'oneRepMax':
        return estimatedOneRepMax(entries);
      case 'topWeight':
        return topWeightPerSession(entries);
      case 'volume':
        return sessionVolume(entries);
      case 'repsAtWeight':
        return activeWeight === undefined ? [] : repsAtWeight(entries, activeWeight);
    }
  }, [metric, entries, activeWeight]);

  const points = useMemo(() => filterByRange(fullSeries, range, new Date()), [fullSeries, range]);

  return (
    <section aria-label="Progress">
      <div className="sort-toggle" role="group" aria-label="Metric">
        {METRICS.map((m) => (
          <button key={m.id} type="button" aria-pressed={metric === m.id} onClick={() => setMetric(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      {metric === 'repsAtWeight' && weights.length > 0 && (
        <select
          className="text-input text-input-small progress-weight-select"
          value={activeWeight}
          onChange={(e) => setChosenWeightKg(Number(e.target.value))}
          aria-label="Weight"
        >
          {weights.map((w) => (
            <option key={w} value={w}>
              {formatWeightKg(w)} kg
            </option>
          ))}
        </select>
      )}

      <div className="sort-toggle" role="group" aria-label="Time range">
        {RANGES.map((r) => (
          <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      <ProgressChart points={points} hasHistory={fullSeries.length > 0} formatValue={formatValueFor(metric)} />
    </section>
  );
}
