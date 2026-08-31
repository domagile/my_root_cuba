import React, { useState } from 'react';
import { X, HeartHandshake, Save, Plus } from 'lucide-react';
import { GenealogyDatabase, Family, Person } from '../../types/genealogy';
import { getFullName, sortPersonsBySurnameAndBirthDesc } from '../../utils/relationship';

interface EditFamilyModalProps {
  familyId: string | null;
  database: GenealogyDatabase;
  onClose: () => void;
  onSave: (family: Family) => void;
}

export const EditFamilyModal: React.FC<EditFamilyModalProps> = ({
  familyId,
  database,
  onClose,
  onSave
}) => {
  const existingFamily = familyId ? database.families[familyId] : null;

  const [husbandId, setHusbandId] = useState(existingFamily?.husbandId || '');
  const [wifeId, setWifeId] = useState(existingFamily?.wifeId || '');
  const [marriageDate, setMarriageDate] = useState(existingFamily?.marriageDate || '');
  const [marriagePlace, setMarriagePlace] = useState(existingFamily?.marriagePlace || '');
  const [childrenIds, setChildrenIds] = useState<string[]>(
    existingFamily?.children.map((c) => c.personId) || []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const marriageYearMatch = marriageDate.match(/\b(1\d{3}|20\d{2})\b/);
    const marriageYear = marriageYearMatch ? parseInt(marriageYearMatch[1], 10) : undefined;

    const generatedId =
      existingFamily?.id || `F${String(Object.keys(database.families).length + 1).padStart(4, '0')}`;

    const newFamily: Family = {
      id: generatedId,
      husbandId: husbandId || undefined,
      wifeId: wifeId || undefined,
      relationshipType: 'Married',
      marriageDate: marriageDate.trim() || undefined,
      marriageYear,
      marriagePlace: marriagePlace.trim() || undefined,
      children: childrenIds.map((cId) => ({ personId: cId, relationType: 'Biological' })),
      events: existingFamily?.events || [],
      notes: existingFamily?.notes || [],
      citations: existingFamily?.citations || []
    };

    onSave(newFamily);
    onClose();
  };

  const handleToggleChild = (pId: string) => {
    if (childrenIds.includes(pId)) {
      setChildrenIds(childrenIds.filter((id) => id !== pId));
    } else {
      setChildrenIds([...childrenIds, pId]);
    }
  };

  const allPersons = Object.values(database.persons) as Person[];
  const menList = sortPersonsBySurnameAndBirthDesc(allPersons.filter((p) => p.gender === 'M' || p.gender === 'U' || p.gender === 'male'));
  const womenList = sortPersonsBySurnameAndBirthDesc(allPersons.filter((p) => p.gender === 'F' || p.gender === 'U' || p.gender === 'female'));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              {existingFamily ? 'Редагувати сімейний союз' : 'Створити сімейний союз'}
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
          {/* Spouses Select */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-blue-400 mb-1">
                Чоловік / Партнер 1
              </label>
              <select
                value={husbandId}
                onChange={(e) => setHusbandId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Не вказано --</option>
                {menList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getFullName(p)} {p.birthYear ? `(${p.birthYear})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-rose-400 mb-1">
                Дружина / Партнер 2
              </label>
              <select
                value={wifeId}
                onChange={(e) => setWifeId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Не вказано --</option>
                {womenList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getFullName(p)} {p.birthYear ? `(${p.birthYear})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Marriage Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Дата одруження
              </label>
              <input
                type="text"
                value={marriageDate}
                onChange={(e) => setMarriageDate(e.target.value)}
                placeholder="28.09.1947 або 1947"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Місце укладення шлюбу
              </label>
              <input
                type="text"
                value={marriagePlace}
                onChange={(e) => setMarriagePlace(e.target.value)}
                placeholder="Київ, церква..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Children selector checklist */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <span className="block text-xs font-semibold text-slate-300">
              Діти цієї сім'ї (обрано: {childrenIds.length}):
            </span>
            <div className="max-h-36 overflow-y-auto bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1 scrollbar-thin">
              {allPersons.map((p) => {
                const isSelected = childrenIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 p-1.5 hover:bg-slate-900 rounded cursor-pointer text-xs text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleChild(p.id)}
                      className="rounded border-slate-700 text-emerald-600 bg-slate-900"
                    />
                    <span className={isSelected ? 'text-white font-medium' : ''}>
                      {getFullName(p)} {p.birthYear ? `(${p.birthYear})` : ''}
                    </span>
                  </label>
                );
              })}
            </div>
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
              <span>Зберегти союз</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
