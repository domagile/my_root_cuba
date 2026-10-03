/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
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
  Baby,
  Trash2,
  Crown,
  GitCommit,
  Dna,
  ArrowDown,
  ArrowUp,
  ArrowRight,
  ArrowLeftRight,
  Check,
  Copy,
  Share2,
  Route,
  Layers,
  Search
} from 'lucide-react';
import { Person, Gender } from '../../types';
import { isPersonMale, isPersonFemale } from '../../rodovid/utils/genderUtils';
import { comparePersonsByAge, getPersonRodName } from '../../rodovid/utils/treeLayout';
import { formatClanName } from '../../utils/ukrainianPhonetics';
import { getMetricSearchStatus, getMetricStatusConfig } from '../../utils/researchStatusUtils';
import { getPersonUrl, openPersonInNewWindow, useUIStore } from '../../stores/useUIStore';
import {
  calculateKinship,
  findRootPerson,
  getFullName,
  KinshipCalculationResult,
  KinshipPathStep
} from '../../rodovid/utils/relationship';

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
  onOpenFamilyQuickAdd?: () => void;
  onOpenReport?: () => void;
  onOpenContact?: () => void;
  onDeletePerson?: () => void;
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
  onOpenFamilyQuickAdd,
  onOpenReport,
  onOpenContact,
  onDeletePerson,
  isReadOnly = false
}) => {
  const familiesList = useMemo(() => {
    if (!families) return [];
    return Array.isArray(families) ? families : Object.values(families);
  }, [families]);

  // Collapsible sections for family block
  const [isSpouseChildrenOpen, setIsSpouseChildrenOpen] = useState<boolean>(true);
  const [isParentsChildrenOpen, setIsParentsChildrenOpen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'family' | 'kinship_line' | 'bio' | 'events' | 'sources' | 'photos'>('family');
  const [copiedKinshipLine, setCopiedKinshipLine] = useState<boolean>(false);

  // Root person of tree
  const rootPerson = useMemo(() => {
    return findRootPerson(persons);
  }, [persons]);

  const isCurrentRoot = Boolean(rootPerson && rootPerson.id === person.id);

  // Default target for kinship calculation: root person if different, else first other relative/person
  const defaultTargetPersonId = useMemo(() => {
    if (rootPerson && rootPerson.id !== person.id) return rootPerson.id;
    const firstOther = persons.find((p) => p.id !== person.id);
    return firstOther ? firstOther.id : '';
  }, [rootPerson, person.id, persons]);

  // Selected person from list for kinship comparison
  const [selectedKinshipPersonId, setSelectedKinshipPersonId] = useState<string>(defaultTargetPersonId);

  // Search filter query for selecting a person
  const [kinshipSearchQuery, setKinshipSearchQuery] = useState<string>('');

  // Keep selectedKinshipPersonId valid when active person changes
  useEffect(() => {
    if (selectedKinshipPersonId === person.id || (!selectedKinshipPersonId && defaultTargetPersonId)) {
      setSelectedKinshipPersonId(defaultTargetPersonId);
    }
  }, [person.id, defaultTargetPersonId, selectedKinshipPersonId]);

  const selectedKinshipPerson = useMemo(() => {
    if (!selectedKinshipPersonId) return null;
    return persons.find((p) => p.id === selectedKinshipPersonId) || null;
  }, [selectedKinshipPersonId, persons]);

  const isTargetRoot = Boolean(rootPerson && selectedKinshipPerson && rootPerson.id === selectedKinshipPerson.id);
  const isComparingWithSelf = selectedKinshipPersonId === person.id;

  const filteredPersonsForKinship = useMemo(() => {
    const q = kinshipSearchQuery.trim().toLowerCase();
    const list = persons.filter((p) => p.id !== person.id);
    if (!q) {
      return [...list].sort((a, b) => {
        const lastA = (a.lastName || a.name?.surname || '').toLowerCase();
        const lastB = (b.lastName || b.name?.surname || '').toLowerCase();
        if (lastA !== lastB) return lastA.localeCompare(lastB, 'uk');
        const firstA = (a.firstName || a.name?.given || '').toLowerCase();
        const firstB = (b.firstName || b.name?.given || '').toLowerCase();
        return firstA.localeCompare(firstB, 'uk');
      });
    }
    return list
      .filter((p) => {
        const full = `${p.lastName || ''} ${p.firstName || ''} ${p.patronymic || ''} ${p.name?.maidenName || ''} ${p.birthYear || ''} ${p.id}`.toLowerCase();
        return full.includes(q);
      })
      .sort((a, b) => {
        const lastA = (a.lastName || a.name?.surname || '').toLowerCase();
        const lastB = (b.lastName || b.name?.surname || '').toLowerCase();
        if (lastA !== lastB) return lastA.localeCompare(lastB, 'uk');
        return (a.firstName || '').localeCompare(b.firstName || '', 'uk');
      });
  }, [persons, person.id, kinshipSearchQuery]);

  const databaseForKinship = useMemo(() => {
    const personMap: Record<string, Person> = {};
    persons.forEach((p) => {
      personMap[p.id] = p;
    });
    const familyMap: Record<string, any> = {};
    if (Array.isArray(families)) {
      families.forEach((f) => {
        if (f && f.id) familyMap[f.id] = f;
      });
    } else if (families && typeof families === 'object') {
      Object.assign(familyMap, families);
    }
    return {
      persons: personMap,
      families: familyMap
    };
  }, [persons, families]);

  // Path and relationship from selected person to active person
  const kinshipToSelected = useMemo(() => {
    if (!selectedKinshipPerson || isComparingWithSelf) return null;
    return calculateKinship(selectedKinshipPerson.id, person.id, databaseForKinship as any);
  }, [selectedKinshipPerson, isComparingWithSelf, person.id, databaseForKinship]);

  // What the selected person is to this person (e.g. "Бабуся", "Двоюрідний брат", "Дядько")
  const targetToPersonKinship = useMemo(() => {
    if (!selectedKinshipPerson || isComparingWithSelf) return null;
    return calculateKinship(person.id, selectedKinshipPerson.id, databaseForKinship as any);
  }, [selectedKinshipPerson, isComparingWithSelf, person.id, databaseForKinship]);

  // Backwards compatibility alias
  const kinshipToRoot = kinshipToSelected;

  const handleCopyKinshipText = () => {
    if (!kinshipToSelected || !kinshipToSelected.path || kinshipToSelected.path.length === 0 || !selectedKinshipPerson) return;
    const lines = kinshipToSelected.path.map((step, idx) => {
      const p = databaseForKinship.persons[step.personId];
      const name = p ? getFullName(p) : step.personId;
      const years = p ? ` (${p.birthYear || '?'}–${p.isLiving ? 'живий' : p.deathYear || '?'})` : '';
      const rel = idx === 0 ? 'Початок (обрана особа)' : `→ ${step.relationFromPrevious || 'зв’язок'}`;
      return `${idx + 1}. [${rel}] ${name}${years}`;
    });
    const header = `Родинна лінія та зв'язок:\n` +
      `Вибрана особа: ${getFullName(selectedKinshipPerson)}\n` +
      `Поточна особа: ${getFullName(person)}\n` +
      `Зв'язок: ${targetToPersonKinship?.relationshipName || kinshipToSelected.relationshipName}\n` +
      `Ступінь спорідненості: ${kinshipToSelected.degree} кроків (Спільні гени: ≈ ${kinshipToSelected.coefficient}%)\n\n` +
      `Ланцюжок спорідненості:\n`;
    navigator.clipboard.writeText(header + lines.join('\n'));
    setCopiedKinshipLine(true);
    setTimeout(() => setCopiedKinshipLine(false), 2200);
  };

  const handleShowKinshipLineInTree = () => {
    if (selectedKinshipPerson) {
      useUIStore.getState().setTreeFocusKinshipPair({
        personAId: selectedKinshipPerson.id,
        personBId: person.id
      });
    } else {
      useUIStore.getState().setTreeFocusKinshipPersonId(person.id);
    }
    if (onChangeRoot && selectedKinshipPerson) {
      onChangeRoot(selectedKinshipPerson.id);
    } else {
      useUIStore.getState().setActiveTab('tree');
    }
    onClose();
  };

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

  // Parents (resolved via direct IDs, parentFamilyId, or families children list)
  const father = useMemo(() => {
    let fId = person.fatherId;
    if (!fId && person.parentFamilyId && families) {
      const fam = Array.isArray(families)
        ? families.find((f) => f.id === person.parentFamilyId)
        : families[person.parentFamilyId];
      if (fam?.husbandId) fId = fam.husbandId;
    }
    if (!fId && families) {
      const fam = Array.isArray(families)
        ? families.find(
            (f) =>
              (f.childrenIds || []).includes(person.id) ||
              (f.children || []).some((c: any) => c.personId === person.id)
          )
        : Object.values(families || {}).find(
            (f: any) =>
              (f.childrenIds || []).includes(person.id) ||
              (f.children || []).some((c: any) => c.personId === person.id)
          );
      if (fam?.husbandId) fId = fam.husbandId;
    }
    if (!fId) return null;
    return persons.find((p) => p.id === fId) || null;
  }, [person.fatherId, person.parentFamilyId, person.id, families, persons]);

  const mother = useMemo(() => {
    let mId = person.motherId;
    if (!mId && person.parentFamilyId && families) {
      const fam = Array.isArray(families)
        ? families.find((f) => f.id === person.parentFamilyId)
        : families[person.parentFamilyId];
      if (fam?.wifeId) mId = fam.wifeId;
    }
    if (!mId && families) {
      const fam = Array.isArray(families)
        ? families.find(
            (f) =>
              (f.childrenIds || []).includes(person.id) ||
              (f.children || []).some((c: any) => c.personId === person.id)
          )
        : Object.values(families || {}).find(
            (f: any) =>
              (f.childrenIds || []).includes(person.id) ||
              (f.children || []).some((c: any) => c.personId === person.id)
          );
      if (fam?.wifeId) mId = fam.wifeId;
    }
    if (!mId) return null;
    return persons.find((p) => p.id === mId) || null;
  }, [person.motherId, person.parentFamilyId, person.id, families, persons]);

  // Siblings (children of either father or mother, or same parent family, excluding active person)
  const siblings = useMemo(() => {
    const pId = person.id;
    const fId = father?.id || person.fatherId;
    const mId = mother?.id || person.motherId;
    const parentFamId = person.parentFamilyId;

    const list = persons.filter((p) => {
      if (p.id === pId) return false;
      if (person.siblingIds && person.siblingIds.includes(p.id)) return true;
      if (fId && (p.fatherId === fId || (p.parentFamilyId && families && (Array.isArray(families) ? families.find(f => f.id === p.parentFamilyId)?.husbandId === fId : families[p.parentFamilyId]?.husbandId === fId)))) return true;
      if (mId && (p.motherId === mId || (p.parentFamilyId && families && (Array.isArray(families) ? families.find(f => f.id === p.parentFamilyId)?.wifeId === mId : families[p.parentFamilyId]?.wifeId === mId)))) return true;
      if (parentFamId && p.parentFamilyId === parentFamId) return true;
      return false;
    });

    return list.sort(comparePersonsByAge);
  }, [person, father, mother, families, persons]);

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

  // Quick targets for kinship selector
  const quickKinshipTargets = useMemo(() => {
    const targets: Array<{ id: string; label: string; icon: string }> = [];
    if (rootPerson && rootPerson.id !== person.id) {
      const rName = `${rootPerson.lastName || ''} ${rootPerson.firstName || ''}`.trim() || 'Корінь';
      targets.push({ id: rootPerson.id, label: `Корінь 👑 (${rName})`, icon: '👑' });
    }
    if (father && father.id !== person.id) {
      targets.push({ id: father.id, label: `Батько (${father.firstName || 'Батько'})`, icon: '👨' });
    }
    if (mother && mother.id !== person.id) {
      targets.push({ id: mother.id, label: `Мати (${mother.firstName || 'Мати'})`, icon: '👩' });
    }
    if (spouses && spouses.length > 0) {
      const sp = spouses[0];
      targets.push({
        id: sp.id,
        label: `${isPersonFemale(sp) ? 'Дружина' : 'Чоловік'} (${sp.firstName || ''})`,
        icon: '💍'
      });
    }
    if (allChildren && allChildren.length > 0) {
      const ch = allChildren[0];
      targets.push({ id: ch.id, label: `Дитина (${ch.firstName || ''})`, icon: '👶' });
    }
    if (siblings && siblings.length > 0) {
      const sib = siblings[0];
      targets.push({
        id: sib.id,
        label: `${isPersonFemale(sib) ? 'Сестра' : 'Брат'} (${sib.firstName || ''})`,
        icon: '👥'
      });
    }
    return targets;
  }, [rootPerson, person.id, father, mother, spouses, allChildren, siblings]);

  // Helper for single person card in FamilySearch style
  const renderPersonCard = (
    p: Person,
    isActive: boolean = false,
    roleLabel?: string,
    onEdit?: () => void,
    keyOverride?: string
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
        key={keyOverride || `${p.id}_${roleLabel || ''}`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.button === 1) {
            openPersonInNewWindow(p.id, { mode: 'view' });
            return;
          }
          if (!isActive && onSelectPerson) {
            onSelectPerson(p.id);
          }
        }}
        onAuxClick={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            openPersonInNewWindow(p.id, { mode: 'view' });
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

        {/* Quick Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={getPersonUrl(p.id, { mode: 'view' })}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0 opacity-80 group-hover:opacity-100"
            title={`Відкрити «${pFirst} ${pLast}» у новій вкладці браузера`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
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
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-stone-50 dark:bg-[#14171c] text-neutral-900 dark:text-neutral-100 overflow-hidden">
        {/* Top Profile Header Bar */}
        <div className="p-3.5 sm:p-5 border-b border-stone-200 dark:border-[#2b3038] bg-white dark:bg-[#1a1e24] flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 shadow-xs">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2 shadow-xs ${
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
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="font-extrabold text-base sm:text-lg text-neutral-900 dark:text-white leading-tight break-words">
                  {lastName} {hasMaiden && <span className="text-amber-600 dark:text-amber-400 font-semibold">({maidenName}) </span>}
                  {firstName} {patronymic}
                </h2>
                {fsCode && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700 shrink-0">
                    {fsCode}
                  </span>
                )}
                {(() => {
                  const rod = person.clan || getPersonRodName(person);
                  return rod ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1 shrink-0" title="Рід (Родова лінія)">
                      <Crown className="w-3 h-3" />
                      <span>{formatClanName(rod)}</span>
                    </span>
                  ) : null;
                })()}
                {person.researchBranch && person.researchBranch !== "Без прив'язки" && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shrink-0" title="Гілка дослідження">
                    <GitFork className="w-3 h-3" />
                    <span>{person.researchBranch}</span>
                  </span>
                )}
                {(() => {
                  const metricStatus = getMetricSearchStatus(person);
                  const cfg = getMetricStatusConfig(metricStatus);
                  return (
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 shrink-0 ${cfg.badgeClass}`} title={cfg.description}>
                      <span>{cfg.icon}</span>
                      <span>{cfg.label}</span>
                    </span>
                  );
                })()}
              </div>
              <div className="text-xs text-neutral-500 dark:text-slate-400 flex items-center gap-2 flex-wrap mt-1">
                <span>{lifespanStr}</span>
                {person.birthPlace && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{person.birthPlace}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Controls in Header */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100 dark:border-[#272c33]">
            {/* Main Edit Person Icon / Button */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={onStartEdit}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
                title="Перейти до редагування картки особи"
              >
                <Pencil className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Редагувати</span>
              </button>
            )}

            {onChangeRoot && (
              <button
                type="button"
                onClick={() => {
                  onChangeRoot(person.id);
                  onClose();
                }}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-stone-300 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Фокусувати дерево на цій особі"
              >
                <GitFork className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">В дерево</span>
              </button>
            )}

            {/* Kinship Line Action Button */}
            <button
              type="button"
              onClick={() => setActiveTab('kinship_line')}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'kinship_line'
                  ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                  : 'border-sky-300/80 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40'
              }`}
              title="Побачити родинну лінію та зв'язок"
            >
              <Dna className="w-3.5 h-3.5 text-sky-500" />
              <span className="hidden sm:inline">Родинна лінія</span>
              {isTargetRoot ? (
                <span className="text-[10px] text-amber-500 font-bold">👑</span>
              ) : kinshipToSelected ? (
                <span className="text-[10px] px-1 py-0.2 rounded-full bg-sky-100 dark:bg-sky-900/60 font-mono">
                  {kinshipToSelected.degree}
                </span>
              ) : null}
            </button>

            {onOpenKinshipWith && (
              <button
                type="button"
                onClick={() => {
                  onOpenKinshipWith(person.id);
                  onClose();
                }}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-stone-300 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Розрахувати ступінь спорідненості"
              >
                <Compass className="w-3.5 h-3.5 text-sky-500" />
                <span className="hidden sm:inline">Спорідненість</span>
              </button>
            )}

            {onOpenReport && (
              <button
                type="button"
                onClick={onOpenReport}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-stone-300 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Звіт про особу"
              >
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Звіт</span>
              </button>
            )}

            {onOpenContact && (
              <button
                type="button"
                onClick={onOpenContact}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-stone-300 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Написати автору"
              >
                <Mail className="w-3.5 h-3.5 text-[#B88E3E]" />
                <span className="hidden sm:inline">Контакт</span>
              </button>
            )}

            {onDeletePerson && !isReadOnly && (
              <button
                type="button"
                onClick={onDeletePerson}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-rose-500/30 hover:border-rose-500/60 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Видалити особу з бази даних"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Видалити</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="px-3 sm:px-6 border-b border-stone-200 dark:border-[#2b3038] bg-white dark:bg-[#1a1e24] flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-nowrap shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('family')}
            className={`px-3 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'family'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span>Родина та зв'язки</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 font-mono">
              {spouses.length + allChildren.length + (father ? 1 : 0) + (mother ? 1 : 0) + siblings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('kinship_line')}
            className={`px-3 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'kinship_line'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Dna className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <span>Родинна лінія</span>
            {isTargetRoot ? (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-500 font-bold">
                Корінь 👑
              </span>
            ) : kinshipToSelected ? (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-mono">
                {kinshipToSelected.degree} {kinshipToSelected.degree === 1 ? 'крок' : kinshipToSelected.degree < 5 ? 'кроки' : 'кроків'}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bio')}
            className={`px-3 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'bio'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>Біографія та дані</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('events')}
            className={`px-3 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'events'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>Події життя</span>
          </button>

          {(person.photos && person.photos.length > 0) && (
            <button
              type="button"
              onClick={() => setActiveTab('photos')}
              className={`px-3 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'photos'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Фото ({person.photos.length})</span>
            </button>
          )}
        </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
        {activeTab === 'family' && (
          <div className="space-y-6">
            {/* Kinship Line to Selected Person (Родина та зв'язки з вибором особи зі списку) */}
            <div className="bg-gradient-to-r from-sky-500/10 via-amber-500/5 to-emerald-500/10 dark:from-sky-950/30 dark:via-[#1e2329] dark:to-emerald-950/20 rounded-2xl border border-sky-200/80 dark:border-sky-800/60 p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-sky-100 dark:border-sky-900/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/15 dark:bg-sky-500/25 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                    <Dna className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-neutral-900 dark:text-white flex items-center gap-2">
                      <span>Родинний зв'язок з вибраною особою</span>
                      {isTargetRoot && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          Корінна особа 👑
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-slate-400">
                      {selectedKinshipPerson
                        ? `Зв'язок між ${getFullName(person)} та ${getFullName(selectedKinshipPerson)}`
                        : 'Виберіть особу зі списку родоводу для перегляду зв’язку'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto flex-wrap">
                  {selectedKinshipPerson && kinshipToSelected && kinshipToSelected.path && kinshipToSelected.path.length > 0 && (
                    <button
                      type="button"
                      onClick={handleShowKinshipLineInTree}
                      className="px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      title="Відкрити дерево та підсвітити цю родинну лінію"
                    >
                      <GitFork className="w-3.5 h-3.5" />
                      <span>Побачити в дереві</span>
                    </button>
                  )}
                  {selectedKinshipPerson && kinshipToSelected && (
                    <button
                      type="button"
                      onClick={handleCopyKinshipText}
                      className="px-2.5 py-1.5 rounded-xl border border-sky-200 dark:border-sky-800 hover:bg-sky-100/50 dark:hover:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Копіювати ланцюжок лінії"
                    >
                      {copiedKinshipLine ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-500" />}
                      <span>{copiedKinshipLine ? 'Скопійовано' : 'Копіювати'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab('kinship_line')}
                    className="px-2.5 py-1.5 rounded-xl border border-sky-300 dark:border-sky-800 hover:bg-sky-100/50 dark:hover:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-semibold text-xs transition-colors cursor-pointer"
                    title="Детальний ланцюжок родинної лінії"
                  >
                    <span>Детально</span>
                    <ChevronRight className="w-3.5 h-3.5 inline ml-0.5" />
                  </button>
                </div>
              </div>

              {/* Person Selector Controls */}
              <div className="bg-white/90 dark:bg-[#15191e]/90 rounded-xl border border-sky-200/70 dark:border-sky-900/40 p-3 space-y-2.5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {/* Current Person (Поточна особа) */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-100/90 dark:bg-sky-950/70 border border-sky-300/80 dark:border-sky-800 text-xs shrink-0 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                      {isPersonFemale(person) ? '♀' : isPersonMale(person) ? '♂' : '👤'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 leading-tight">
                        Поточна особа
                      </span>
                      <span className="font-extrabold text-neutral-900 dark:text-white leading-tight truncate max-w-[150px] sm:max-w-[200px]" title={getFullName(person)}>
                        {getFullName(person)}
                      </span>
                    </div>
                  </div>

                  {/* Connection Arrow */}
                  <div className="hidden sm:flex items-center text-sky-500 dark:text-sky-400 shrink-0" title="Зв'язок з особою">
                    <ArrowRight className="w-4 h-4" />
                  </div>

                  {/* Search query input */}
                  <div className="relative flex-1 min-w-[140px]">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={kinshipSearchQuery}
                      onChange={(e) => setKinshipSearchQuery(e.target.value)}
                      placeholder="Пошук за ім'ям або роком..."
                      className="w-full pl-8 pr-6 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-[#1a1e24] text-neutral-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    {kinshipSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setKinshipSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Select dropdown */}
                  <select
                    value={selectedKinshipPersonId}
                    onChange={(e) => setSelectedKinshipPersonId(e.target.value)}
                    className="flex-1 max-w-full sm:max-w-xs px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-[#1a1e24] text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                  >
                    {filteredPersonsForKinship.length === 0 ? (
                      <option value="" disabled>Нікого не знайдено</option>
                    ) : (
                      filteredPersonsForKinship.map((p) => {
                        const isRoot = rootPerson && rootPerson.id === p.id;
                        const pYear = p.birthYear ? ` (${p.birthYear}${p.deathYear ? `–${p.deathYear}` : p.isLiving ? '–живий' : ''})` : '';
                        return (
                          <option key={`sel_kin_${p.id}`} value={p.id}>
                            {isRoot ? '👑 ' : ''}{getFullName(p)}{pYear}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                {/* Quick Pick Chips */}
                {quickKinshipTargets.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[11px] text-slate-400 shrink-0">Швидкий вибір:</span>
                    {quickKinshipTargets.map((qt) => {
                      const isSelected = selectedKinshipPersonId === qt.id;
                      return (
                        <button
                          key={`quick_kin_${qt.id}`}
                          type="button"
                          onClick={() => setSelectedKinshipPersonId(qt.id)}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-sky-600 text-white shadow-2xs'
                              : 'bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-neutral-700 dark:text-slate-300'
                          }`}
                        >
                          <span>{qt.icon}</span>
                          <span>{qt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Calculation Results */}
              {isComparingWithSelf ? (
                <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <span>ℹ️</span>
                  <span>Вибрано ту саму особу. Будь ласка, виберіть іншого родича зі списку вище, щоб розрахувати ступінь спорідненості.</span>
                </div>
              ) : selectedKinshipPerson && kinshipToSelected ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Relationship Badge */}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-900 dark:text-sky-200 font-extrabold border border-sky-200 dark:border-sky-800 shadow-2xs">
                      <span>{targetToPersonKinship?.relationshipName || kinshipToSelected.relationshipName}</span>
                      {targetToPersonKinship?.relationshipName && kinshipToSelected.relationshipName && targetToPersonKinship.relationshipName !== kinshipToSelected.relationshipName && (
                        <span className="text-[10px] font-normal text-sky-600 dark:text-sky-400">
                          ({getFullName(person)}: {kinshipToSelected.relationshipName})
                        </span>
                      )}
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-neutral-700 dark:text-slate-300 font-semibold font-mono">
                      Ступінь: {kinshipToSelected.degree} {kinshipToSelected.degree === 1 ? 'крок' : kinshipToSelected.degree < 5 ? 'кроки' : 'кроків'}
                    </span>

                    {kinshipToSelected.coefficient > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-semibold">
                        Спільні гени (ДНК): ≈ {kinshipToSelected.coefficient}%
                      </span>
                    )}

                    {kinshipToSelected.generationalDistance !== undefined && kinshipToSelected.generationalDistance !== 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 font-semibold">
                        Покоління: {kinshipToSelected.generationalDistance > 0 ? `+${kinshipToSelected.generationalDistance} (висхідне)` : `${kinshipToSelected.generationalDistance} (низхідне)`}
                      </span>
                    )}

                    {kinshipToSelected.commonAncestors && kinshipToSelected.commonAncestors.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1">
                        <Crown className="w-3 h-3 text-amber-500" />
                        <span>Спільний предок: {getFullName(kinshipToSelected.commonAncestors[0])}</span>
                      </span>
                    )}
                  </div>

                  {/* Concise chain preview */}
                  {kinshipToSelected.path && kinshipToSelected.path.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                      {kinshipToSelected.path.map((step, sIdx) => {
                        const stepP = databaseForKinship.persons[step.personId];
                        if (!stepP) return null;
                        const isStartStep = sIdx === 0;
                        const isTargetStep = sIdx === kinshipToSelected.path.length - 1;
                        const isRootP = rootPerson && rootPerson.id === stepP.id;
                        return (
                          <React.Fragment key={`kin_prev_${step.personId}_${sIdx}`}>
                            {sIdx > 0 && (
                              <div className="flex flex-col items-center px-1 text-[10px] text-neutral-400 dark:text-slate-500 shrink-0">
                                <ArrowRight className="w-3.5 h-3.5 text-sky-500" />
                                <span className="text-[9px] font-semibold text-sky-600 dark:text-sky-400">
                                  {step.relationFromPrevious || ''}
                                </span>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (stepP.id !== person.id && onSelectPerson) {
                                  onSelectPerson(stepP.id);
                                }
                              }}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs text-left shrink-0 transition-all cursor-pointer ${
                                isTargetStep
                                  ? 'bg-sky-600 text-white border-sky-500 font-bold shadow-xs'
                                  : isStartStep
                                  ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 font-bold'
                                  : 'bg-white dark:bg-[#1a1e24] text-neutral-700 dark:text-slate-300 border-stone-200 dark:border-[#2d333b] hover:border-sky-400'
                              }`}
                              title={`Натисніть для перегляду: ${getFullName(stepP)}`}
                            >
                              {isRootP && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                              <span className="truncate max-w-[130px]">{getFullName(stepP)}</span>
                              {stepP.birthYear && (
                                <span className="text-[10px] opacity-75 font-mono">({stepP.birthYear})</span>
                              )}
                            </button>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : selectedKinshipPerson ? (
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#14171a] border border-stone-200 dark:border-[#2d3238] text-xs text-neutral-500 dark:text-slate-400">
                  Прямий родинний ланцюжок між {getFullName(person)} та {getFullName(selectedKinshipPerson)} не знайдено або вони належать до різних незв'язаних гілок родоводу.
                </div>
              ) : null}
            </div>

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
                    spouses.map((sp, spIdx) => (
                      <div key={`sp_wrap_${sp.id}_${spIdx}`} className="space-y-3">
                        {renderPersonCard(sp, false, 'Подружжя', undefined, `sp_card_${sp.id}_${spIdx}`)}
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded-xl border border-dashed border-stone-200 dark:border-slate-800 text-center text-xs text-slate-400">
                      Подружжя не вказано
                    </div>
                  )}

                  {/* Highlighted Active Person Card */}
                  {renderPersonCard(person, true, 'Вибрана особа', onStartEdit, `active_${person.id}`)}

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
                        allChildren.map((ch, chIdx) => renderPersonCard(ch, false, isPersonFemale(ch) ? 'Донька' : 'Син', undefined, `all_ch_${ch.id}_${chIdx}`))
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
                  {!isReadOnly && (onOpenFamilyQuickAdd || onOpenAddRelation) && (!father || !mother) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenFamilyQuickAdd) {
                          onOpenFamilyQuickAdd();
                        } else if (onOpenAddRelation) {
                          onOpenAddRelation(!father ? 'father' : 'mother', person.id);
                        }
                      }}
                      className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Додати батьків
                    </button>
                  )}
                </div>

                {/* Parents Section */}
                <div className="space-y-2.5">
                  {father ? (
                    renderPersonCard(father, false, 'Батько', undefined, `father_${father.id}`)
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
                    renderPersonCard(mother, false, 'Мати', undefined, `mother_${mother.id}`)
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
                      {parentsChildren.map((ch, pcIdx) => {
                        const isThisPerson = ch.id === person.id;
                        return renderPersonCard(
                          ch,
                          isThisPerson,
                          isThisPerson ? 'Вибрана особа' : isPersonFemale(ch) ? 'Сестра' : 'Брат',
                          isThisPerson ? onStartEdit : undefined,
                          `parent_ch_${ch.id}_${pcIdx}`
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
                          key={`gp_${gp.id || ''}_${idx}`}
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
                      {godchildrenList.map((gc, gcIdx) => (
                        <div
                          key={`gc_${gc.id}_${gcIdx}`}
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

        {/* Detailed Kinship Line Tab (Родинна лінія та зв'язок з вибраною особою) */}
        {activeTab === 'kinship_line' && (
          <div className="space-y-6">
            {/* Summary Overview Card */}
            <div className="bg-gradient-to-br from-sky-500/10 via-amber-500/5 to-emerald-500/10 dark:from-sky-950/40 dark:via-[#1c2128] dark:to-emerald-950/20 rounded-2xl border border-sky-300/70 dark:border-sky-800/70 p-5 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-sky-200/60 dark:border-sky-900/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-500/20 dark:bg-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0 shadow-xs">
                    <Dna className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg text-neutral-900 dark:text-white flex items-center gap-2">
                      <span>Родинна лінія та зв'язок</span>
                      {isTargetRoot ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40">
                          Корінна особа 👑
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/40">
                          {targetToPersonKinship?.relationshipName || kinshipToSelected?.relationshipName || 'Спорідненість'}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-slate-400">
                      {selectedKinshipPerson
                        ? `Генеалогічний зв'язок між ${getFullName(person)} та ${getFullName(selectedKinshipPerson)}`
                        : 'Виберіть особу зі списку для розрахунку родинної лінії'}
                    </p>
                  </div>
                </div>

                {/* Main Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedKinshipPerson && kinshipToSelected && kinshipToSelected.path && kinshipToSelected.path.length > 0 && (
                    <button
                      type="button"
                      onClick={handleShowKinshipLineInTree}
                      className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
                      title="Відкрити дерево та підсвітити весь ланцюжок родинної лінії"
                    >
                      <GitFork className="w-3.5 h-3.5" />
                      <span>Побачити в дереві</span>
                    </button>
                  )}
                  {selectedKinshipPerson && kinshipToSelected && (
                    <button
                      type="button"
                      onClick={handleCopyKinshipText}
                      className="px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Копіювати текстовий ланцюжок лінії"
                    >
                      {copiedKinshipLine ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                      <span>{copiedKinshipLine ? 'Скопійовано' : 'Копіювати'}</span>
                    </button>
                  )}
                  {onOpenKinshipWith && selectedKinshipPerson && !isComparingWithSelf && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenKinshipWith(selectedKinshipPerson.id);
                        onClose();
                      }}
                      className="px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Відкрити детальний калькулятор спорідненості"
                    >
                      <Compass className="w-3.5 h-3.5 text-sky-500" />
                      <span>Калькулятор</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Person Selector Controls inside Kinship Tab */}
              <div className="bg-white/90 dark:bg-[#15191e]/90 rounded-xl border border-sky-200/70 dark:border-sky-900/40 p-3 space-y-2.5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {/* Current Person (Поточна особа) */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-100/90 dark:bg-sky-950/70 border border-sky-300/80 dark:border-sky-800 text-xs shrink-0 shadow-2xs">
                    <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                      {isPersonFemale(person) ? '♀' : isPersonMale(person) ? '♂' : '👤'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 leading-tight">
                        Поточна особа
                      </span>
                      <span className="font-extrabold text-neutral-900 dark:text-white leading-tight truncate max-w-[150px] sm:max-w-[200px]" title={getFullName(person)}>
                        {getFullName(person)}
                      </span>
                    </div>
                  </div>

                  {/* Connection Arrow */}
                  <div className="hidden sm:flex items-center text-sky-500 dark:text-sky-400 shrink-0" title="Зв'язок з особою">
                    <ArrowRight className="w-4 h-4" />
                  </div>

                  <div className="relative flex-1 min-w-[140px]">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={kinshipSearchQuery}
                      onChange={(e) => setKinshipSearchQuery(e.target.value)}
                      placeholder="Пошук за ім'ям або роком..."
                      className="w-full pl-8 pr-6 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-[#1a1e24] text-neutral-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    {kinshipSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setKinshipSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <select
                    value={selectedKinshipPersonId}
                    onChange={(e) => setSelectedKinshipPersonId(e.target.value)}
                    className="flex-1 max-w-full sm:max-w-xs px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-[#1a1e24] text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                  >
                    {filteredPersonsForKinship.length === 0 ? (
                      <option value="" disabled>Нікого не знайдено</option>
                    ) : (
                      filteredPersonsForKinship.map((p) => {
                        const isRoot = rootPerson && rootPerson.id === p.id;
                        const pYear = p.birthYear ? ` (${p.birthYear}${p.deathYear ? `–${p.deathYear}` : p.isLiving ? '–живий' : ''})` : '';
                        return (
                          <option key={`sel_kin_tab_${p.id}`} value={p.id}>
                            {isRoot ? '👑 ' : ''}{getFullName(p)}{pYear}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                {quickKinshipTargets.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[11px] text-slate-400 shrink-0">Швидкий вибір:</span>
                    {quickKinshipTargets.map((qt) => {
                      const isSelected = selectedKinshipPersonId === qt.id;
                      return (
                        <button
                          key={`quick_kin_tab_${qt.id}`}
                          type="button"
                          onClick={() => setSelectedKinshipPersonId(qt.id)}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-sky-600 text-white shadow-2xs'
                              : 'bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-neutral-700 dark:text-slate-300'
                          }`}
                        >
                          <span>{qt.icon}</span>
                          <span>{qt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Endpoint Comparison Cards: Selected Person vs This Person */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Selected Person Card */}
                <div className="p-3.5 rounded-xl bg-white/80 dark:bg-[#15191e]/80 border border-sky-300/60 dark:border-sky-800/50 shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                      {isTargetRoot ? '👑' : '👤'}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                        {isTargetRoot ? 'Корінна особа родоводу' : 'Вибрана особа для зв’язку'}
                      </div>
                      <div className="font-extrabold text-xs text-neutral-900 dark:text-white">
                        {selectedKinshipPerson ? getFullName(selectedKinshipPerson) : 'Особа не вибрана'}
                      </div>
                      {selectedKinshipPerson && (
                        <div className="text-[11px] text-slate-400">
                          {selectedKinshipPerson.birthYear ? `нар. ${selectedKinshipPerson.birthYear}` : ''}
                          {selectedKinshipPerson.birthPlace ? ` • ${selectedKinshipPerson.birthPlace}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                  {selectedKinshipPerson && selectedKinshipPerson.id !== person.id && onSelectPerson && (
                    <button
                      type="button"
                      onClick={() => onSelectPerson(selectedKinshipPerson.id)}
                      className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-400 hover:text-sky-500"
                      title={`Перейти до картки ${getFullName(selectedKinshipPerson)}`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* This Person Card */}
                <div className="p-3.5 rounded-xl bg-white/80 dark:bg-[#15191e]/80 border border-sky-300/60 dark:border-sky-800/50 shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-sm shrink-0">
                      👤
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                        Поточна особа
                      </div>
                      <div className="font-extrabold text-xs text-neutral-900 dark:text-white">
                        {getFullName(person)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {person.birthYear ? `нар. ${person.birthYear}` : ''}
                        {person.birthPlace ? ` • ${person.birthPlace}` : ''}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                    Цільова
                  </span>
                </div>
              </div>

              {/* Metrics Pills */}
              {!isComparingWithSelf && kinshipToSelected && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#15191e] border border-stone-200 dark:border-[#2d333b] font-medium">
                    <Route className="w-3.5 h-3.5 text-sky-500" />
                    <span className="text-slate-400">Ступінь спорідненості:</span>
                    <span className="font-bold text-neutral-800 dark:text-white">
                      {kinshipToSelected.degree} {kinshipToSelected.degree === 1 ? 'крок' : kinshipToSelected.degree < 5 ? 'кроки' : 'кроків'}
                    </span>
                  </div>

                  {kinshipToSelected.coefficient > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#15191e] border border-stone-200 dark:border-[#2d333b] font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-slate-400">Спільні гени (ДНК):</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        ≈ {kinshipToSelected.coefficient}%
                      </span>
                    </div>
                  )}

                  {kinshipToSelected.generationalDistance !== undefined && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#15191e] border border-stone-200 dark:border-[#2d333b] font-medium">
                      <Layers className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-slate-400">Покоління:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {kinshipToSelected.generationalDistance === 0
                          ? 'Одне покоління (0)'
                          : kinshipToSelected.generationalDistance > 0
                          ? `+${kinshipToSelected.generationalDistance} (висхідне/предки)`
                          : `${kinshipToSelected.generationalDistance} (низхідне/нащадки)`}
                      </span>
                    </div>
                  )}

                  {kinshipToSelected.commonAncestors && kinshipToSelected.commonAncestors.length > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#15191e] border border-stone-200 dark:border-[#2d333b] font-medium">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-slate-400">Спільний предок:</span>
                      <span className="font-bold text-neutral-800 dark:text-white">
                        {getFullName(kinshipToSelected.commonAncestors[0])}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Detailed Lineage Chain Breakdown */}
            {isComparingWithSelf ? (
              <div className="p-8 rounded-2xl bg-white dark:bg-[#1a1e24] border border-amber-300 dark:border-amber-800/60 text-center space-y-3 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto text-2xl">
                  ℹ️
                </div>
                <h4 className="text-base font-extrabold text-neutral-900 dark:text-white">
                  Вибрано ту саму особу
                </h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  {getFullName(person)} вибрано як початкову та цільову особу. Будь ласка, оберіть іншого родича зі списку вище, щоб побачити родинну лінію та ступінь спорідненості.
                </p>
              </div>
            ) : kinshipToSelected && kinshipToSelected.path && kinshipToSelected.path.length > 0 ? (
              <div className="bg-white dark:bg-[#1a1e24] rounded-2xl border border-stone-200 dark:border-[#2d333b] p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-[#272c33]">
                  <h4 className="font-extrabold text-sm sm:text-base text-neutral-900 dark:text-white flex items-center gap-2">
                    <Route className="w-4 h-4 text-sky-500" />
                    <span>Покроковий родинний ланцюжок ({kinshipToSelected.path.length} осіб)</span>
                  </h4>
                  <span className="text-xs text-slate-400">
                    Від {selectedKinshipPerson ? getFullName(selectedKinshipPerson) : 'початку'} {isTargetRoot ? '👑 ' : ''}до {getFullName(person)}
                  </span>
                </div>

                {/* Vertical Timeline / Path Step Chain */}
                <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-amber-400 before:via-sky-400 before:to-emerald-400">
                  {kinshipToSelected.path.map((step, sIdx) => {
                    const stepP = databaseForKinship.persons[step.personId];
                    if (!stepP) return null;
                    const isStartStep = sIdx === 0;
                    const isTargetStep = sIdx === kinshipToSelected.path.length - 1;
                    const isStepTreeRoot = Boolean(rootPerson && rootPerson.id === stepP.id);
                    const isStepMale = isPersonMale(stepP);
                    const isStepFemale = isPersonFemale(stepP);

                    return (
                      <div key={`kin_full_step_${step.personId}_${sIdx}`} className="relative group">
                        {/* Step Marker on the line */}
                        <div
                          className={`absolute -left-6 sm:-left-8 top-3.5 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all shadow-xs ${
                            isTargetStep
                              ? 'bg-sky-500 border-sky-300 text-white scale-110'
                              : isStartStep
                              ? 'bg-amber-500 border-amber-300 text-stone-950 scale-110'
                              : step.isCommonAncestor
                              ? 'bg-purple-500 border-purple-300 text-white'
                              : 'bg-white dark:bg-[#1a1e24] border-sky-400 text-sky-600 dark:text-sky-300'
                          }`}
                        >
                          {isStepTreeRoot ? '👑' : sIdx + 1}
                        </div>

                        {/* Step Connection Badge */}
                        {sIdx > 0 && (
                          <div className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900/60 shadow-2xs">
                            {step.direction === 'up' ? (
                              <ArrowUp className="w-3 h-3 text-sky-500" />
                            ) : step.direction === 'down' ? (
                              <ArrowDown className="w-3 h-3 text-emerald-500" />
                            ) : step.direction === 'spouse' ? (
                              <Heart className="w-3 h-3 text-rose-500" />
                            ) : (
                              <ArrowLeftRight className="w-3 h-3 text-indigo-500" />
                            )}
                            <span>{step.relationFromPrevious || 'Родинний перехід'}</span>
                            {step.isCommonAncestor && (
                              <span className="ml-1 text-[10px] font-bold text-amber-500">
                                • Спільний предок 👑
                              </span>
                            )}
                          </div>
                        )}

                        {/* Person Card */}
                        <div
                          onClick={() => {
                            if (stepP.id !== person.id && onSelectPerson) {
                              onSelectPerson(stepP.id);
                            }
                          }}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                            isTargetStep
                              ? 'bg-sky-50/50 dark:bg-sky-950/20 border-sky-400/80 shadow-xs'
                              : isStartStep
                              ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-400/80 shadow-xs'
                              : 'bg-slate-50/40 dark:bg-[#15191e] border-stone-200 dark:border-[#2d333b] hover:border-sky-400 hover:shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {/* Avatar Icon */}
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                                  isStepTreeRoot
                                    ? 'bg-amber-500/20 border-amber-400 text-amber-600 dark:text-amber-300'
                                    : isStartStep
                                    ? 'bg-amber-500/15 border-amber-400/40 text-amber-600 dark:text-amber-300'
                                    : isStepFemale
                                    ? 'bg-rose-500/15 border-rose-400/40 text-rose-500'
                                    : isStepMale
                                    ? 'bg-sky-500/15 border-sky-400/40 text-sky-500'
                                    : 'bg-slate-500/15 border-slate-400/40 text-slate-400'
                                }`}
                              >
                                {isStepTreeRoot ? '👑' : isStepFemale ? '♀' : '♂'}
                              </div>

                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-sm text-neutral-900 dark:text-white">
                                    {getFullName(stepP)}
                                  </span>
                                  {isStepTreeRoot && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                      Корінь родоводу 👑
                                    </span>
                                  )}
                                  {isStartStep && !isStepTreeRoot && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                      Вибрана особа
                                    </span>
                                  )}
                                  {isTargetStep && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-500/20 text-sky-700 dark:text-sky-300">
                                      Поточна особа
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                                  <span>
                                    {stepP.birthYear || stepP.deathYear
                                      ? `${stepP.birthYear || '?'} — ${stepP.isLiving ? 'живий' : stepP.deathYear || '?'}`
                                      : 'Роки невідомі'}
                                  </span>
                                  {stepP.birthPlace && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate max-w-[200px]">{stepP.birthPlace}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Card Actions */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {onChangeRoot && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onChangeRoot(stepP.id);
                                    onClose();
                                  }}
                                  className="p-1.5 rounded-lg border border-stone-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-500 transition-colors"
                                  title={`Фокусувати дерево на ${getFullName(stepP)}`}
                                >
                                  <GitFork className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {stepP.id !== person.id && (
                                <span className="text-xs text-sky-600 dark:text-sky-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                  <span>Картка</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Call to Action */}
                <div className="pt-4 border-t border-stone-100 dark:border-[#272c33] flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-neutral-500 dark:text-slate-400">
                    Повна родинна лінія складається з {kinshipToSelected.path.length} осіб (кроків: {kinshipToSelected.degree}).
                  </div>
                  <button
                    type="button"
                    onClick={handleShowKinshipLineInTree}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <GitFork className="w-4 h-4" />
                    <span>Побачити цю родинну лінію в дереві</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-white dark:bg-[#1a1e24] border border-stone-200 dark:border-[#2d333b] text-center space-y-2">
                <Compass className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Родинну лінію не знайдено
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Не вдалося побудувати неперервний родинний зв'язок між цією особою та {selectedKinshipPerson ? getFullName(selectedKinshipPerson) : 'обраною особою'}. Можливо, вони належать до різних незв'язаних гілок родоводу або бракує проміжних зв'язків.
                </p>
              </div>
            )}
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
          {onDeletePerson && !isReadOnly && (
            <button
              type="button"
              onClick={onDeletePerson}
              className="px-3 py-1.5 rounded-lg border border-rose-500/30 hover:border-rose-500/60 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5 cursor-pointer text-xs transition-colors"
              title="Видалити особу з бази даних"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Видалити</span>
            </button>
          )}
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
