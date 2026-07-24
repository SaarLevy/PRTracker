import { useState } from 'react';
import { formatWeightKg, toISODay } from '../lib/format';
import type { Entry } from '../types';

export interface EntryValues {
  weightKg: number;
  reps: number;
  note?: string;
  date: string;
}

function parseWeight(raw: string): number {
  return Number.parseFloat(raw.replace(',', '.'));
}

function parseReps(raw: string): number {
  return /^\d+$/.test(raw.trim()) ? Number.parseInt(raw, 10) : NaN;
}

function isValid(weightKg: number, reps: number): boolean {
  return Number.isFinite(weightKg) && weightKg >= 0 && Number.isInteger(reps) && reps >= 1;
}

interface StepperProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  step: number;
  min: number;
  decimal?: boolean;
}

function Stepper({ label, value, onValueChange, step, min, decimal }: StepperProps) {
  function bump(direction: 1 | -1) {
    const parsed = decimal ? parseWeight(value) : parseReps(value);
    const base = Number.isFinite(parsed) ? parsed : min - direction * step;
    const next = Math.max(min, Math.round((base + direction * step) * 100) / 100);
    onValueChange(String(next));
  }

  return (
    <div className="stepper">
      <button type="button" onClick={() => bump(-1)} aria-label={`Decrease ${label}`}>
        −
      </button>
      <div className="stepper-field">
        <input
          type="text"
          inputMode={decimal ? 'decimal' : 'numeric'}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          aria-label={label}
          placeholder={decimal ? '0' : '0'}
        />
        <span className="stepper-label">{label}</span>
      </div>
      <button type="button" onClick={() => bump(1)} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  );
}

interface LogBarProps {
  defaultWeightKg?: number;
  defaultReps?: number;
  onLog: (values: EntryValues) => void;
}

/** Bottom-docked quick logger: steppers for weight/reps, optional note and date. */
export function LogBar({ defaultWeightKg, defaultReps, onLog }: LogBarProps) {
  const [weight, setWeight] = useState(defaultWeightKg !== undefined ? formatWeightKg(defaultWeightKg) : '');
  const [reps, setReps] = useState(defaultReps !== undefined ? String(defaultReps) : '');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(toISODay(new Date()));

  const weightKg = parseWeight(weight);
  const repsNum = parseReps(reps);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid(weightKg, repsNum)) return;
    onLog({ weightKg, reps: repsNum, note: note.trim() || undefined, date });
    setNote('');
  }

  return (
    <form className="dock" onSubmit={handleSubmit}>
      <div className="log-extras">
        <input
          type="text"
          className="text-input text-input-small"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="Note"
        />
        <input
          type="date"
          className="text-input text-input-small date-input"
          value={date}
          max={toISODay(new Date())}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date"
        />
      </div>
      <div className="log-main">
        <Stepper label="kg" value={weight} onValueChange={setWeight} step={2.5} min={0} decimal />
        <Stepper label="reps" value={reps} onValueChange={setReps} step={1} min={1} />
        <button type="submit" className="btn btn-primary btn-log" disabled={!isValid(weightKg, repsNum)}>
          Log set
        </button>
      </div>
    </form>
  );
}

interface EntryEditorProps {
  entry: Entry;
  onSave: (values: EntryValues) => void;
  onDelete: () => void;
  onCancel: () => void;
}

/** Inline editor shown in place of a history row. */
export function EntryEditor({ entry, onSave, onDelete, onCancel }: EntryEditorProps) {
  const [weight, setWeight] = useState(formatWeightKg(entry.weightKg));
  const [reps, setReps] = useState(String(entry.reps));
  const [note, setNote] = useState(entry.note ?? '');
  const [date, setDate] = useState(entry.date);

  const weightKg = parseWeight(weight);
  const repsNum = parseReps(reps);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid(weightKg, repsNum)) return;
    onSave({ weightKg, reps: repsNum, note: note.trim() || undefined, date });
  }

  return (
    <form className="entry-editor" onSubmit={handleSubmit}>
      <div className="editor-grid">
        <label className="editor-field">
          <span>Weight (kg)</span>
          <input type="text" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label className="editor-field">
          <span>Reps</span>
          <input type="text" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
        </label>
        <label className="editor-field editor-field-wide">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="editor-field editor-field-wide">
          <span>Note</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </label>
      </div>
      <div className="editor-actions">
        <button type="submit" className="btn btn-primary" disabled={!isValid(weightKg, repsNum)}>
          Save
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </form>
  );
}
