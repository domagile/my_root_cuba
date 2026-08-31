/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Save, User, UserPlus, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useGenealogy } from '../../context/GenealogyContext';
import { getThemeConfig } from '../../utils/theme';
import { Person, Gender } from '../../types';

interface AddPersonModalProps {
  initialPersonToEdit?: Person | null;
  initialRelation?: {
    type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling';
    targetPersonId: string;
  } | null;
  onClose: () => void;
}

export const AddPersonModal: React.FC<AddPersonModalProps> = ({
  initialPersonToEdit,
  initialRelation,
  onClose
}) => {
  const { persons, addPerson, updatePerson, themePalette } = useGenealogy();
  const theme = getThemeConfig(themePalette);

  const [showAdvanced, setShowAdvanced] = useState(false);

  const [firstName, setFirstName] = useState(
    initialPersonToEdit?.name?.given || initialPersonToEdit?.firstName || ''
  );
  const [lastName, setLastName] = useState(
    initialPersonToEdit?.name?.surname || initialPersonToEdit?.lastName || ''
  );
  const [maidenName, setMaidenName] = useState(
    initialPersonToEdit?.name?.maidenName || initialPersonToEdit?.maidenName || ''
  );
  const [patronymic, setPatronymic] = useState(
    initialPersonToEdit?.name?.patronymic || initialPersonToEdit?.patronymic || ''
  );
  const [prefix, setPrefix] = useState(
    initialPersonToEdit?.name?.prefix || initialPersonToEdit?.prefix || ''
  );
  const targetPerson = initialRelation
    ? persons.find((p) => p.id === initialRelation.targetPersonId)
    : null;

  const [gender, setGender] = useState<Gender>(
    initialPersonToEdit?.gender ||
      (initialRelation?.type === 'father'
        ? 'male'
        : initialRelation?.type === 'mother'
        ? 'female'
        : initialRelation?.type === 'spouse'
        ? (targetPerson?.gender === 'male' || targetPerson?.gender === 'M' ? 'female' : 'male')
        : 'male')
  );
  const [birthDate, setBirthDate] = useState(initialPersonToEdit?.birthDate || '');
  const [birthPlace, setBirthPlace] = useState(initialPersonToEdit?.birthPlace || '');
  const [deathDate, setDeathDate] = useState(initialPersonToEdit?.deathDate || '');
  const [deathPlace, setDeathPlace] = useState(initialPersonToEdit?.deathPlace || '');
  const [isLiving, setIsLiving] = useState(initialPersonToEdit?.isLiving || false);
  const [occupation, setOccupation] = useState(initialPersonToEdit?.occupation || '');
  const [estate, setEstate] = useState(
    initialPersonToEdit?.estateOrSocialStatus || initialPersonToEdit?.estate || ''
  );
  const [confession, setConfession] = useState(initialPersonToEdit?.confession || '');
  const [militaryRank, setMilitaryRank] = useState(initialPersonToEdit?.militaryRank || '');
  const [bio, setBio] = useState(initialPersonToEdit?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(
    initialPersonToEdit?.avatarUrl || initialPersonToEdit?.avatar || initialPersonToEdit?.photoUrl || ''
  );
  const [tagsStr, setTagsStr] = useState((initialPersonToEdit?.tags || []).join(', '));
  const [notes, setNotes] = useState(
    typeof initialPersonToEdit?.notes === 'string' ? initialPersonToEdit.notes : ''
  );

  const getRelationLabel = () => {
    if (!initialRelation) return 'Створення нової особи';
    const name = targetPerson
      ? `${targetPerson.name?.surname || targetPerson.lastName || ''} ${targetPerson.name?.given || targetPerson.firstName || ''}`.trim()
      : 'особи';
    switch (initialRelation.type) {
      case 'father':
        return `Додати батька для: ${name}`;
      case 'mother':
        return `Додати матір для: ${name}`;
      case 'spouse':
        return `Додати партнера/подружжя для: ${name}`;
      case 'child':
        return `Додати дитину для: ${name}`;
      case 'sibling':
        return `Додати брата/сестру для: ${name}`;
      case 'parent':
        return `Додати одного з батьків для: ${name}`;
      default:
        return `Додати родича для: ${name}`;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() && !lastName.trim()) return;

    const birthYearMatch = birthDate.match(/\b(1\d{3}|20\d{2})\b/);
    const birthYear = birthYearMatch ? parseInt(birthYearMatch[1], 10) : undefined;

    const deathYearMatch = deathDate.match(/\b(1\d{3}|20\d{2})\b/);
    const deathYear = deathYearMatch ? parseInt(deathYearMatch[1], 10) : undefined;

    const tags = tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const nameObj = {
      given: firstName.trim(),
      surname: lastName.trim(),
      patronymic: patronymic.trim() || undefined,
      maidenName: maidenName.trim() || undefined,
      prefix: prefix.trim() || undefined
    };

    if (initialPersonToEdit) {
      updatePerson({
        ...initialPersonToEdit,
        name: nameObj,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        patronymic: patronymic.trim() || undefined,
        maidenName: maidenName.trim() || undefined,
        prefix: prefix.trim() || undefined,
        gender,
        birthDate: birthDate.trim() || undefined,
        birthPlace: birthPlace.trim() || undefined,
        birthYear,
        deathDate: isLiving ? undefined : deathDate.trim() || undefined,
        deathPlace: isLiving ? undefined : deathPlace.trim() || undefined,
        deathYear: isLiving ? undefined : deathYear,
        isLiving,
        occupation: occupation.trim() || undefined,
        estate: estate.trim() || undefined,
        estateOrSocialStatus: estate.trim() || undefined,
        socialStatus: estate.trim() || undefined,
        confession: confession.trim() || undefined,
        militaryRank: militaryRank.trim() || undefined,
        bio: bio.trim() || undefined,
        avatar: avatarUrl.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        photoUrl: avatarUrl.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        notes: notes.trim() || undefined
      });
    } else {
      const newPersonId = `p-${Date.now()}`;
      const newPerson: Person = {
        id: newPersonId,
        name: nameObj,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        patronymic: patronymic.trim() || undefined,
        maidenName: maidenName.trim() || undefined,
        prefix: prefix.trim() || undefined,
        gender,
        birthDate: birthDate.trim() || undefined,
        birthPlace: birthPlace.trim() || undefined,
        birthYear,
        deathDate: isLiving ? undefined : deathDate.trim() || undefined,
        deathPlace: isLiving ? undefined : deathPlace.trim() || undefined,
        deathYear: isLiving ? undefined : deathYear,
        isLiving,
        occupation: occupation.trim() || undefined,
        estate: estate.trim() || undefined,
        estateOrSocialStatus: estate.trim() || undefined,
        socialStatus: estate.trim() || undefined,
        confession: confession.trim() || undefined,
        militaryRank: militaryRank.trim() || undefined,
        bio: bio.trim() || undefined,
        avatar: avatarUrl.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        photoUrl: avatarUrl.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        notes: notes.trim() || undefined,
        spouseIds: [],
        childrenIds: []
      };

      // Set relationships based on initialRelation
      if (initialRelation) {
        const target = persons.find((p) => p.id === initialRelation.targetPersonId);
        if (target) {
          if (initialRelation.type === 'father') {
            updatePerson({ ...target, fatherId: newPersonId });
            newPerson.childrenIds = [target.id];
          } else if (initialRelation.type === 'mother') {
            updatePerson({ ...target, motherId: newPersonId });
            newPerson.childrenIds = [target.id];
          } else if (initialRelation.type === 'parent') {
            const isFemale = gender === 'female' || gender === 'F';
            if (isFemale) {
              updatePerson({ ...target, motherId: newPersonId });
            } else {
              updatePerson({ ...target, fatherId: newPersonId });
            }
            newPerson.childrenIds = [target.id];
          } else if (initialRelation.type === 'child') {
            if (target.gender === 'male' || target.gender === 'M') newPerson.fatherId = target.id;
            else newPerson.motherId = target.id;
            updatePerson({
              ...target,
              childrenIds: Array.from(new Set([...(target.childrenIds || []), newPersonId]))
            });
          } else if (initialRelation.type === 'spouse') {
            newPerson.spouseIds = [target.id];
            updatePerson({
              ...target,
              spouseIds: Array.from(new Set([...(target.spouseIds || []), newPersonId]))
            });
          } else if (initialRelation.type === 'sibling') {
            if (target.fatherId) {
              newPerson.fatherId = target.fatherId;
              const f = persons.find((p) => p.id === target.fatherId);
              if (f) {
                updatePerson({
                  ...f,
                  childrenIds: Array.from(new Set([...(f.childrenIds || []), newPersonId]))
                });
              }
            }
            if (target.motherId) {
              newPerson.motherId = target.motherId;
              const m = persons.find((p) => p.id === target.motherId);
              if (m) {
                updatePerson({
                  ...m,
                  childrenIds: Array.from(new Set([...(m.childrenIds || []), newPersonId]))
                });
              }
            }
          }
        }
      }

      addPerson(newPerson);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className={`w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl overflow-hidden my-auto transition-all`}>
        
        {/* Compact Header */}
        <div className="px-4 sm:px-5 py-3 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#B88E3E]/20 text-[#B88E3E] flex items-center justify-center shrink-0 border border-[#B88E3E]/30">
              {initialPersonToEdit ? <User className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h2 className={`text-sm font-bold ${theme.cardTitle} truncate`}>
                {initialPersonToEdit ? 'Редагувати особу' : getRelationLabel()}
              </h2>
              <p className={`text-[11px] ${theme.cardSubtext} truncate`}>
                {initialRelation ? 'Швидке створення та зв\'язування' : 'Канонічний запис у базі родоводу'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 scrollbar-thin">
          
          {/* Names Row 1: Прізвище та Ім'я */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                Прізвище <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="напр. Шевченко"
                className={`w-full px-3 py-1.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                Ім'я <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="напр. Тарас"
                className={`w-full px-3 py-1.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              />
            </div>
          </div>

          {/* Names Row 2: По батькові & Стать */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">По батькові</label>
              <input
                type="text"
                value={patronymic}
                onChange={(e) => setPatronymic(e.target.value)}
                placeholder="Григорович"
                className={`w-full px-3 py-1.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">Стать</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className={`w-full px-3 py-1.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              >
                <option value="male">Чоловіча (M)</option>
                <option value="female">Жіноча (F)</option>
                <option value="other">Невідомо (U)</option>
              </select>
            </div>
          </div>

          {/* Living Status Toggle Classic */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                Статус життя <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-neutral-400 font-normal">Обов'язкове поле</span>
            </div>
            <div className="flex items-center py-1">
              <button
                type="button"
                role="switch"
                aria-checked={isLiving}
                onClick={() => setIsLiving(!isLiving)}
                className="inline-flex items-center gap-2 cursor-pointer select-none group"
                title={isLiving ? 'Статус: Жива особа (натисніть, щоб позначити померлою)' : 'Статус: Померла особа (натисніть, щоб позначити живою)'}
              >
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    isLiving ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                      isLiving ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </span>
                <span className={`text-xs font-medium ${isLiving ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-neutral-600 dark:text-neutral-400'}`}>
                  {isLiving ? 'Жива особа' : 'Померла особа'}
                </span>
              </button>
            </div>
            {isLiving && (
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] flex items-center gap-2">
                <span>🛡️</span>
                <span>Для користувачів не з Білого списку дані цієї особи будуть захищені (<strong>«Скрито»</strong>).</span>
              </div>
            )}
          </div>

          {/* Life Dates Row */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                Рік / дата народження
              </label>
              <input
                type="text"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                placeholder="1995 або 1995-03-09"
                className={`w-full px-3 py-1.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                {isLiving ? 'Статус смерті' : 'Рік / дата смерті'}
              </label>
              {!isLiving ? (
                <input
                  type="text"
                  value={deathDate}
                  onChange={(e) => setDeathDate(e.target.value)}
                  placeholder="1980 або 1980-10-14"
                  className={`w-full px-3 py-1.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
                />
              ) : (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Нині живий(а)</span>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible toggle for advanced/optional fields */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full py-1.5 px-3 rounded-xl bg-neutral-100 dark:bg-slate-800/80 hover:bg-neutral-200 text-neutral-600 dark:text-neutral-300 text-xs font-semibold flex items-center justify-between transition-colors"
            >
              <span>{showAdvanced ? 'Приховати додаткові поля' : 'Більше деталей (місця, стан, біографія)'}</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-3 pt-1 border-t border-neutral-200 dark:border-neutral-800 animate-in fade-in duration-150">
              
              {/* Maiden name & Prefix */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">Дівоче прізвище</label>
                  <input
                    type="text"
                    value={maidenName}
                    onChange={(e) => setMaidenName(e.target.value)}
                    placeholder="дівоче прізвище"
                    className={`w-full px-3 py-1.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">Титул / Префікс</label>
                  <input
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="козак, шляхтич..."
                    className={`w-full px-3 py-1.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
                  />
                </div>
              </div>

              {/* Places */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">Місце народження</label>
                  <input
                    type="text"
                    value={birthPlace}
                    onChange={(e) => setBirthPlace(e.target.value)}
                    placeholder="с. Моринці, Київська губ."
                    className={`w-full px-3 py-1.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
                  />
                </div>

                {!isLiving && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">Місце смерті / поховання</label>
                    <input
                      type="text"
                      value={deathPlace}
                      onChange={(e) => setDeathPlace(e.target.value)}
                      placeholder="м. Санкт-Петербург"
                      className={`w-full px-3 py-1.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
                    />
                  </div>
                )}
              </div>

              {/* Occupation & Social Estate */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">Професія / Посада</label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="Художник, поет, козак..."
                    className={`w-full px-3 py-1.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">Стан / Соціальний статус</label>
                  <input
                    type="text"
                    value={estate}
                    onChange={(e) => setEstate(e.target.value)}
                    placeholder="Селянин, дворянин, міщанин..."
                    className={`w-full px-3 py-1.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
                  />
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">Короткий життєпис</label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Біографічні відомості..."
                  className={`w-full px-3 py-1.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">Архівні примітки & Джерела</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Метричні книги, ревізії..."
                  className={`w-full px-3 py-1.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
                />
              </div>
            </div>
          )}

          {/* Footer Submit Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium transition-colors"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-[#B88E3E] hover:bg-[#A37B30] text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Зберегти</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
