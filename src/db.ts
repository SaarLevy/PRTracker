import Dexie, { type EntityTable } from 'dexie';
import type { Entry, Exercise } from './types';

export const db = new Dexie('prtracker') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>;
  entries: EntityTable<Entry, 'id'>;
};

db.version(1).stores({
  exercises: 'id, name',
  entries: 'id, exerciseId, date',
});

export function addExercise(name: string): Promise<string> {
  const exercise: Exercise = { id: crypto.randomUUID(), name: name.trim(), createdAt: new Date().toISOString() };
  return db.exercises.add(exercise);
}

export function renameExercise(id: string, name: string): Promise<number> {
  return db.exercises.update(id, { name: name.trim() });
}

/** Deletes an exercise and all of its entries. */
export function deleteExercise(id: string): Promise<void> {
  return db.transaction('rw', db.exercises, db.entries, async () => {
    await db.entries.where('exerciseId').equals(id).delete();
    await db.exercises.delete(id);
  });
}

export function addEntry(input: Omit<Entry, 'id' | 'createdAt'>): Promise<string> {
  const entry: Entry = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  return db.entries.add(entry);
}

export function updateEntry(id: string, changes: Partial<Omit<Entry, 'id' | 'exerciseId' | 'createdAt'>>): Promise<number> {
  return db.entries.update(id, changes);
}

export function deleteEntry(id: string): Promise<void> {
  return db.entries.delete(id);
}

/** Replaces the entire database contents (used by import). */
export function replaceAll(exercises: Exercise[], entries: Entry[]): Promise<void> {
  return db.transaction('rw', db.exercises, db.entries, async () => {
    await db.exercises.clear();
    await db.entries.clear();
    await db.exercises.bulkAdd(exercises);
    await db.entries.bulkAdd(entries);
  });
}
