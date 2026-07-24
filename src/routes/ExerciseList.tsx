import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { GearIcon } from '../components/icons';
import { addExercise, db } from '../db';
import { formatWeightKg, timeAgo } from '../lib/format';
import { searchExercises } from '../lib/exerciseSearch';
import { chronological, overallBest } from '../lib/records';
import type { Entry } from '../types';

export default function ExerciseList() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState('');

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

  const results = useMemo(() => searchExercises(query, exercises ?? []), [query, exercises]);

  const loaded = exercises !== undefined && entries !== undefined;
  const now = new Date();

  async function handleResolve(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const match = exercises?.find((e) => e.name.trim().toLowerCase() === trimmed.toLowerCase());
    const id = match ? match.id : await addExercise(trimmed);
    setQuery('');
    navigate(`/exercise/${id}`);
  }

  function handleFormSubmit(event: React.FormEvent) {
    event.preventDefault();
    void handleResolve(query);
  }

  return (
    <div className="screen">
      <header className="top-bar">
        <span className="wordmark">PRTRACKER</span>
        <Link href="/settings" className="icon-btn" aria-label="Settings">
          <GearIcon />
        </Link>
      </header>

      {loaded && exercises.length === 0 && !query.trim() && (
        <p className="empty">
          <strong>No exercises yet.</strong>
          <br />
          Search below for a common lift, or type a name to add your own.
        </p>
      )}

      <ul className="exercise-rows">
        {results.existing.map((exercise) => {
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

        {results.libraryOnly.map((name) => (
          <li key={name}>
            <button
              type="button"
              className="exercise-row exercise-row-library"
              onClick={() => void handleResolve(name)}
            >
              <span className="exercise-info">
                <span className="exercise-name">{name}</span>
                <span className="exercise-sub">Not tracked yet</span>
              </span>
              <span className="row-plus" aria-hidden="true">
                +
              </span>
            </button>
          </li>
        ))}

        {results.showAddLiteral && (
          <li>
            <button
              type="button"
              className="exercise-row exercise-row-add"
              onClick={() => void handleResolve(query)}
            >
              <span className="exercise-info">
                <span className="exercise-name">Add "{query.trim()}"</span>
              </span>
              <span className="row-plus" aria-hidden="true">
                +
              </span>
            </button>
          </li>
        )}
      </ul>

      <form className="dock" onSubmit={handleFormSubmit}>
        <input
          type="search"
          className="search-input"
          placeholder="Search or add an exercise"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search or add an exercise"
        />
      </form>
    </div>
  );
}
