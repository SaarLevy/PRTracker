import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { GearIcon } from '../components/icons';
import { addExercise, db } from '../db';
import { formatWeightKg, timeAgo } from '../lib/format';
import { chronological, overallBest } from '../lib/records';
import type { Entry } from '../types';

export default function ExerciseList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');

  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const entries = useLiveQuery(() => db.entries.toArray(), []);

  const entriesByExercise = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of entries ?? []) {
      const list = map.get(entry.exerciseId);
      if (list) list.push(entry);
      else map.set(entry.exerciseId, [entry]);
    }
    return map;
  }, [entries]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (exercises ?? [])
      .filter((e) => e.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, search]);

  const loaded = exercises !== undefined && entries !== undefined;
  const now = new Date();

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const id = await addExercise(name);
    setNewName('');
    navigate(`/exercise/${id}`);
  }

  return (
    <div className="screen">
      <header className="top-bar">
        <span className="wordmark">PRTRACKER</span>
        <Link href="/settings" className="icon-btn" aria-label="Settings">
          <GearIcon />
        </Link>
      </header>

      {(exercises?.length ?? 0) > 0 && (
        <input
          type="search"
          className="search-input"
          placeholder="Search exercises"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search exercises"
        />
      )}

      {loaded && exercises.length === 0 && (
        <p className="empty">
          <strong>No exercises yet.</strong>
          <br />
          Add your first lift below — then log a set whenever you train it.
        </p>
      )}

      {loaded && exercises.length > 0 && visible.length === 0 && (
        <p className="empty">Nothing matches "{search.trim()}".</p>
      )}

      <ul className="exercise-rows">
        {visible.map((exercise) => {
          const list = entriesByExercise.get(exercise.id) ?? [];
          const latest = chronological(list).at(-1);
          const best = overallBest(list);
          return (
            <li key={exercise.id}>
              <Link href={`/exercise/${exercise.id}`} className="exercise-row">
                <span className="exercise-info">
                  <span className="exercise-name">{exercise.name}</span>
                  <span className="exercise-sub">
                    {latest
                      ? `${formatWeightKg(latest.weightKg)} kg × ${latest.reps} · ${timeAgo(latest.date, now)}`
                      : 'No sets logged yet'}
                  </span>
                </span>
                {best && (
                  <span className="best-chip">
                    <span className="best-value">{formatWeightKg(best.weightKg)}</span>
                    <span className="best-label">best kg</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <form className="dock" onSubmit={handleAdd}>
        <div className="add-row">
          <input
            type="text"
            className="text-input"
            placeholder="New exercise, e.g. Bench Press"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            aria-label="New exercise name"
          />
          <button type="submit" className="btn btn-primary" disabled={!newName.trim()}>
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
