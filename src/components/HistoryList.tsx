import { formatDay, formatWeightKg } from '../lib/format';
import type { Entry } from '../types';
import { EntryEditor, type EntryValues } from './EntryForm';

interface HistoryListProps {
  entries: Entry[];
  prIds: Set<string>;
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onSave: (id: string, values: EntryValues) => void;
  onDelete: (id: string) => void;
}

/** Newest-first log of sets; tap a row to edit it in place. */
export function HistoryList({ entries, prIds, editingId, onEdit, onSave, onDelete }: HistoryListProps) {
  const now = new Date();

  if (entries.length === 0) {
    return (
      <p className="empty">
        <strong>No sets logged yet.</strong>
        <br />
        Log your first set with the bar below.
      </p>
    );
  }

  return (
    <section aria-label="History">
      <h2 className="section-label">History</h2>
      <ul className="entry-rows">
        {entries.map((entry) =>
          entry.id === editingId ? (
            <li key={entry.id}>
              <EntryEditor
                entry={entry}
                onSave={(values) => onSave(entry.id, values)}
                onDelete={() => onDelete(entry.id)}
                onCancel={() => onEdit(null)}
              />
            </li>
          ) : (
            <li key={entry.id}>
              <button type="button" className="entry-row" onClick={() => onEdit(entry.id)}>
                <span className="entry-load">
                  {formatWeightKg(entry.weightKg)}
                  <span className="entry-x"> × </span>
                  {entry.reps}
                </span>
                {prIds.has(entry.id) && <span className="pr-tag">PR</span>}
                <span className="entry-date">{formatDay(entry.date, now)}</span>
                {entry.note && <span className="entry-note">{entry.note}</span>}
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
