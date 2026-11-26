import React, { useState } from 'react';
import { Undo2, X } from 'lucide-react';
import { useGenealogyStore } from '../stores/useGenealogyStore';

export function UndoPersonMergeButton() {
  const snapshotId = useGenealogyStore(state => state.lastPersonMergeSnapshotId);
  const busy = useGenealogyStore(state => state.mergeInProgress);
  const undo = useGenealogyStore(state => state.undoLastPersonMerge);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  if (!snapshotId && !message) return null;
  return <div className="relative shrink-0">
    {snapshotId && <button type="button" disabled={busy}
      title="Скасувати останнє злиття, якщо після нього записи не змінювалися"
      aria-label="Скасувати останнє злиття"
      className="p-2 rounded-xl text-amber-600 hover:bg-amber-500/10 disabled:opacity-50 cursor-pointer"
      onClick={async () => {
        setMessage(null); setFailed(false);
        try {
          const result = await undo();
          setMessage(result.persisted ? 'Злиття скасовано. Особи та родинні зв’язки відновлено.'
            : 'Злиття скасовано в пам’яті. Локальне збереження ще не підтверджене; не закривайте вкладку.');
        } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Не вдалося скасувати злиття.'); }
      }}><Undo2 className="w-4 h-4" /></button>}
    {message && <div role={failed ? 'alert' : 'status'} className="absolute right-0 top-full z-[100] mt-2 w-64 rounded-xl border border-amber-500/30 bg-white dark:bg-neutral-900 p-3 text-xs shadow-xl">
      <p>{message}</p><button type="button" className="mt-2 flex items-center gap-1 cursor-pointer" onClick={() => setMessage(null)}><X className="w-3 h-3" />Закрити</button>
    </div>}
  </div>;
}
