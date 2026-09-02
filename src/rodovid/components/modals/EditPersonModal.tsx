/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { X, Save, User, Users, Hash, Tag } from 'lucide-react';
import { GenealogyDatabase, Person, Gender } from '../../types/genealogy';
import { getFullName, sortPersonsBySurnameAndBirthDesc } from '../../utils/relationship';
import { parseAndNormalizeTags, getTreeHashtagsWithCounts, extractHashtagsFromText } from '../../../utils/tagUtils';
import { detectGenderFromName, isPersonMale, isPersonFemale } from '../../../utils/genderUtils';

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

  const initialFatherId = existingPerson?.fatherId || (existingPerson?.parentFamilyId ? database.families[existingPerson.parentFamilyId]?.husbandId : undefined);
  const initialMotherId = existingPerson?.motherId || (existingPerson?.parentFamilyId ? database.families[existingPerson.parentFamilyId]?.wifeId : undefined);

  const initialGiven = existingPerson?.name?.given || existingPerson?.firstName || '';
  const initialSurname = existingPerson?.name?.surname || existingPerson?.lastName || '';
  const initialPatronymic = existingPerson?.name?.patronymic || existingPerson?.patronymic || '';
  const initialMaiden = existingPerson?.name?.maidenName || existingPerson?.maidenName || '';

  const [given, setGiven] = useState(initialGiven);
  const [surname, setSurname] = useState(initialSurname);
  const [patronymic, setPatronymic] = useState(initialPatronymic);
  const [maidenName, setMaidenName] = useState(initialMaiden);
  const [prefix, setPrefix] = useState(existingPerson?.name?.prefix || existingPerson?.prefix || '');
  const [gender, setGender] = useState<Gender>(() => {
    if (existingPerson) {
      if (isPersonFemale(existingPerson)) return 'F';
      if (isPersonMale(existingPerson)) return 'M';
    }
    const auto = detectGenderFromName(initialGiven, initialSurname, initialPatronymic, initialMaiden);
    return auto === 'female' ? 'F' : 'M';
  });
  const [genderManuallyChanged, setGenderManuallyChanged] = useState(false);
  const [isLiving, setIsLiving] = useState<boolean>(existingPerson?.isLiving ?? false);
  const [fatherId, setFatherId] = useState<string>(initialFatherId || '');
  const [motherId, setMotherId] = useState<string>(initialMotherId || '');
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

  // Available fathers and mothers lists
  const availablePersons = useMemo(() => {
    const unselected = Object.values(database.persons).filter((p) => !personId || p.id !== personId);
    return sortPersonsBySurnameAndBirthDesc(unselected as Person[]);
  }, [database.persons, personId]);

  const availableFathers = useMemo(() => {
    return availablePersons.filter((p) => isPersonMale(p));
  }, [availablePersons]);

  const availableMothers = useMemo(() => {
    return availablePersons.filter((p) => isPersonFemale(p));
  }, [availablePersons]);

  const popularHashtags = useMemo(() => {
    return getTreeHashtagsWithCounts(database.persons).slice(0, 10);
  }, [database.persons]);

  const handleAddHashtagSuggestion = (tagToAdd: string) => {
    const currentList = parseAndNormalizeTags(tagsStr);
    const clean = tagToAdd.replace(/^#+/, '').trim();
    if (!currentList.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      const next = [...currentList, clean];
      setTagsStr(next.join(', '));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentList = parseAndNormalizeTags(tagsStr);
    const updated = currentList.filter(
      (t) => t.toLowerCase() !== tagToRemove.toLowerCase()
    );
    setTagsStr(updated.join(', '));
  };

  const currentTagsList = useMemo(() => {
    return parseAndNormalizeTags(tagsStr);
  }, [tagsStr]);

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

    // Parse explicit tags input and any hashtags found in bio or notes
    const inputTags = parseAndNormalizeTags(tagsStr);
    const textTags = extractHashtagsFromText(`${bio} ${notes}`);
    const mergedTagsMap = new Map<string, string>();
    [...inputTags, ...textTags].forEach((t) => {
      const clean = t.replace(/^#+/, '').trim();
      if (clean && !mergedTagsMap.has(clean.toLowerCase())) {
        mergedTagsMap.set(clean.toLowerCase(), clean);
      }
    });
    const tags = Array.from(mergedTagsMap.values());

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
      fatherId: fatherId.trim() || undefined,
      motherId: motherId.trim() || undefined,
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
                onChange={(e) => {
                  const val = e.target.value;
                  setSurname(val);
                  if (!genderManuallyChanged) {
                    const detected = detectGenderFromName(given, val, patronymic, maidenName);
                    if (detected) setGender(detected === 'female' ? 'F' : 'M');
                  }
                }}
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
                onChange={(e) => {
                  const val = e.target.value;
                  setGiven(val);
                  if (!genderManuallyChanged) {
                    const detected = detectGenderFromName(val, surname, patronymic, maidenName);
                    if (detected) setGender(detected === 'female' ? 'F' : 'M');
                  }
                }}
                placeholder="Микола"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">По батькові</label>
              <input
                type="text"
                value={patronymic}
                onChange={(e) => {
                  const val = e.target.value;
                  setPatronymic(val);
                  if (!genderManuallyChanged) {
                    const detected = detectGenderFromName(given, surname, val, maidenName);
                    if (detected) setGender(detected === 'female' ? 'F' : 'M');
                  }
                }}
                placeholder="Олександрович"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Дівоче прізвище
              </label>
              <input
                type="text"
                value={maidenName}
                onChange={(e) => {
                  const val = e.target.value;
                  setMaidenName(val);
                  if (!genderManuallyChanged && val.trim()) {
                    setGender('F');
                  }
                }}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>Стать</span>
                {!genderManuallyChanged && (
                  <span className="text-[10px] text-emerald-400 font-normal">Автоматично</span>
                )}
              </label>
              <select
                value={gender}
                onChange={(e) => {
                  setGenderManuallyChanged(true);
                  setGender(e.target.value as Gender);
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="M">Чоловіча (M)</option>
                <option value="F">Жіноча (F)</option>
                <option value="U">Невідома (U)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>
                  Статус життя <span className="text-rose-400">*</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">Обов'язкове</span>
              </label>
              <div className="flex items-center h-[38px]">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isLiving}
                  onClick={() => setIsLiving(!isLiving)}
                  className="inline-flex items-center gap-2 cursor-pointer select-none py-1 group"
                  title={isLiving ? 'Статус: Жива особа (натисніть, щоб змінити на померлу)' : 'Статус: Померла особа (натисніть, щоб змінити на живу)'}
                >
                  <span
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      isLiving ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                        isLiving ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </span>
                  <span className={`text-xs font-medium ${isLiving ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                    {isLiving ? 'Жива особа' : 'Померла особа'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Living Privacy Note */}
          {isLiving && (
            <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-[11px] flex items-center gap-2">
              <span className="text-sm">🛡️</span>
              <div>
                Дані живої особи будуть захищені (<span className="underline font-bold text-white">«Скрито»</span>) для гостей не з білого списку.
              </div>
            </div>
          )}

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

          {/* Parents Section */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Батьки (встановлення родинного зв'язку)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-blue-400 mb-1">
                  Батько
                </label>
                <select
                  value={fatherId}
                  onChange={(e) => setFatherId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Не вказаний / Невідомий --</option>
                  {availableFathers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {getFullName(f)} ({f.birthYear || '?'}) [{f.id}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-rose-400 mb-1">
                  Мати
                </label>
                <select
                  value={motherId}
                  onChange={(e) => setMotherId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                >
                  <option value="">-- Не вказана / Невідома --</option>
                  {availableMothers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {getFullName(m)} ({m.birthYear || '?'}) [{m.id}]
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Хештеги / Теги
                </label>
                <span className="text-[10px] text-slate-500">можна з # або через кому</span>
              </div>

              {currentTagsList.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {currentTagsList.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/60"
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="p-0.5 hover:bg-emerald-900/80 rounded cursor-pointer transition-colors"
                        title="Видалити тег"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
                placeholder="#козак, #ветеран, #полтавщина"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              />
              {popularHashtags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap mt-1.5">
                  <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                    <Hash className="w-2.5 h-2.5" /> часті:
                  </span>
                  {popularHashtags.slice(0, 6).map((h) => {
                    const isSelected = currentTagsList.some((t) => t.toLowerCase() === h.tag.toLowerCase());
                    return (
                      <button
                        key={h.tag}
                        type="button"
                        onClick={() => handleAddHashtagSuggestion(h.tag)}
                        disabled={isSelected}
                        className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-950/20 text-emerald-500 border-emerald-900/40 opacity-50 cursor-default'
                            : 'bg-slate-900 hover:bg-emerald-950/60 text-slate-400 hover:text-emerald-300 border-slate-800'
                        }`}
                        title="Додати цей хештег"
                      >
                        #{h.tag}
                      </button>
                    );
                  })}
                </div>
              )}
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
