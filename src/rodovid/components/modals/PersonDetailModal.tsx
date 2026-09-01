/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  User,
  Calendar,
  MapPin,
  Heart,
  GitFork,
  Compass,
  Edit2,
  Trash2,
  Briefcase,
  Award,
  BookOpen,
  Tag,
  Shield,
  UserPlus,
  Unlink,
  Search,
  Check,
  RefreshCw,
  Plus,
  FileText,
  FilePlus,
  Save,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Users,
  Sparkles,
  TreePine
} from 'lucide-react';
import { GenealogyDatabase, Person, Family, Source } from '../../types/genealogy';
import { getFullName } from '../../utils/relationship';
import { useUIStore } from '../../../stores/useUIStore';
import { useGenealogy } from '../../../context/GenealogyContext';
import { useAuthStore } from '../../../stores/useAuthStore';
import { isPersonLiving, getPrivacySafePerson, isUserWhitelisted } from '../../utils/privacy';
import { getThemeConfig } from '../../../utils/theme';
import { ConfirmDeleteModal } from '../../../components/common/ConfirmDeleteModal';
import { PersonDocumentsSection } from '../../../components/PersonDocumentsSection';

interface PersonDetailModalProps {
  database?: GenealogyDatabase;
  personId: string | null;
  onClose: () => void;
  onSelectPerson?: (id: string) => void;
  onEditPerson?: (id: string) => void;
  onDeletePerson?: (id: string) => void;
  onChangeRoot?: (id: string) => void;
  onOpenKinshipWith?: (id: string) => void;
  onOpenRelationManager?: (id: string) => void;
  onAddRelation?: (type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling', targetPersonId: string) => void;
  isReadOnly?: boolean;
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
  database,
  personId,
  onClose,
  onSelectPerson,
  onEditPerson,
  onDeletePerson,
  onChangeRoot,
  onOpenKinshipWith,
  onOpenRelationManager,
  onAddRelation,
  isReadOnly: isPropReadOnly = false
}) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const { updatePerson, saveFamily, deleteFamily, saveSource, sources, families, persons } = useGenealogy();

  // Effective database fallback if database prop is omitted
  const effectiveDb: GenealogyDatabase = useMemo(() => {
    const personsObj: Record<string, Person> = {};
    persons.forEach((p) => {
      personsObj[p.id] = p;
    });
    const familiesObj: Record<string, Family> = {};
    Object.values(families || {}).forEach((f: any) => {
      if (f?.id) familiesObj[f.id] = f;
    });
    return {
      persons: database?.persons ? { ...personsObj, ...database.persons } : personsObj,
      families: database?.families ? { ...familiesObj, ...database.families } : familiesObj,
      sources: database?.sources || sources || {},
      submitters: database?.submitters || {},
      repositories: database?.repositories || {}
    };
  }, [database, persons, families, sources]);

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Link Pickers
  const [parentPicker, setParentPicker] = useState<{ isOpen: boolean; type: 'father' | 'mother' } | null>(null);
  const [childPicker, setChildPicker] = useState<{ isOpen: boolean; familyId?: string } | null>(null);
  const [spousePicker, setSpousePicker] = useState<boolean>(false);
  const [siblingPicker, setSiblingPicker] = useState<{ isOpen: boolean; gender?: 'male' | 'female' | 'all' } | null>(null);
  const [isSiblingsCollapsed, setIsSiblingsCollapsed] = useState(false);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');

  // Inline Note Editor
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  // Inline Bio Editor
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');

  // Event Modal State
  const [eventModal, setEventModal] = useState<{
    isOpen: boolean;
    editIndex?: number;
    type: string;
    date: string;
    year: string;
    placeName: string;
    description: string;
  } | null>(null);

  // Source / Citation Modal State
  const [sourceModal, setSourceModal] = useState<{
    isOpen: boolean;
    mode: 'link_existing' | 'create_new';
    selectedExistingSourceId: string;
    customTitle?: string;
    customDescription?: string;
    title: string;
    archive: string;
    fund: string;
    inventory: string;
    caseNumber: string;
    page: string;
    date: string;
    transcription: string;
    url: string;
  } | null>(null);

  // Family Marriage Editor State
  const [familyMarriageEditor, setFamilyMarriageEditor] = useState<{
    isOpen: boolean;
    familyId: string;
    marriageDate: string;
    marriagePlace: string;
  } | null>(null);

  const currentUser = useAuthStore((s) => s.currentUser);
  const whitelist = useAuthStore((s) => s.whitelist);
  const isWhitelisted = useMemo(() => isUserWhitelisted(currentUser, whitelist), [currentUser, whitelist]);

  const canEdit = useMemo(() => {
    if (isPropReadOnly) return false;
    if (!currentUser || !isWhitelisted) return false;
    const entry = whitelist.find(
      (w) => w.email.toLowerCase() === currentUser.email?.toLowerCase() && w.status === 'active'
    );
    return Boolean(entry && (entry.role === 'admin' || entry.role === 'editor'));
  }, [isPropReadOnly, currentUser, isWhitelisted, whitelist]);

  const isReadOnly = !canEdit;

  if (!personId) return null;
  const rawPerson = (database?.persons ? database.persons[personId] : undefined) || persons.find((p) => p.id === personId);
  if (!rawPerson) return null;

  const isLiving = isPersonLiving(rawPerson);
  const isMasked = !isWhitelisted && isLiving;
  const person = isMasked ? getPrivacySafePerson(rawPerson, false) : rawPerson;

  const isMale = person.gender === 'male' || person.gender === 'M';
  const isFemale = person.gender === 'female' || person.gender === 'F';

  // Parents resolution
  const parentFamily = person.parentFamilyId ? (database.families[person.parentFamilyId] || families?.[person.parentFamilyId]) : null;
  const father = parentFamily?.husbandId
    ? (database.persons[parentFamily.husbandId] || persons.find((p) => p.id === parentFamily.husbandId))
    : person.fatherId
    ? (database.persons[person.fatherId] || persons.find((p) => p.id === person.fatherId))
    : null;
  const mother = parentFamily?.wifeId
    ? (database.persons[parentFamily.wifeId] || persons.find((p) => p.id === parentFamily.wifeId))
    : person.motherId
    ? (database.persons[person.motherId] || persons.find((p) => p.id === person.motherId))
    : null;

  // Spouses & Families resolution
  const spouseFamilyIds = Array.from(
    new Set([
      ...(person.spouseFamilyIds || []),
      ...Object.values(database.families || {})
        .filter((f) => f.husbandId === person.id || f.wifeId === person.id)
        .map((f) => f.id),
      ...Object.values(families || {})
        .filter((f: any) => f.husbandId === person.id || f.wifeId === person.id)
        .map((f: any) => f.id)
    ])
  );

  const spouseFamilies: Family[] = spouseFamilyIds
    .map((id) => database.families[id] || families?.[id])
    .filter(Boolean);

  // Standalone spouses without family container
  const directSpouses = (person.spouseIds || [])
    .filter((sId) => !spouseFamilies.some((f) => f.husbandId === sId || f.wifeId === sId))
    .map((sId) => database.persons[sId] || persons.find((p) => p.id === sId))
    .filter(Boolean) as Person[];

  // Standalone children not in spouseFamilies
  const directChildren = (person.childrenIds || [])
    .map((cId) => database.persons[cId] || persons.find((p) => p.id === cId))
    .filter(Boolean) as Person[];

  const estate = person.estateOrSocialStatus || person.estate || person.socialStatus;

  // Handle parent linking
  const handleLinkParent = (parentType: 'father' | 'mother', selectedParentId: string) => {
    const selectedParent = database.persons[selectedParentId] || persons.find((p) => p.id === selectedParentId);
    if (!selectedParent) return;

    if (parentType === 'father') {
      updatePerson({
        ...person,
        fatherId: selectedParentId
      });
      updatePerson({
        ...selectedParent,
        childrenIds: Array.from(new Set([...(selectedParent.childrenIds || []), person.id]))
      });
    } else {
      updatePerson({
        ...person,
        motherId: selectedParentId
      });
      updatePerson({
        ...selectedParent,
        childrenIds: Array.from(new Set([...(selectedParent.childrenIds || []), person.id]))
      });
    }
    setParentPicker(null);
    setPickerSearchQuery('');
  };

  // Handle parent unlinking
  const handleUnlinkParent = (parentType: 'father' | 'mother') => {
    if (parentType === 'father') {
      const formerId = person.fatherId || parentFamily?.husbandId;
      const updatedPerson: Person = {
        ...person,
        fatherId: undefined
      };

      if (parentFamily) {
        const fam = effectiveDb.families[parentFamily.id] || families?.[parentFamily.id];
        if (fam) {
          if (fam.wifeId) {
            updatedPerson.motherId = updatedPerson.motherId || fam.wifeId;
          }
          updatedPerson.parentFamilyId = undefined;
          saveFamily({
            ...fam,
            children: (fam.children || []).filter((c) => c.personId !== person.id)
          });
        }
      }

      Object.values(effectiveDb.families || {}).forEach((f) => {
        if (f.husbandId === formerId && f.children?.some((c) => c.personId === person.id)) {
          saveFamily({
            ...f,
            children: f.children.filter((c) => c.personId !== person.id)
          });
        }
      });

      updatePerson(updatedPerson);

      if (formerId) {
        const former = effectiveDb.persons[formerId] || persons.find((p) => p.id === formerId);
        if (former) {
          updatePerson({
            ...former,
            childrenIds: (former.childrenIds || []).filter((cid) => cid !== person.id)
          });
        }
      }
    } else {
      const formerId = person.motherId || parentFamily?.wifeId;
      const updatedPerson: Person = {
        ...person,
        motherId: undefined
      };

      if (parentFamily) {
        const fam = effectiveDb.families[parentFamily.id] || families?.[parentFamily.id];
        if (fam) {
          if (fam.husbandId) {
            updatedPerson.fatherId = updatedPerson.fatherId || fam.husbandId;
          }
          updatedPerson.parentFamilyId = undefined;
          saveFamily({
            ...fam,
            children: (fam.children || []).filter((c) => c.personId !== person.id)
          });
        }
      }

      Object.values(effectiveDb.families || {}).forEach((f) => {
        if (f.wifeId === formerId && f.children?.some((c) => c.personId === person.id)) {
          saveFamily({
            ...f,
            children: f.children.filter((c) => c.personId !== person.id)
          });
        }
      });

      updatePerson(updatedPerson);

      if (formerId) {
        const former = effectiveDb.persons[formerId] || persons.find((p) => p.id === formerId);
        if (former) {
          updatePerson({
            ...former,
            childrenIds: (former.childrenIds || []).filter((cid) => cid !== person.id)
          });
        }
      }
    }
  };

  // Siblings resolution
  const siblings = useMemo(() => {
    const currentFatherId = father?.id || person.fatherId || parentFamily?.husbandId;
    const currentMotherId = mother?.id || person.motherId || parentFamily?.wifeId;

    const sibMap = new Map<string, { person: Person; relationType: 'full' | 'paternal' | 'maternal' | 'sibling'; label: string }>();

    // Scan all known persons
    const allPersons = [
      ...Object.values(effectiveDb.persons || {}),
      ...persons
    ];
    const uniquePersons = new Map<string, Person>();
    allPersons.forEach((p) => {
      if (p && p.id && !uniquePersons.has(p.id)) uniquePersons.set(p.id, p);
    });

    uniquePersons.forEach((p) => {
      if (p.id === person.id) return;

      const pFatherId = p.fatherId;
      const pMotherId = p.motherId;

      const isSameFather = Boolean(currentFatherId && pFatherId && currentFatherId === pFatherId);
      const isSameMother = Boolean(currentMotherId && pMotherId && currentMotherId === pMotherId);

      const isDirectSibling = Boolean(
        (person.siblingIds && person.siblingIds.includes(p.id)) ||
        (p.siblingIds && p.siblingIds.includes(person.id))
      );

      const isMaleSibling = p.gender === 'male' || p.gender === 'M';

      if (isSameFather && isSameMother) {
        sibMap.set(p.id, {
          person: p,
          relationType: 'full',
          label: isMaleSibling ? 'Рідний брат' : 'Рідна сестра'
        });
      } else if (isSameFather) {
        sibMap.set(p.id, {
          person: p,
          relationType: 'paternal',
          label: isMaleSibling ? 'Брат (по батькові)' : 'Сестра (по батькові)'
        });
      } else if (isSameMother) {
        sibMap.set(p.id, {
          person: p,
          relationType: 'maternal',
          label: isMaleSibling ? 'Брат (по матері)' : 'Сестра (по матері)'
        });
      } else if (isDirectSibling) {
        sibMap.set(p.id, {
          person: p,
          relationType: 'sibling',
          label: isMaleSibling ? 'Брат' : 'Сестра'
        });
      }
    });

    // Also check parentFamily children if any
    if (parentFamily?.children) {
      parentFamily.children.forEach((c) => {
        if (c.personId !== person.id) {
          const p = effectiveDb.persons[c.personId] || persons.find((per) => per.id === c.personId);
          if (p && !sibMap.has(p.id)) {
            const isMaleSibling = p.gender === 'male' || p.gender === 'M';
            sibMap.set(p.id, {
              person: p,
              relationType: 'full',
              label: isMaleSibling ? 'Рідний брат' : 'Рідна сестра'
            });
          }
        }
      });
    }

    return Array.from(sibMap.values());
  }, [father, mother, person, parentFamily, effectiveDb.persons, persons]);

  // Handle linking sibling
  const handleLinkSibling = (siblingId: string) => {
    const siblingPerson = effectiveDb.persons[siblingId] || persons.find((p) => p.id === siblingId);
    if (!siblingPerson) return;

    const currentFatherId = father?.id || person.fatherId || parentFamily?.husbandId;
    const currentMotherId = mother?.id || person.motherId || parentFamily?.wifeId;

    if (currentFatherId || currentMotherId) {
      updatePerson({
        ...siblingPerson,
        fatherId: currentFatherId || siblingPerson.fatherId,
        motherId: currentMotherId || siblingPerson.motherId,
        siblingIds: Array.from(new Set([...(siblingPerson.siblingIds || []), person.id]))
      });

      if (currentFatherId) {
        const f = effectiveDb.persons[currentFatherId] || persons.find((p) => p.id === currentFatherId);
        if (f) {
          updatePerson({
            ...f,
            childrenIds: Array.from(new Set([...(f.childrenIds || []), siblingId, person.id]))
          });
        }
      }

      if (currentMotherId) {
        const m = effectiveDb.persons[currentMotherId] || persons.find((p) => p.id === currentMotherId);
        if (m) {
          updatePerson({
            ...m,
            childrenIds: Array.from(new Set([...(m.childrenIds || []), siblingId, person.id]))
          });
        }
      }

      if (parentFamily) {
        const fam = effectiveDb.families[parentFamily.id] || families?.[parentFamily.id];
        if (fam) {
          const exists = fam.children?.some((c) => c.personId === siblingId);
          if (!exists) {
            saveFamily({
              ...fam,
              children: [...(fam.children || []), { personId: siblingId, relationType: 'Biological' }]
            });
          }
        }
      }
    } else {
      updatePerson({
        ...person,
        siblingIds: Array.from(new Set([...(person.siblingIds || []), siblingId]))
      });
      updatePerson({
        ...siblingPerson,
        siblingIds: Array.from(new Set([...(siblingPerson.siblingIds || []), person.id]))
      });
    }

    setSiblingPicker(null);
    setPickerSearchQuery('');
  };

  // Handle unlinking sibling
  const handleUnlinkSibling = (siblingId: string) => {
    const siblingPerson = effectiveDb.persons[siblingId] || persons.find((p) => p.id === siblingId);
    if (siblingPerson) {
      updatePerson({
        ...siblingPerson,
        siblingIds: (siblingPerson.siblingIds || []).filter((id) => id !== person.id)
      });
    }

    updatePerson({
      ...person,
      siblingIds: (person.siblingIds || []).filter((id) => id !== siblingId)
    });

    if (parentFamily) {
      const fam = effectiveDb.families[parentFamily.id] || families?.[parentFamily.id];
      if (fam) {
        saveFamily({
          ...fam,
          children: (fam.children || []).filter((c) => c.personId !== siblingId)
        });
      }
    }
  };

  // Handle linking child
  const handleLinkChild = (childPersonId: string, targetFamilyId?: string) => {
    const childPerson = database.persons[childPersonId] || persons.find((p) => p.id === childPersonId);
    if (!childPerson) return;

    const isCurrentMale = person.gender === 'male' || person.gender === 'M';

    // Update child parent reference
    updatePerson({
      ...childPerson,
      fatherId: isCurrentMale ? person.id : childPerson.fatherId,
      motherId: !isCurrentMale ? person.id : childPerson.motherId
    });

    // Update current person's childrenIds
    updatePerson({
      ...person,
      childrenIds: Array.from(new Set([...(person.childrenIds || []), childPersonId]))
    });

    // Update family if targetFamilyId specified
    if (targetFamilyId) {
      const fam = database.families[targetFamilyId] || families?.[targetFamilyId];
      if (fam) {
        const existsInFam = fam.children?.some((c) => c.personId === childPersonId);
        if (!existsInFam) {
          saveFamily({
            ...fam,
            children: [...(fam.children || []), { personId: childPersonId, relationType: 'Biological' }]
          });
        }
      }
    }

    setChildPicker(null);
    setPickerSearchQuery('');
  };

  // Handle unlinking child
  const handleUnlinkChild = (childId: string, familyId?: string) => {
    const child = database.persons[childId] || persons.find((p) => p.id === childId);
    if (child) {
      const isCurrentMale = person.gender === 'male' || person.gender === 'M';
      updatePerson({
        ...child,
        fatherId: isCurrentMale && child.fatherId === person.id ? undefined : child.fatherId,
        motherId: !isCurrentMale && child.motherId === person.id ? undefined : child.motherId
      });
    }

    updatePerson({
      ...person,
      childrenIds: (person.childrenIds || []).filter((cid) => cid !== childId)
    });

    if (familyId) {
      const fam = database.families[familyId] || families?.[familyId];
      if (fam) {
        saveFamily({
          ...fam,
          children: (fam.children || []).filter((c) => c.personId !== childId)
        });
      }
    }
  };

  // Handle linking spouse
  const handleLinkSpouse = (spouseId: string) => {
    const spousePerson = database.persons[spouseId] || persons.find((p) => p.id === spouseId);
    if (!spousePerson) return;

    const newFamId = `F${String(Date.now()).slice(-4)}${Math.floor(Math.random() * 100)}`;
    const isCurrentMale = person.gender === 'male' || person.gender === 'M';

    const newFamily: Family = {
      id: newFamId,
      husbandId: isCurrentMale ? person.id : spouseId,
      wifeId: !isCurrentMale ? person.id : spouseId,
      relationshipType: 'Married',
      children: [],
      events: [],
      notes: [],
      citations: []
    };

    saveFamily(newFamily);

    updatePerson({
      ...person,
      spouseIds: Array.from(new Set([...(person.spouseIds || []), spouseId])),
      spouseFamilyIds: Array.from(new Set([...(person.spouseFamilyIds || []), newFamId]))
    });

    updatePerson({
      ...spousePerson,
      spouseIds: Array.from(new Set([...(spousePerson.spouseIds || []), person.id])),
      spouseFamilyIds: Array.from(new Set([...(spousePerson.spouseFamilyIds || []), newFamId]))
    });

    setSpousePicker(false);
    setPickerSearchQuery('');
  };

  // Handle unlinking spouse
  const handleUnlinkSpouse = (spouseId: string, familyId?: string) => {
    const spouse = database.persons[spouseId] || persons.find((p) => p.id === spouseId);
    if (spouse) {
      updatePerson({
        ...spouse,
        spouseIds: (spouse.spouseIds || []).filter((id) => id !== person.id),
        spouseFamilyIds: familyId ? (spouse.spouseFamilyIds || []).filter((id) => id !== familyId) : spouse.spouseFamilyIds
      });
    }

    updatePerson({
      ...person,
      spouseIds: (person.spouseIds || []).filter((id) => id !== spouseId),
      spouseFamilyIds: familyId ? (person.spouseFamilyIds || []).filter((id) => id !== familyId) : person.spouseFamilyIds
    });

    if (familyId) {
      deleteFamily(familyId);
    }
  };

  // Save Notes inline
  const handleSaveNotes = () => {
    updatePerson({
      ...person,
      notes: notesDraft.trim() || undefined
    });
    setIsEditingNotes(false);
  };

  // Save Bio inline
  const handleSaveBio = () => {
    updatePerson({
      ...person,
      bio: bioDraft.trim() || undefined
    });
    setIsEditingBio(false);
  };

  // Save Event
  const handleSaveEvent = () => {
    if (!eventModal) return;
    const currentEvents = [...(person.events || [])];
    const newEventObj = {
      type: eventModal.type.trim() || 'Подія',
      date: eventModal.date.trim() || undefined,
      year: eventModal.year ? parseInt(eventModal.year, 10) : undefined,
      placeName: eventModal.placeName.trim() || undefined,
      description: eventModal.description.trim() || undefined
    };

    if (typeof eventModal.editIndex === 'number' && eventModal.editIndex >= 0) {
      currentEvents[eventModal.editIndex] = newEventObj;
    } else {
      currentEvents.push(newEventObj);
    }

    updatePerson({
      ...person,
      events: currentEvents
    });
    setEventModal(null);
  };

  // Delete Event
  const handleDeleteEvent = (index: number) => {
    const currentEvents = (person.events || []).filter((_, idx) => idx !== index);
    updatePerson({
      ...person,
      events: currentEvents
    });
  };

  // Save Citation / Source
  const handleSaveCitation = () => {
    if (!sourceModal) return;
    const currentCitations = [...(person.citations || [])];
    const currentSourceIds = Array.from(new Set([...(person.sourceIds || [])]));

    if (sourceModal.mode === 'link_existing' && sourceModal.selectedExistingSourceId) {
      if (sourceModal.selectedExistingSourceId === 'custom') {
        const customTitle = sourceModal.customTitle?.trim() || 'Власне джерело';
        const newSourceId = `S${String(Date.now()).slice(-4)}${Math.floor(Math.random() * 100)}`;
        const newSource: Source = {
          id: newSourceId,
          title: customTitle,
          transcription: sourceModal.customDescription?.trim() || undefined,
          page: sourceModal.page.trim() || undefined,
          tags: ['власне']
        };

        saveSource(newSource);
        currentSourceIds.push(newSourceId);
        currentCitations.push({
          sourceId: newSourceId,
          page: sourceModal.page.trim() || undefined,
          citation: `${customTitle}${sourceModal.page.trim() ? ` (Арк./стор. ${sourceModal.page.trim()})` : ''}`
        });
      } else {
        currentSourceIds.push(sourceModal.selectedExistingSourceId);
        const existingSrc = database.sources[sourceModal.selectedExistingSourceId] || sources?.[sourceModal.selectedExistingSourceId];
        if (existingSrc) {
          currentCitations.push({
            sourceId: existingSrc.id,
            page: sourceModal.page.trim() || undefined,
            citation: `${existingSrc.title || 'Архівне джерело'}${sourceModal.page ? ` (Арк./стор. ${sourceModal.page})` : ''}`
          });
        }
      }
    } else if (sourceModal.mode === 'create_new') {
      const newSourceId = `S${String(Date.now()).slice(-4)}`;
      const newSource: Source = {
        id: newSourceId,
        title: sourceModal.title.trim() || 'Архівний витяг',
        archive: sourceModal.archive.trim() || undefined,
        fund: sourceModal.fund.trim() || undefined,
        inventory: sourceModal.inventory.trim() || undefined,
        caseNumber: sourceModal.caseNumber.trim() || undefined,
        date: sourceModal.date.trim() || undefined,
        page: sourceModal.page.trim() || undefined,
        transcription: sourceModal.transcription.trim() || undefined,
        url: sourceModal.url.trim() || undefined,
        tags: ['архів']
      };

      saveSource(newSource);
      currentSourceIds.push(newSourceId);
      currentCitations.push({
        sourceId: newSourceId,
        page: sourceModal.page.trim() || undefined,
        citation: `${newSource.title}${sourceModal.page ? ` (Арк. ${sourceModal.page})` : ''}`
      });
    }

    updatePerson({
      ...person,
      citations: currentCitations,
      sourceIds: currentSourceIds
    });
    setSourceModal(null);
  };

  // Delete Citation
  const handleDeleteCitation = (index: number) => {
    const currentCitations = (person.citations || []).filter((_, idx) => idx !== index);
    updatePerson({
      ...person,
      citations: currentCitations
    });
  };

  // Save Family Marriage details
  const handleSaveMarriageDetails = () => {
    if (!familyMarriageEditor) return;
    const fam = effectiveDb.families[familyMarriageEditor.familyId] || families?.[familyMarriageEditor.familyId];
    if (fam) {
      const yearMatch = familyMarriageEditor.marriageDate.match(/\b(1\d{3}|20\d{2})\b/);
      saveFamily({
        ...fam,
        marriageDate: familyMarriageEditor.marriageDate.trim() || undefined,
        marriageYear: yearMatch ? parseInt(yearMatch[1], 10) : fam.marriageYear,
        marriagePlace: familyMarriageEditor.marriagePlace.trim() || undefined
      });
    }
    setFamilyMarriageEditor(null);
  };

  // Filter candidates for pickers
  const filteredCandidates = useMemo(() => {
    const q = pickerSearchQuery.toLowerCase().trim();
    return Object.values(effectiveDb.persons).filter((p) => {
      if (p.id === person.id) return false;
      const isCandMale = p.gender === 'male' || p.gender === 'M';
      const isCandFemale = p.gender === 'female' || p.gender === 'F';

      if (genderFilter === 'male' && !isCandMale) return false;
      if (genderFilter === 'female' && !isCandFemale) return false;

      if (!q) return true;
      const fullName = getFullName(p).toLowerCase();
      const idMatch = p.id.toLowerCase().includes(q);
      const birthMatch = p.birthYear?.toString().includes(q) || p.birthDate?.toLowerCase().includes(q);
      const placeMatch = p.birthPlace?.toLowerCase().includes(q) || p.deathPlace?.toLowerCase().includes(q);

      return fullName.includes(q) || idMatch || Boolean(birthMatch) || Boolean(placeMatch);
    });
  }, [pickerSearchQuery, genderFilter, effectiveDb.persons, person.id]);

  // Citations list formatted
  const personCitations = useMemo(() => {
    const list: Array<{ id?: string; sourceId?: string; title: string; page?: string; archiveRef?: string; url?: string }> = [];

    (person.citations || []).forEach((c, idx) => {
      const linkedSrc = c.sourceId ? (database.sources[c.sourceId] || sources?.[c.sourceId]) : null;
      list.push({
        id: `c_${idx}`,
        sourceId: c.sourceId,
        title: linkedSrc?.title || c.citation || c.title || 'Архівне свідоцтво / джерело',
        page: c.page || linkedSrc?.page,
        archiveRef: linkedSrc ? [linkedSrc.archive, linkedSrc.fund && `Ф. ${linkedSrc.fund}`, linkedSrc.inventory && `Оп. ${linkedSrc.inventory}`, linkedSrc.caseNumber && `Спр. ${linkedSrc.caseNumber}`].filter(Boolean).join(', ') : undefined,
        url: linkedSrc?.url
      });
    });

    // Also include from sourceIds if not already in citations
    (person.sourceIds || []).forEach((sId, idx) => {
      if (!list.some((l) => l.sourceId === sId)) {
        const src = database.sources[sId] || sources?.[sId];
        if (src) {
          list.push({
            id: `s_${idx}`,
            sourceId: sId,
            title: src.title || 'Першоджерело',
            page: src.page,
            archiveRef: [src.archive, src.fund && `Ф. ${src.fund}`, src.inventory && `Оп. ${src.inventory}`, src.caseNumber && `Спр. ${src.caseNumber}`].filter(Boolean).join(', '),
            url: src.url
          });
        }
      }
    });

    return list;
  }, [person.citations, person.sourceIds, database.sources, sources]);

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]`}>
        {/* Header Profile */}
        <div className={`p-5 sm:p-6 ${theme.surfaceBg} border-b ${theme.borderSubtle} flex items-start justify-between gap-3 shrink-0`}>
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            {isMasked ? (
              <div
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center border shadow-inner shrink-0 ${
                  isDark ? 'bg-emerald-950/70 border-emerald-800 text-emerald-400' : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                }`}
              >
                <Shield className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
            ) : person.avatarUrl || person.avatar || person.photoUrl ? (
              <img
                src={person.avatarUrl || person.avatar || person.photoUrl}
                alt={getFullName(person)}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border ${theme.borderSubtle} shadow-md shrink-0`}
              />
            ) : (
              <div
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center border shadow-inner shrink-0 ${
                  isMale
                    ? isDark ? 'bg-blue-950/60 border-blue-800 text-blue-300' : 'bg-blue-100 border-blue-300 text-blue-700'
                    : isFemale
                    ? isDark ? 'bg-rose-950/60 border-rose-800 text-rose-300' : 'bg-rose-100 border-rose-300 text-rose-700'
                    : isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-neutral-200 border-neutral-300 text-neutral-600'
                }`}
              >
                <User className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 ${isDark ? 'bg-slate-800 text-emerald-400' : 'bg-neutral-200 text-emerald-800'} rounded`}>
                  {isMasked ? '🔒 Захищено' : person.id}
                </span>
                {isMasked && (
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700/60 rounded font-medium flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" /> Жива особа
                  </span>
                )}
                {!isMasked && person.name?.prefix && (
                  <span className={`text-[10px] font-serif px-2 py-0.5 ${isDark ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60' : 'bg-amber-100 text-amber-800 border border-amber-300'} rounded`}>
                    {person.name.prefix}
                  </span>
                )}
                {!isMasked && estate && (
                  <span className={`text-[10px] px-2 py-0.5 ${isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-neutral-100 text-neutral-700 border border-neutral-300'} rounded`}>
                    {estate}
                  </span>
                )}
                {!isMasked && person.confession && (
                  <span className={`text-[10px] px-2 py-0.5 ${isDark ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/60' : 'bg-indigo-100 text-indigo-800 border border-indigo-300'} rounded`}>
                    {person.confession}
                  </span>
                )}
              </div>
              <h2 className={`text-lg sm:text-xl font-bold ${theme.textPrimary} mt-1 truncate`}>
                {isMasked ? 'Скрито Скрито' : getFullName(person)}
              </h2>
              {!isMasked && (person.name?.maidenName || person.maidenName) && (
                <p className={`text-xs ${theme.textMuted} truncate`}>
                  Дівоче прізвище: {person.name?.maidenName || person.maidenName}
                </p>
              )}
              <div className={`flex items-center gap-2 text-xs ${theme.textSecondary} font-mono mt-1`}>
                <Calendar className={`w-3.5 h-3.5 ${theme.textMuted}`} />
                <span>
                  {isMasked
                    ? '🔒 Конфіденційні дані (Жива особа)'
                    : `${person.birthDate || person.birthYear || '?'} — ${person.isLiving ? 'донині' : person.deathDate || person.deathYear || '?'}`}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 ${theme.textMuted} hover:${theme.textPrimary} ${theme.cardBgHover} rounded-xl transition-colors cursor-pointer shrink-0`}
            title="Закрити картку"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Toolbar */}
        <div className={`px-5 sm:px-6 py-2.5 ${theme.cardBg} border-b ${theme.borderSubtle} flex flex-wrap items-center justify-between gap-2 text-xs shrink-0`}>
          <div className="flex items-center gap-2">
            {/* Tree Navigation Icon Button */}
            <button
              onClick={() => {
                onChangeRoot?.(rawPerson.id);
                onClose();
              }}
              className={`p-2 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} hover:bg-emerald-600 hover:text-white ${theme.textPrimary} transition-all cursor-pointer shadow-xs`}
              title="Перейти до родинного дерева"
              aria-label="Перейти до дерева"
            >
              <GitFork className="w-4 h-4 text-emerald-500 hover:text-white" />
            </button>

            {/* Calculate Kinship Button */}
            <button
              onClick={() => {
                onOpenKinshipWith?.(rawPerson.id);
                onClose();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${theme.surfaceBg} hover:opacity-80 ${theme.textPrimary} border ${theme.borderSubtle} rounded-xl transition-colors cursor-pointer`}
              title="Розрахувати ступінь спорідненості"
            >
              <Compass className="w-3.5 h-3.5 text-sky-500" />
              <span>Спорідненість</span>
            </button>
          </div>

          {!isReadOnly && !isMasked && (
            <div className="flex items-center gap-2">
              {/* Classic Compact Living Status Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(rawPerson.isLiving)}
                onClick={() => {
                  const newStatus = !rawPerson.isLiving;
                  updatePerson({
                    ...rawPerson,
                    isLiving: newStatus
                  });
                }}
                className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} hover:opacity-95 transition-all cursor-pointer shadow-2xs select-none`}
                title={rawPerson.isLiving ? 'Статус: Жива особа (натисніть, щоб позначити померлою)' : 'Статус: Померла особа (натисніть, щоб позначити живою)'}
              >
                <span
                  className={`relative inline-flex h-4.5 w-8 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    rawPerson.isLiving ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                      rawPerson.isLiving ? 'translate-x-3.5' : 'translate-x-0'
                    }`}
                  />
                </span>
                <span className={`text-[11px] font-medium ${rawPerson.isLiving ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : theme.textSecondary}`}>
                  {rawPerson.isLiving ? 'Жива особа' : 'Померла особа'}
                </span>
              </button>

              {onEditPerson && (
                <button
                  onClick={() => onEditPerson(person.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 ${theme.surfaceBg} hover:opacity-80 text-amber-600 dark:text-amber-400 border ${theme.borderSubtle} rounded-xl transition-colors cursor-pointer font-medium`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Редагувати анкету</span>
                </button>
              )}
              {onDeletePerson && (
                <button
                  type="button"
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  className={`p-1.5 ${theme.textMuted} hover:text-rose-500 rounded-xl transition-colors cursor-pointer`}
                  title="Видалити особу"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Body Content */}
        {isMasked ? (
          <div className="p-8 sm:p-10 text-center flex flex-col items-center justify-center space-y-4 my-auto">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-inner ${
              isDark ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              <Shield className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className={`text-base sm:text-lg font-bold ${theme.textPrimary}`}>
                🔒 Конфіденційні дані живої особи
              </h3>
              <p className={`text-xs ${theme.textMuted} max-w-md mx-auto leading-relaxed`}>
                Відповідно до налаштувань безпеки та приватності родоводу, персональні відомості, біографія, дати та першоджерела живих осіб захищені. Повний доступ мають лише авторизовані родичі з білого списку.
              </p>
            </div>
            <div className="flex items-center gap-2.5 pt-2">
              <button
                onClick={() => {
                  onChangeRoot?.(rawPerson.id);
                  onClose();
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold ${theme.surfaceBg} hover:bg-emerald-600 hover:text-white ${theme.textPrimary} border ${theme.borderSubtle} transition-all flex items-center gap-2 cursor-pointer shadow-xs`}
              >
                <GitFork className="w-4 h-4 text-emerald-500" />
                <span>Відкрити зв'язки у дереві</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-xs"
              >
                Зрозуміло
              </button>
            </div>
          </div>
        ) : (
          <div className={`p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 ${theme.textPrimary} scrollbar-thin`}>
          {/* SECTION 1: Status & Attributes */}
          <div className={`p-3.5 ${theme.surfaceBg} rounded-2xl border ${theme.borderSubtle} space-y-3`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold ${theme.textMuted} uppercase tracking-wider block`}>
                Біографічні та станові відомості:
              </span>
              {!isReadOnly && onEditPerson && (
                <button
                  type="button"
                  onClick={() => onEditPerson(person.id)}
                  className="text-[11px] text-[#B88E3E] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Змінити</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500 shrink-0" />
                <div className="min-w-0">
                  <span className={`${theme.textMuted} block text-[10px]`}>Статус життя:</span>
                  {!isReadOnly ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(rawPerson.isLiving)}
                      onClick={() => {
                        const newStatus = !rawPerson.isLiving;
                        updatePerson({
                          ...rawPerson,
                          isLiving: newStatus
                        });
                      }}
                      className="inline-flex items-center gap-2 mt-0.5 cursor-pointer select-none group"
                      title={rawPerson.isLiving ? 'Статус: Жива особа (натисніть, щоб позначити померлою)' : 'Статус: Померла особа (натисніть, щоб позначити живою)'}
                    >
                      <span
                        className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          rawPerson.isLiving ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                            rawPerson.isLiving ? 'translate-x-3' : 'translate-x-0'
                          }`}
                        />
                      </span>
                      <span className={`text-xs font-semibold ${rawPerson.isLiving ? 'text-emerald-600 dark:text-emerald-400' : theme.textSecondary}`}>
                        {rawPerson.isLiving ? 'Жива особа' : 'Померла особа'}
                      </span>
                    </button>
                  ) : (
                    <span className={`font-medium ${theme.textPrimary}`}>
                      {rawPerson.isLiving ? 'Жива особа' : 'Померла особа'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <span className={`${theme.textMuted} block text-[10px]`}>Рід занять / Фах:</span>
                  <span className={`font-medium ${theme.textPrimary} truncate`}>{person.occupation || '—'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-sky-500 shrink-0" />
                <div className="min-w-0">
                  <span className={`${theme.textMuted} block text-[10px]`}>Стан / Соціальний статус:</span>
                  <span className={`font-medium ${theme.textPrimary} truncate`}>{estate || '—'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <span className={`${theme.textMuted} block text-[10px]`}>Військовий чин / Звання:</span>
                  <span className={`font-medium ${theme.textPrimary} truncate`}>{person.militaryRank || '—'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <span className={`${theme.textMuted} block text-[10px]`}>Віросповідання / Конфесія:</span>
                  <span className={`font-medium ${theme.textPrimary} truncate`}>{person.confession || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Parents Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>
                Батьки:
              </span>
              {!isReadOnly && onOpenRelationManager && (
                <button
                  type="button"
                  onClick={() => onOpenRelationManager(person.id)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-lg flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors cursor-pointer`}
                >
                  <UserPlus className="w-3 h-3" />
                  <span>Менеджер родоводу</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Father Card */}
              <div
                className={`p-3.5 rounded-2xl border text-xs transition-all relative group ${
                  father
                    ? `${theme.surfaceBg} ${isDark ? 'border-blue-900/40 hover:border-blue-700' : 'border-blue-200 hover:border-blue-400 shadow-xs'}`
                    : `${theme.surfaceBg} border-dashed ${isDark ? 'border-slate-700' : 'border-neutral-300'}`
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[11px] ${isDark ? 'text-blue-400' : 'text-blue-700'} font-bold flex items-center gap-1.5`}>
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    Батько
                  </span>

                  {!isReadOnly && father && (
                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      {onEditPerson && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditPerson(father.id);
                          }}
                          className="p-1 rounded hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer"
                          title="Редагувати дані батька"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setParentPicker({ isOpen: true, type: 'father' });
                          setGenderFilter('male');
                        }}
                        className="p-1 rounded hover:bg-sky-500/10 text-sky-600 dark:text-sky-400 transition-colors cursor-pointer"
                        title="Змінити батька (обрати іншого)"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnlinkParent('father');
                        }}
                        className="p-1 rounded hover:bg-rose-500/10 text-rose-500 transition-colors cursor-pointer"
                        title="Від'єднати батька"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {father ? (
                  <div
                    onClick={() => onSelectPerson && onSelectPerson(father.id)}
                    className="cursor-pointer group/link hover:opacity-90 transition-opacity"
                  >
                    <div className={`font-bold ${theme.textPrimary} text-[13px] leading-tight group-hover/link:text-blue-500 transition-colors truncate`}>
                      {getFullName(father)}
                    </div>
                    <div className={`text-[11px] ${theme.textMuted} font-mono mt-0.5`}>
                      {father.birthYear || father.birthDate || '?'} — {father.deathYear || father.deathDate || (father.isLiving ? 'донині' : '?')}
                    </div>
                    {father.occupation && (
                      <div className={`text-[10px] ${theme.textSecondary} truncate mt-0.5 italic`}>
                        {father.occupation}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 py-1">
                    <div className={`text-[11px] ${theme.textMuted} italic`}>Батько не вказаний</div>
                    {!isReadOnly && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setParentPicker({ isOpen: true, type: 'father' });
                            setGenderFilter('male');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                        >
                          <Search className="w-3 h-3" />
                          <span>Обрати з бази</span>
                        </button>
                        {onAddRelation && (
                          <button
                            type="button"
                            onClick={() => onAddRelation('father', person.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Створити</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Mother Card */}
              <div
                className={`p-3.5 rounded-2xl border text-xs transition-all relative group ${
                  mother
                    ? `${theme.surfaceBg} ${isDark ? 'border-rose-900/40 hover:border-rose-700' : 'border-rose-200 hover:border-rose-400 shadow-xs'}`
                    : `${theme.surfaceBg} border-dashed ${isDark ? 'border-slate-700' : 'border-neutral-300'}`
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[11px] ${isDark ? 'text-rose-400' : 'text-rose-700'} font-bold flex items-center gap-1.5`}>
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    Мати
                  </span>

                  {!isReadOnly && mother && (
                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      {onEditPerson && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditPerson(mother.id);
                          }}
                          className="p-1 rounded hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer"
                          title="Редагувати дані матері"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setParentPicker({ isOpen: true, type: 'mother' });
                          setGenderFilter('female');
                        }}
                        className="p-1 rounded hover:bg-sky-500/10 text-sky-600 dark:text-sky-400 transition-colors cursor-pointer"
                        title="Змінити матір (обрати іншу)"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnlinkParent('mother');
                        }}
                        className="p-1 rounded hover:bg-rose-500/10 text-rose-500 transition-colors cursor-pointer"
                        title="Від'єднати матір"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {mother ? (
                  <div
                    onClick={() => onSelectPerson && onSelectPerson(mother.id)}
                    className="cursor-pointer group/link hover:opacity-90 transition-opacity"
                  >
                    <div className={`font-bold ${theme.textPrimary} text-[13px] leading-tight group-hover/link:text-rose-500 transition-colors truncate`}>
                      {getFullName(mother)}
                    </div>
                    <div className={`text-[11px] ${theme.textMuted} font-mono mt-0.5`}>
                      {mother.birthYear || mother.birthDate || '?'} — {mother.deathYear || mother.deathDate || (mother.isLiving ? 'донині' : '?')}
                    </div>
                    {(mother.name?.maidenName || mother.maidenName) && (
                      <div className={`text-[10px] ${theme.textSecondary} truncate mt-0.5`}>
                        Дівоче: {mother.name?.maidenName || mother.maidenName}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 py-1">
                    <div className={`text-[11px] ${theme.textMuted} italic`}>Мати не вказана</div>
                    {!isReadOnly && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setParentPicker({ isOpen: true, type: 'mother' });
                            setGenderFilter('female');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                        >
                          <Search className="w-3 h-3" />
                          <span>Обрати з бази</span>
                        </button>
                        {onAddRelation && (
                          <button
                            type="button"
                            onClick={() => onAddRelation('mother', person.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Створити</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION: Siblings (Брати та сестри) with Fold/Unfold */}
          <div className={`p-4 ${theme.surfaceBg} rounded-2xl border ${theme.borderSubtle} space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                <span className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider`}>
                  Брати та сестри ({siblings.length}):
                </span>
                {siblings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsSiblingsCollapsed(!isSiblingsCollapsed)}
                    className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                      isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                    } transition-colors cursor-pointer`}
                    title={isSiblingsCollapsed ? 'Розгорнути список братів/сестер' : 'Згорнути список братів/сестер'}
                  >
                    {isSiblingsCollapsed ? (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        <span>Показати</span>
                      </>
                    ) : (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        <span>Сховати</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {!isReadOnly && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSiblingPicker({ isOpen: true, gender: 'male' });
                      setGenderFilter('male');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                    title="Додати брата з бази"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Брат</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSiblingPicker({ isOpen: true, gender: 'female' });
                      setGenderFilter('female');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                    title="Додати сестру з бази"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Сестра</span>
                  </button>

                  {onAddRelation && (
                    <button
                      type="button"
                      onClick={() => onAddRelation('sibling', person.id)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      title="Створити нову особу як брата/сестру"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>+ Створити</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {!isSiblingsCollapsed && (
              <div>
                {siblings.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {siblings.map(({ person: sib, label }) => {
                      const isSibMale = sib.gender === 'male' || sib.gender === 'M';
                      return (
                        <div
                          key={sib.id}
                          className={`p-2.5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} flex items-center justify-between gap-2.5 group/sib transition-all hover:border-amber-500/40`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectPerson && onSelectPerson(sib.id)}
                            className="flex items-center gap-2.5 text-left min-w-0 flex-1 cursor-pointer"
                          >
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                isSibMale
                                  ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              {isSibMale ? 'Ч' : 'Ж'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-bold ${theme.textPrimary} group-hover/sib:text-amber-500 transition-colors truncate`}>
                                  {getFullName(sib)}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                  isSibMale
                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                }`}>
                                  {label}
                                </span>
                              </div>
                              <div className={`text-[10px] ${theme.textMuted} font-mono mt-0.5`}>
                                {sib.birthYear || sib.birthDate || '?'} — {sib.isLiving ? 'донині' : sib.deathYear || sib.deathDate || '?'}
                                {sib.occupation ? ` • ${sib.occupation}` : ''}
                              </div>
                            </div>
                          </button>

                          {!isReadOnly && (
                            <div className="flex items-center gap-1 opacity-80 group-hover/sib:opacity-100">
                              {onEditPerson && (
                                <button
                                  type="button"
                                  onClick={() => onEditPerson(sib.id)}
                                  className="p-1 rounded text-amber-500 hover:bg-amber-500/10 cursor-pointer"
                                  title="Редагувати анкету"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  handleUnlinkSibling(sib.id);
                                }}
                                className="p-1 rounded text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                title="Від'єднати"
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`p-3 rounded-xl border border-dashed ${theme.borderSubtle} text-center space-y-1.5`}>
                    <p className={`text-xs ${theme.textMuted} italic`}>Братів та сестер для цієї особи ще не вказано</p>
                    {!isReadOnly && (
                      <div className="flex justify-center items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSiblingPicker({ isOpen: true, gender: 'male' });
                            setGenderFilter('male');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold cursor-pointer"
                        >
                          + Додати брата
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSiblingPicker({ isOpen: true, gender: 'female' });
                            setGenderFilter('female');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer"
                        >
                          + Додати сестру
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: Families, Spouses & Children */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" />
                <span className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>
                  Сім'ї, подружжя ({spouseFamilies.length + directSpouses.length}) та діти:
                </span>
              </div>

              {!isReadOnly && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSpousePicker(true);
                      setGenderFilter(isMale ? 'female' : 'male');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                    title={spouseFamilies.length > 0 ? "Додати друге/наступне подружжя" : "Додати подружжя"}
                  >
                    <Plus className="w-3 h-3" />
                    <span>{spouseFamilies.length > 0 ? '+ Друге подружжя' : '+ Подружжя'}</span>
                  </button>

                  {onAddRelation && (
                    <button
                      type="button"
                      onClick={() => onAddRelation('spouse', person.id)}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      title="Створити нову особу як дружину/чоловіка"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>+ Створити подружжя</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setChildPicker({ isOpen: true });
                      setGenderFilter('all');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Дитина</span>
                  </button>
                </div>
              )}
            </div>

            {/* Families List */}
            {spouseFamilies.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                {spouseFamilies.map((fam, idx) => {
                  const spouseId = fam.husbandId === person.id ? fam.wifeId : fam.husbandId;
                  const spouse = spouseId ? (effectiveDb.persons[spouseId] || persons.find((p) => p.id === spouseId)) : null;

                  return (
                    <div
                      key={fam.id}
                      className={`p-4 ${theme.surfaceBg} rounded-2xl border ${theme.borderSubtle} space-y-3 shadow-xs`}
                    >
                      {/* Family Header: Spouse info & Marriage dates */}
                      <div className={`flex flex-wrap items-center justify-between gap-2 text-xs border-b ${theme.borderSubtle} pb-2.5`}>
                        <div className="flex items-center gap-2">
                          <Heart className="w-4 h-4 text-rose-500 shrink-0" />
                          <span className={`${theme.textMuted} font-semibold`}>
                            {spouseFamilies.length > 1 ? `${idx + 1}-й союз / подружжя:` : 'Подружжя:'}
                          </span>
                          {spouse ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => onSelectPerson && onSelectPerson(spouse.id)}
                                className={`font-bold ${theme.textPrimary} hover:text-emerald-500 cursor-pointer`}
                              >
                                {getFullName(spouse)}
                              </button>
                              {!spouse.isLiving && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                                  Помер(ла)
                                </span>
                              )}
                              {!isReadOnly && onEditPerson && (
                                <button
                                  type="button"
                                  onClick={() => onEditPerson(spouse.id)}
                                  className="p-1 rounded text-amber-500 hover:bg-amber-500/10 cursor-pointer"
                                  title="Редагувати анкету подружжя"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleUnlinkSpouse(spouse.id, fam.id);
                                  }}
                                  className="p-1 rounded text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                  title="Від'єднати подружжя"
                                >
                                  <Unlink className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className={`italic ${theme.textMuted}`}>Не вказано</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {fam.marriageDate ? (
                            <span className={`text-[11px] ${theme.textMuted} font-mono bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded`}>
                              Шлюб: {fam.marriageDate} {fam.marriagePlace ? `(${fam.marriagePlace})` : ''}
                            </span>
                          ) : null}

                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() =>
                                setFamilyMarriageEditor({
                                  isOpen: true,
                                  familyId: fam.id,
                                  marriageDate: fam.marriageDate || '',
                                  marriagePlace: fam.marriagePlace || ''
                                })
                              }
                              className="px-2 py-0.5 rounded text-[10px] text-sky-600 dark:text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 font-medium cursor-pointer"
                            >
                              {fam.marriageDate ? 'Ред. шлюб' : '+ Дата шлюбу'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Children in this family */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[11px] font-semibold ${theme.textMuted}`}>
                            Діти ({fam.children?.length || 0}):
                          </span>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => {
                                setChildPicker({ isOpen: true, familyId: fam.id });
                                setGenderFilter('all');
                              }}
                              className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Додати дитину в сім'ю</span>
                            </button>
                          )}
                        </div>

                        {(!fam.children || fam.children.length === 0) ? (
                          <div className={`p-2.5 rounded-xl border border-dashed ${theme.borderSubtle} text-center text-[11px] ${theme.textMuted} italic`}>
                            Дітей у цьому союзі ще не вказано
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {fam.children.map((c) => {
                              const child = effectiveDb.persons[c.personId] || persons.find((p) => p.id === c.personId);
                              if (!child) return null;
                              return (
                                <div
                                  key={child.id}
                                  className={`p-2 rounded-xl ${theme.cardBg} border ${theme.cardBorder} flex items-center justify-between gap-2 group/child`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => onSelectPerson && onSelectPerson(child.id)}
                                    className={`text-left text-xs font-semibold ${theme.textPrimary} hover:text-emerald-500 transition-colors truncate cursor-pointer flex-1`}
                                  >
                                    <div className="truncate">{getFullName(child)}</div>
                                    <div className={`text-[10px] ${theme.textMuted} font-mono`}>
                                      {child.birthYear || child.birthDate || '?'} — {child.isLiving ? 'донині' : child.deathYear || '?'}
                                    </div>
                                  </button>

                                  {!isReadOnly && (
                                    <div className="flex items-center gap-1 opacity-80 group-hover/child:opacity-100">
                                      {onEditPerson && (
                                        <button
                                          type="button"
                                          onClick={() => onEditPerson(child.id)}
                                          className="p-1 rounded text-amber-500 hover:bg-amber-500/10 cursor-pointer"
                                          title="Редагувати анкету дитини"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleUnlinkChild(child.id, fam.id);
                                        }}
                                        className="p-1 rounded text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                        title="Від'єднати дитину"
                                      >
                                        <Unlink className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : directSpouses.length > 0 || directChildren.length > 0 ? (
              <div className={`p-4 ${theme.surfaceBg} rounded-2xl border ${theme.borderSubtle} space-y-3`}>
                {directSpouses.length > 0 && (
                  <div>
                    <span className={`text-[11px] font-semibold ${theme.textMuted} block mb-1.5`}>Подружжя:</span>
                    <div className="flex flex-wrap gap-2">
                      {directSpouses.map((s) => (
                        <div key={s.id} className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/5 border text-xs">
                          <button onClick={() => onSelectPerson && onSelectPerson(s.id)} className="font-bold hover:underline cursor-pointer">
                            {getFullName(s)}
                          </button>
                          {!isReadOnly && (
                            <button onClick={() => handleUnlinkSpouse(s.id)} className="text-rose-500 p-0.5 hover:opacity-80 cursor-pointer">
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {directChildren.length > 0 && (
                  <div>
                    <span className={`text-[11px] font-semibold ${theme.textMuted} block mb-1.5`}>Діти:</span>
                    <div className="flex flex-wrap gap-2">
                      {directChildren.map((c) => (
                        <div key={c.id} className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/5 border text-xs">
                          <button onClick={() => onSelectPerson && onSelectPerson(c.id)} className="font-bold hover:underline cursor-pointer">
                            {getFullName(c)}
                          </button>
                          {!isReadOnly && (
                            <button onClick={() => handleUnlinkChild(c.id)} className="text-rose-500 p-0.5 hover:opacity-80 cursor-pointer">
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={`p-4 rounded-2xl border border-dashed ${theme.borderSubtle} ${theme.surfaceBg} text-center space-y-2`}>
                <p className={`text-xs ${theme.textMuted} italic`}>Сімейні зв'язки та діти ще не внесені</p>
                {!isReadOnly && (
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSpousePicker(true);
                        setGenderFilter(isMale ? 'female' : 'male');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold cursor-pointer"
                    >
                      + Додати подружжя
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChildPicker({ isOpen: true });
                        setGenderFilter('all');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold cursor-pointer"
                    >
                      + Додати дитину
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 4: Life Events */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-500" />
                <span className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>
                  Події життя ({person.events?.length || 0}):
                </span>
              </div>

              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() =>
                    setEventModal({
                      isOpen: true,
                      type: 'Народження',
                      date: '',
                      year: '',
                      placeName: '',
                      description: ''
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Додати подію</span>
                </button>
              )}
            </div>

            {person.events && person.events.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {person.events.map((ev: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3.5 ${theme.surfaceBg} rounded-2xl border ${theme.borderSubtle} text-xs space-y-1 relative group/ev`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[13px]">
                          {ev.date || (ev.year ? `${ev.year} р.` : 'Дата не вказана')}
                        </span>
                        <span className={`font-bold px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 ${theme.textPrimary}`}>
                          {ev.type || 'Подія'}
                        </span>
                      </div>

                      {!isReadOnly && (
                        <div className="flex items-center gap-1 opacity-80 group-hover/ev:opacity-100">
                          <button
                            type="button"
                            onClick={() =>
                              setEventModal({
                                isOpen: true,
                                editIndex: idx,
                                type: ev.type || 'Подія',
                                date: ev.date || '',
                                year: ev.year?.toString() || '',
                                placeName: ev.placeName || '',
                                description: ev.description || ''
                              })
                            }
                            className="p-1 rounded text-amber-500 hover:bg-amber-500/10 cursor-pointer"
                            title="Редагувати подію"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleDeleteEvent(idx);
                            }}
                            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                            title="Видалити подію"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {ev.placeName && (
                      <div className={`flex items-center gap-1.5 text-[11px] ${theme.textMuted} pt-0.5`}>
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>{ev.placeName}</span>
                      </div>
                    )}

                    {ev.description && <p className={`${theme.textSecondary} text-[11px] pt-1 leading-relaxed`}>{ev.description}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className={`p-3.5 rounded-2xl border border-dashed ${theme.borderSubtle} ${theme.surfaceBg} text-center`}>
                <span className={`text-xs ${theme.textMuted} italic`}>Події життя ще не зафіксовані</span>
              </div>
            )}
          </div>

          {/* SECTION 5: Archive Notes and Sources */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#B88E3E]" />
                <span className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>
                  Архівні примітки та джерела:
                </span>
              </div>

              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() =>
                    setSourceModal({
                      isOpen: true,
                      mode: 'create_new',
                      selectedExistingSourceId: '',
                      title: '',
                      archive: '',
                      fund: '',
                      inventory: '',
                      caseNumber: '',
                      page: '',
                      date: '',
                      transcription: '',
                      url: ''
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-[#B88E3E]/15 hover:bg-[#B88E3E]/25 text-[#B88E3E] text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <FilePlus className="w-3 h-3" />
                  <span>+ Додати джерело</span>
                </button>
              )}
            </div>

            {/* Research Notes Block */}
            <div className={`p-4 ${theme.surfaceBg} rounded-2xl border ${theme.borderSubtle} space-y-2`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold ${theme.textMuted} flex items-center gap-1.5`}>
                  <FileText className="w-3.5 h-3.5 text-[#B88E3E]" />
                  Дослідницькі та архівні примітки
                </span>

                {!isReadOnly && !isEditingNotes && (
                  <button
                    type="button"
                    onClick={() => {
                      setNotesDraft(typeof person.notes === 'string' ? person.notes : '');
                      setIsEditingNotes(true);
                    }}
                    className="text-[11px] text-[#B88E3E] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{person.notes ? 'Редагувати' : '+ Додати примітку'}</span>
                  </button>
                )}
              </div>

              {isEditingNotes ? (
                <div className="space-y-2 pt-1">
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={4}
                    placeholder="Введіть архівні витяги, номери справ, посилання на метричні книги чи примітки дослідника..."
                    className={`w-full p-3 rounded-xl text-xs border ${theme.borderSubtle} ${theme.cardBg} ${theme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#B88E3E] leading-relaxed`}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingNotes(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs ${theme.textSecondary} hover:${theme.textPrimary} cursor-pointer`}
                    >
                      Скасувати
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      className="px-3.5 py-1.5 rounded-lg bg-[#B88E3E] hover:bg-[#a07a32] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Зберегти примітки</span>
                    </button>
                  </div>
                </div>
              ) : person.notes ? (
                <p className={`text-xs ${theme.textSecondary} leading-relaxed whitespace-pre-wrap`}>
                  {typeof person.notes === 'string'
                    ? person.notes
                    : Array.isArray(person.notes)
                    ? (person.notes as any[]).join('\n')
                    : JSON.stringify(person.notes)}
                </p>
              ) : (
                <p className={`text-[11px] ${theme.textMuted} italic`}>Архівних приміток ще не додано.</p>
              )}
            </div>

            {/* Citations & Sources List */}
            {personCitations.length > 0 ? (
              <div className="space-y-2">
                <span className={`text-[11px] font-bold ${theme.textMuted} block`}>
                  Прив'язані джерела та архівні документи ({personCitations.length}):
                </span>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                  {personCitations.map((c, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl ${theme.surfaceBg} border ${theme.borderSubtle} flex items-start justify-between gap-3 group/cite`}
                    >
                      <div className="space-y-0.5 text-xs min-w-0">
                        <div className={`font-bold ${theme.textPrimary} flex items-center gap-1.5`}>
                          <BookOpen className="w-3.5 h-3.5 text-[#B88E3E] shrink-0" />
                          <span className="truncate">{c.title}</span>
                        </div>
                        {c.archiveRef && <div className={`text-[11px] ${theme.textSecondary}`}>{c.archiveRef}</div>}
                        {c.page && <div className={`text-[10px] ${theme.textMuted} font-mono`}>Аркуш/Сторінка: {c.page}</div>}
                        {c.url && (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-sky-500 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Переглянути документ / скан</span>
                          </a>
                        )}
                      </div>

                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCitation(idx)}
                          className="p-1 rounded text-rose-500 hover:bg-rose-500/10 opacity-80 group-hover/cite:opacity-100 transition-opacity cursor-pointer"
                          title="Від'єднати джерело"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* SECTION: Archive Documents, Photos & GitHub Sync */}
          <PersonDocumentsSection
            person={person}
            onUpdatePerson={(updatedPerson) => updatePerson(updatedPerson)}
            isReadOnly={isReadOnly}
            themePalette={themePalette}
            isDark={isDark}
          />

          {/* SECTION 6: Biography */}
          <div className={`p-4 ${theme.surfaceBg} rounded-2xl border ${theme.borderSubtle} space-y-2`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold ${theme.textMuted} uppercase tracking-wider block`}>
                Життєпис / Біографічна довідка:
              </span>

              {!isReadOnly && !isEditingBio && (
                <button
                  type="button"
                  onClick={() => {
                    setBioDraft(person.bio || '');
                    setIsEditingBio(true);
                  }}
                  className="text-[11px] text-[#B88E3E] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>{person.bio ? 'Редагувати' : '+ Додати життєпис'}</span>
                </button>
              )}
            </div>

            {isEditingBio ? (
              <div className="space-y-2 pt-1">
                <textarea
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  rows={4}
                  placeholder="Введіть повний життєпис, спогади родичів, перекази або факти з життя особи..."
                  className={`w-full p-3 rounded-xl text-xs border ${theme.borderSubtle} ${theme.cardBg} ${theme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#B88E3E] leading-relaxed`}
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingBio(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs ${theme.textSecondary} hover:${theme.textPrimary} cursor-pointer`}
                  >
                    Скасувати
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBio}
                    className="px-3.5 py-1.5 rounded-lg bg-[#B88E3E] hover:bg-[#a07a32] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Зберегти життєпис</span>
                  </button>
                </div>
              </div>
            ) : person.bio ? (
              <p className={`text-xs ${theme.textPrimary} leading-relaxed whitespace-pre-wrap`}>{person.bio}</p>
            ) : (
              <p className={`text-[11px] ${theme.textMuted} italic`}>Життєпис ще не заповнено.</p>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Universal Person Picker Dialog (Parent / Sibling / Child / Spouse) */}
      {(parentPicker?.isOpen || siblingPicker?.isOpen || childPicker?.isOpen || spousePicker) && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]`}>
            {/* Header */}
            <div className={`p-4 border-b ${theme.borderSubtle} flex items-center justify-between ${isDark ? 'bg-slate-900/90' : 'bg-neutral-50'}`}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${theme.textPrimary}`}>
                    {parentPicker?.isOpen
                      ? parentPicker.type === 'father'
                        ? 'Вибрати батька'
                        : 'Вибрати матір'
                      : siblingPicker?.isOpen
                      ? siblingPicker.gender === 'male'
                        ? 'Вибрати брата'
                        : 'Вибрати сестру'
                      : spousePicker
                      ? 'Вибрати чоловіка / дружину'
                      : 'Вибрати дитину'}
                  </h3>
                  <p className={`text-[11px] ${theme.textMuted}`}>
                    Для особи: <span className="font-bold text-emerald-600 dark:text-emerald-400">{getFullName(person)}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setParentPicker(null);
                  setSiblingPicker(null);
                  setChildPicker(null);
                  setSpousePicker(false);
                  setPickerSearchQuery('');
                }}
                className={`p-1.5 rounded-lg ${theme.textMuted} hover:${theme.textPrimary} transition-colors`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search and Filters */}
            <div className={`p-3 border-b ${theme.borderSubtle} space-y-2`}>
              <div className="relative">
                <Search className={`w-4 h-4 absolute left-3 top-2.5 ${theme.textMuted}`} />
                <input
                  type="text"
                  value={pickerSearchQuery}
                  onChange={(e) => setPickerSearchQuery(e.target.value)}
                  placeholder="Пошук за прізвищем, ім'ям, роком чи ID..."
                  autoFocus
                  className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                />
                {pickerSearchQuery && (
                  <button
                    onClick={() => setPickerSearchQuery('')}
                    className={`absolute right-2.5 top-2.5 text-xs ${theme.textMuted} hover:${theme.textPrimary}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px]">
                <span className={`${theme.textMuted} text-[10px] uppercase font-semibold mr-1`}>Фільтр:</span>
                <button
                  type="button"
                  onClick={() => setGenderFilter('male')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    genderFilter === 'male' ? 'bg-blue-600 text-white' : `${theme.surfaceBg} ${theme.textSecondary} border ${theme.borderSubtle}`
                  }`}
                >
                  Чоловіки
                </button>
                <button
                  type="button"
                  onClick={() => setGenderFilter('female')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    genderFilter === 'female' ? 'bg-rose-600 text-white' : `${theme.surfaceBg} ${theme.textSecondary} border ${theme.borderSubtle}`
                  }`}
                >
                  Жінки
                </button>
                <button
                  type="button"
                  onClick={() => setGenderFilter('all')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    genderFilter === 'all' ? 'bg-emerald-600 text-white' : `${theme.surfaceBg} ${theme.textSecondary} border ${theme.borderSubtle}`
                  }`}
                >
                  Всі
                </button>
              </div>
            </div>

            {/* Candidates List */}
            <div className="p-3 overflow-y-auto flex-1 divide-y divide-neutral-200 dark:divide-slate-800/60 space-y-1 custom-scrollbar">
              {filteredCandidates.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <User className={`w-8 h-8 mx-auto ${theme.textMuted} opacity-40`} />
                  <div className={`text-xs ${theme.textMuted}`}>
                    {pickerSearchQuery ? 'Не знайдено жодної особи за цим запитом' : 'Немає доступних кандидатів'}
                  </div>
                </div>
              ) : (
                filteredCandidates.map((candidate) => {
                  const isCandMale = candidate.gender === 'male' || candidate.gender === 'M';
                  return (
                    <div
                      key={candidate.id}
                      className={`p-2.5 rounded-xl hover:${theme.surfaceBg} flex items-center justify-between gap-3 transition-colors cursor-pointer border border-transparent hover:${theme.borderSubtle}`}
                      onClick={() => {
                        if (parentPicker?.isOpen) {
                          handleLinkParent(parentPicker.type, candidate.id);
                        } else if (siblingPicker?.isOpen) {
                          handleLinkSibling(candidate.id);
                        } else if (childPicker?.isOpen) {
                          handleLinkChild(candidate.id, childPicker.familyId);
                        } else if (spousePicker) {
                          handleLinkSpouse(candidate.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            isCandMale
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {isCandMale ? 'Ч' : 'Ж'}
                        </div>
                        <div className="min-w-0">
                          <div className={`text-xs font-bold ${theme.textPrimary} truncate`}>
                            {getFullName(candidate)}
                          </div>
                          <div className={`text-[10px] ${theme.textMuted} font-mono flex items-center gap-1.5`}>
                            <span>
                              {candidate.birthYear || candidate.birthDate || '?'} — {candidate.deathYear || candidate.deathDate || (candidate.isLiving ? 'живий(а)' : '?')}
                            </span>
                            <span className="opacity-50">•</span>
                            <span className="opacity-75">{candidate.id}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (parentPicker?.isOpen) {
                            handleLinkParent(parentPicker.type, candidate.id);
                          } else if (siblingPicker?.isOpen) {
                            handleLinkSibling(candidate.id);
                          } else if (childPicker?.isOpen) {
                            handleLinkChild(candidate.id, childPicker.familyId);
                          } else if (spousePicker) {
                            handleLinkSpouse(candidate.id);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors shadow-xs cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Обрати</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className={`p-3 border-t ${theme.borderSubtle} flex items-center justify-between ${isDark ? 'bg-slate-900/60' : 'bg-neutral-50'}`}>
              {onAddRelation ? (
                <button
                  type="button"
                  onClick={() => {
                    const t = parentPicker?.isOpen
                      ? parentPicker.type
                      : siblingPicker?.isOpen
                      ? 'sibling'
                      : spousePicker
                      ? 'spouse'
                      : 'child';
                    setParentPicker(null);
                    setSiblingPicker(null);
                    setChildPicker(null);
                    setSpousePicker(false);
                    onAddRelation(t, person.id);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Створити нову особу</span>
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => {
                  setParentPicker(null);
                  setSiblingPicker(null);
                  setChildPicker(null);
                  setSpousePicker(false);
                  setPickerSearchQuery('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${theme.textSecondary} hover:${theme.textPrimary} cursor-pointer`}
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Life Event Editor Modal */}
      {eventModal?.isOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl max-w-md w-full shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150`}>
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <h3 className={`text-sm font-bold ${theme.cardTitle} flex items-center gap-2`}>
                <Clock className="w-4 h-4 text-emerald-500" />
                <span>{typeof eventModal.editIndex === 'number' ? 'Редагувати подію життя' : 'Додати подію життя'}</span>
              </h3>
              <button onClick={() => setEventModal(null)} className="text-xs opacity-60 hover:opacity-100 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 opacity-70">Тип події:</label>
                <select
                  value={eventModal.type}
                  onChange={(e) => setEventModal({ ...eventModal, type: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                >
                  <option value="Народження">Народження (Birth)</option>
                  <option value="Хрещення">Хрещення (Baptism / Christening)</option>
                  <option value="Шлюб">Шлюб (Marriage)</option>
                  <option value="Ревізька казка">Ревізька казка (Census / Revision)</option>
                  <option value="Сповідний розпис">Сповідний розпис (Confession list)</option>
                  <option value="Військова служба">Військова служба (Military service)</option>
                  <option value="Переселення">Переселення / Еміграція</option>
                  <option value="Смерть">Смерть (Death)</option>
                  <option value="Поховання">Поховання (Burial)</option>
                  <option value="Інша подія">Інша подія</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1 opacity-70">Дата або період:</label>
                  <input
                    type="text"
                    value={eventModal.date}
                    onChange={(e) => setEventModal({ ...eventModal, date: e.target.value })}
                    placeholder="Напр. 15 травня 1892"
                    className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 opacity-70">Рік (число):</label>
                  <input
                    type="number"
                    value={eventModal.year}
                    onChange={(e) => setEventModal({ ...eventModal, year: e.target.value })}
                    placeholder="1892"
                    className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 opacity-70">Місце події:</label>
                <input
                  type="text"
                  value={eventModal.placeName}
                  onChange={(e) => setEventModal({ ...eventModal, placeName: e.target.value })}
                  placeholder="Напр. с. Великі Сорочинці, Полтавщина"
                  className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 opacity-70">Опис та архівні деталі:</label>
                <textarea
                  value={eventModal.description}
                  onChange={(e) => setEventModal({ ...eventModal, description: e.target.value })}
                  rows={3}
                  placeholder="Вкажіть свідків, хрещених, священика, примітки з метричної книги..."
                  className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={() => setEventModal(null)}
                className="px-3 py-1.5 rounded-lg text-xs opacity-70 hover:opacity-100 cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={handleSaveEvent}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
              >
                Зберегти подію
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Source / Citation Modal */}
      {sourceModal?.isOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl max-w-lg w-full shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[88vh] flex flex-col`}>
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <h3 className={`text-sm font-bold ${theme.cardTitle} flex items-center gap-2`}>
                <BookOpen className="w-4 h-4 text-[#B88E3E]" />
                <span>Прив'язати архівне джерело / документ</span>
              </h3>
              <button onClick={() => setSourceModal(null)} className="text-xs opacity-60 hover:opacity-100 cursor-pointer">
                ✕
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex p-1 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSourceModal({ ...sourceModal, mode: 'create_new' })}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  sourceModal.mode === 'create_new' ? 'bg-[#B88E3E] text-white shadow-xs' : 'opacity-70 hover:opacity-100'
                }`}
              >
                + Нове архівне свідоцтво
              </button>
              <button
                type="button"
                onClick={() => setSourceModal({ ...sourceModal, mode: 'link_existing' })}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  sourceModal.mode === 'link_existing' ? 'bg-[#B88E3E] text-white shadow-xs' : 'opacity-70 hover:opacity-100'
                }`}
              >
                Обрати з наявних джерел
              </button>
            </div>

            <div className="space-y-3 text-xs overflow-y-auto flex-1 pr-1 scrollbar-thin">
              {sourceModal.mode === 'link_existing' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold mb-1 opacity-70">Оберіть джерело з бази:</label>
                    <select
                      value={sourceModal.selectedExistingSourceId}
                      onChange={(e) => setSourceModal({ ...sourceModal, selectedExistingSourceId: e.target.value })}
                      className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                    >
                      <option value="">-- Оберіть джерело --</option>
                      <option value="custom">✏️ Свій варіант (вказати опис / джерело вручну)</option>
                      {Object.values(database.sources || {}).map((src) => (
                        <option key={src.id} value={src.id}>
                          {src.title} {src.archive ? `(${src.archive})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {sourceModal.selectedExistingSourceId === 'custom' && (
                    <div className="p-3.5 rounded-xl bg-[#B88E3E]/10 border border-[#B88E3E]/30 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                      <div>
                        <label className="block font-bold mb-1 text-[#B88E3E]">
                          Власна назва / тип джерела: <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={sourceModal.customTitle || ''}
                          onChange={(e) => setSourceModal({ ...sourceModal, customTitle: e.target.value })}
                          placeholder="Напр. Спогади дідуся, довідка з РАЦС, родинний щоденник..."
                          className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary} focus:ring-2 focus:ring-[#B88E3E] outline-none`}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1 opacity-75">
                          Опис джерела / додаткові відомості:
                        </label>
                        <textarea
                          value={sourceModal.customDescription || ''}
                          onChange={(e) => setSourceModal({ ...sourceModal, customDescription: e.target.value })}
                          rows={2}
                          placeholder="Опишіть джерело, цитату або де зберігається оригінал..."
                          className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary} focus:ring-2 focus:ring-[#B88E3E] outline-none`}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold mb-1 opacity-70">Аркуш / Сторінка / Номер запису:</label>
                    <input
                      type="text"
                      value={sourceModal.page}
                      onChange={(e) => setSourceModal({ ...sourceModal, page: e.target.value })}
                      placeholder="Напр. арк. 45 зв., запис №12"
                      className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block font-semibold mb-1 opacity-70">Назва джерела / справи:</label>
                    <input
                      type="text"
                      value={sourceModal.title}
                      onChange={(e) => setSourceModal({ ...sourceModal, title: e.target.value })}
                      placeholder="Напр. Метрична книга Свято-Успенської церкви за 1888 рік"
                      className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold mb-1 opacity-70">Архів:</label>
                      <input
                        type="text"
                        value={sourceModal.archive}
                        onChange={(e) => setSourceModal({ ...sourceModal, archive: e.target.value })}
                        placeholder="Напр. ДАПО"
                        className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1 opacity-70">Фонд:</label>
                      <input
                        type="text"
                        value={sourceModal.fund}
                        onChange={(e) => setSourceModal({ ...sourceModal, fund: e.target.value })}
                        placeholder="Ф. 127"
                        className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-semibold mb-1 opacity-70">Опис:</label>
                      <input
                        type="text"
                        value={sourceModal.inventory}
                        onChange={(e) => setSourceModal({ ...sourceModal, inventory: e.target.value })}
                        placeholder="Оп. 1"
                        className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1 opacity-70">Справа:</label>
                      <input
                        type="text"
                        value={sourceModal.caseNumber}
                        onChange={(e) => setSourceModal({ ...sourceModal, caseNumber: e.target.value })}
                        placeholder="Спр. 450"
                        className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1 opacity-70">Аркуш/Стор.:</label>
                      <input
                        type="text"
                        value={sourceModal.page}
                        onChange={(e) => setSourceModal({ ...sourceModal, page: e.target.value })}
                        placeholder="Арк. 12 зв."
                        className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 opacity-70">Транскрипція / Текст витягу:</label>
                    <textarea
                      value={sourceModal.transcription}
                      onChange={(e) => setSourceModal({ ...sourceModal, transcription: e.target.value })}
                      rows={2}
                      placeholder="Цитата або витяг із метричного запису чи ревізії..."
                      className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 opacity-70">Посилання на скан (URL):</label>
                    <input
                      type="text"
                      value={sourceModal.url}
                      onChange={(e) => setSourceModal({ ...sourceModal, url: e.target.value })}
                      placeholder="https://..."
                      className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={() => setSourceModal(null)}
                className="px-3 py-1.5 rounded-lg text-xs opacity-70 hover:opacity-100 cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={handleSaveCitation}
                className="px-4 py-1.5 rounded-lg bg-[#B88E3E] hover:bg-[#a07a32] text-white text-xs font-bold cursor-pointer"
              >
                Прив'язати джерело
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Family Marriage Editor Modal */}
      {familyMarriageEditor?.isOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl max-w-sm w-full shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150`}>
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2">
              <h3 className={`text-sm font-bold ${theme.cardTitle} flex items-center gap-2`}>
                <Heart className="w-4 h-4 text-rose-500" />
                <span>Відомості про шлюб</span>
              </h3>
              <button onClick={() => setFamilyMarriageEditor(null)} className="text-xs opacity-60 hover:opacity-100 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 opacity-70">Дата шлюбу:</label>
                <input
                  type="text"
                  value={familyMarriageEditor.marriageDate}
                  onChange={(e) => setFamilyMarriageEditor({ ...familyMarriageEditor, marriageDate: e.target.value })}
                  placeholder="Напр. 12 листопада 1890 р."
                  className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 opacity-70">Місце укладання шлюбу / Церква:</label>
                <input
                  type="text"
                  value={familyMarriageEditor.marriagePlace}
                  onChange={(e) => setFamilyMarriageEditor({ ...familyMarriageEditor, marriagePlace: e.target.value })}
                  placeholder="Напр. Свято-Миколаївська церква, м. Полтава"
                  className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary}`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={() => setFamilyMarriageEditor(null)}
                className="px-3 py-1.5 rounded-lg text-xs opacity-70 hover:opacity-100 cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={handleSaveMarriageDetails}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {isConfirmDeleteOpen && person && (
        <ConfirmDeleteModal
          isOpen={isConfirmDeleteOpen}
          title="Видалення особи"
          itemName={getFullName(person)}
          itemType="особу"
          message={`Ви дійсно бажаєте видалити особу «${getFullName(person)}» з родоводу?`}
          onConfirm={() => {
            onDeletePerson(person.id);
            setIsConfirmDeleteOpen(false);
            onClose();
          }}
          onClose={() => setIsConfirmDeleteOpen(false)}
          isPermanent={true}
        />
      )}
    </div>
  );
};
