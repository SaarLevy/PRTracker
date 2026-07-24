import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'wouter';
import { BackIcon } from '../components/icons';
import { db, replaceAll } from '../db';
import { parseImport, serializeExport } from '../lib/exportImport';
import { toISODay } from '../lib/format';

type Message = { kind: 'ok' | 'error'; text: string };

export default function Settings() {
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const entries = useLiveQuery(() => db.entries.toArray(), []);
  const [message, setMessage] = useState<Message | null>(null);

  async function handleExport() {
    const json = serializeExport(exercises ?? [], entries ?? []);
    const filename = `prtracker-backup-${toISODay(new Date())}.json`;
    const file = new File([json], filename, { type: 'application/json' });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'PRTracker backup' });
        setMessage({ kind: 'ok', text: 'Backup shared.' });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        // Fall through to a plain download.
      }
    }

    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage({ kind: 'ok', text: 'Backup downloaded.' });
  }

  async function handleImport(file: File) {
    try {
      const parsed = parseImport(await file.text());
      const current = `${exercises?.length ?? 0} exercises, ${entries?.length ?? 0} sets`;
      const incoming = `${parsed.exercises.length} exercises, ${parsed.entries.length} sets`;
      if (!confirm(`Replace the data on this device (${current}) with the backup (${incoming})? This cannot be undone.`)) {
        return;
      }
      await replaceAll(parsed.exercises, parsed.entries);
      setMessage({ kind: 'ok', text: 'Backup restored.' });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Import failed.' });
    }
  }

  return (
    <div className="screen screen-no-dock">
      <header className="top-bar">
        <Link href="/" className="icon-btn" aria-label="Back to exercises">
          <BackIcon />
        </Link>
        <h1 className="exercise-title">Settings</h1>
      </header>

      <section className="card" aria-label="Your data">
        <h2 className="section-label">Your data</h2>
        <p className="stat-line">
          {exercises?.length ?? 0} exercises · {entries?.length ?? 0} logged sets
        </p>
        <div className="card-actions">
          <button type="button" className="btn btn-primary" onClick={handleExport}>
            Export backup
          </button>
          <label className="btn btn-ghost">
            Import backup
            <input
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImport(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {message && <p className={message.kind === 'error' ? 'msg msg-error' : 'msg'}>{message.text}</p>}
        <p className="fine-print">
          Everything is stored only on this device — nothing leaves your phone. Export a backup before switching devices,
          and import it on the new one.
        </p>
      </section>
    </div>
  );
}
