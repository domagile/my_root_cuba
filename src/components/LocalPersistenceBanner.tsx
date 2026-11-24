import { useLocalPersistenceStore } from '../stores/useLocalPersistenceStore';
import { flushPendingLocalWrites } from '../utils/indexedDbStorage';

export function LocalPersistenceBanner() {
  const error=useLocalPersistenceStore((state) => state.lastError);
  if(!error) return null;

  return (
    <div role="alert" className="shrink-0 bg-red-100 text-red-950 border-b border-red-300 px-4 py-3 text-sm">
      <p>Не вдалося зберегти останні зміни на цьому пристрої. Не закривайте вкладку; перевірте вільне місце й дозволи сховища та повторіть збереження.</p>
      <button type="button" className="mt-2 underline font-semibold cursor-pointer"
        onClick={() => { void flushPendingLocalWrites().catch(() => { }); }}>
        Повторити збереження
      </button>
    </div>
  );
}
