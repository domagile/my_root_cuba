/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Save,
  User,
  UserPlus,
  Heart,
  Users,
  Calendar,
  MapPin,
  FileText,
  Camera,
  Layers,
  Sparkles,
  Hash,
  Tag,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  AlertCircle,
  Upload,
  Link as LinkIcon,
  Cloud,
  ChevronRight,
  Shield,
  Briefcase,
  Award,
  BookOpen,
  Church,
  Search,
  ExternalLink,
  ChevronDown,
  GitFork,
  Compass,
  Mail
} from 'lucide-react';
import { useGenealogy } from '../../context/GenealogyContext';
import { getThemeConfig } from '../../utils/theme';
import {
  Person,
  Gender,
  CustomFieldItem,
  GodparentItem,
  HistoricalPlaceItem,
  PersonLifeEventItem
} from '../../types';
import { parseAndNormalizeTags, getTreeHashtagsWithCounts, extractHashtagsFromText } from '../../utils/tagUtils';
import { detectGenderFromName, isPersonMale, isPersonFemale, parseFullNameComponents } from '../../utils/genderUtils';
import { ContactAuthorModal } from '../ContactAuthorModal';

export interface AddPersonModalProps {
  personId?: string | null;
  initialPersonToEdit?: Person | null;
  initialRelation?: {
    type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling';
    targetPersonId: string;
  } | null;
  onClose: () => void;
  onSaveAndOpenProfile?: (personId: string) => void;
  onChangeRoot?: (personId: string) => void;
  onOpenKinshipWith?: (personId: string) => void;
  onDeletePerson?: (personId: string) => void;
  onSelectPerson?: (personId: string) => void;
  isReadOnly?: boolean;
}

type ModalSection =
  | 'basic'
  | 'names'
  | 'parents'
  | 'dates-places'
  | 'bio-notes'
  | 'events'
  | 'photos'
  | 'custom-fields';

export const AddPersonModal: React.FC<AddPersonModalProps> = ({
  personId,
  initialPersonToEdit,
  initialRelation,
  onClose,
  onSaveAndOpenProfile,
  onChangeRoot,
  onOpenKinshipWith,
  onDeletePerson,
  onSelectPerson,
  isReadOnly = false
}) => {
  const { persons, addPerson, updatePerson, themePalette, setSelectedPersonId } = useGenealogy();
  const theme = getThemeConfig(themePalette);
  const isDark = themePalette.includes('dark');

  const [activeSection, setActiveSection] = useState<ModalSection>('basic');
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // Determine effective person either from prop or personId
  const effectivePerson = useMemo(() => {
    if (initialPersonToEdit) return initialPersonToEdit;
    if (personId) return persons.find((p) => p.id === personId) || null;
    return null;
  }, [initialPersonToEdit, personId, persons]);

  // Target Person for initialRelation
  const targetPerson = initialRelation
    ? persons.find((p) => p.id === initialRelation.targetPersonId)
    : null;

  // 1. Basic Information
  const [researchBranch, setResearchBranch] = useState(effectivePerson?.researchBranch || 'Без прив\'язки');
  const [researchStatus, setResearchStatus] = useState(effectivePerson?.researchStatus || 'hypothetical');
  
  const initialFirst = effectivePerson?.name?.given || effectivePerson?.firstName || '';
  const initialLast = effectivePerson?.name?.surname || effectivePerson?.lastName || '';
  const initialMaiden = effectivePerson?.name?.maidenName || effectivePerson?.maidenName || '';
  const initialPatronym = effectivePerson?.name?.patronymic || effectivePerson?.patronymic || '';
  const initialPrefix = effectivePerson?.name?.prefix || effectivePerson?.prefix || '';

  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [maidenName, setMaidenName] = useState(initialMaiden);
  const [patronymic, setPatronymic] = useState(initialPatronym);
  const [prefix, setPrefix] = useState(initialPrefix);
  const [fullNameOverride, setFullNameOverride] = useState('');
  const [nameVariants, setNameVariants] = useState((effectivePerson?.nameVariants || []).join(', '));
  const [surnameVariants, setSurnameVariants] = useState((effectivePerson?.surnameVariants || []).join(', '));

  // Gender
  const [gender, setGender] = useState<Gender>(() => {
    if (effectivePerson) {
      if (isPersonFemale(effectivePerson)) return 'female';
      if (isPersonMale(effectivePerson)) return 'male';
      return effectivePerson.gender || 'male';
    }
    if (initialRelation?.type === 'father') return 'male';
    if (initialRelation?.type === 'mother') return 'female';
    if (initialRelation?.type === 'spouse') {
      return targetPerson ? (isPersonMale(targetPerson) ? 'female' : 'male') : 'female';
    }
    const detected = detectGenderFromName(initialFirst, initialLast, initialPatronym, initialMaiden);
    return detected || 'male';
  });
  const [genderManuallyChanged, setGenderManuallyChanged] = useState(() => {
    return Boolean(effectivePerson || initialRelation?.type === 'father' || initialRelation?.type === 'mother' || initialRelation?.type === 'spouse');
  });

  // Living status
  const [isLiving, setIsLiving] = useState<boolean>(effectivePerson?.isLiving ?? false);

  // 3. Parents & Kinship
  const [fatherId, setFatherId] = useState<string>(() => {
    if (effectivePerson?.fatherId) return effectivePerson.fatherId;
    if (initialRelation?.type === 'child' && targetPerson && isPersonMale(targetPerson)) return targetPerson.id;
    if (initialRelation?.type === 'sibling' && targetPerson?.fatherId) return targetPerson.fatherId;
    return '';
  });
  const [motherId, setMotherId] = useState<string>(() => {
    if (effectivePerson?.motherId) return effectivePerson.motherId;
    if (initialRelation?.type === 'child' && targetPerson && isPersonFemale(targetPerson)) return targetPerson.id;
    if (initialRelation?.type === 'sibling' && targetPerson?.motherId) return targetPerson.motherId;
    return '';
  });
  const [spouseId, setSpouseId] = useState<string>(() => {
    if (effectivePerson?.spouseIds && effectivePerson.spouseIds.length > 0) return effectivePerson.spouseIds[0];
    if (initialRelation?.type === 'spouse' && targetPerson) return targetPerson.id;
    return '';
  });

  // Sibling IDs
  const [siblingIds, setSiblingIds] = useState<string[]>(effectivePerson?.siblingIds || []);

  // Godparents list
  const [godparents, setGodparents] = useState<GodparentItem[]>(effectivePerson?.godparents || []);
  const [godparentMode, setGodparentMode] = useState<'create_new' | 'select_existing'>('create_new');
  const [newGodparentName, setNewGodparentName] = useState('');
  const [newGodparentRole, setNewGodparentRole] = useState<'godfather' | 'godmother' | 'witness'>('godfather');
  const [newGodparentNotes, setNewGodparentNotes] = useState('');
  const [newGodparentPlace, setNewGodparentPlace] = useState('');
  const [newGodparentYear, setNewGodparentYear] = useState('');
  const [selectedExistingGodparentId, setSelectedExistingGodparentId] = useState('');
  const [godparentSearchQuery, setGodparentSearchQuery] = useState('');
  const [showAddGodparentForm, setShowAddGodparentForm] = useState(false);
  const [godparentFeedbackMsg, setGodparentFeedbackMsg] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // 4. Dates & Places (Map locations)
  const [birthDate, setBirthDate] = useState(effectivePerson?.birthDate || '');
  const [birthPlace, setBirthPlace] = useState(effectivePerson?.birthPlace || '');
  const [birthPlaceHistorical, setBirthPlaceHistorical] = useState('');

  const [marriageDate, setMarriageDate] = useState(effectivePerson?.marriageDate || '');
  const [marriagePlace, setMarriagePlace] = useState(effectivePerson?.marriagePlace || '');
  const [marriagePlaceHistorical, setMarriagePlaceHistorical] = useState('');

  const [deathDate, setDeathDate] = useState(effectivePerson?.deathDate || '');
  const [deathPlace, setDeathPlace] = useState(effectivePerson?.deathPlace || '');
  const [deathPlaceHistorical, setDeathPlaceHistorical] = useState('');
  const [deathReason, setDeathReason] = useState(effectivePerson?.deathReason || '');

  const [residencePlace, setResidencePlace] = useState(effectivePerson?.residencePlace || '');
  const [residencePlaceHistorical, setResidencePlaceHistorical] = useState('');

  // 5. Biography, Notes & Social info
  const [bio, setBio] = useState(effectivePerson?.bio || '');
  const [notes, setNotes] = useState(
    typeof effectivePerson?.notes === 'string' ? effectivePerson.notes : ''
  );
  const [estate, setEstate] = useState(
    effectivePerson?.estateOrSocialStatus || effectivePerson?.estate || ''
  );
  const [occupation, setOccupation] = useState(effectivePerson?.occupation || '');
  const [confession, setConfession] = useState(effectivePerson?.confession || '');
  const [militaryRank, setMilitaryRank] = useState(effectivePerson?.militaryRank || '');
  const [tagsStr, setTagsStr] = useState((effectivePerson?.tags || []).join(', '));

  // 6. Events & Facts
  const [lifeEvents, setLifeEvents] = useState<PersonLifeEventItem[]>(
    (effectivePerson?.events as PersonLifeEventItem[]) || []
  );
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [newEvent, setNewEvent] = useState<PersonLifeEventItem>({
    type: 'baptism',
    title: '',
    date: '',
    place: '',
    description: '',
    source: ''
  });

  // 7. Photos
  const [avatarUrl, setAvatarUrl] = useState(
    effectivePerson?.avatarUrl || effectivePerson?.avatar || effectivePerson?.photoUrl || ''
  );
  const [photosList, setPhotosList] = useState<string[]>(effectivePerson?.photos || []);
  const [newPhotoUrlInput, setNewPhotoUrlInput] = useState('');
  const [showPhotoUrlInput, setShowPhotoUrlInput] = useState(false);

  // 8. Custom Fields
  const parseInitialCustomFields = (): CustomFieldItem[] => {
    if (!effectivePerson?.customFields) return [];
    if (Array.isArray(effectivePerson.customFields)) {
      return effectivePerson.customFields;
    }
    // If it was Record<string, string>
    return Object.entries(effectivePerson.customFields).map(([label, value]) => ({
      id: `cf-${Math.random().toString(36).substr(2, 9)}`,
      label,
      value: String(value),
      type: 'text'
    }));
  };

  const [customFields, setCustomFields] = useState<CustomFieldItem[]>(parseInitialCustomFields);
  const [showAddCustomField, setShowAddCustomField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<string>('text');
  const [newFieldValue, setNewFieldValue] = useState('');

  // Sync state whenever effectivePerson changes (e.g. clicking another relative or opening by ID)
  useEffect(() => {
    if (!effectivePerson) return;
    setResearchBranch(effectivePerson.researchBranch || 'Без прив\'язки');
    setResearchStatus(effectivePerson.researchStatus || 'hypothetical');
    setFirstName(effectivePerson.name?.given || effectivePerson.firstName || '');
    setLastName(effectivePerson.name?.surname || effectivePerson.lastName || '');
    setMaidenName(effectivePerson.name?.maidenName || effectivePerson.maidenName || '');
    setPatronymic(effectivePerson.name?.patronymic || effectivePerson.patronymic || '');
    setPrefix(effectivePerson.name?.prefix || effectivePerson.prefix || '');
    setNameVariants((effectivePerson.nameVariants || []).join(', '));
    setSurnameVariants((effectivePerson.surnameVariants || []).join(', '));
    setGender(() => {
      if (isPersonFemale(effectivePerson)) return 'female';
      if (isPersonMale(effectivePerson)) return 'male';
      return effectivePerson.gender || 'male';
    });
    setIsLiving(effectivePerson.isLiving ?? false);
    setFatherId(effectivePerson.fatherId || '');
    setMotherId(effectivePerson.motherId || '');
    setSpouseId(effectivePerson.spouseIds?.[0] || '');
    setSiblingIds(effectivePerson.siblingIds || []);
    setGodparents(effectivePerson.godparents || []);
    setBirthDate(effectivePerson.birthDate || '');
    setBirthPlace(effectivePerson.birthPlace || '');
    setMarriageDate(effectivePerson.marriageDate || '');
    setMarriagePlace(effectivePerson.marriagePlace || '');
    setDeathDate(effectivePerson.deathDate || '');
    setDeathPlace(effectivePerson.deathPlace || '');
    setDeathReason(effectivePerson.deathReason || '');
    setResidencePlace(effectivePerson.residencePlace || '');
    setBio(effectivePerson.bio || '');
    setNotes(typeof effectivePerson.notes === 'string' ? effectivePerson.notes : '');
    setEstate(effectivePerson.estateOrSocialStatus || effectivePerson.estate || '');
    setOccupation(effectivePerson.occupation || '');
    setConfession(effectivePerson.confession || '');
    setMilitaryRank(effectivePerson.militaryRank || '');
    setTagsStr((effectivePerson.tags || []).join(', '));
    setAvatarUrl(effectivePerson.avatarUrl || effectivePerson.avatar || effectivePerson.photoUrl || '');
    setPhotosList(effectivePerson.photos || []);
    setLifeEvents((effectivePerson.events as PersonLifeEventItem[]) || []);
    if (effectivePerson.customFields) {
      if (Array.isArray(effectivePerson.customFields)) {
        setCustomFields(effectivePerson.customFields);
      } else {
        setCustomFields(Object.entries(effectivePerson.customFields).map(([label, value]) => ({
          id: `cf-${Math.random().toString(36).substr(2, 9)}`,
          label,
          value: String(value),
          type: 'text'
        })));
      }
    } else {
      setCustomFields([]);
    }
  }, [effectivePerson?.id]);

  // Popular hashtags
  const popularHashtags = useMemo(() => {
    return getTreeHashtagsWithCounts(persons).slice(0, 8);
  }, [persons]);

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

  // Potential Fathers, Mothers, Spouses list
  const malePersons = useMemo(() => {
    return persons.filter((p) => p.id !== initialPersonToEdit?.id && (p.gender === 'male' || p.gender === 'M'));
  }, [persons, initialPersonToEdit]);

  const femalePersons = useMemo(() => {
    return persons.filter((p) => p.id !== initialPersonToEdit?.id && (p.gender === 'female' || p.gender === 'F'));
  }, [persons, initialPersonToEdit]);

  const otherEligiblePersons = useMemo(() => {
    return persons.filter((p) => p.id !== initialPersonToEdit?.id);
  }, [persons, initialPersonToEdit]);

  // Profile completion calculation (%)
  const profileCompletion = useMemo(() => {
    let score = 0;
    const total = 10;
    if (firstName.trim() || lastName.trim()) score += 2;
    if (gender) score += 1;
    if (birthDate.trim()) score += 1;
    if (birthPlace.trim()) score += 1;
    if (isLiving || deathDate.trim()) score += 1;
    if (fatherId || motherId) score += 1;
    if (bio.trim() || notes.trim()) score += 1;
    if (avatarUrl.trim() || photosList.length > 0) score += 1;
    if (estate.trim() || occupation.trim() || confession.trim() || customFields.length > 0) score += 1;

    return Math.min(100, Math.round((score / total) * 100));
  }, [
    firstName,
    lastName,
    gender,
    birthDate,
    birthPlace,
    isLiving,
    deathDate,
    fatherId,
    motherId,
    bio,
    notes,
    avatarUrl,
    photosList,
    estate,
    occupation,
    confession,
    customFields
  ]);

  // Auto-generate full name
  const computedFullName = useMemo(() => {
    if (fullNameOverride.trim()) return fullNameOverride.trim();
    const parts = [lastName.trim(), firstName.trim(), patronymic.trim()].filter(Boolean);
    if (prefix.trim()) parts.unshift(`(${prefix.trim()})`);
    return parts.length > 0 ? parts.join(' ') : 'Особа без імені';
  }, [lastName, firstName, patronymic, prefix, fullNameOverride]);

  // Years preview
  const lifeYearsPreview = useMemo(() => {
    const bMatch = birthDate.match(/\b(1\d{3}|20\d{2})\b/);
    const bYear = bMatch ? bMatch[1] : '?';

    if (isLiving) {
      return `${bYear} — живий(а)`;
    }
    const dMatch = deathDate.match(/\b(1\d{3}|20\d{2})\b/);
    const dYear = dMatch ? dMatch[1] : '?';
    return `${bYear} — ${dYear}`;
  }, [birthDate, deathDate, isLiving]);

  // Scroll to section handler
  const scrollToSection = (sectionId: ModalSection) => {
    setActiveSection(sectionId);
    const el = document.getElementById(`sec-${sectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Add Custom Field
  const handleAddCustomField = () => {
    if (!newFieldLabel.trim()) return;
    const newField: CustomFieldItem = {
      id: `cf-${Date.now()}`,
      label: newFieldLabel.trim(),
      type: newFieldType,
      value: newFieldValue.trim()
    };
    setCustomFields((prev) => [...prev, newField]);
    setNewFieldLabel('');
    setNewFieldValue('');
    setShowAddCustomField(false);
  };

  const handleRemoveCustomField = (id?: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  // Add Godparent with Person Entity creation
  const handleAddGodparent = () => {
    if (godparentMode === 'select_existing') {
      if (!selectedExistingGodparentId) {
        setGodparentFeedbackMsg({ text: 'Будь ласка, виберіть особу зі списку.', type: 'info' });
        return;
      }
      const existingPerson = persons.find((p) => p.id === selectedExistingGodparentId);
      if (!existingPerson) return;

      const fullName = [
        existingPerson.name?.surname || existingPerson.lastName || '',
        existingPerson.name?.given || existingPerson.firstName || '',
        existingPerson.name?.patronymic || existingPerson.patronymic || ''
      ].filter(Boolean).join(' ');

      const item: GodparentItem = {
        id: `gp-${Date.now()}`,
        personId: existingPerson.id,
        name: fullName || 'Особа з дерева',
        role: newGodparentRole,
        notes: newGodparentNotes.trim()
      };
      setGodparents((prev) => [...prev, item]);
      setSelectedExistingGodparentId('');
      setGodparentSearchQuery('');
      setNewGodparentNotes('');
      setShowAddGodparentForm(false);
      setGodparentFeedbackMsg({
        text: `Особу «${fullName}» прив'язано як ${newGodparentRole === 'godmother' ? 'хрещену матір' : newGodparentRole === 'witness' ? 'свідка' : 'хрещеного батька'}!`,
        type: 'success'
      });
      setTimeout(() => setGodparentFeedbackMsg(null), 5000);
      return;
    }

    // Creating a brand new Person entity
    if (!newGodparentName.trim()) {
      setGodparentFeedbackMsg({ text: 'Будь ласка, введіть ПІБ або ім\'я хрещеного.', type: 'info' });
      return;
    }

    const parsed = parseFullNameComponents(newGodparentName.trim());
    
    // Determine gender based on role and name
    let determinedGender: Gender = 'male';
    if (newGodparentRole === 'godmother') {
      determinedGender = 'female';
    } else if (newGodparentRole === 'godfather') {
      determinedGender = 'male';
    } else {
      const detected = detectGenderFromName(parsed.given, parsed.patronymic, parsed.surname);
      determinedGender = (detected as Gender) || 'male';
    }

    const newPersonId = `p-gp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const fullDisplayName = [parsed.surname, parsed.given, parsed.patronymic].filter(Boolean).join(' ') || newGodparentName.trim();

    // Create the full Person entity in the tree/database
    const newGodparentPerson: Person = {
      id: newPersonId,
      name: {
        given: parsed.given,
        surname: parsed.surname,
        patronymic: parsed.patronymic || undefined
      },
      firstName: parsed.given,
      lastName: parsed.surname,
      patronymic: parsed.patronymic || undefined,
      gender: determinedGender,
      birthYear: newGodparentYear.trim() ? parseInt(newGodparentYear.trim(), 10) : undefined,
      residencePlace: newGodparentPlace.trim() || undefined,
      estate: newGodparentNotes.trim() || undefined,
      estateOrSocialStatus: newGodparentNotes.trim() || undefined,
      socialStatus: newGodparentNotes.trim() || undefined,
      researchStatus: 'confirmed',
      researchBranch: researchBranch && researchBranch !== 'Без прив\'язки' ? researchBranch : 'Без прив\'язки',
      notes: newGodparentNotes.trim()
        ? `Хрещений(а) або свідок при хрещенні. Примітки: ${newGodparentNotes.trim()}`
        : `Хрещений(а) або свідок при хрещенні.`,
      isLiving: false,
      godchildrenIds: initialPersonToEdit?.id ? [initialPersonToEdit.id] : []
    };

    // Persist person into database
    addPerson(newGodparentPerson);

    const item: GodparentItem = {
      id: `gp-${Date.now()}`,
      personId: newPersonId,
      name: fullDisplayName,
      role: newGodparentRole,
      notes: newGodparentNotes.trim()
    };

    setGodparents((prev) => [...prev, item]);
    setNewGodparentName('');
    setNewGodparentNotes('');
    setNewGodparentPlace('');
    setNewGodparentYear('');
    setShowAddGodparentForm(false);
    setGodparentFeedbackMsg({
      text: `Створено нову особу «${fullDisplayName}» (${determinedGender === 'female' ? 'жіноча стать' : 'чоловіча стать'}) та додано як хрещеного!`,
      type: 'success'
    });
    setTimeout(() => setGodparentFeedbackMsg(null), 5000);
  };

  const handleRemoveGodparent = (id?: string) => {
    setGodparents((prev) => prev.filter((gp) => gp.id !== id));
  };

  // Add Life Event
  const handleAddLifeEvent = () => {
    if (!newEvent.title && !newEvent.type) return;
    const item: PersonLifeEventItem = {
      id: `evt-${Date.now()}`,
      ...newEvent,
      title: newEvent.title || getEventTypeName(newEvent.type)
    };
    setLifeEvents((prev) => [...prev, item]);
    setNewEvent({
      type: 'baptism',
      title: '',
      date: '',
      place: '',
      description: '',
      source: ''
    });
    setShowAddEventForm(false);
  };

  const handleRemoveLifeEvent = (id?: string) => {
    setLifeEvents((prev) => prev.filter((evt) => evt.id !== id));
  };

  const getEventTypeName = (type?: string) => {
    switch (type) {
      case 'birth':
        return 'Народження';
      case 'baptism':
        return 'Хрещення';
      case 'marriage':
        return 'Шлюб';
      case 'revision':
        return 'Ревізька казка / Перепис';
      case 'confession':
        return 'Сповідний розпис';
      case 'residence':
        return 'Проживання / Переїзд';
      case 'military':
        return 'Військова служба';
      case 'education':
        return 'Освіта';
      case 'award':
        return 'Нагорода / Відзнака';
      case 'emigration':
        return 'Еміграція / Переселення';
      case 'death':
        return 'Смерть';
      case 'burial':
        return 'Поховання';
      default:
        return 'Подія';
    }
  };

  // Add photo via URL
  const handleAddPhotoUrl = () => {
    if (!newPhotoUrlInput.trim()) return;
    const url = newPhotoUrlInput.trim();
    if (!avatarUrl) {
      setAvatarUrl(url);
    }
    setPhotosList((prev) => Array.from(new Set([...prev, url])));
    setNewPhotoUrlInput('');
    setShowPhotoUrlInput(false);
  };

  // Save Person Core Logic
  const handleSave = (openProfileAfterSave = false) => {
    if (!firstName.trim() && !lastName.trim()) {
      alert('Будь ласка, вкажіть прізвище або ім\'я особи.');
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

    const nameVariantsList = nameVariants
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const surnameVariantsList = surnameVariants
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const nameObj = {
      given: firstName.trim(),
      surname: lastName.trim(),
      patronymic: patronymic.trim() || undefined,
      maidenName: maidenName.trim() || undefined,
      prefix: prefix.trim() || undefined
    };

    let savedPersonId: string;

    if (effectivePerson) {
      savedPersonId = effectivePerson.id;
      const updatedPerson: Person = {
        ...effectivePerson,
        name: nameObj,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        patronymic: patronymic.trim() || undefined,
        maidenName: maidenName.trim() || undefined,
        prefix: prefix.trim() || undefined,
        gender,
        researchBranch: researchBranch || undefined,
        researchStatus: researchStatus || undefined,
        nameVariants: nameVariantsList.length > 0 ? nameVariantsList : undefined,
        surnameVariants: surnameVariantsList.length > 0 ? surnameVariantsList : undefined,
        birthDate: birthDate.trim() || undefined,
        birthPlace: birthPlace.trim() || undefined,
        birthYear,
        marriageDate: marriageDate.trim() || undefined,
        marriagePlace: marriagePlace.trim() || undefined,
        deathDate: isLiving ? undefined : deathDate.trim() || undefined,
        deathPlace: isLiving ? undefined : deathPlace.trim() || undefined,
        deathYear: isLiving ? undefined : deathYear,
        deathReason: isLiving ? undefined : deathReason.trim() || undefined,
        residencePlace: residencePlace.trim() || undefined,
        isLiving,
        fatherId: fatherId || undefined,
        motherId: motherId || undefined,
        spouseIds: spouseId ? [spouseId] : effectivePerson.spouseIds || [],
        siblingIds: siblingIds.length > 0 ? siblingIds : undefined,
        godparents: godparents.length > 0 ? godparents : undefined,
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
        photos: photosList.length > 0 ? photosList : undefined,
        tags: tags.length > 0 ? tags : undefined,
        notes: notes.trim() || undefined,
        events: lifeEvents.length > 0 ? lifeEvents : undefined,
        customFields: customFields.length > 0 ? customFields : undefined
      };

      updatePerson(updatedPerson);
    } else {
      savedPersonId = `p-${Date.now()}`;
      const newPerson: Person = {
        id: savedPersonId,
        name: nameObj,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        patronymic: patronymic.trim() || undefined,
        maidenName: maidenName.trim() || undefined,
        prefix: prefix.trim() || undefined,
        gender,
        researchBranch: researchBranch || undefined,
        researchStatus: researchStatus || undefined,
        nameVariants: nameVariantsList.length > 0 ? nameVariantsList : undefined,
        surnameVariants: surnameVariantsList.length > 0 ? surnameVariantsList : undefined,
        birthDate: birthDate.trim() || undefined,
        birthPlace: birthPlace.trim() || undefined,
        birthYear,
        marriageDate: marriageDate.trim() || undefined,
        marriagePlace: marriagePlace.trim() || undefined,
        deathDate: isLiving ? undefined : deathDate.trim() || undefined,
        deathPlace: isLiving ? undefined : deathPlace.trim() || undefined,
        deathYear: isLiving ? undefined : deathYear,
        deathReason: isLiving ? undefined : deathReason.trim() || undefined,
        residencePlace: residencePlace.trim() || undefined,
        isLiving,
        fatherId: fatherId || undefined,
        motherId: motherId || undefined,
        spouseIds: spouseId ? [spouseId] : [],
        childrenIds: [],
        siblingIds: siblingIds.length > 0 ? siblingIds : undefined,
        godparents: godparents.length > 0 ? godparents : undefined,
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
        photos: photosList.length > 0 ? photosList : undefined,
        tags: tags.length > 0 ? tags : undefined,
        notes: notes.trim() || undefined,
        events: lifeEvents.length > 0 ? lifeEvents : undefined,
        customFields: customFields.length > 0 ? customFields : undefined
      };

      // Set relationships based on initialRelation
      if (initialRelation) {
        const target = persons.find((p) => p.id === initialRelation.targetPersonId);
        if (target) {
          if (initialRelation.type === 'father') {
            updatePerson({ ...target, fatherId: savedPersonId });
            newPerson.childrenIds = [target.id];
          } else if (initialRelation.type === 'mother') {
            updatePerson({ ...target, motherId: savedPersonId });
            newPerson.childrenIds = [target.id];
          } else if (initialRelation.type === 'parent') {
            const isFemale = gender === 'female' || gender === 'F';
            if (isFemale) {
              updatePerson({ ...target, motherId: savedPersonId });
            } else {
              updatePerson({ ...target, fatherId: savedPersonId });
            }
            newPerson.childrenIds = [target.id];
          } else if (initialRelation.type === 'child') {
            if (target.gender === 'male' || target.gender === 'M') newPerson.fatherId = target.id;
            else newPerson.motherId = target.id;
            updatePerson({
              ...target,
              childrenIds: Array.from(new Set([...(target.childrenIds || []), savedPersonId]))
            });
          } else if (initialRelation.type === 'spouse') {
            newPerson.spouseIds = [target.id];
            updatePerson({
              ...target,
              spouseIds: Array.from(new Set([...(target.spouseIds || []), savedPersonId]))
            });
          } else if (initialRelation.type === 'sibling') {
            if (target.fatherId) {
              newPerson.fatherId = target.fatherId;
              const f = persons.find((p) => p.id === target.fatherId);
              if (f) {
                updatePerson({
                  ...f,
                  childrenIds: Array.from(new Set([...(f.childrenIds || []), savedPersonId]))
                });
              }
            }
            if (target.motherId) {
              newPerson.motherId = target.motherId;
              const m = persons.find((p) => p.id === target.motherId);
              if (m) {
                updatePerson({
                  ...m,
                  childrenIds: Array.from(new Set([...(m.childrenIds || []), savedPersonId]))
                });
              }
            }
          }
        }
      }

      // If father selected, update father's childrenIds
      if (fatherId) {
        const f = persons.find((p) => p.id === fatherId);
        if (f) {
          updatePerson({
            ...f,
            childrenIds: Array.from(new Set([...(f.childrenIds || []), savedPersonId]))
          });
        }
      }

      // If mother selected, update mother's childrenIds
      if (motherId) {
        const m = persons.find((p) => p.id === motherId);
        if (m) {
          updatePerson({
            ...m,
            childrenIds: Array.from(new Set([...(m.childrenIds || []), savedPersonId]))
          });
        }
      }

      // If spouse selected, update spouse's spouseIds
      if (spouseId) {
        const sp = persons.find((p) => p.id === spouseId);
        if (sp) {
          updatePerson({
            ...sp,
            spouseIds: Array.from(new Set([...(sp.spouseIds || []), savedPersonId]))
          });
        }
      }

      addPerson(newPerson);
    }

    // Synchronize all linked godparents so their godchildrenIds includes this saved person
    if (godparents.length > 0) {
      godparents.forEach((gp) => {
        if (gp.personId) {
          const gpPerson = persons.find((p) => p.id === gp.personId);
          if (gpPerson) {
            const currentGodchildren = gpPerson.godchildrenIds || [];
            if (!currentGodchildren.includes(savedPersonId)) {
              updatePerson({
                ...gpPerson,
                godchildrenIds: [...currentGodchildren, savedPersonId]
              });
            }
          }
        }
      });
    }

    if (openProfileAfterSave) {
      setSelectedPersonId(savedPersonId);
      if (onSaveAndOpenProfile) {
        onSaveAndOpenProfile(savedPersonId);
      }
    }

    onClose();
  };

  const getRelationLabel = () => {
    if (!initialRelation) {
      if (effectivePerson) {
        const pName = `${lastName || effectivePerson.lastName || ''} ${firstName || effectivePerson.firstName || ''}`.trim();
        return pName ? `Картка особи: ${pName}` : 'Картка особи';
      }
      return 'Додати нову особу';
    }
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
        return `Додати батька чи матір для: ${name}`;
      default:
        return `Додати родича для: ${name}`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs overflow-hidden animate-in fade-in duration-200">
      <div
        className={`w-full max-w-6xl h-[92vh] flex flex-col rounded-2xl md:rounded-3xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl overflow-hidden transition-all`}
      >
        {/* Top Header Bar */}
        <div className="px-4 sm:px-5 py-3 flex items-center justify-between border-b border-black/10 dark:border-white/10 shrink-0 bg-black/5 dark:bg-white/5 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#B88E3E]/20 text-[#B88E3E] flex items-center justify-center shrink-0 border border-[#B88E3E]/30 shadow-xs">
              {effectivePerson ? <User className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className={`text-sm sm:text-base font-bold ${theme.cardTitle} truncate flex items-center gap-2`}>
                <span className="truncate">{getRelationLabel()}</span>
                {effectivePerson && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 border ${
                    isReadOnly 
                      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' 
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  }`}>
                    {isReadOnly ? 'Перегляд' : 'Повна картка'}
                  </span>
                )}
              </h2>
              <p className={`text-[11px] sm:text-xs ${theme.cardSubtext} truncate hidden sm:block`}>
                Повноцінна генеалогічна картка особи з родинними зв'язками, датами, подіями та архівом
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {effectivePerson && onChangeRoot && (
              <button
                type="button"
                onClick={() => {
                  onChangeRoot(effectivePerson.id);
                  onClose();
                }}
                className="px-2.5 py-1.5 rounded-xl text-neutral-600 dark:text-neutral-300 hover:text-emerald-600 hover:bg-emerald-500/10 border border-black/10 dark:border-white/10 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                title="Показати в родинному дереві"
              >
                <GitFork className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden md:inline">В дерево</span>
              </button>
            )}

            {effectivePerson && onOpenKinshipWith && (
              <button
                type="button"
                onClick={() => {
                  onOpenKinshipWith(effectivePerson.id);
                  onClose();
                }}
                className="px-2.5 py-1.5 rounded-xl text-neutral-600 dark:text-neutral-300 hover:text-sky-600 hover:bg-sky-500/10 border border-black/10 dark:border-white/10 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                title="Розрахувати ступінь спорідненості"
              >
                <Compass className="w-3.5 h-3.5 text-sky-500" />
                <span className="hidden md:inline">Спорідненість</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsContactModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl text-neutral-600 dark:text-neutral-300 hover:text-[#B88E3E] hover:bg-[#B88E3E]/10 border border-black/10 dark:border-white/10 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Зв'язатися з автором щодо цієї особи"
            >
              <Mail className="w-3.5 h-3.5 text-[#B88E3E]" />
              <span className="hidden md:inline">Написати автору</span>
            </button>

            {effectivePerson && onDeletePerson && !isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Ви впевнені, що хочете видалити особу ${computedFullName}?`)) {
                    onDeletePerson(effectivePerson.id);
                    onClose();
                  }
                }}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 border border-black/10 dark:border-white/10 transition-colors cursor-pointer"
                title="Видалити особу з бази даних"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
              title="Закрити вікно"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body (2 Columns: Left Sidebar + Scrollable Content) */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          
          {/* Left Navigation & Profile Summary Column */}
          <div className="w-full md:w-64 lg:w-72 border-b md:border-b-0 md:border-r border-black/10 dark:border-white/10 flex flex-col shrink-0 bg-black/[0.02] dark:bg-white/[0.02] p-4 overflow-y-auto">
            
            {/* Top Profile Card Summary (Matching Screenshot) */}
            <div className={`p-4 rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs space-y-3`}>
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg overflow-hidden border-2 shadow-xs transition-transform ${
                      avatarUrl
                        ? 'border-[#B88E3E]'
                        : gender === 'female'
                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>{firstName ? firstName[0].toUpperCase() : '?'}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => scrollToSection('photos')}
                    className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#B88E3E] text-white shadow-sm hover:scale-110 transition-transform cursor-pointer"
                    title="Змінити фото"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className={`font-bold text-sm leading-snug ${theme.textPrimary} truncate`}>
                    {computedFullName}
                  </h3>
                  <div className={`text-xs ${theme.textMuted} mt-0.5`}>
                    {lifeYearsPreview}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {researchStatus === 'confirmed'
                        ? 'підтверджена'
                        : researchStatus === 'in_progress'
                        ? 'в процесі'
                        : researchStatus === 'archival_search'
                        ? 'архівний пошук'
                        : researchStatus === 'needs_verification'
                        ? 'перевірка'
                        : 'гіпотетична'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Meter Bar */}
              <div className="space-y-1 pt-1 border-t border-black/5 dark:border-white/5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className={theme.textMuted}>Заповненість профілю</span>
                  <span className="font-bold text-[#B88E3E]">{profileCompletion}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-[#B88E3E] rounded-full transition-all duration-300"
                    style={{ width: `${profileCompletion}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Navigation Menu Buttons */}
            <div className="mt-3 space-y-1 flex-1">
              {[
                { id: 'basic', label: 'Основне та теги', icon: User },
                { id: 'names', label: 'Імена та варіанти', icon: FileText },
                { id: 'parents', label: 'Батьки та духовні зв\'язки', icon: Users },
                { id: 'dates-places', label: 'Дати та місця', icon: MapPin },
                { id: 'bio-notes', label: 'Біографія і нотатки', icon: BookOpen },
                { id: 'events', label: 'Події та факти', icon: Calendar },
                { id: 'photos', label: 'Фотографії', icon: Camera },
                { id: 'custom-fields', label: 'Власні поля', icon: Layers }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id as ModalSection)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Scrollable Content Area */}
          <div
            ref={contentAreaRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin"
          >
            
            {/* SECTION 1: Основне */}
            <div id="sec-basic" className={`p-5 rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs space-y-4`}>
              <div className="border-b border-black/5 dark:border-white/5 pb-2.5">
                <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Основне</h3>
                <p className={`text-xs ${theme.textMuted}`}>Дослідження, статус картки, стать і життєвий статус особи.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Дослідження */}
                <div className="space-y-1.5">
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                    Дослідження
                  </label>
                  <select
                    value={researchBranch}
                    onChange={(e) => setResearchBranch(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  >
                    <option value="Без прив'язки">Без прив'язки</option>
                    <option value="Головна гілка родоводу">Головна гілка родоводу</option>
                    <option value="Батьківська лінія">Батьківська лінія</option>
                    <option value="Материнська лінія">Материнська лінія</option>
                    <option value="Шляхетська лінія">Шляхетська лінія</option>
                    <option value="Селянська лінія">Селянська лінія</option>
                  </select>
                </div>

                {/* Статус дослідження */}
                <div className="space-y-1.5">
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                    Статус дослідження <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={researchStatus}
                    onChange={(e) => setResearchStatus(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  >
                    <option value="hypothetical">гіпотетична</option>
                    <option value="confirmed">підтверджена першоджерелами</option>
                    <option value="in_progress">в процесі дослідження</option>
                    <option value="needs_verification">потребує додаткової перевірки</option>
                    <option value="archival_search">активний архівний пошук</option>
                  </select>
                </div>

                {/* Стать */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                      Стать <span className="text-rose-500">*</span>
                    </label>
                    {!genderManuallyChanged && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Визначено авто</span>
                    )}
                  </div>
                  <select
                    value={gender}
                    onChange={(e) => {
                      setGenderManuallyChanged(true);
                      setGender(e.target.value as Gender);
                    }}
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  >
                    <option value="male">чоловіча</option>
                    <option value="female">жіноча</option>
                    <option value="other">невідомо</option>
                  </select>
                </div>

                {/* Статус життя (Requested with our toggle switch) */}
                <div className="space-y-1.5">
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px] block">
                    Статус життя <span className="text-rose-500">*</span>
                  </label>
                  
                  <div className="flex items-center gap-4 py-1">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isLiving}
                      onClick={() => setIsLiving(!isLiving)}
                      className="inline-flex items-center gap-2.5 cursor-pointer select-none group"
                    >
                      <span
                        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          isLiving ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                            isLiving ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </span>
                      <span className={`text-xs font-bold ${isLiving ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-600 dark:text-neutral-400'}`}>
                        {isLiving ? 'ЖИВА ОСОБА' : 'ПОМЕРЛА АБО СТАТУС НЕВІДОМИЙ'}
                      </span>
                    </button>
                  </div>

                  {isLiving && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] flex items-center gap-2">
                      <Shield className="w-4 h-4 shrink-0 text-emerald-500" />
                      <span>Дані живої особи будуть автоматично захищені приватністю для сторонніх користувачів.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags & Hashtags (Хештеги та теги) */}
              <div className="pt-3 border-t border-black/5 dark:border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#B88E3E]" />
                    <span>Хештеги / Теги особи</span>
                  </label>
                  <span className="text-[10px] text-neutral-400">розділяйте комою або #</span>
                </div>

                {/* Active Tag Badges */}
                {currentTagsList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 py-1">
                    {currentTagsList.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#B88E3E]/15 text-[#B88E3E] border border-[#B88E3E]/30"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded cursor-pointer transition-colors"
                          title="Видалити тег"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <input
                    type="text"
                    value={tagsStr}
                    onChange={(e) => setTagsStr(e.target.value)}
                    placeholder="#козак, #ветеран, #полтавщина, #дворянин, #галичина"
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  />
                </div>

                {/* Popular Hashtag Suggestions */}
                {popularHashtags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-neutral-400 flex items-center gap-0.5 font-medium">
                      <Hash className="w-3 h-3 text-[#B88E3E]" /> Популярні теги в дереві:
                    </span>
                    {popularHashtags.map((h) => {
                      const isSelected = currentTagsList.some((t) => t.toLowerCase() === h.tag.toLowerCase());
                      return (
                        <button
                          key={h.tag}
                          type="button"
                          onClick={() => handleAddHashtagSuggestion(h.tag)}
                          disabled={isSelected}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 opacity-60 cursor-default'
                              : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-[#B88E3E]/20 text-neutral-600 dark:text-neutral-300 hover:text-[#B88E3E] border-neutral-200 dark:border-neutral-700'
                          }`}
                        >
                          #{h.tag} {h.count > 1 && <span className="opacity-60 text-[9px]">({h.count})</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2: Імена та варіанти */}
            <div id="sec-names" className={`p-5 rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs space-y-4`}>
              <div className="border-b border-black/5 dark:border-white/5 pb-2.5">
                <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Імена та варіанти</h3>
                <p className={`text-xs ${theme.textMuted}`}>Канонічне ім'я картки та написання, знайдені в інших джерелах.</p>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* Row 1: Прізвище & Дівоче прізвище */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                      Прізвище <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLastName(val);
                        if (!genderManuallyChanged) {
                          const detected = detectGenderFromName(firstName, val, patronymic, maidenName);
                          if (detected) setGender(detected);
                        }
                      }}
                      placeholder="Шевченко"
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                      Дівоче прізвище
                    </label>
                    <input
                      type="text"
                      value={maidenName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMaidenName(val);
                        if (!genderManuallyChanged && val.trim()) {
                          setGender('female');
                        }
                      }}
                      placeholder={gender === 'female' ? 'Дівоче прізвище до шлюбу' : 'Доступне після вибору жіночої статі'}
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>
                </div>

                {/* Row 2: Ім'я & По батькові */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                      Ім'я <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFirstName(val);
                        if (!genderManuallyChanged) {
                          const detected = detectGenderFromName(val, lastName, patronymic, maidenName);
                          if (detected) setGender(detected);
                        }
                      }}
                      placeholder="Тарас"
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                      По батькові
                    </label>
                    <input
                      type="text"
                      value={patronymic}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPatronymic(val);
                        if (!genderManuallyChanged) {
                          const detected = detectGenderFromName(firstName, lastName, val, maidenName);
                          if (detected) setGender(detected);
                        }
                      }}
                      placeholder="Григорович"
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>
                </div>

                {/* Row 3: Повне ім'я preview & Титул/Префікс */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                      Повне ім'я (відображення у дереві)
                    </label>
                    <input
                      type="text"
                      value={fullNameOverride || computedFullName}
                      onChange={(e) => setFullNameOverride(e.target.value)}
                      placeholder="Заповніть прізвище, ім'я та по батькові"
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                      Титул / Префікс / Прізвисько
                    </label>
                    <input
                      type="text"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                      placeholder="козак, шляхтич, вуличне прізвисько"
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>
                </div>

                {/* Row 4: Варіанти імені та прізвища */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                      Варіанти імені
                    </label>
                    <input
                      type="text"
                      value={nameVariants}
                      onChange={(e) => setNameVariants(e.target.value)}
                      placeholder="напр. Тарасій, Тараско, Taras"
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                      Варіанти прізвища
                    </label>
                    <input
                      type="text"
                      value={surnameVariants}
                      onChange={(e) => setSurnameVariants(e.target.value)}
                      placeholder="напр. Шевченко, Шевчуков, Szewczenko"
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: Батьки та зв'язки (User requirement 3) */}
            <div id="sec-parents" className={`p-5 rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs space-y-4`}>
              <div className="border-b border-black/5 dark:border-white/5 pb-2.5">
                <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Батьки та родинні зв'язки</h3>
                <p className={`text-xs ${theme.textMuted}`}>Встановлення зв'язків з батьками, подружжям, братами/сестрами та хрещеними батьками (кумами).</p>
              </div>

              <div className="space-y-4 text-xs">
                {/* Parents selectors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Father */}
                  <div className="space-y-1.5 p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 text-xs">
                      <User className="w-3.5 h-3.5 text-blue-500" />
                      <span>Батько</span>
                    </label>
                    <select
                      value={fatherId}
                      onChange={(e) => setFatherId(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    >
                      <option value="">-- Оберіть батька зі списку осіб --</option>
                      {malePersons.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name?.surname || p.lastName || ''} {p.name?.given || p.firstName || ''} {p.birthYear ? `(${p.birthYear})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Mother */}
                  <div className="space-y-1.5 p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 text-xs">
                      <User className="w-3.5 h-3.5 text-rose-500" />
                      <span>Матір</span>
                    </label>
                    <select
                      value={motherId}
                      onChange={(e) => setMotherId(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    >
                      <option value="">-- Оберіть матір зі списку осіб --</option>
                      {femalePersons.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name?.surname || p.lastName || ''} {p.name?.given || p.firstName || ''} {p.birthYear ? `(${p.birthYear})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Spouse Selector */}
                <div className="p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] space-y-1.5">
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 text-xs">
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    <span>Подружжя / Партнер</span>
                  </label>
                  <select
                    value={spouseId}
                    onChange={(e) => setSpouseId(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  >
                    <option value="">-- Оберіть партнера/подружжя зі списку осіб --</option>
                    {otherEligiblePersons.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name?.surname || p.lastName || ''} {p.name?.given || p.firstName || ''} {p.birthYear ? `(${p.birthYear})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Godparents (Хрещені батьки / Куми) */}
                <div className="p-4 rounded-2xl border border-purple-500/20 bg-purple-500/[0.02] dark:bg-purple-500/[0.03] space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 text-xs">
                        <Church className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span>Хрещені батьки, куми та восприємники</span>
                      </h4>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        При додаванні хрещених створюються окремі особи в дереві з автоматичним визначенням статі та зв'язків.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowAddGodparentForm(!showAddGodparentForm);
                        setGodparentFeedbackMsg(null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{showAddGodparentForm ? 'Закрити форму' : '+ Додати хрещеного'}</span>
                    </button>
                  </div>

                  {/* Feedback Message */}
                  {godparentFeedbackMsg && (
                    <div
                      className={`p-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
                        godparentFeedbackMsg.type === 'success'
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{godparentFeedbackMsg.text}</span>
                    </div>
                  )}

                  {/* Add Godparent Form */}
                  {showAddGodparentForm && (
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-purple-500/30 shadow-sm space-y-3.5 animate-in fade-in duration-150">
                      {/* Mode toggle */}
                      <div className="flex items-center gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setGodparentMode('create_new')}
                          className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            godparentMode === 'create_new'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                          }`}
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Створити нову особу</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGodparentMode('select_existing')}
                          className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            godparentMode === 'select_existing'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                          }`}
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Обрати з наявних у дереві</span>
                        </button>
                      </div>

                      {godparentMode === 'create_new' ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div className="sm:col-span-2 space-y-1">
                              <label className="font-bold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wide">
                                ПІБ або Ім'я хрещеного <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={newGodparentName}
                                onChange={(e) => setNewGodparentName(e.target.value)}
                                placeholder="напр. Шевченко Іван Григорович або Іван Шевченко"
                                className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-purple-500`}
                                autoFocus
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="font-bold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wide">
                                Роль у хрещенні <span className="text-rose-500">*</span>
                              </label>
                              <select
                                value={newGodparentRole}
                                onChange={(e) => setNewGodparentRole(e.target.value as any)}
                                className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-purple-500`}
                              >
                                <option value="godfather">Хрещений батько (чол.)</option>
                                <option value="godmother">Хрещена мати (жін.)</option>
                                <option value="witness">Восприємник / Свідок</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div className="space-y-1">
                              <label className="font-bold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wide">
                                Стан / Чин / Парафія
                              </label>
                              <input
                                type="text"
                                value={newGodparentNotes}
                                onChange={(e) => setNewGodparentNotes(e.target.value)}
                                placeholder="напр. козак с. Моринці, шляхтич"
                                className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-purple-500`}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="font-bold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wide">
                                Місце проживання
                              </label>
                              <input
                                type="text"
                                value={newGodparentPlace}
                                onChange={(e) => setNewGodparentPlace(e.target.value)}
                                placeholder="напр. с. Моринці"
                                className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-purple-500`}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="font-bold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wide">
                                Приблизний рік народж.
                              </label>
                              <input
                                type="text"
                                value={newGodparentYear}
                                onChange={(e) => setNewGodparentYear(e.target.value)}
                                placeholder="напр. 1790"
                                className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-purple-500`}
                              />
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/20 text-[11px] text-purple-800 dark:text-purple-300 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
                            <span>Буде створено повноцінну картку особи зі статтю <strong>{newGodparentRole === 'godmother' ? '«жіноча»' : newGodparentRole === 'godfather' ? '«чоловіча»' : 'автоматично за іменем'}</strong> та внесено до родоводу.</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="font-bold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wide">
                              Пошук та вибір особи з дерева <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={godparentSearchQuery}
                              onChange={(e) => setGodparentSearchQuery(e.target.value)}
                              placeholder="Почніть вводити прізвище або ім'я для фільтру..."
                              className={`w-full p-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs mb-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500`}
                            />
                            <select
                              value={selectedExistingGodparentId}
                              onChange={(e) => setSelectedExistingGodparentId(e.target.value)}
                              className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-purple-500`}
                              size={4}
                            >
                              <option value="" disabled>-- Оберіть особу зі списку нижче --</option>
                              {persons
                                .filter((p) => {
                                  if (!godparentSearchQuery.trim()) return true;
                                  const q = godparentSearchQuery.toLowerCase();
                                  const name = `${p.name?.surname || p.lastName || ''} ${p.name?.given || p.firstName || ''} ${p.name?.patronymic || p.patronymic || ''}`.toLowerCase();
                                  return name.includes(q);
                                })
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name?.surname || p.lastName || ''} {p.name?.given || p.firstName || ''} {p.name?.patronymic || p.patronymic || ''} {p.birthYear ? `(${p.birthYear})` : ''} — {p.gender === 'female' ? 'жіноча' : 'чоловіча'}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <label className="font-bold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wide">
                                Роль у хрещенні <span className="text-rose-500">*</span>
                              </label>
                              <select
                                value={newGodparentRole}
                                onChange={(e) => setNewGodparentRole(e.target.value as any)}
                                className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-purple-500`}
                              >
                                <option value="godfather">Хрещений батько</option>
                                <option value="godmother">Хрещена мати</option>
                                <option value="witness">Восприємник / Свідок</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="font-bold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wide">
                                Додаткові примітки
                              </label>
                              <input
                                type="text"
                                value={newGodparentNotes}
                                onChange={(e) => setNewGodparentNotes(e.target.value)}
                                placeholder="напр. записаний у метриці як свідок"
                                className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-purple-500`}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddGodparentForm(false);
                            setGodparentFeedbackMsg(null);
                          }}
                          className="px-3.5 py-1.5 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 font-medium cursor-pointer"
                        >
                          Скасувати
                        </button>
                        <button
                          type="button"
                          onClick={handleAddGodparent}
                          className="px-4 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{godparentMode === 'create_new' ? 'Створити особу та додати' : 'Прив\'язати особу як хрещеного'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* List of Godparents */}
                  {godparents.length > 0 ? (
                    <div className="space-y-2">
                      {godparents.map((gp, idx) => (
                        <div
                          key={gp.id || idx}
                          className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-purple-500/20 flex items-center justify-between gap-3 text-xs shadow-2xs hover:border-purple-500/40 transition-all"
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate">
                                  {gp.name}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold text-[10px]">
                                  {gp.role === 'godmother' ? 'Хрещена мати' : gp.role === 'witness' ? 'Восприємник / Свідок' : 'Хрещений батько'}
                                </span>
                                {gp.personId && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium text-[9px] flex items-center gap-0.5">
                                    <Check className="w-2.5 h-2.5" />
                                    <span>Особа в дереві</span>
                                  </span>
                                )}
                              </div>
                              {gp.notes && (
                                <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                                  {gp.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveGodparent(gp.id)}
                            className="text-neutral-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0"
                            title="Видалити зв'язок з хрещеним"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-center rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-dashed border-black/10 dark:border-white/10">
                      <p className="text-[11px] text-neutral-400 italic">
                        Хрещених батьків поки не додано. Натисніть «+ Додати хрещеного», щоб створити особу або прив'язати наявну.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 4: Дати та події / Місця на карті (Screenshot 2) */}
            <div id="sec-dates-places" className={`p-5 rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs space-y-4`}>
              <div className="border-b border-black/5 dark:border-white/5 pb-2.5">
                <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Місця подій на карті</h3>
                <p className={`text-xs ${theme.textMuted}`}>Додайте позначки лише для подій, які потрібно показувати на карті.</p>
              </div>

              <div className="space-y-5 text-xs">
                {/* 4a. Народження */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                      Народження
                    </label>
                    <span className="text-[10px] text-neutral-400">Знайдіть місце або поставте точку вручну</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <input
                        type="text"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        placeholder="дд.мм.рррр або рррр (напр. 1814)"
                        className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                      />
                    </div>
                    <div className="md:col-span-2 flex gap-2">
                      <input
                        type="text"
                        value={birthPlace}
                        onChange={(e) => setBirthPlace(e.target.value)}
                        placeholder="Назва населеного пункту або місця"
                        className={`flex-1 p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                      />
                      <button
                        type="button"
                        onClick={() => alert(`Місце народження: ${birthPlace || 'Вкажіть назву'}`)}
                        className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-neutral-700 dark:text-neutral-300 font-semibold text-xs shrink-0 cursor-pointer"
                      >
                        Поставити точку на карті
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-neutral-500 font-bold uppercase">
                      Народження: написання в джерелі та історичне місце
                    </label>
                    <input
                      type="text"
                      value={birthPlaceHistorical}
                      onChange={(e) => setBirthPlaceHistorical(e.target.value)}
                      placeholder="Почніть вводити історичну або сучасну назву (напр. с. Моринці Звенигородського повіту)"
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                    <p className="text-[10px] text-neutral-400">Написання з джерела зберігається окремо від вибраного місця й не нормалізується.</p>
                  </div>
                </div>

                {/* 4b. Шлюб */}
                <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                      Шлюб
                    </label>
                    <span className="text-[10px] text-neutral-400">Знайдіть місце або поставте точку вручну</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <input
                        type="text"
                        value={marriageDate}
                        onChange={(e) => setMarriageDate(e.target.value)}
                        placeholder="дд.мм.рррр або рррр"
                        className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                      />
                    </div>
                    <div className="md:col-span-2 flex gap-2">
                      <input
                        type="text"
                        value={marriagePlace}
                        onChange={(e) => setMarriagePlace(e.target.value)}
                        placeholder="Назва населеного пункту або місця"
                        className={`flex-1 p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                      />
                      <button
                        type="button"
                        onClick={() => alert(`Місце шлюбу: ${marriagePlace || 'Вкажіть назву'}`)}
                        className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-neutral-700 dark:text-neutral-300 font-semibold text-xs shrink-0 cursor-pointer"
                      >
                        Поставити точку на карті
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-neutral-500 font-bold uppercase">
                      Шлюб: написання в джерелі та історичне місце
                    </label>
                    <input
                      type="text"
                      value={marriagePlaceHistorical}
                      onChange={(e) => setMarriagePlaceHistorical(e.target.value)}
                      placeholder="Почніть вводити історичну або сучасну назву"
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>
                </div>

                {/* 4c. Смерть (if not living) */}
                {!isLiving && (
                  <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                        Смерть
                      </label>
                      <span className="text-[10px] text-neutral-400">Знайдіть місце або поставте точку вручну</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div>
                        <input
                          type="text"
                          value={deathDate}
                          onChange={(e) => setDeathDate(e.target.value)}
                          placeholder="дд.мм.рррр або рррр"
                          className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                        />
                      </div>
                      <div className="md:col-span-2 flex gap-2">
                        <input
                          type="text"
                          value={deathPlace}
                          onChange={(e) => setDeathPlace(e.target.value)}
                          placeholder="Назва населеного пункту або місця"
                          className={`flex-1 p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                        />
                        <button
                          type="button"
                          onClick={() => alert(`Місце смерті: ${deathPlace || 'Вкажіть назву'}`)}
                          className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-neutral-700 dark:text-neutral-300 font-semibold text-xs shrink-0 cursor-pointer"
                        >
                          Поставити точку на карті
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500 font-bold uppercase">
                        Смерть: написання в джерелі та історичне місце
                      </label>
                      <input
                        type="text"
                        value={deathPlaceHistorical}
                        onChange={(e) => setDeathPlaceHistorical(e.target.value)}
                        placeholder="Почніть вводити історичну або сучасну назву"
                        className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                      />
                    </div>

                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] text-neutral-500 font-bold uppercase">
                        Причина смерті (якщо вказано в метричній книзі)
                      </label>
                      <input
                        type="text"
                        value={deathReason}
                        onChange={(e) => setDeathReason(e.target.value)}
                        placeholder="напр. від старості, водянка, чахотка..."
                        className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                      />
                    </div>
                  </div>
                )}

                {/* 4d. Проживання */}
                <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                      Проживання
                    </label>
                    <span className="text-[10px] text-neutral-400">Знайдіть місце або поставте точку вручну</span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={residencePlace}
                      onChange={(e) => setResidencePlace(e.target.value)}
                      placeholder="Назва населеного пункту або місця"
                      className={`flex-1 p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                    <button
                      type="button"
                      onClick={() => alert(`Місце проживання: ${residencePlace || 'Вкажіть назву'}`)}
                      className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-neutral-700 dark:text-neutral-300 font-semibold text-xs shrink-0 cursor-pointer"
                    >
                      Поставити точку на карті
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-neutral-500 font-bold uppercase">
                      Проживання: написання в джерелі та історичне місце
                    </label>
                    <input
                      type="text"
                      value={residencePlaceHistorical}
                      onChange={(e) => setResidencePlaceHistorical(e.target.value)}
                      placeholder="Почніть вводити історичну або сучасну назву"
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 5: Біографія і нотатки (Screenshot 3) */}
            <div id="sec-bio-notes" className={`p-5 rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs space-y-4`}>
              <div className="border-b border-black/5 dark:border-white/5 pb-2.5">
                <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Біографія і нотатки</h3>
                <p className={`text-xs ${theme.textMuted}`}>Поточна модель зберігає біографічний опис у спільному полі нотаток.</p>
              </div>

              <div className="space-y-4 text-xs">
                {/* Large Textarea for Biography */}
                <div className="space-y-1.5">
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                    Біографія та нотатки
                  </label>
                  <textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Введіть життєпис, родинні перекази, спогади, відомості про діяльність особи..."
                    className={`w-full p-3 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E] leading-relaxed`}
                  />
                </div>

                {/* Status & Occupation row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                      Стан / Соціальний статус
                    </label>
                    <input
                      type="text"
                      value={estate}
                      onChange={(e) => setEstate(e.target.value)}
                      placeholder="Селянин, дворянин, міщанин, козак, шляхтич..."
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                      Професія / Посада / Заняття
                    </label>
                    <input
                      type="text"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      placeholder="Художник, коваль, вчитель, писар..."
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>
                </div>

                {/* Confession & Military */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                      Конфесія / Віросповідання
                    </label>
                    <input
                      type="text"
                      value={confession}
                      onChange={(e) => setConfession(e.target.value)}
                      placeholder="Православна, Греко-Католицька, Римо-Католицька..."
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                      Військове звання / Служба
                    </label>
                    <input
                      type="text"
                      value={militaryRank}
                      onChange={(e) => setMilitaryRank(e.target.value)}
                      placeholder="Рядовий, унтер-офіцер, сотник, ветеран..."
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>
                </div>

                {/* Tags & Hashtags */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-[#B88E3E]" />
                      <span>Хештеги та мітки</span>
                    </label>
                    <span className="text-[10px] text-neutral-400">розділяйте комою або #</span>
                  </div>

                  {currentTagsList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 py-1">
                      {currentTagsList.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#B88E3E]/15 text-[#B88E3E] border border-[#B88E3E]/30"
                        >
                          <span>#{tag}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded cursor-pointer transition-colors"
                            title="Видалити тег"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <input
                    type="text"
                    value={tagsStr}
                    onChange={(e) => setTagsStr(e.target.value)}
                    placeholder="#козак, #ветеран, #полтавщина, #дворянин"
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  />
                  {popularHashtags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] text-neutral-400 flex items-center gap-0.5 font-medium">
                        <Hash className="w-3 h-3 text-[#B88E3E]" /> часті в дереві:
                      </span>
                      {popularHashtags.map((h) => {
                        const isSelected = currentTagsList.some((t) => t.toLowerCase() === h.tag.toLowerCase());
                        return (
                          <button
                            key={h.tag}
                            type="button"
                            onClick={() => handleAddHashtagSuggestion(h.tag)}
                            disabled={isSelected}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 opacity-60 cursor-default'
                                : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-[#B88E3E]/20 text-neutral-600 dark:text-neutral-300 hover:text-[#B88E3E] border-neutral-200 dark:border-neutral-700'
                            }`}
                          >
                            #{h.tag} {h.count > 1 && <span className="opacity-60 text-[9px]">({h.count})</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Archive Notes & Cloud Storage Actions (Matching Screenshot 3) */}
                <div className="p-4 rounded-xl border border-black/10 dark:border-white/10 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-neutral-800 dark:text-neutral-200 text-xs">
                        Інші згадки та матеріали
                      </h4>
                      <p className="text-[11px] text-neutral-500">
                        Зображення, аудіо, PDF, DJVU, документи Word, Excel, RTF, CSV, TXT, Markdown, XML. Файли зберігаються у папці активного проєкту в хмарному сховищі.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => alert('Хмарне сховище GitHub налаштовано та готове до автоматичної синхронізації.')}
                        className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-black/5 text-xs font-semibold cursor-pointer"
                      >
                        Підключити сховище
                      </button>
                      <button
                        type="button"
                        onClick={() => alert('Оберіть файл на Google Диску')}
                        className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-black/5 text-xs font-semibold cursor-pointer"
                      >
                        Обрати з Google Drive
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const url = prompt('Введіть посилання на документ або файл:');
                          if (url) {
                            setNotes((prev) => `${prev ? prev + '\n' : ''}Матеріал: ${url}`);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-black/5 text-xs font-semibold cursor-pointer"
                      >
                        Зовнішнє посилання
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 text-[11px]">
                      Архівні шифри, витяги та примітки:
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="ДАХО Ф. 40, оп. 1, спр. 12, арк. 15 зв. Запис № 42 про народження..."
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 6: Події та факти (Screenshot 3) */}
            <div id="sec-events" className={`p-5 rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs space-y-4`}>
              <div className="border-b border-black/5 dark:border-white/5 pb-2.5">
                <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Події</h3>
                <p className={`text-xs ${theme.textMuted}`}>Додаткові життєві події та факти, крім основних дат вище.</p>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="p-4 rounded-xl border border-black/10 dark:border-white/10 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-neutral-800 dark:text-neutral-200 text-xs">
                        Інші життєві події та факти
                      </h4>
                      <p className="text-[11px] text-neutral-500">
                        Хрещення, переписи, ревізії, сповідні розписи, військова служба, освіта, поховання та інші події. Для однієї особи можна додати декілька подій одного типу.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAddEventForm(!showAddEventForm)}
                      className="px-3 py-1.5 rounded-xl bg-[#B88E3E]/15 hover:bg-[#B88E3E]/25 text-[#B88E3E] font-bold text-xs flex items-center gap-1.5 border border-[#B88E3E]/30 shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{showAddEventForm ? 'Скасувати' : '+ Додати подію'}</span>
                    </button>
                  </div>

                  {showAddEventForm && (
                    <div className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-3 animate-in fade-in duration-150">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="font-bold block text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">
                            Тип події:
                          </label>
                          <select
                            value={newEvent.type}
                            onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as any })}
                            className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                          >
                            <option value="baptism">Хрещення</option>
                            <option value="revision">Ревізька казка / Перепис</option>
                            <option value="confession">Сповідний розпис</option>
                            <option value="marriage">Шлюб / Вінчання</option>
                            <option value="military">Військова служба / Призов</option>
                            <option value="education">Освіта / Навчання</option>
                            <option value="award">Нагорода / Відзнака</option>
                            <option value="residence">Зміна місця проживання</option>
                            <option value="emigration">Еміграція / Переселення</option>
                            <option value="death">Смерть</option>
                            <option value="burial">Поховання</option>
                            <option value="other">Інша подія</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-bold block text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">
                            Назва або заголовок:
                          </label>
                          <input
                            type="text"
                            value={newEvent.title || ''}
                            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                            placeholder="напр. Ревізія 1858 року"
                            className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="font-bold block text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">
                            Дата або рік:
                          </label>
                          <input
                            type="text"
                            value={newEvent.date || ''}
                            onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                            placeholder="1858 або 15.04.1858"
                            className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                          />
                        </div>

                        <div>
                          <label className="font-bold block text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">
                            Місце події:
                          </label>
                          <input
                            type="text"
                            value={newEvent.place || ''}
                            onChange={(e) => setNewEvent({ ...newEvent, place: e.target.value })}
                            placeholder="с. Моринці, Київська губернія"
                            className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="font-bold block text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">
                          Опис, витяг та джерело:
                        </label>
                        <textarea
                          rows={2}
                          value={newEvent.description || ''}
                          onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                          placeholder="Деталі запису, склад сім'ї, джерело..."
                          className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddEventForm(false)}
                          className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-700"
                        >
                          Скасувати
                        </button>
                        <button
                          type="button"
                          onClick={handleAddLifeEvent}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#B88E3E] text-white hover:bg-[#a07a32] cursor-pointer"
                        >
                          Зберегти подію
                        </button>
                      </div>
                    </div>
                  )}

                  {lifeEvents.length > 0 ? (
                    <div className="space-y-2">
                      {lifeEvents.map((evt, idx) => (
                        <div
                          key={evt.id || idx}
                          className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-[#B88E3E]/15 text-[#B88E3E] font-bold text-[10px]">
                                {getEventTypeName(evt.type)}
                              </span>
                              <span className="font-bold text-neutral-800 dark:text-neutral-200">{evt.title}</span>
                              {evt.date && <span className="text-neutral-500 font-medium">({evt.date})</span>}
                            </div>
                            {evt.place && <div className="text-neutral-500 text-[11px]">📍 {evt.place}</div>}
                            {evt.description && <div className="text-neutral-600 dark:text-neutral-400 text-[11px] mt-1">{evt.description}</div>}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveLifeEvent(evt.id)}
                            className="text-neutral-400 hover:text-rose-500 p-1 cursor-pointer"
                            title="Видалити подію"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-neutral-400 italic">Додаткових подій поки немає.</p>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 7: Фотографії (User 1a: "Розділ фото розмістити внизу") */}
            <div id="sec-photos" className={`p-5 rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs space-y-4`}>
              <div className="border-b border-black/5 dark:border-white/5 pb-2.5">
                <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Фото</h3>
                <p className={`text-xs ${theme.textMuted}`}>Фотографії особи, вибір головного зображення та кадрування аватара.</p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl border border-black/10 dark:border-white/10 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-neutral-800 dark:text-neutral-200 text-xs">
                        Фотографії особи
                      </h4>
                      <p className="text-[11px] text-neutral-500">
                        Зображення зберігаються у Google Drive / GitHub / хмарному сховищі; у картці залишаються посилання та метадані.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => alert('Сховище GitHub активовано')}
                        className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-black/5 text-xs font-semibold cursor-pointer"
                      >
                        Підключити сховище
                      </button>
                      <button
                        type="button"
                        onClick={() => alert('Оберіть фото з Google Диска')}
                        className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-black/5 text-xs font-semibold cursor-pointer"
                      >
                        Обрати з Google Drive
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPhotoUrlInput(!showPhotoUrlInput)}
                        className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-black/5 text-xs font-semibold cursor-pointer"
                      >
                        Зовнішнє посилання
                      </button>
                    </div>
                  </div>

                  {showPhotoUrlInput && (
                    <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex gap-2 animate-in fade-in duration-150">
                      <input
                        type="url"
                        value={newPhotoUrlInput}
                        onChange={(e) => setNewPhotoUrlInput(e.target.value)}
                        placeholder="https://images.unsplash.com/... або пряме посилання на фото"
                        className={`flex-1 p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                      />
                      <button
                        type="button"
                        onClick={handleAddPhotoUrl}
                        className="px-3 py-2 rounded-lg bg-[#B88E3E] text-white font-bold text-xs shrink-0 cursor-pointer"
                      >
                        Додати фото
                      </button>
                    </div>
                  )}

                  {/* Photo Gallery Grid */}
                  {photosList.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
                      {photosList.map((photo, idx) => {
                        const isMainAvatar = avatarUrl === photo;
                        return (
                          <div
                            key={idx}
                            className={`relative rounded-xl overflow-hidden border-2 aspect-square group shadow-xs ${
                              isMainAvatar ? 'border-[#B88E3E] ring-2 ring-[#B88E3E]/30' : 'border-neutral-200 dark:border-neutral-700'
                            }`}
                          >
                            <img src={photo} alt="Person" className="w-full h-full object-cover" />
                            {isMainAvatar && (
                              <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-[#B88E3E] text-white text-[9px] font-bold">
                                Головне
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                              {!isMainAvatar && (
                                <button
                                  type="button"
                                  onClick={() => setAvatarUrl(photo)}
                                  className="p-1 rounded-md bg-emerald-600 text-white text-[10px] hover:bg-emerald-700 cursor-pointer"
                                  title="Зробити аватаром"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setPhotosList((prev) => prev.filter((p) => p !== photo));
                                  if (avatarUrl === photo) setAvatarUrl('');
                                }}
                                className="p-1 rounded-md bg-rose-600 text-white text-[10px] hover:bg-rose-700 cursor-pointer"
                                title="Видалити"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 text-center text-neutral-400 text-xs">
                      Файлів поки немає. Скористайтеся кнопками вище для завантаження світлин.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 8: Власні поля (Screenshot 4) */}
            <div id="sec-custom-fields" className={`p-5 rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs space-y-4`}>
              <div className="border-b border-black/5 dark:border-white/5 pb-2.5">
                <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Власні поля</h3>
                <p className={`text-xs ${theme.textMuted}`}>Додаткові поля, налаштовані для модуля осіб цього проекту.</p>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* Notice banner */}
                <div className="p-3.5 rounded-xl border border-black/10 dark:border-white/10 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-neutral-800 dark:text-neutral-200 text-xs">
                        Користувацькі атрибути та параметри
                      </h4>
                      <p className="text-[11px] text-neutral-500">
                        Створюйте власні поля довільних типів (номер ревізької душі, назва маєтку, земельний наділ тощо).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAddCustomField(!showAddCustomField)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 border border-emerald-500/30 shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{showAddCustomField ? 'Скасувати додавання' : '+ Додати власне поле'}</span>
                    </button>
                  </div>

                  {/* Add Custom Field Form (Matching Screenshot 4) */}
                  {showAddCustomField && (
                    <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-3 animate-in fade-in duration-150">
                      <p className="text-[11px] text-neutral-500 italic">
                        Нове поле буде доступне в усіх записах цього розділу.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-bold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wide">
                            Назва поля
                          </label>
                          <input
                            type="text"
                            value={newFieldLabel}
                            onChange={(e) => setNewFieldLabel(e.target.value)}
                            placeholder="Наприклад: Назва маєтку"
                            className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                            autoFocus
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wide">
                            Тип поля
                          </label>
                          <select
                            value={newFieldType}
                            onChange={(e) => setNewFieldType(e.target.value)}
                            className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                          >
                            <option value="text">Короткий текст</option>
                            <option value="longtext">Довгий текст</option>
                            <option value="number">Число</option>
                            <option value="year">Рік</option>
                            <option value="date">Дата</option>
                            <option value="time">Час</option>
                            <option value="approx_date">Приблизна дата або період</option>
                            <option value="place">Місце</option>
                            <option value="list">Список</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wide">
                          Значення поля
                        </label>
                        {newFieldType === 'longtext' ? (
                          <textarea
                            rows={2}
                            value={newFieldValue}
                            onChange={(e) => setNewFieldValue(e.target.value)}
                            placeholder="Введіть значення..."
                            className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                          />
                        ) : (
                          <input
                            type={newFieldType === 'number' ? 'number' : 'text'}
                            value={newFieldValue}
                            onChange={(e) => setNewFieldValue(e.target.value)}
                            placeholder="Введіть значення поля..."
                            className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                          />
                        )}
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddCustomField(false)}
                          className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-700"
                        >
                          Скасувати
                        </button>
                        <button
                          type="button"
                          onClick={handleAddCustomField}
                          className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        >
                          Зберегти власне поле
                        </button>
                      </div>
                    </div>
                  )}

                  {/* List of Custom Fields */}
                  {customFields.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      {customFields.map((field) => (
                        <div
                          key={field.id}
                          className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <span className="font-bold text-neutral-700 dark:text-neutral-300 shrink-0">
                              {field.label}:
                            </span>
                            <input
                              type="text"
                              value={field.value}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCustomFields((prev) =>
                                  prev.map((f) => (f.id === field.id ? { ...f, value: val } : f))
                                );
                              }}
                              className={`flex-1 p-1.5 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                            />
                            {field.type && (
                              <span className="text-[10px] text-neutral-400 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 shrink-0">
                                {field.type}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomField(field.id)}
                            className="text-neutral-400 hover:text-rose-500 p-1 cursor-pointer shrink-0"
                            title="Видалити поле"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-neutral-400 italic">Власних полів ще немає.</p>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Sticky Bottom Actions Bar (Matching Screenshot) */}
        <div className="px-5 py-3.5 border-t border-black/10 dark:border-white/10 flex items-center justify-between bg-black/5 dark:bg-white/5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold transition-colors cursor-pointer"
          >
            {isReadOnly ? 'Закрити' : 'Скасувати'}
          </button>

          <div className="flex items-center gap-2.5">
            {isReadOnly ? (
              <span className="text-xs text-neutral-400 italic">
                Режим перегляду картки
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-[#B88E3E]" />
                  <span>Зберегти</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Зберегти й відкрити профіль</span>
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Contact Author Modal */}
      {isContactModalOpen && (
        <ContactAuthorModal
          isOpen={isContactModalOpen}
          onClose={() => setIsContactModalOpen(false)}
          personName={computedFullName}
          personYears={lifeYearsPreview}
        />
      )}
    </div>
  );
};
