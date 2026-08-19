import React, { useState } from 'react';
import { X, BookOpen, Save } from 'lucide-react';
import { GenealogyDatabase, Source } from '../../types/genealogy';

interface EditSourceModalProps {
  sourceId: string | null;
  database: GenealogyDatabase;
  onClose: () => void;
  onSave: (source: Source) => void;
}

export const EditSourceModal: React.FC<EditSourceModalProps> = ({
  sourceId,
  database,
  onClose,
  onSave
}) => {
  const existingSource = sourceId ? database.sources[sourceId] : null;

  const [title, setTitle] = useState(existingSource?.title || '');
  const [author, setAuthor] = useState(existingSource?.author || '');
  const [publication, setPublication] = useState(existingSource?.publication || '');
  const [repository, setRepository] = useState(existingSource?.repository || '');
  const [archiveReference, setArchiveReference] = useState(
    existingSource?.archiveReference || ''
  );
  const [notes, setNotes] = useState(existingSource?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      return;
    }

    const generatedId =
      existingSource?.id || `S${String(Object.keys(database.sources).length + 1).padStart(4, '0')}`;

    const newSource: Source = {
      id: generatedId,
      title: title.trim(),
      author: author.trim() || undefined,
      publication: publication.trim() || undefined,
      repository: repository.trim() || undefined,
      archiveReference: archiveReference.trim() || undefined,
      notes: notes.trim() || undefined
    };

    onSave(newSource);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">
              {existingSource ? 'Редагувати архівне джерело' : 'Додати архівне джерело'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Назва джерела / Документа *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Метрична книга за 1898 рік..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Автор / Укладач / Відомство
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Київська духовна консисторія"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Рік / Публікація
              </label>
              <input
                type="text"
                value={publication}
                onChange={(e) => setPublication(e.target.value)}
                placeholder="1888 рік"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Архівосховище (Репозиторій)
            </label>
            <input
              type="text"
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              placeholder="Центральний державний історичний архів України (ЦДІАК)"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Архівний шифр (Фонд, Опис, Справа, Аркуш)
            </label>
            <input
              type="text"
              value={archiveReference}
              onChange={(e) => setArchiveReference(e.target.value)}
              placeholder="Фонд 127, Опис 1012, Справа 1124, Аркуші 45-46"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-amber-300 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Примітки та цитування
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Додаткові відомості, розшифровка рукописного тексту..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Зберегти джерело</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
