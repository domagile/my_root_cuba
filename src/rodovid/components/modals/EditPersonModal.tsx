/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Save, User } from 'lucide-react';
import { GenealogyDatabase, Person, Gender } from '../../types/genealogy';

interface EditPersonModalProps {
  database: GenealogyDatabase;
  personId?: string | null;
  onClose: () => void;
  onSave: (person: Person) => void;
}

export const EditPersonModal: React.FC<EditPersonModalProps> = ({
  database,
  personId,
  onClose,
  onSave
}) => {
  const existingPerson = personId ? database.persons[personId] : null;

  const [given, setGiven] = useState(existingPerson?.name?.given || existingPerson?.firstName || '');
  const [surname, setSurname] = useState(existingPerson?.name?.surname || existingPerson?.lastName || '');
  const [patronymic, setPatronymic] = useState(existingPerson?.name?.patronymic || existingPerson?.patronymic || '');
  const [maidenName, setMaidenName] = useState(existingPerson?.name?.maidenName || existingPerson?.maidenName || '');
  const [prefix, setPrefix] = useState(existingPerson?.name?.prefix || existingPerson?.prefix || '');
  const [gender, setGender] = useState<Gender>(existingPerson?.gender || 'M');
  const [isLiving, setIsLiving] = useState<boolean>(existingPerson?.isLiving ?? false);
  const [birthDate, setBirthDate] = useState(existingPerson?.birthDate || '');
  const [birthPlace, setBirthPlace] = useState(existingPerson?.birthPlace || '');
  const [deathDate, setDeathDate] = useState(existingPerson?.deathDate || '');
  const [deathPlace, setDeathPlace] = useState(existingPerson?.deathPlace || '');
  const [occupation, setOccupation] = useState(existingPerson?.occupation || '');
  const [estate, setEstate] = useState(existingPerson?.estateOrSocialStatus || existingPerson?.estate || '');
  const [confession, setConfession] = useState(existingPerson?.confession || '');
  const [militaryRank, setMilitaryRank] = useState(existingPerson?.militaryRank || '');
  const [avatarUrl, setAvatarUrl] = useState(existingPerson?.avatarUrl || existingPerson?.avatar || existingPerson?.photoUrl || '');
  const [bio, setBio] = useState(existingPerson?.bio || '');
  const [notes, setNotes] = useState(typeof existingPerson?.notes === 'string' ? existingPerson.notes : '');
  const [tagsStr, setTagsStr] = useState((existingPerson?.tags || []).join(', '));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!given.trim() && !surname.trim()) {
      alert('Будь ласка, вкажіть ім\'я або прізвище.');
      return;
    }

    const birthYearMatch = birthDate.match(/\b(1\d{3}|20\d{2})\b/);
    const birthYear = birthYearMatch ? parseInt(birthYearMatch[1], 10) : undefined;

    const deathYearMatch = deathDate.match(/\b(1\d{3}|20\d{2})\b/);
    const deathYear = deathYearMatch ? parseInt(deathYearMatch[1], 10) : undefined;

    const tags = tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const generatedId = existingPerson?.id || `I${String(Object.keys(database.persons).length + 1).padStart(4, '0')}`;

    const newPerson: Person = {
      id: generatedId,
      name: {
        given: given.trim(),
        surname: surname.trim(),
        patronymic: patronymic.trim() || undefined,
        maidenName: maidenName.trim() || undefined,
        prefix: prefix.trim() || undefined
      },
      firstName: given.trim(),
      lastName: surname.trim(),
      patronymic: patronymic.trim() || undefined,
      maidenName: maidenName.trim() || undefined,
      prefix: prefix.trim() || undefined,
      gender,
      isLiving,
      birthDate: birthDate.trim() || undefined,
      birthYear,
      birthPlace: birthPlace.trim() || undefined,
      deathDate: !isLiving && deathDate.trim() ? deathDate.trim() : undefined,
      deathYear: !isLiving ? deathYear : undefined,
      deathPlace: !isLiving && deathPlace.trim() ? deathPlace.trim() : undefined,
      occupation: occupation.trim() || undefined,
      estate: estate.trim() || undefined,
      socialStatus: estate.trim() || undefined,
      estateOrSocialStatus: estate.trim() || undefined,
      confession: confession.trim() || undefined,
      militaryRank: militaryRank.trim() || undefined,
      avatar: avatarUrl.trim() || undefined,
      avatarUrl: avatarUrl.trim() || undefined,
      photoUrl: avatarUrl.trim() || undefined,
      bio: bio.trim() || undefined,
      notes: notes.trim() || existingPerson?.notes || undefined,
      tags: tags.length > 0 ? tags : undefined,
      events: existingPerson?.events || [],
      citations: existingPerson?.citations || [],
      sourceCitations: existingPerson?.sourceCitations || [],
      sourceIds: existingPerson?.sourceIds || [],
      parentFamilyId: existingPerson?.parentFamilyId,
      spouseFamilyIds: existingPerson?.spouseFamilyIds || [],
      fatherId: existingPerson?.fatherId,
      motherId: existingPerson?.motherId,
      spouseIds: existingPerson?.spouseIds || [],
      childrenIds: existingPerson?.childrenIds || []
    };

    onSave(newPerson);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              {existingPerson ? 'Редагувати фігуранта / особу' : 'Додати фігуранта / особу'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto scrollbar-thin">
          {/* Names Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Прізвище *</label>
              <input
                type="text"
                required
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                placeholder="Морозов"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Ім'я *</label>
              <input
                type="text"
                required
                value={given}
                onChange={(e) => setGiven(e.target.value)}
                placeholder="Микола"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">По батькові</label>
              <input
                type="text"
                value={patronymic}
                onChange={(e) => setPatronymic(e.target.value)}
                placeholder="Олександрович"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Дівоче прізвище / до шлюбу
              </label>
              <input
                type="text"
                value={maidenName}
                onChange={(e) => setMaidenName(e.target.value)}
                placeholder="Оболенська"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Титул / Префікс / Стан
              </label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="Штабс-капітан, Граф, Козак"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Gender & Living Status */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Стать</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="M">Чоловіча (M)</option>
                <option value="F">Жіноча (F)</option>
                <option value="U">Невідома (U)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Статус життя</label>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isLiving}
                    onChange={(e) => setIsLiving(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 bg-slate-950"
                  />
                  <span>Нині живий(а)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Birth Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Дата / рік народження
              </label>
              <input
                type="text"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                placeholder="12.05.1888 або 1888"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Місце народження
              </label>
              <input
                type="text"
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                placeholder="Київ, Україна"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Death Info */}
          {!isLiving && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Дата смерті
                </label>
                <input
                  type="text"
                  value={deathDate}
                  onChange={(e) => setDeathDate(e.target.value)}
                  placeholder="14.01.1956 або 1956"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Місце смерті
                </label>
                <input
                  type="text"
                  value={deathPlace}
                  onChange={(e) => setDeathPlace(e.target.value)}
                  placeholder="Львів, Україна"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Occupation & Social Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Рід занять / Професія
              </label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="Архітектор, професор"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Стан / Соціальний статус
              </label>
              <input
                type="text"
                value={estate}
                onChange={(e) => setEstate(e.target.value)}
                placeholder="Козак, дворянин, міщанин..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Confession & Military Rank */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Віросповідання / Конфесія
              </label>
              <input
                type="text"
                value={confession}
                onChange={(e) => setConfession(e.target.value)}
                placeholder="Православний, римо-католик..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Військове звання / Чин
              </label>
              <input
                type="text"
                value={militaryRank}
                onChange={(e) => setMilitaryRank(e.target.value)}
                placeholder="Сотник, підпоручик..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Photo & Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Посилання на фото (URL)
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Теги (через кому)
              </label>
              <input
                type="text"
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
                placeholder="Ветеран, Дворянин, Архітектор"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Biography */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Життєпис / Біографічна довідка
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Відомості про життя, освіту, службу, нагороди..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Архівні нотатки та посилання
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Джерела, ревізії, метрики, сповідні розписи..."
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
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Зберегти в базу</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
