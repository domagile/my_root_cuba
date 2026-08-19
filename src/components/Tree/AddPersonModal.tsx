/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Save, User, UserPlus, Calendar, MapPin, Briefcase, FileText, Image, Tag, Shield } from 'lucide-react';
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
  const [gender, setGender] = useState<Gender>(
    initialPersonToEdit?.gender ||
      (initialRelation?.type === 'father'
        ? 'male'
        : initialRelation?.type === 'mother'
        ? 'female'
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
        maidenName: maidenName.trim() || undefined,
        patronymic: patronymic.trim() || undefined,
        prefix: prefix.trim() || undefined,
        gender,
        birthDate: birthDate.trim() || undefined,
        birthYear: birthYear || initialPersonToEdit.birthYear,
        birthPlace: birthPlace.trim() || undefined,
        deathDate: isLiving ? undefined : deathDate.trim() || undefined,
        deathYear: isLiving ? undefined : deathYear || initialPersonToEdit.deathYear,
        deathPlace: isLiving ? undefined : deathPlace.trim() || undefined,
        isLiving,
        occupation: occupation.trim() || undefined,
        estate: estate.trim() || undefined,
        socialStatus: estate.trim() || undefined,
        estateOrSocialStatus: estate.trim() || undefined,
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
      const newPersonId = `person-${Date.now()}`;
      const newPerson: Person = {
        id: newPersonId,
        name: nameObj,
        firstName: firstName.trim() || 'Без імені',
        lastName: lastName.trim() || '',
        maidenName: maidenName.trim() || undefined,
        patronymic: patronymic.trim() || undefined,
        prefix: prefix.trim() || undefined,
        gender,
        birthDate: birthDate.trim() || undefined,
        birthYear,
        birthPlace: birthPlace.trim() || undefined,
        deathDate: isLiving ? undefined : deathDate.trim() || undefined,
        deathYear: isLiving ? undefined : deathYear,
        deathPlace: isLiving ? undefined : deathPlace.trim() || undefined,
        isLiving,
        occupation: occupation.trim() || undefined,
        estate: estate.trim() || undefined,
        socialStatus: estate.trim() || undefined,
        estateOrSocialStatus: estate.trim() || undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl p-6 md:p-8 space-y-6 relative scrollbar-thin`}>
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-[#B88E3E]/20 text-[#B88E3E] flex items-center justify-center border border-[#B88E3E]/30">
            {initialPersonToEdit ? <User className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
          </div>
          <div>
            <h2 className={`text-lg font-bold ${theme.cardTitle}`}>
              {initialPersonToEdit ? 'Редагувати фігуранта / особу' : 'Додати фігуранта / особу в родовід'}
            </h2>
            <p className={`text-xs ${theme.cardSubtext}`}>
              Єдині поля обліку фігуранта справи та генеалогічного родоводу
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Main Name Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Титул / Префікс</label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="козак, шляхтич, міщанин..."
                className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Ім'я *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="напр. Остап"
                className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Прізвище *</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="напр. Коваленко"
                className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">По батькові</label>
              <input
                type="text"
                value={patronymic}
                onChange={(e) => setPatronymic(e.target.value)}
                placeholder="Григорович"
                className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Дівоче прізвище</label>
              <input
                type="text"
                value={maidenName}
                onChange={(e) => setMaidenName(e.target.value)}
                placeholder="для жінок до шлюбу"
                className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Стать</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              >
                <option value="male">Чоловіча (M)</option>
                <option value="female">Жіноча (F)</option>
                <option value="other">Інша / Невідомо (U)</option>
              </select>
            </div>
          </div>

          {/* Birth Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Дата / Рік народження</label>
              <input
                type="text"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                placeholder="1845-04-12 або 1845"
                className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Місце народження</label>
              <input
                type="text"
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                placeholder="с. Чернечий Яр"
                className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              />
            </div>
          </div>

          {/* Living toggle & Death Info */}
          <div className="pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={isLiving}
                onChange={(e) => setIsLiving(e.target.checked)}
                className="rounded text-[#B88E3E] focus:ring-[#B88E3E]"
              />
              <span>Особа є живою (приховати дату смерті)</span>
            </label>

            {!isLiving && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Дата смерті</label>
                  <input
                    type="text"
                    value={deathDate}
                    onChange={(e) => setDeathDate(e.target.value)}
                    placeholder="1918-11-20"
                    className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Місце смерті / поховання</label>
                  <input
                    type="text"
                    value={deathPlace}
                    onChange={(e) => setDeathPlace(e.target.value)}
                    placeholder="с. Чернечий Яр"
                    className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Social, Confession, Rank, Occupation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Фах / Професія / Посада</label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="Коваль, сотник, вчитель..."
                className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Стан / Соціальний статус</label>
              <input
                type="text"
                value={estate}
                onChange={(e) => setEstate(e.target.value)}
                placeholder="Козак, дворянин, міщанин..."
                className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Віросповідання / Конфесія</label>
              <input
                type="text"
                value={confession}
                onChange={(e) => setConfession(e.target.value)}
                placeholder="Православний, греко-католик..."
                className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Військове звання / Чин</label>
              <input
                type="text"
                value={militaryRank}
                onChange={(e) => setMilitaryRank(e.target.value)}
                placeholder="Унтер-офіцер, козацький старшина..."
                className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              />
            </div>
          </div>

          {/* Photo & Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">URL фото / портрета</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Теги (через кому)</label>
              <input
                type="text"
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
                placeholder="Полтавщина, ковальство, 1914"
                className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
              />
            </div>
          </div>

          {/* Bio and Notes */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Життєпис / Біографічна довідка</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Короткий життєпис, родинна історія..."
              className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Архівні примітки та джерела</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Додаткові відомості з метричних книг, ревізьких казок, сповідних розписів..."
              className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E]`}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium transition-colors"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-[#B88E3E] hover:bg-[#A37B30] text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Зберегти</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
