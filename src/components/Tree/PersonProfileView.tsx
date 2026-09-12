/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  User,
  Pencil,
  Plus,
  ChevronDown,
  ChevronUp,
  GitFork,
  Compass,
  FileText,
  Mail,
  Calendar,
  MapPin,
  Heart,
  Users,
  Shield,
  Tag,
  BookOpen,
  Image as ImageIcon,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Cross,
  Baby
} from 'lucide-react';
import { Person, Gender } from '../../types';
import { isPersonMale, isPersonFemale } from '../../rodovid/utils/genderUtils';
import { comparePersonsByAge } from '../../rodovid/utils/treeLayout';

export interface PersonProfileViewProps {
  person: Person;
  persons: Person[];
  families?: any[] | Record<string, any>;
  sources?: any[] | Record<string, any>;
  events?: any[] | Record<string, any>;
  onStartEdit: () => void;
  onClose: () => void;
  onSelectPerson?: (personId: string) => void;
  onEditPerson?: (personId: string) => void;
  onChangeRoot?: (personId: string) => void;
  onOpenKinshipWith?: (personId: string) => void;
  onOpenAddRelation?: (
    type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling' | 'godparent' | 'witness',
    targetPersonId: string
  ) => void;
  onOpenReport?: () => void;
  onOpenContact?: () => void;
  isReadOnly?: boolean;
}

export const PersonProfileView: React.FC<PersonProfileViewProps> = ({
  person,
  persons,
  families = [],
  sources = [],
  events = [],
  onStartEdit,
  onClose,
  onSelectPerson,
  onEditPerson,
  onChangeRoot,
  onOpenKinshipWith,
  onOpenAddRelation,
  onOpenReport,
  onOpenContact,
  isReadOnly = false
}) => {
  const familiesList = useMemo(() => {
    if (!families) return [];
    return Array.isArray(families) ? families : Object.values(families);
  }, [families]);

  // Collapsible sections for family block
  const [isSpouseChildrenOpen, setIsSpouseChildrenOpen] = useState<boolean>(true);
  const [isParentsChildrenOpen, setIsParentsChildrenOpen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'family' | 'bio' | 'events' | 'sources' | 'photos'>('family');

  const isMale = isPersonMale(person);
  const isFemale = isPersonFemale(person);

  // Format maiden name
  const maidenName = (person.name?.maidenName || person.maidenName || '').trim();
  const lastName = (person.name?.surname || person.lastName || '—').trim();
  const firstName = (person.name?.given || person.firstName || '—').trim();
  const patronymic = (person.name?.patronymic || person.patronymic || '').trim();
  const hasMaiden = maidenName && maidenName.toLowerCase() !== lastName.toLowerCase();

  // FamilySearch ID format helper
  const formatFSCode = (id?: string) => {
    if (!id) return '';
    const clean = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (clean.length >= 7) {
      return `${clean.slice(0, 4)}-${clean.slice(4, 7)}`;
    }
    return id;
  };

  const fsCode = formatFSCode(person.id);

  // Lifespan string
  const lifespanStr = useMemo(() => {
    const bYear = person.birthYear || (person.birthDate ? person.birthDate.slice(0, 4) : '');
    const dYear = person.deathYear || (person.deathDate ? person.deathDate.slice(0, 4) : '');
    if (person.isLiving) {
      return bYear ? `${bYear}–Живий` : 'Живий';
    }
    if (bYear && dYear) return `${bYear}–${dYear}`;
    if (bYear) return `${bYear}–?`;
    if (dYear) return `?–${dYear}`;
    return 'Дати невідомі';
  }, [person]);

  // Parents
  const father = useMemo(() => {
    if (!person.fatherId) return null;
    return persons.find((p) => p.id === person.fatherId) || null;
  }, [person.fatherId, persons]);

  const mother = useMemo(() => {
    if (!person.motherId) return null;
    return persons.find((p) => p.id === person.motherId) || null;
  }, [person.motherId, persons]);

  // Siblings (children of either father or mother, excluding active person)
  const siblings = useMemo(() => {
    const pId = person.id;
    const fId = person.fatherId;
    const mId = person.motherId;
    if (!fId && !mId && (!person.siblingIds || person.siblingIds.length === 0)) return [];

    const list = persons.filter((p) => {
      if (p.id === pId) return false;
      if (person.siblingIds && person.siblingIds.includes(p.id)) return true;
      if (fId && p.fatherId === fId) return true;
      if (mId && p.motherId === mId) return true;
      return false;
    });

    return list.sort(comparePersonsByAge);
  }, [person, persons]);

  // All children of the parents (active person + siblings, sorted chronologically)
  const parentsChildren = useMemo(() => {
    const all = [person, ...siblings];
    return all.sort(comparePersonsByAge);
  }, [person, siblings]);

  // Spouses
  const spouses = useMemo(() => {
    const result: Person[] = [];
    const seen = new Set<string>();

    if (person.spouseIds) {
      person.spouseIds.forEach((sId) => {
        if (!seen.has(sId)) {
          seen.add(sId);
          const found = persons.find((p) => p.id === sId);
          if (found) result.push(found);
        }
      });
    }

    // Check families
    familiesList.forEach((fam: any) => {
      if (fam.husbandId === person.id && fam.wifeId && !seen.has(fam.wifeId)) {
        seen.add(fam.wifeId);
        const w = persons.find((p) => p.id === fam.wifeId);
        if (w) result.push(w);
      } else if (fam.wifeId === person.id && fam.husbandId && !seen.has(fam.husbandId)) {
        seen.add(fam.husbandId);
        const h = persons.find((p) => p.id === fam.husbandId);
        if (h) result.push(h);
      }
    });

    // Check persons that have person as spouse
    persons.forEach((p) => {
      if (p.spouseIds && p.spouseIds.includes(person.id) && !seen.has(p.id)) {
        seen.add(p.id);
        result.push(p);
      }
    });

    return result;
  }, [person, persons, families]);

  // Children of the person (by spouse or all)
  const allChildren = useMemo(() => {
    const pId = person.id;
    const list = persons.filter((p) => {
      if (p.fatherId === pId || p.motherId === pId) return true;
      if (person.childrenIds && person.childrenIds.includes(p.id)) return true;
      return false;
    });
    return list.sort(comparePersonsByAge);
  }, [person, persons]);

  // Godparents
  const godparentsList = useMemo(() => {
    const items: Array<{ id?: string; name: string; role?: string; notes?: string; person?: Person }> = [];
    if (person.godparents && person.godparents.length > 0) {
      person.godparents.forEach((g) => {
        const found = g.personId ? persons.find((p) => p.id === g.personId) : undefined;
        items.push({
          id: g.id || g.personId,
          name: g.name || (found ? `${found.lastName || ''} ${found.firstName || ''}` : 'Невідомий'),
          role: g.role || 'Хрещений',
          notes: g.notes,
          person: found
        });
      });
    }
    if (person.godparentIds && person.godparentIds.length > 0) {
      person.godparentIds.forEach((gpId) => {
        if (!items.some((i) => i.id === gpId)) {
          const found = persons.find((p) => p.id === gpId);
          if (found) {
            items.push({
              id: found.id,
              name: `${found.lastName || ''} ${found.firstName || ''}`,
              role: isPersonFemale(found) ? 'Хрещена мати' : 'Хрещений батько',
              person: found
            });
          }
        }
      });
    }
    return items;
  }, [person, persons]);

  // Godchildren (where person is godparent)
  const godchildrenList = useMemo(() => {
    const pId = person.id;
    return persons.filter((p) => {
      if (p.godparentIds && p.godparentIds.includes(pId)) return true;
      if (p.godparents && p.godparents.some((g) => g.personId === pId)) return true;
      return false;
    });
  }, [person, persons]);

  // Helper for single person card in FamilySearch style
  const renderPersonCard = (
    p: Person,
    isActive: boolean = false,
    roleLabel?: string,
    onEdit?: () => void
  ) => {
    const pIsMale = isPersonMale(p);
    const pIsFemale = isPersonFemale(p);
    const pMaiden = (p.name?.maidenName || p.maidenName || '').trim();
    const pLast = (p.name?.surname || p.lastName || '—').trim();
    const pFirst = (p.name?.given || p.firstName || '—').trim();
    const pPatronymic = (p.name?.patronymic || p.patronymic || '').trim();
    const pHasMaiden = pMaiden && pMaiden.toLowerCase() !== pLast.toLowerCase();

    const pBYear = p.birthYear || (p.birthDate ? p.birthDate.slice(0, 4) : '');
    const pDYear = p.deathYear || (p.deathDate ? p.deathDate.slice(0, 4) : '');
    let pLifespan = '';
    if (p.isLiving) {
      pLifespan = pBYear ? `${pBYear}–Живий` : 'Живий';
    } else if (pBYear && pDYear) {
      pLifespan = `${pBYear}–${pDYear}`;
    } else if (pBYear) {
      pLifespan = `${pBYear}–?`;
    } else if (pDYear) {
      pLifespan = `?–${pDYear}`;
    }

    const pCode = formatFSCode(p.id);

    return (
      <div
        key={p.id}
        onClick={() => {
          if (!isActive && onSelectPerson) {
            onSelectPerson(p.id);
          }
        }}
        className={`group relative flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
          isActive
            ? 'border-2 border-rose-400 dark:border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 shadow-sm'
            : 'border-slate-200 dark:border-[#333a45] bg-white dark:bg-[#1e232a] hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-xs'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Gender avatar silhouette with colored background */}
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${
              pIsMale
                ? 'bg-sky-100 dark:bg-sky-950/70 border-sky-300 dark:border-sky-800 text-sky-600 dark:text-sky-400'
                : pIsFemale
                ? 'bg-rose-100 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            {p.avatarUrl || p.photoUrl ? (
              <img
                src={p.avatarUrl || p.photoUrl}
                alt={pFirst}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User className="w-5 h-5 stroke-[1.8]" />
            )}
          </div>

          <div className="min-w-0">
            {roleLabel && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block leading-tight">
                {roleLabel}
              </span>
            )}
            <div className="font-bold text-sm text-neutral-900 dark:text-white truncate leading-tight">
              {pLast} {pHasMaiden && <span className="text-amber-600 dark:text-amber-400 font-normal">({pMaiden}) </span>}
              {pFirst} {pPatronymic}
            </div>
            <div className="text-xs text-neutral-500 dark:text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
              {pLifespan && <span>{pLifespan}</span>}
              {pLifespan && pCode && <span>•</span>}
              {pCode && <span className="tracking-wider">{pCode}</span>}
            </div>
          </div>
        </div>

        {/* Quick Edit Icon */}
        {!isReadOnly && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onEdit) {
                onEdit();
              } else if (onEditPerson) {
                onEditPerson(p.id);
              } else if (onSelectPerson) {
                onSelectPerson(p.id);
              }
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0 opacity-80 group-hover:opacity-100"
            title={`Редагувати ${pFirst} ${pLast}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-stone-50 dark:bg-[#14171c] text-neutral-900 dark:text-neutral-100 overflow-hidden">
      {/* Top Profile Header Bar */}
      <div className="px-4 sm:px-6 py-3.5 border-b border-stone-200 dark:border-[#2b3038] bg-white dark:bg-[#1a1e24] flex items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 border-2 shadow-xs ${
              isMale
                ? 'bg-sky-100 dark:bg-sky-950 border-sky-400 text-sky-600 dark:text-sky-300'
                : isFemale
                ? 'bg-rose-100 dark:bg-rose-950 border-rose-400 text-rose-600 dark:text-rose-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-400 text-slate-600 dark:text-slate-300'
            }`}
          >
            {person.avatarUrl || person.photoUrl ? (
              <img
                src={person.avatarUrl || person.photoUrl}
                alt={firstName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 stroke-[1.8]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-extrabold text-base sm:text-lg text-neutral-900 dark:text-white truncate leading-tight">
                {lastName} {hasMaiden && <span className="text-amber-600 dark:text-amber-400 font-semibold">({maidenName}) </span>}
                {firstName} {patronymic}
              </h2>
              {fsCode && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700">
                  {fsCode}
                </span>
              )}
            </div>
            <div className="text-xs text-neutral-500 dark:text-slate-400 flex items-center gap-2 flex-wrap mt-0.5">
              <span>{lifespanStr}</span>
              {person.birthPlace && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    {person.birthPlace}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Main Edit Person Icon / Button */}
          {!isReadOnly && (
            <button
              type="button"
              onClick={onStartEdit}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
              title="Перейти до редагування картки особи"
            >
              <Pencil className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Редагувати</span>
            </button>
          )}

          {onChangeRoot && (
            <button
              type="button"
              onClick={() => {
                onChangeRoot(person.id);
                onClose();
              }}
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-stone-300 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Фокусувати дерево на цій особі"
            >
              <GitFork className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden md:inline">В дерево</span>
            </button>
          )}

          {onOpenKinshipWith && (
            <button
              type="button"
              onClick={() => {
                onOpenKinshipWith(person.id);
                onClose();
              }}
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-stone-300 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Розрахувати ступінь спорідненості"
            >
              <Compass className="w-3.5 h-3.5 text-sky-500" />
              <span className="hidden md:inline">Спорідненість</span>
            </button>
          )}

          {onOpenReport && (
            <button
              type="button"
              onClick={onOpenReport}
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-stone-300 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Звіт про особу"
            >
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden md:inline">Звіт</span>
            </button>
          )}

          {onOpenContact && (
            <button
              type="button"
              onClick={onOpenContact}
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-stone-300 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Написати автору"
            >
              <Mail className="w-3.5 h-3.5 text-[#B88E3E]" />
              <span className="hidden md:inline">Контакт</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="px-4 sm:px-6 border-b border-stone-200 dark:border-[#2b3038] bg-white dark:bg-[#1a1e24] flex items-center gap-2 overflow-x-auto shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('family')}
          className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'family'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Родина та зв'язки</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 font-mono">
            {spouses.length + allChildren.length + (father ? 1 : 0) + (mother ? 1 : 0) + siblings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bio')}
          className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'bio'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Біографія та дані</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'events'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Події життя</span>
        </button>

        {(person.photos && person.photos.length > 0) && (
          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'photos'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Фото ({person.photos.length})</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
        {activeTab === 'family' && (
          <div className="space-y-6">
            {/* Two-Column Family Grid (Matching uploaded FamilySearch layout) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Left Column: Подружжя і діти */}
              <div className="bg-white dark:bg-[#1a1e24] rounded-2xl border border-stone-200 dark:border-[#2d333b] p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-[#272c33]">
                  <h3 className="font-extrabold text-sm sm:text-base text-neutral-900 dark:text-white flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-500" />
                    <span>Подружжя і діти</span>
                  </h3>
                  {!isReadOnly && onOpenAddRelation && (
                    <button
                      type="button"
                      onClick={() => onOpenAddRelation('spouse', person.id)}
                      className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline uppercase tracking-wider flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Додати подружжя
                    </button>
                  )}
                </div>

                {/* Spouses List */}
                <div className="space-y-3">
                  {spouses.length > 0 ? (
                    spouses.map((sp) => (
                      <div key={sp.id} className="space-y-3">
                        {renderPersonCard(sp, false, 'Подружжя')}
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded-xl border border-dashed border-stone-200 dark:border-slate-800 text-center text-xs text-slate-400">
                      Подружжя не вказано
                    </div>
                  )}

                  {/* Highlighted Active Person Card */}
                  {renderPersonCard(person, true, 'Вибрана особа', onStartEdit)}

                  {!isReadOnly && onOpenAddRelation && (
                    <button
                      type="button"
                      onClick={() => onOpenAddRelation('spouse', person.id)}
                      className="w-full py-1.5 text-center text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 rounded-xl transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Додати родинний зв'язок подружжя
                    </button>
                  )}
                </div>

                {/* Children Collapsible Section */}
                <div className="pt-2 border-t border-stone-100 dark:border-[#272c33] space-y-3">
                  <button
                    type="button"
                    onClick={() => setIsSpouseChildrenOpen(!isSpouseChildrenOpen)}
                    className="w-full flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white py-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Baby className="w-3.5 h-3.5 text-sky-500" />
                      <span>Діти ({allChildren.length})</span>
                    </span>
                    {isSpouseChildrenOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {isSpouseChildrenOpen && (
                    <div className="space-y-2.5 pl-2 border-l-2 border-slate-200 dark:border-[#2d333b]">
                      {allChildren.length > 0 ? (
                        allChildren.map((ch) => renderPersonCard(ch, false, isPersonFemale(ch) ? 'Донька' : 'Син'))
                      ) : (
                        <div className="text-xs text-slate-400 py-1 italic">Дітей не записано</div>
                      )}

                      {!isReadOnly && onOpenAddRelation && (
                        <button
                          type="button"
                          onClick={() => onOpenAddRelation('child', person.id)}
                          className="py-1 text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Додати дитину
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Батьки та брати/сестри */}
              <div className="bg-white dark:bg-[#1a1e24] rounded-2xl border border-stone-200 dark:border-[#2d333b] p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-[#272c33]">
                  <h3 className="font-extrabold text-sm sm:text-base text-neutral-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-500" />
                    <span>Батьки та брати/сестри</span>
                  </h3>
                  {!isReadOnly && onOpenAddRelation && (!father || !mother) && (
                    <button
                      type="button"
                      onClick={() => onOpenAddRelation(!father ? 'father' : 'mother', person.id)}
                      className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline uppercase tracking-wider flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Додати батьків
                    </button>
                  )}
                </div>

                {/* Parents Section */}
                <div className="space-y-2.5">
                  {father ? (
                    renderPersonCard(father, false, 'Батько')
                  ) : (
                    !isReadOnly && onOpenAddRelation && (
                      <button
                        type="button"
                        onClick={() => onOpenAddRelation('father', person.id)}
                        className="w-full py-2.5 px-3 rounded-xl border border-dashed border-sky-300 dark:border-sky-800 hover:bg-sky-50 dark:hover:bg-sky-950/30 text-sky-600 dark:text-sky-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        + ДОДАТИ БАТЬКА
                      </button>
                    )
                  )}

                  {mother ? (
                    renderPersonCard(mother, false, 'Мати')
                  ) : (
                    !isReadOnly && onOpenAddRelation && (
                      <button
                        type="button"
                        onClick={() => onOpenAddRelation('mother', person.id)}
                        className="w-full py-2.5 px-3 rounded-xl border border-dashed border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        + ДОДАТИ МАТІР
                      </button>
                    )
                  )}

                  {/* Marriage event of parents if available */}
                  <div className="text-center py-1 text-[11px] text-slate-400 border-t border-b border-stone-100 dark:border-[#272c33] my-1">
                    Немає подій, пов'язаних зі шлюбом
                  </div>
                </div>

                {/* Parents' Children (Active Person + Siblings) */}
                <div className="pt-2 border-t border-stone-100 dark:border-[#272c33] space-y-3">
                  <button
                    type="button"
                    onClick={() => setIsParentsChildrenOpen(!isParentsChildrenOpen)}
                    className="w-full flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white py-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-amber-500" />
                      <span>Діти ({parentsChildren.length})</span>
                    </span>
                    {isParentsChildrenOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {isParentsChildrenOpen && (
                    <div className="space-y-2.5 pl-2 border-l-2 border-slate-200 dark:border-[#2d333b]">
                      {parentsChildren.map((ch) => {
                        const isThisPerson = ch.id === person.id;
                        return renderPersonCard(
                          ch,
                          isThisPerson,
                          isThisPerson ? 'Вибрана особа' : isPersonFemale(ch) ? 'Сестра' : 'Брат',
                          isThisPerson ? onStartEdit : undefined
                        );
                      })}

                      <div className="flex items-center gap-3 pt-1 flex-wrap">
                        {!isReadOnly && onOpenAddRelation && (
                          <button
                            type="button"
                            onClick={() => onOpenAddRelation('sibling', person.id)}
                            className="py-1 text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Додати дитину (брата/сестру)
                          </button>
                        )}
                        {!isReadOnly && onOpenAddRelation && (!father || !mother) && (
                          <button
                            type="button"
                            onClick={() => onOpenAddRelation(!father ? 'father' : 'mother', person.id)}
                            className="py-1 text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Додати одного з батьків
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Spiritual Section: Хрещені, хресники та свідки */}
            <div className="bg-white dark:bg-[#1a1e24] rounded-2xl border border-stone-200 dark:border-[#2d333b] p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-[#272c33]">
                <h3 className="font-extrabold text-sm sm:text-base text-neutral-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span>Духовні зв'язки (Хрещені, хресники та свідки)</span>
                </h3>
                {!isReadOnly && onOpenAddRelation && (
                  <button
                    type="button"
                    onClick={() => onOpenAddRelation('godparent', person.id)}
                    className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline uppercase tracking-wider flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Додати хрещеного
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Godparents List */}
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Хрещені батьки (Куми) ({godparentsList.length})
                  </div>
                  {godparentsList.length > 0 ? (
                    <div className="space-y-2">
                      {godparentsList.map((gp, idx) => (
                        <div
                          key={gp.id || idx}
                          onClick={() => {
                            if (gp.person && onSelectPerson) onSelectPerson(gp.person.id);
                          }}
                          className={`p-2.5 rounded-xl border border-slate-200 dark:border-[#2d333b] bg-slate-50/50 dark:bg-[#1f242b] flex items-center justify-between ${
                            gp.person ? 'cursor-pointer hover:border-emerald-400' : ''
                          }`}
                        >
                          <div>
                            <div className="font-bold text-xs text-neutral-900 dark:text-white">
                              {gp.name}
                            </div>
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                              {gp.role || 'Хрещений'} {gp.notes ? `• ${gp.notes}` : ''}
                            </div>
                          </div>
                          {gp.person && <ExternalLink className="w-3 h-3 text-slate-400" />}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl border border-dashed border-stone-200 dark:border-slate-800 text-center text-xs text-slate-400">
                      Хрещених батьків не записано
                    </div>
                  )}
                </div>

                {/* Godchildren List */}
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Похресники (Хресники) ({godchildrenList.length})
                  </div>
                  {godchildrenList.length > 0 ? (
                    <div className="space-y-2">
                      {godchildrenList.map((gc) => (
                        <div
                          key={gc.id}
                          onClick={() => {
                            if (onSelectPerson) onSelectPerson(gc.id);
                          }}
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-[#2d333b] bg-slate-50/50 dark:bg-[#1f242b] flex items-center justify-between cursor-pointer hover:border-emerald-400"
                        >
                          <div>
                            <div className="font-bold text-xs text-neutral-900 dark:text-white">
                              {gc.lastName} {gc.firstName}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {gc.birthYear ? `нар. ${gc.birthYear}` : ''}
                            </div>
                          </div>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl border border-dashed border-stone-200 dark:border-slate-800 text-center text-xs text-slate-400">
                      Похресників не знайдено в базі
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bio' && (
          <div className="space-y-5">
            {/* Quick Biographical Fact Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {person.birthDate && (
                <div className="p-3 rounded-xl bg-white dark:bg-[#1a1e24] border border-stone-200 dark:border-[#2d333b]">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Дата народження</span>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white">{person.birthDate}</span>
                </div>
              )}
              {person.birthPlace && (
                <div className="p-3 rounded-xl bg-white dark:bg-[#1a1e24] border border-stone-200 dark:border-[#2d333b]">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Місце народження</span>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white">{person.birthPlace}</span>
                </div>
              )}
              {person.deathDate && (
                <div className="p-3 rounded-xl bg-white dark:bg-[#1a1e24] border border-stone-200 dark:border-[#2d333b]">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Дата смерті</span>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white">{person.deathDate}</span>
                </div>
              )}
              {person.deathPlace && (
                <div className="p-3 rounded-xl bg-white dark:bg-[#1a1e24] border border-stone-200 dark:border-[#2d333b]">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Місце смерті</span>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white">{person.deathPlace}</span>
                </div>
              )}
              {person.occupation && (
                <div className="p-3 rounded-xl bg-white dark:bg-[#1a1e24] border border-stone-200 dark:border-[#2d333b]">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Професія / Діяльність</span>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white">{person.occupation}</span>
                </div>
              )}
              {person.confession && (
                <div className="p-3 rounded-xl bg-white dark:bg-[#1a1e24] border border-stone-200 dark:border-[#2d333b]">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Віросповідання</span>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white">{person.confession}</span>
                </div>
              )}
              {(person.estate || person.socialStatus || person.estateOrSocialStatus) && (
                <div className="p-3 rounded-xl bg-white dark:bg-[#1a1e24] border border-stone-200 dark:border-[#2d333b]">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Стан / Соціальний статус</span>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {person.estate || person.socialStatus || person.estateOrSocialStatus}
                  </span>
                </div>
              )}
              {person.residencePlace && (
                <div className="p-3 rounded-xl bg-white dark:bg-[#1a1e24] border border-stone-200 dark:border-[#2d333b]">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Місце проживання</span>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white">{person.residencePlace}</span>
                </div>
              )}
            </div>

            {/* Tags */}
            {person.tags && person.tags.length > 0 && (
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1a1e24] border border-stone-200 dark:border-[#2d333b] space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Теги
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {person.tags.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                    >
                      #{tag.replace(/^#+/, '')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bio & Notes */}
            {person.bio && (
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1a1e24] border border-stone-200 dark:border-[#2d333b] space-y-2">
                <h4 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-500" />
                  <span>Біографія</span>
                </h4>
                <div className="text-sm text-neutral-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {person.bio}
                </div>
              </div>
            )}

            {person.notes && (
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1a1e24] border border-stone-200 dark:border-[#2d333b] space-y-2">
                <h4 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-500" />
                  <span>Нотатки дослідника</span>
                </h4>
                <div className="text-sm text-neutral-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-mono text-xs">
                  {person.notes}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1a1e24] border border-stone-200 dark:border-[#2d333b] space-y-4">
            <h4 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>Хронологія життя</span>
            </h4>
            <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700 pl-6">
              {/* Birth event */}
              {(person.birthDate || person.birthYear) && (
                <div className="relative">
                  <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-[#1a1e24]" />
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Народження</div>
                  <div className="text-sm font-semibold">{person.birthDate || person.birthYear}</div>
                  {person.birthPlace && <div className="text-xs text-slate-400">{person.birthPlace}</div>}
                </div>
              )}

              {/* Marriage event */}
              {person.marriageDate && (
                <div className="relative">
                  <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-rose-500 ring-4 ring-white dark:ring-[#1a1e24]" />
                  <div className="text-xs font-bold text-rose-600 dark:text-rose-400">Шлюб</div>
                  <div className="text-sm font-semibold">{person.marriageDate}</div>
                  {person.marriagePlace && <div className="text-xs text-slate-400">{person.marriagePlace}</div>}
                </div>
              )}

              {/* Death event */}
              {(person.deathDate || person.deathYear) && (
                <div className="relative">
                  <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-stone-500 ring-4 ring-white dark:ring-[#1a1e24]" />
                  <div className="text-xs font-bold text-stone-600 dark:text-stone-400">Смерть</div>
                  <div className="text-sm font-semibold">{person.deathDate || person.deathYear}</div>
                  {person.deathPlace && <div className="text-xs text-slate-400">{person.deathPlace}</div>}
                  {person.deathReason && <div className="text-xs text-rose-500">Причина: {person.deathReason}</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'photos' && person.photos && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {person.photos.map((ph, idx) => (
              <div key={idx} className="rounded-xl overflow-hidden border border-stone-200 dark:border-slate-800 bg-black/5">
                <img src={ph} alt={`Фото ${idx + 1}`} className="w-full h-44 object-cover hover:scale-105 transition-transform" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer status bar */}
      <div className="px-6 py-3 border-t border-stone-200 dark:border-[#2b3038] bg-white dark:bg-[#1a1e24] flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-2">
          <span>Статус:</span>
          <span className="font-semibold text-neutral-700 dark:text-neutral-300">
            {person.isLiving ? 'Жива особа' : 'Померлий'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isReadOnly && (
            <button
              type="button"
              onClick={onStartEdit}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              Редагувати картку
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-neutral-700 dark:text-neutral-300 font-semibold cursor-pointer"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
};
