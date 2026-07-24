import { formatWeightKg } from '../lib/format';
import type { RepRecord } from '../types';

/** Best weight per rep count; the heaviest overall is highlighted gold. */
export function RecordsPanel({ records }: { records: RepRecord[] }) {
  if (records.length === 0) return null;
  const maxWeight = Math.max(...records.map((r) => r.weightKg));

  return (
    <section aria-label="Records">
      <h2 className="section-label">Records</h2>
      <div className="records">
        {records.map((record) => (
          <div key={record.reps} className={record.weightKg === maxWeight ? 'record-chip is-best' : 'record-chip'}>
            <span className="record-value">{formatWeightKg(record.weightKg)}</span>
            <span className="record-reps">{record.reps} rep{record.reps === 1 ? '' : 's'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
