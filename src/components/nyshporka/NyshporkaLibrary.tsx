import React, { useState } from 'react';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Layers, 
  FileText, 
  ArrowRight,
  Sparkles,
  Search
} from 'lucide-react';
import { ArchivalCase } from './types';

interface NyshporkaLibraryProps {
  theme: any;
  onOpenCase: (caseId: string) => void;
  onNavigateToCatalog: () => void;
}

const INITIAL_CASES: ArchivalCase[] = [
  {
    id: 'dahmo-315-1-159',
    shifra: 'ДАХмО 315-1-159',
    archive: 'ДАХмО',
    fond: '315',
    opis: '1',
    sprava: '159',
    title: 'Справа про рукоположення дякона Григорія Долищинського у с. Липовеньке Балтського повіту',
    years: '1821–1822',
    sheets: 24,
    status: 'decoded',
    frames: []
  },
  {
    id: 'cdiak-127-1012-115',
    shifra: 'ЦДІАК 127-1012-115',
    archive: 'ЦДІАК',
    fond: '127',
    opis: '1012',
    sprava: '115',
    title: 'Метрична книга церков Васильківського повіту Київської губернії',
    years: '1835',
    sheets: 340,
    status: 'in_progress',
    frames: []
  },
  {
    id: 'dako-280-2-340',
    shifra: 'ДАКО 280-2-340',
    archive: 'ДАКО',
    fond: '280',
    opis: '2',
    sprava: '340',
    title: 'Ревізька казка поміщицьких селян Білоцерківського ключа графів Браницьких',
    years: '1858',
    sheets: 180,
    status: 'queued',
    frames: []
  }
];

export const NyshporkaLibrary: React.FC<NyshporkaLibraryProps> = ({ 
  theme, 
  onOpenCase,
  onNavigateToCatalog 
}) => {
  const [cases, setCases] = useState<ArchivalCase[]>(INITIAL_CASES);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newShifra, setNewShifra] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newYears, setNewYears] = useState('');
  const [newSheets, setNewSheets] = useState('50');

  const handleAddCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShifra.trim()) return;

    const newCase: ArchivalCase = {
      id: `case-${Date.now()}`,
      shifra: newShifra.trim(),
      archive: newShifra.split(' ')[0] || 'Архів',
      fond: '1',
      opis: '1',
      sprava: '1',
      title: newTitle.trim() || 'Архівна справа',
      years: newYears.trim() || 'XIX ст.',
      sheets: parseInt(newSheets) || 10,
      status: 'queued',
      frames: []
    };

    setCases([newCase, ...cases]);
    setNewShifra('');
    setNewTitle('');
    setNewYears('');
    setIsAddModalOpen(false);
  };

  const handleDeleteCase = (id: string) => {
    setCases(cases.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold ${theme.cardTitle} flex items-center gap-2`}>
            <BookOpen className="w-5 h-5 text-amber-500" />
            Бібліотека архівних справ у дослідженні
          </h2>
          <p className={`text-xs ${theme.cardSubtext} mt-0.5`}>
            Справи з метричними книгами, сповідками та ревізіями, взяті в опрацювання
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateToCatalog}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-amber-500" />
            Знайти в каталозі описів
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Додати нову справу
          </button>
        </div>
      </div>

      {/* Cases List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cases.map((c) => (
          <div
            key={c.id}
            className={`p-5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/50 transition-all flex flex-col justify-between shadow-sm space-y-4`}
          >
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono text-xs font-bold">
                  {c.shifra}
                </span>

                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  c.status === 'decoded'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : c.status === 'in_progress'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-300 dark:border-neutral-700'
                }`}>
                  {c.status === 'decoded' ? '✓ Прочитано' : c.status === 'in_progress' ? 'В процесі' : 'Очікує'}
                </span>
              </div>

              <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 line-clamp-2 leading-snug">
                {c.title}
              </h3>

              <div className="flex items-center gap-4 text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                <span>Рік: {c.years}</span>
                <span>Аркушів: {c.sheets}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteCase(c.id)}
                className="p-1.5 text-neutral-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                title="Видалити з бібліотеки"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onOpenCase(c.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Читати в гортачі
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className={`w-full max-w-md p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl space-y-4`}>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
              <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                Додати архівну справу до дослідження
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCase} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Архівний шифр (напр. ДАХмО 315-1-159 або ЦДІАК 127-1012-50):</label>
                <input
                  type="text"
                  required
                  value={newShifra}
                  onChange={e => setNewShifra(e.target.value)}
                  placeholder="ДАХмО 315-1-159"
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Назва або зміст справи:</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Метрична книга с. Липовеньке..."
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Роки:</label>
                  <input
                    type="text"
                    value={newYears}
                    onChange={e => setNewYears(e.target.value)}
                    placeholder="1820–1830"
                    className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Кількість аркушів:</label>
                  <input
                    type="number"
                    value={newSheets}
                    onChange={e => setNewSheets(e.target.value)}
                    placeholder="50"
                    className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                >
                  Зберегти справу
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
