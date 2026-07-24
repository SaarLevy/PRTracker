import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, Redirect, useLocation, useParams } from 'wouter';
import { type EntryValues, LogBar } from '../components/EntryForm';
import { HistoryList } from '../components/HistoryList';
import { RecordsPanel } from '../components/RecordsPanel';
import { BackIcon, DotsIcon } from '../components/icons';
import { addEntry, deleteEntry, deleteExercise, renameExercise, updateEntry } from '../db';
import { db } from '../db';
import { chronological, computeRecords, prEntryIds } from '../lib/records';

export default function ExerciseDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // `null` (vs undefined-while-loading) means the exercise does not exist.
  const exercise = useLiveQuery(async () => (await db.exercises.get(id)) ?? null, [id]);
  const entries = useLiveQuery(() => db.entries.where('exerciseId').equals(id).toArray(), [id]);

  const chrono = useMemo(() => chronological(entries ?? []), [entries]);
  const records = useMemo(() => computeRecords(chrono), [chrono]);
  const prIds = useMemo(() => prEntryIds(chrono), [chrono]);
  const newestFirst = useMemo(() => [...chrono].reverse(), [chrono]);
  const last = chrono.at(-1);

  if (exercise === null) return <Redirect to="/" />;
  if (exercise === undefined || entries === undefined) return <div className="screen" />;

  function handleLog(values: EntryValues) {
    void addEntry({ exerciseId: id, ...values });
  }

  function handleSave(entryId: string, values: EntryValues) {
    void updateEntry(entryId, values).then(() => setEditingId(null));
  }

  function handleDelete(entryId: string) {
    if (!confirm('Delete this set?')) return;
    void deleteEntry(entryId).then(() => setEditingId(null));
  }

  function handleRename(event: React.FormEvent) {
    event.preventDefault();
    const name = renameValue.trim();
    if (!name) return;
    void renameExercise(id, name).then(() => setRenaming(false));
  }

  function handleDeleteExercise() {
    setMenuOpen(false);
    const count = entries?.length ?? 0;
    const suffix = count === 0 ? '' : count === 1 ? ' and its 1 logged set' : ` and its ${count} logged sets`;
    if (!confirm(`Delete "${exercise?.name}"${suffix}? This cannot be undone.`)) return;
    void deleteExercise(id).then(() => navigate('/'));
  }

  return (
    <div className="screen">
      <header className="top-bar">
        <Link href="/" className="icon-btn" aria-label="Back to exercises">
          <BackIcon />
        </Link>
        {renaming ? (
          <form className="rename-form" onSubmit={handleRename}>
            <input
              type="text"
              className="text-input text-input-small"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              aria-label="Exercise name"
              autoFocus
            />
            <button type="submit" className="btn btn-primary btn-small" disabled={!renameValue.trim()}>
              Save
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setRenaming(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <h1 className="exercise-title">{exercise.name}</h1>
        )}
        {!renaming && (
          <button type="button" className="icon-btn" aria-label="Exercise options" onClick={() => setMenuOpen((v) => !v)}>
            <DotsIcon />
          </button>
        )}
        {menuOpen && (
          <div className="menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setRenameValue(exercise.name);
                setRenaming(true);
              }}
            >
              Rename exercise
            </button>
            <button type="button" role="menuitem" className="menu-danger" onClick={handleDeleteExercise}>
              Delete exercise
            </button>
          </div>
        )}
      </header>

      <RecordsPanel records={records} />
      <HistoryList
        entries={newestFirst}
        prIds={prIds}
        editingId={editingId}
        onEdit={setEditingId}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <LogBar key={id} defaultWeightKg={last?.weightKg} defaultReps={last?.reps} onLog={handleLog} />
    </div>
  );
}
