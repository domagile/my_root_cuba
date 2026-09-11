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
  ChevronUp,
  GitFork,
  Compass,
  Mail,
  GitMerge,
  AlertTriangle
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
import { parseAndNormalizeTags, getTreeHashtagsWithCounts, extractHashtagsFromText, COMMON_GENEALOGY_HASHTAG_PRESETS } from '../../utils/tagUtils';
import { detectGenderFromName, isPersonMale, isPersonFemale, parseFullNameComponents } from '../../utils/genderUtils';
import {
  generateUkrainianPatronymic,
  adaptUkrainianSurnameForGender,
  inheritContextFromParents,
  ParentContextInheritance
} from '../../utils/ukrainianNameUtils';
import { ContactAuthorModal } from '../ContactAuthorModal';
import { findDuplicatesForPerson, PersonDuplicateMatch } from '../../utils/duplicateDetector';
import { MergePersonsByIdModal } from '../modals/MergePersonsByIdModal';
import { PersonReportModal } from '../common/PersonReportModal';
import {
  getBidirectionalGodchildren,
  getBidirectionalWitnessedPersons,
  getGodparentOtherGodchildren,
  getWitnessOtherWitnessed,
  getMergedGodparents
} from '../../utils/spiritualRelations';
import {
  ModalSection,
  ModalAccordionState,
  DEFAULT_MODAL_ACCORDION_SECTIONS
} from '../../utils/accordionState';
import { useUIStore } from '../../stores/useUIStore';
import {
  validatePersonFormDates,
  validateLifeEventDate
} from '../../utils/dateValidation';

export type { ModalSection, ModalAccordionState };

export interface AddPersonModalProps {
  personId?: string | null;
  initialPersonToEdit?: Person | null;
  initialRelation?: {
    type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling' | 'godparent' | 'godchild' | 'witness';
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

const MODAL_SECTIONS: { id: ModalSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'basic', label: 'Основне та теги', icon: User },
  { id: 'names', label: 'Імена та варіанти', icon: FileText },
  { id: 'parents', label: 'Батьки та духовні зв\'язки', icon: Users },
  { id: 'dates-places', label: 'Дати та місця', icon: MapPin },
  { id: 'bio-notes', label: 'Біографія і нотатки', icon: BookOpen },
  { id: 'events', label: 'Події та факти', icon: Calendar },
  { id: 'photos', label: 'Фотографії', icon: Camera },
  { id: 'custom-fields', label: 'Власні поля', icon: Layers }
];

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
  const { persons, addPerson, updatePerson, themePalette, setSelectedPersonId, getGenealogyDatabase, families, sources, events } = useGenealogy();
  const theme = getThemeConfig(themePalette);
  const isDark = themePalette.includes('dark');

  // Persistent Accordion & Active Section state from useUIStore
  const openSections = useUIStore((s) => s.personModalOpenSections);
  const activeSection = useUIStore((s) => s.personModalActiveSection);
  const initPersonModalAccordion = useUIStore((s) => s.initPersonModalAccordion);
  const togglePersonModalSection = useUIStore((s) => s.togglePersonModalSection);
  const setPersonModalOpenSections = useUIStore((s) => s.setPersonModalOpenSections);
  const setPersonModalActiveSection = useUIStore((s) => s.setPersonModalActiveSection);
  const expandAllPersonModalSections = useUIStore((s) => s.expandAllPersonModalSections);
  const collapseAllPersonModalSections = useUIStore((s) => s.collapseAllPersonModalSections);
  const resetPersonModalSectionsToDefault = useUIStore((s) => s.resetPersonModalSectionsToDefault);

  const [isMobileNavCollapsed, setIsMobileNavCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

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

  // Resolve initial parents based on effectivePerson, initialRelation and targetPerson
  const initialFatherId = useMemo(() => {
    if (effectivePerson?.fatherId) return effectivePerson.fatherId;
    if (initialRelation?.type === 'child' && targetPerson) {
      if (isPersonMale(targetPerson)) return targetPerson.id;
      if (isPersonFemale(targetPerson) && targetPerson.spouseIds && targetPerson.spouseIds.length > 0) {
        const spouse = persons.find((p) => targetPerson.spouseIds?.includes(p.id) && isPersonMale(p));
        if (spouse) return spouse.id;
      }
    }
    if (initialRelation?.type === 'sibling' && targetPerson?.fatherId) return targetPerson.fatherId;
    return '';
  }, [effectivePerson, initialRelation, targetPerson, persons]);

  const initialMotherId = useMemo(() => {
    if (effectivePerson?.motherId) return effectivePerson.motherId;
    if (initialRelation?.type === 'child' && targetPerson) {
      if (isPersonFemale(targetPerson)) return targetPerson.id;
      if (isPersonMale(targetPerson) && targetPerson.spouseIds && targetPerson.spouseIds.length > 0) {
        const spouse = persons.find((p) => targetPerson.spouseIds?.includes(p.id) && isPersonFemale(p));
        if (spouse) return spouse.id;
      }
    }
    if (initialRelation?.type === 'sibling' && targetPerson?.motherId) return targetPerson.motherId;
    return '';
  }, [effectivePerson, initialRelation, targetPerson, persons]);

  const initialFatherPerson = useMemo(() => {
    return initialFatherId ? persons.find((p) => p.id === initialFatherId) || null : null;
  }, [initialFatherId, persons]);

  const initialMotherPerson = useMemo(() => {
    return initialMotherId ? persons.find((p) => p.id === initialMotherId) || null : null;
  }, [initialMotherId, persons]);

  // Initial gender inference
  const initialGenderVal: Gender = useMemo(() => {
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
    const detected = detectGenderFromName(
      effectivePerson?.name?.given || effectivePerson?.firstName || '',
      effectivePerson?.name?.surname || effectivePerson?.lastName || '',
      effectivePerson?.name?.patronymic || effectivePerson?.patronymic || '',
      effectivePerson?.name?.maidenName || effectivePerson?.maidenName || ''
    );
    return detected || 'male';
  }, [effectivePerson, initialRelation, targetPerson]);

  // Inherited context for new person from initial parents
  const initialParentContext: ParentContextInheritance | null = useMemo(() => {
    if (effectivePerson) return null;
    return inheritContextFromParents({
      father: initialFatherPerson,
      mother: initialMotherPerson,
      childGender: initialGenderVal
    });
  }, [effectivePerson, initialFatherPerson, initialMotherPerson, initialGenderVal]);

  // 1. Basic Information
  const initialBranchVal = useMemo(() => {
    if (effectivePerson?.researchBranch) return effectivePerson.researchBranch;
    if (initialParentContext?.suggestedBranch) return initialParentContext.suggestedBranch;
    if (targetPerson?.researchBranch && targetPerson.researchBranch !== 'Без прив\'язки') {
      return targetPerson.researchBranch;
    }
    return 'Без прив\'язки';
  }, [effectivePerson, initialParentContext, targetPerson]);

  const [researchBranch, setResearchBranch] = useState(initialBranchVal);
  const [researchStatus, setResearchStatus] = useState(effectivePerson?.researchStatus || 'hypothetical');
  
  const initialFirst = effectivePerson?.name?.given || effectivePerson?.firstName || '';
  const initialLast = useMemo(() => {
    if (effectivePerson?.name?.surname || effectivePerson?.lastName) {
      return effectivePerson.name?.surname || effectivePerson.lastName || '';
    }
    if (initialRelation?.type === 'child') {
      return initialParentContext?.suggestedLastName || '';
    }
    if (initialRelation?.type === 'sibling') {
      return initialParentContext?.suggestedLastName || (targetPerson ? adaptUkrainianSurnameForGender(targetPerson.name?.surname || targetPerson.lastName, initialGenderVal) : '');
    }
    if (initialRelation?.type === 'father' && targetPerson) {
      return adaptUkrainianSurnameForGender(targetPerson.name?.surname || targetPerson.lastName, 'male');
    }
    return '';
  }, [effectivePerson, initialRelation, initialParentContext, targetPerson, initialGenderVal]);

  const initialMaiden = effectivePerson?.name?.maidenName || effectivePerson?.maidenName || '';
  const initialPatronym = useMemo(() => {
    if (effectivePerson?.name?.patronymic || effectivePerson?.patronymic) {
      return effectivePerson.name?.patronymic || effectivePerson.patronymic || '';
    }
    if (initialRelation?.type === 'child' || initialRelation?.type === 'sibling') {
      return initialParentContext?.suggestedPatronymic || '';
    }
    return '';
  }, [effectivePerson, initialRelation, initialParentContext]);

  const initialPrefix = effectivePerson?.name?.prefix || effectivePerson?.prefix || '';

  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [maidenName, setMaidenName] = useState(initialMaiden);
  const [patronymic, setPatronymic] = useState(initialPatronym);
  const [prefix, setPrefix] = useState(initialPrefix);
  const [fullNameOverride, setFullNameOverride] = useState('');
  const [nameVariants, setNameVariants] = useState((effectivePerson?.nameVariants || []).join(', '));
  const [surnameVariants, setSurnameVariants] = useState((effectivePerson?.surnameVariants || []).join(', '));
  const [showNameExtras, setShowNameExtras] = useState<boolean>(() => {
    return Boolean(
      initialPrefix ||
      (effectivePerson?.nameVariants && effectivePerson.nameVariants.length > 0) ||
      (effectivePerson?.surnameVariants && effectivePerson.surnameVariants.length > 0)
    );
  });

  // Track auto-inherited fields so we know which values can be auto-updated when gender/father changes
  const [autoInheritedValues, setAutoInheritedValues] = useState<{
    lastName?: string;
    patronymic?: string;
    branch?: string;
    fatherId?: string;
  }>(() => ({
    lastName: !effectivePerson && initialLast ? initialLast : undefined,
    patronymic: !effectivePerson && initialPatronym ? initialPatronym : undefined,
    branch: !effectivePerson && initialBranchVal !== 'Без прив\'язки' ? initialBranchVal : undefined,
    fatherId: !effectivePerson && initialFatherId ? initialFatherId : undefined
  }));

  // Gender
  const [gender, setGender] = useState<Gender>(initialGenderVal);
  const [genderManuallyChanged, setGenderManuallyChanged] = useState(() => {
    return Boolean(effectivePerson || initialRelation?.type === 'father' || initialRelation?.type === 'mother' || initialRelation?.type === 'spouse');
  });

  // Living status
  const [isLiving, setIsLiving] = useState<boolean>(effectivePerson?.isLiving ?? false);

  // 3. Parents & Kinship
  const [fatherId, setFatherId] = useState<string>(initialFatherId);
  const [motherId, setMotherId] = useState<string>(initialMotherId);
  const [spouseId, setSpouseId] = useState<string>(() => {
    if (effectivePerson?.spouseIds && effectivePerson.spouseIds.length > 0) return effectivePerson.spouseIds[0];
    if (initialRelation?.type === 'spouse' && targetPerson) return targetPerson.id;
    return '';
  });

  // Selected father and mother objects
  const selectedFather = useMemo(() => {
    return fatherId ? persons.find((p) => p.id === fatherId) || null : null;
  }, [fatherId, persons]);

  const selectedMother = useMemo(() => {
    return motherId ? persons.find((p) => p.id === motherId) || null : null;
  }, [motherId, persons]);

  // Dynamic context inheritance from currently selected parents & child gender
  const currentInheritance = useMemo(() => {
    return inheritContextFromParents({
      father: selectedFather,
      mother: selectedMother,
      childGender: gender
    });
  }, [selectedFather, selectedMother, gender]);

  // Intelligent gender change handler that adjusts Ukrainian surnames and patronymics
  const applyGenderChange = (newGender: Gender, isManual = true) => {
    if (isManual) setGenderManuallyChanged(true);
    setGender(newGender);

    if (!effectivePerson) {
      // 1. Patronymic update:
      if (selectedFather) {
        const fatherFirst = selectedFather.name?.given || selectedFather.firstName;
        if (fatherFirst) {
          const oldPatr = generateUkrainianPatronymic(fatherFirst, gender);
          const newPatr = generateUkrainianPatronymic(fatherFirst, newGender);
          if (!patronymic || patronymic === oldPatr || patronymic === autoInheritedValues.patronymic) {
            setPatronymic(newPatr);
            setAutoInheritedValues(prev => ({ ...prev, patronymic: newPatr }));
          }
        }
      }

      // 2. Surname update:
      if (selectedFather) {
        const fatherLast = selectedFather.name?.surname || selectedFather.lastName;
        if (fatherLast) {
          const oldSur = adaptUkrainianSurnameForGender(fatherLast, gender);
          const newSur = adaptUkrainianSurnameForGender(fatherLast, newGender);
          if (!lastName || lastName === oldSur || lastName === autoInheritedValues.lastName) {
            setLastName(newSur);
            setAutoInheritedValues(prev => ({ ...prev, lastName: newSur }));
          }
        }
      } else if (lastName) {
        const adapted = adaptUkrainianSurnameForGender(lastName, newGender);
        if (adapted !== lastName) {
          setLastName(adapted);
          setAutoInheritedValues(prev => ({ ...prev, lastName: adapted }));
        }
      }
    }
  };

  // Intelligent father selection handler
  const handleFatherSelect = (newFatherId: string) => {
    setFatherId(newFatherId);
    if (!newFatherId) return;

    const f = persons.find((p) => p.id === newFatherId);
    if (!f) return;

    const fFirst = f.name?.given || f.firstName;
    const fLast = f.name?.surname || f.lastName;

    // 1. Auto-generate patronymic from father's name
    if (fFirst) {
      const newPatr = generateUkrainianPatronymic(fFirst, gender);
      if (!patronymic || patronymic === autoInheritedValues.patronymic) {
        setPatronymic(newPatr);
        setAutoInheritedValues(prev => ({ ...prev, patronymic: newPatr, fatherId: newFatherId }));
      }
    }

    // 2. Auto-inherit and adapt surname
    if (fLast) {
      const newSur = adaptUkrainianSurnameForGender(fLast, gender);
      if (!lastName || lastName === autoInheritedValues.lastName) {
        setLastName(newSur);
        setAutoInheritedValues(prev => ({ ...prev, lastName: newSur }));
      }
    }

    // 3. Auto-inherit research branch
    if (f.researchBranch && f.researchBranch !== 'Без прив\'язки') {
      if (!researchBranch || researchBranch === 'Без прив\'язки' || researchBranch === autoInheritedValues.branch) {
        setResearchBranch(f.researchBranch);
        setAutoInheritedValues(prev => ({ ...prev, branch: f.researchBranch }));
      }
    }

    // 4. Auto-suggest mother if not yet selected and father has a wife
    if (!motherId && f.spouseIds && f.spouseIds.length > 0) {
      const wife = persons.find((p) => f.spouseIds?.includes(p.id) && isPersonFemale(p));
      if (wife) {
        setMotherId(wife.id);
      }
    }

    // 5. Geographic & social context inheritance if empty
    const place = f.residencePlace || f.birthPlace;
    if (place) {
      if (!birthPlace) setBirthPlace(place);
      if (!residencePlace) setResidencePlace(place);
    }
    const fEstate = f.estateOrSocialStatus || f.estate;
    if (fEstate && !estate) setEstate(fEstate);
    if (f.confession && !confession) setConfession(f.confession);
  };

  // Intelligent mother selection handler
  const handleMotherSelect = (newMotherId: string) => {
    setMotherId(newMotherId);
    if (!newMotherId) return;

    const m = persons.find((p) => p.id === newMotherId);
    if (!m) return;

    // Auto-inherit branch if still empty or without attachment
    if ((!researchBranch || researchBranch === 'Без прив\'язки' || researchBranch === autoInheritedValues.branch) && m.researchBranch && m.researchBranch !== 'Без прив\'язки') {
      setResearchBranch(m.researchBranch);
      setAutoInheritedValues(prev => ({ ...prev, branch: m.researchBranch }));
    }

    // Auto-suggest father if not selected and mother has a husband
    if (!fatherId && m.spouseIds && m.spouseIds.length > 0) {
      const husband = persons.find((p) => m.spouseIds?.includes(p.id) && isPersonMale(p));
      if (husband) {
        handleFatherSelect(husband.id);
      }
    }
  };

  // Apply all inherited parent attributes
  const applyAllParentAttributes = () => {
    if (currentInheritance.suggestedLastName) {
      setLastName(currentInheritance.suggestedLastName);
      setAutoInheritedValues(prev => ({ ...prev, lastName: currentInheritance.suggestedLastName }));
    }
    if (currentInheritance.suggestedPatronymic) {
      setPatronymic(currentInheritance.suggestedPatronymic);
      setAutoInheritedValues(prev => ({ ...prev, patronymic: currentInheritance.suggestedPatronymic }));
    }
    if (currentInheritance.suggestedBranch) {
      setResearchBranch(currentInheritance.suggestedBranch);
      setAutoInheritedValues(prev => ({ ...prev, branch: currentInheritance.suggestedBranch }));
    }
    if (currentInheritance.suggestedBirthPlace && !birthPlace) {
      setBirthPlace(currentInheritance.suggestedBirthPlace);
    }
    if (currentInheritance.suggestedResidencePlace && !residencePlace) {
      setResidencePlace(currentInheritance.suggestedResidencePlace);
    }
    if (currentInheritance.suggestedEstate && !estate) {
      setEstate(currentInheritance.suggestedEstate);
    }
    if (currentInheritance.suggestedConfession && !confession) {
      setConfession(currentInheritance.suggestedConfession);
    }
  };

  // Gather all available research branches from persons database + presets
  const allAvailableBranches = useMemo(() => {
    const defaultBranches = [
      'Без прив\'язки',
      'Головна гілка',
      'Батьківська лінія',
      'Материнська лінія',
      'Шляхетська лінія',
      'Селянська лінія'
    ];
    const custom = new Set<string>();
    persons.forEach((p) => {
      if (p.researchBranch && p.researchBranch.trim() && !defaultBranches.includes(p.researchBranch.trim())) {
        custom.add(p.researchBranch.trim());
      }
    });
    if (researchBranch && researchBranch.trim() && !defaultBranches.includes(researchBranch.trim())) {
      custom.add(researchBranch.trim());
    }
    if (currentInheritance.suggestedBranch && !defaultBranches.includes(currentInheritance.suggestedBranch)) {
      custom.add(currentInheritance.suggestedBranch);
    }
    return [...defaultBranches, ...Array.from(custom)];
  }, [persons, researchBranch, currentInheritance.suggestedBranch]);

  // Sibling IDs
  const [siblingIds, setSiblingIds] = useState<string[]>(effectivePerson?.siblingIds || []);

  // Godparents & Spiritual relations
  const [godparents, setGodparents] = useState<GodparentItem[]>(effectivePerson?.godparents || []);
  const [spiritualTab, setSpiritualTab] = useState<'godparents' | 'godchildren' | 'witnesses'>('godparents');
  const [godparentMode, setGodparentMode] = useState<'select_existing' | 'create_new'>('select_existing');
  const [newGodparentName, setNewGodparentName] = useState('');
  const [newGodparentRole, setNewGodparentRole] = useState<'godfather' | 'godmother' | 'witness'>('godfather');
  const [newGodparentNotes, setNewGodparentNotes] = useState('');
  const [newGodparentPlace, setNewGodparentPlace] = useState('');
  const [newGodparentYear, setNewGodparentYear] = useState('');
  const [selectedExistingGodparentId, setSelectedExistingGodparentId] = useState('');
  const [godparentSearchQuery, setGodparentSearchQuery] = useState('');
  const [showAddGodparentForm, setShowAddGodparentForm] = useState(false);
  const [godparentFeedbackMsg, setGodparentFeedbackMsg] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Godchildren states (Хресники)
  const [showAddGodchildForm, setShowAddGodchildForm] = useState(false);
  const [godchildMode, setGodchildMode] = useState<'select_existing' | 'create_new'>('select_existing');
  const [godchildSearchQuery, setGodchildSearchQuery] = useState('');
  const [selectedExistingGodchildId, setSelectedExistingGodchildId] = useState('');
  const [newGodchildName, setNewGodchildName] = useState('');
  const [newGodchildGender, setNewGodchildGender] = useState<Gender>('male');
  const [newGodchildBirthYear, setNewGodchildBirthYear] = useState('');
  const [newGodchildNotes, setNewGodchildNotes] = useState('');
  const [godchildFeedbackMsg, setGodchildFeedbackMsg] = useState<{ text: string; type: 'success' | 'info' } | null>(null);
  const [tempGodchildren, setTempGodchildren] = useState<Array<{ id: string; person: Person; notes?: string }>>([]);

  // Witnessed persons states (де дана особа була свідком / поручителем)
  const [showAddWitnessedForm, setShowAddWitnessedForm] = useState(false);
  const [witnessedSearchQuery, setWitnessedSearchQuery] = useState('');
  const [selectedExistingWitnessedId, setSelectedExistingWitnessedId] = useState('');
  const [newWitnessedNotes, setNewWitnessedNotes] = useState('');
  const [witnessedFeedbackMsg, setWitnessedFeedbackMsg] = useState<{ text: string; type: 'success' | 'info' } | null>(null);
  const [tempWitnessedPersons, setTempWitnessedPersons] = useState<Array<{ id: string; person: Person; notes?: string }>>([]);

  // 4. Dates & Places (Map locations)
  const [birthDate, setBirthDate] = useState(effectivePerson?.birthDate || '');
  const [birthPlace, setBirthPlace] = useState(
    effectivePerson?.birthPlace || (!effectivePerson ? initialParentContext?.suggestedBirthPlace || '' : '')
  );
  const [birthPlaceHistorical, setBirthPlaceHistorical] = useState('');

  const [marriageDate, setMarriageDate] = useState(effectivePerson?.marriageDate || '');
  const [marriagePlace, setMarriagePlace] = useState(effectivePerson?.marriagePlace || '');
  const [marriagePlaceHistorical, setMarriagePlaceHistorical] = useState('');

  const [deathDate, setDeathDate] = useState(effectivePerson?.deathDate || '');
  const [deathPlace, setDeathPlace] = useState(effectivePerson?.deathPlace || '');
  const [deathPlaceHistorical, setDeathPlaceHistorical] = useState('');
  const [deathReason, setDeathReason] = useState(effectivePerson?.deathReason || '');

  const [residencePlace, setResidencePlace] = useState(
    effectivePerson?.residencePlace || (!effectivePerson ? initialParentContext?.suggestedResidencePlace || '' : '')
  );
  const [residencePlaceHistorical, setResidencePlaceHistorical] = useState('');

  // 5. Biography, Notes & Social info
  const [bio, setBio] = useState(effectivePerson?.bio || '');
  const [notes, setNotes] = useState(
    typeof effectivePerson?.notes === 'string' ? effectivePerson.notes : ''
  );
  const [estate, setEstate] = useState(
    effectivePerson?.estateOrSocialStatus || effectivePerson?.estate || (!effectivePerson ? initialParentContext?.suggestedEstate || '' : '')
  );
  const [occupation, setOccupation] = useState(effectivePerson?.occupation || '');
  const [confession, setConfession] = useState(
    effectivePerson?.confession || (!effectivePerson ? initialParentContext?.suggestedConfession || '' : '')
  );
  const [militaryRank, setMilitaryRank] = useState(effectivePerson?.militaryRank || '');
  const [tagsStr, setTagsStr] = useState(() => {
    const raw = effectivePerson?.tags || [];
    return raw.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
  });
  const [newTagDraft, setNewTagDraft] = useState('');

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

  // Duplicate check and Merge by ID state
  const [dismissedDuplicateIds, setDismissedDuplicateIds] = useState<string[]>([]);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState<boolean>(false);
  const [mergeModalPair, setMergeModalPair] = useState<{ idA?: string; idB?: string } | null>(null);
  const [duplicateWarningDismissedForSave, setDuplicateWarningDismissedForSave] = useState<boolean>(false);
  const [showDuplicateSaveDialog, setShowDuplicateSaveDialog] = useState<boolean>(false);
  const [dateValidationDismissedForSave, setDateValidationDismissedForSave] = useState<boolean>(false);
  const [showDateValidationDialog, setShowDateValidationDialog] = useState<boolean>(false);

  const draftPersonForDuplicates = useMemo<Person>(() => {
    return {
      id: effectivePerson?.id || '__draft_person__',
      name: {
        given: firstName.trim(),
        surname: lastName.trim(),
        patronymic: patronymic.trim() || undefined,
        maidenName: maidenName.trim() || undefined
      },
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      patronymic: patronymic.trim() || undefined,
      maidenName: maidenName.trim() || undefined,
      gender,
      birthDate: birthDate.trim() || undefined,
      birthPlace: birthPlace.trim() || undefined,
      deathDate: deathDate.trim() || undefined,
      deathPlace: deathPlace.trim() || undefined,
      fatherId: fatherId || undefined,
      motherId: motherId || undefined,
      spouseIds: spouseId ? [spouseId] : undefined
    };
  }, [effectivePerson, firstName, lastName, patronymic, maidenName, gender, birthDate, birthPlace, deathDate, deathPlace, fatherId, motherId, spouseId]);

  const potentialDuplicates = useMemo<PersonDuplicateMatch[]>(() => {
    if (firstName.trim().length < 2 && lastName.trim().length < 2) return [];
    const matches = findDuplicatesForPerson(
      draftPersonForDuplicates,
      persons,
      effectivePerson?.id,
      48
    );
    return matches.filter((m) => !dismissedDuplicateIds.includes(m.person.id));
  }, [draftPersonForDuplicates, persons, effectivePerson, dismissedDuplicateIds, firstName, lastName]);

  const handleUseExistingPerson = (existingPerson: Person) => {
    if (initialRelation) {
      const target = persons.find((p) => p.id === initialRelation.targetPersonId);
      if (target) {
        if (initialRelation.type === 'father') {
          updatePerson({ ...target, fatherId: existingPerson.id });
          updatePerson({
            ...existingPerson,
            childrenIds: Array.from(new Set([...(existingPerson.childrenIds || []), target.id]))
          });
        } else if (initialRelation.type === 'mother') {
          updatePerson({ ...target, motherId: existingPerson.id });
          updatePerson({
            ...existingPerson,
            childrenIds: Array.from(new Set([...(existingPerson.childrenIds || []), target.id]))
          });
        } else if (initialRelation.type === 'spouse') {
          updatePerson({
            ...target,
            spouseIds: Array.from(new Set([...(target.spouseIds || []), existingPerson.id]))
          });
          updatePerson({
            ...existingPerson,
            spouseIds: Array.from(new Set([...(existingPerson.spouseIds || []), target.id]))
          });
        } else if (initialRelation.type === 'child') {
          const isMale = target.gender === 'male' || target.gender === 'M';
          updatePerson({
            ...existingPerson,
            fatherId: isMale ? target.id : existingPerson.fatherId,
            motherId: !isMale ? target.id : existingPerson.motherId
          });
          updatePerson({
            ...target,
            childrenIds: Array.from(new Set([...(target.childrenIds || []), existingPerson.id]))
          });
        } else if (initialRelation.type === 'sibling') {
          const tf = target.fatherId;
          const tm = target.motherId;
          if (tf || tm) {
            updatePerson({
              ...existingPerson,
              fatherId: tf || existingPerson.fatherId,
              motherId: tm || existingPerson.motherId
            });
            if (tf) {
              const f = persons.find((p) => p.id === tf);
              if (f) {
                updatePerson({ ...f, childrenIds: Array.from(new Set([...(f.childrenIds || []), existingPerson.id])) });
              }
            }
            if (tm) {
              const m = persons.find((p) => p.id === tm);
              if (m) {
                updatePerson({ ...m, childrenIds: Array.from(new Set([...(m.childrenIds || []), existingPerson.id])) });
              }
            }
          }
        } else if (initialRelation.type === 'godparent') {
          const isFemale = existingPerson.gender === 'female' || existingPerson.gender === 'F';
          const existingGps = target.godparents || [];
          updatePerson({
            ...target,
            godparents: [
              ...existingGps,
              {
                id: crypto.randomUUID(),
                personId: existingPerson.id,
                name: `${existingPerson.name?.surname || existingPerson.lastName || ''} ${existingPerson.name?.given || existingPerson.firstName || ''}`.trim(),
                role: isFemale ? 'godmother' : 'godfather'
              }
            ],
            godparentIds: Array.from(new Set([...(target.godparentIds || []), existingPerson.id]))
          });
          updatePerson({
            ...existingPerson,
            godchildrenIds: Array.from(new Set([...(existingPerson.godchildrenIds || []), target.id]))
          });
        } else if (initialRelation.type === 'witness') {
          const existingGps = target.godparents || [];
          updatePerson({
            ...target,
            godparents: [
              ...existingGps,
              {
                id: crypto.randomUUID(),
                personId: existingPerson.id,
                name: `${existingPerson.name?.surname || existingPerson.lastName || ''} ${existingPerson.name?.given || existingPerson.firstName || ''}`.trim(),
                role: 'witness'
              }
            ],
            godparentIds: Array.from(new Set([...(target.godparentIds || []), existingPerson.id])),
            witnessIds: Array.from(new Set([...(target.witnessIds || []), existingPerson.id]))
          });
          updatePerson({
            ...existingPerson,
            witnessedPersonIds: Array.from(new Set([...(existingPerson.witnessedPersonIds || []), target.id]))
          });
        }
      }
    }
    if (onSelectPerson) {
      onSelectPerson(existingPerson.id);
    }
    onClose();
  };

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
    if (
      effectivePerson.name?.prefix ||
      effectivePerson.prefix ||
      (effectivePerson.nameVariants && effectivePerson.nameVariants.length > 0) ||
      (effectivePerson.surnameVariants && effectivePerson.surnameVariants.length > 0)
    ) {
      setShowNameExtras(true);
    }
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
    setTagsStr(
      (effectivePerson.tags || [])
        .map((t) => (t.startsWith('#') ? t : `#${t}`))
        .join(' ')
    );
    setNewTagDraft('');
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
    setShowAddGodparentForm(false);
    setShowAddGodchildForm(false);
    setShowAddWitnessedForm(false);
    setGodparentFeedbackMsg(null);
    setGodchildFeedbackMsg(null);
    setWitnessedFeedbackMsg(null);
  }, [effectivePerson?.id]);

  // Popular hashtags
  const popularHashtags = useMemo(() => {
    return getTreeHashtagsWithCounts(persons).slice(0, 10);
  }, [persons]);

  const handleAddHashtagsFromDraft = () => {
    if (!newTagDraft.trim()) return;
    const parsed = parseAndNormalizeTags(newTagDraft);
    if (parsed.length === 0) return;
    const currentList = parseAndNormalizeTags(tagsStr);
    const merged = new Set(currentList);
    parsed.forEach((t) => merged.add(t));
    setTagsStr(Array.from(merged).map((t) => `#${t}`).join(' '));
    setNewTagDraft('');
  };

  const handleAddHashtagSuggestion = (tagToAdd: string) => {
    const currentList = parseAndNormalizeTags(tagsStr);
    const clean = tagToAdd.replace(/^#+/, '').trim();
    if (!currentList.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      const next = [...currentList, clean];
      setTagsStr(next.map((t) => `#${t}`).join(' '));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentList = parseAndNormalizeTags(tagsStr);
    const updated = currentList.filter(
      (t) => t.toLowerCase() !== tagToRemove.toLowerCase()
    );
    setTagsStr(updated.map((t) => `#${t}`).join(' '));
  };

  const handleClearAllTags = () => {
    setTagsStr('');
    setNewTagDraft('');
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

  // Real-time Date validation calculations
  const personDateValidation = useMemo(() => {
    return validatePersonFormDates(birthDate, deathDate, marriageDate, isLiving);
  }, [birthDate, deathDate, marriageDate, isLiving]);

  const lifeEventsValidation = useMemo(() => {
    return lifeEvents.map((evt) => ({
      event: evt,
      ...validateLifeEventDate(evt.date, birthDate, deathDate, isLiving)
    }));
  }, [lifeEvents, birthDate, deathDate, isLiving]);

  const hasFutureLifeEvents = useMemo(() => {
    return lifeEventsValidation.some((v) => v.isFuture);
  }, [lifeEventsValidation]);

  const newEventValidation = useMemo(() => {
    return validateLifeEventDate(newEvent.date, birthDate, deathDate, isLiving);
  }, [newEvent.date, birthDate, deathDate, isLiving]);

  // Sync persistent accordion state when person changes or modal opens
  useEffect(() => {
    initPersonModalAccordion(effectivePerson?.id);
  }, [effectivePerson?.id, initPersonModalAccordion]);

  // Count of currently expanded accordion sections
  const openSectionsCount = useMemo(() => {
    return Object.values(openSections).filter(Boolean).length;
  }, [openSections]);

  const toggleSectionAccordion = (sectionId: ModalSection) => {
    togglePersonModalSection(sectionId, effectivePerson?.id);
  };

  const handleExpandAllSections = () => {
    expandAllPersonModalSections(effectivePerson?.id);
  };

  const handleCollapseAllSections = () => {
    collapseAllPersonModalSections(effectivePerson?.id);
  };

  const handleResetSectionsToDefault = () => {
    resetPersonModalSectionsToDefault(effectivePerson?.id);
  };

  // Scroll to section handler (opens accordion section and scrolls)
  const scrollToSection = (sectionId: ModalSection) => {
    setPersonModalActiveSection(sectionId, effectivePerson?.id);
    if (!openSections[sectionId]) {
      setPersonModalOpenSections((prev) => ({ ...prev, [sectionId]: true }), effectivePerson?.id);
    }
    setTimeout(() => {
      const el = document.getElementById(`sec-${sectionId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 40);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMobileNavCollapsed(true);
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
  const currentPersonId = effectivePerson?.id || personId || '';

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

      // Synchronize bidirectional reference immediately
      if (currentPersonId) {
        const isWitness = newGodparentRole === 'witness';
        if (isWitness) {
          const updatedWitnessed = Array.from(new Set([...(existingPerson.witnessedPersonIds || []), currentPersonId]));
          updatePerson({
            ...existingPerson,
            witnessedPersonIds: updatedWitnessed
          });
        } else {
          const updatedGodchildren = Array.from(new Set([...(existingPerson.godchildrenIds || []), currentPersonId]));
          updatePerson({
            ...existingPerson,
            godchildrenIds: updatedGodchildren
          });
        }
      }

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

    const isWitnessRole = newGodparentRole === 'witness';
    const targetLinkChildId = currentPersonId;

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
      godchildrenIds: !isWitnessRole && targetLinkChildId ? [targetLinkChildId] : [],
      witnessedPersonIds: isWitnessRole && targetLinkChildId ? [targetLinkChildId] : []
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
    const gpToRemove = godparents.find((gp) => gp.id === id);
    if (gpToRemove?.personId && effectivePerson) {
      const gpPerson = persons.find((p) => p.id === gpToRemove.personId);
      if (gpPerson) {
        const isWitness = gpToRemove.role === 'witness' || /свідок|поручитель/i.test(gpToRemove.role || '');
        if (isWitness && gpPerson.witnessedPersonIds) {
          updatePerson({
            ...gpPerson,
            witnessedPersonIds: gpPerson.witnessedPersonIds.filter((cid) => cid !== effectivePerson.id)
          });
        } else if (gpPerson.godchildrenIds) {
          updatePerson({
            ...gpPerson,
            godchildrenIds: gpPerson.godchildrenIds.filter((cid) => cid !== effectivePerson.id)
          });
        }
      }
    }
    setGodparents((prev) => prev.filter((gp) => gp.id !== id));
  };

  const currentPersonDisplayName = useMemo(() => {
    return [lastName, firstName, patronymic].filter(Boolean).join(' ').trim();
  }, [lastName, firstName, patronymic]);

  // List of godchildren for the current effectivePerson (хресники / похресники) - calculated bidirectionally
  const linkedGodchildren = useMemo(() => {
    return getBidirectionalGodchildren(currentPersonId, currentPersonDisplayName, persons, effectivePerson);
  }, [currentPersonId, currentPersonDisplayName, persons, effectivePerson]);

  // List of persons where currentPerson was a witness / guarantor (де особа була свідком / поручителем) - calculated bidirectionally
  const linkedWitnessedPersons = useMemo(() => {
    return getBidirectionalWitnessedPersons(currentPersonId, currentPersonDisplayName, persons, effectivePerson);
  }, [currentPersonId, currentPersonDisplayName, persons, effectivePerson]);

  // Merged list of godparents for display to ensure bidirectional completeness
  const displayGodparents = useMemo(() => {
    return getMergedGodparents(effectivePerson, godparents, persons);
  }, [effectivePerson, godparents, persons]);

  // Select existing godparent with auto-detected gender role
  const handleSelectExistingGodparent = (pId: string) => {
    setSelectedExistingGodparentId(pId);
    const p = persons.find((item) => item.id === pId);
    if (p) {
      if (p.gender === 'female' || p.gender === 'F') {
        setNewGodparentRole('godmother');
      } else if (p.gender === 'male' || p.gender === 'M') {
        setNewGodparentRole('godfather');
      }
    }
  };

  // Alphabetically sorted & filtered persons for godparents
  const filteredGodparentPersons = useMemo(() => {
    const q = godparentSearchQuery.trim().toLowerCase();
    return persons
      .filter((p) => {
        if (p.id === currentPersonId) return false;
        if (godparents.some((gp) => gp.personId === p.id)) return false;
        if (!q) return true;
        const name = `${p.name?.surname || p.lastName || ''} ${p.name?.given || p.firstName || ''} ${p.name?.patronymic || p.patronymic || ''}`.toLowerCase();
        return name.includes(q);
      })
      .sort((a, b) => {
        const nameA = `${a.name?.surname || a.lastName || ''} ${a.name?.given || a.firstName || ''}`.trim().toLowerCase();
        const nameB = `${b.name?.surname || b.lastName || ''} ${b.name?.given || b.firstName || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB, 'uk');
      });
  }, [persons, currentPersonId, godparents, godparentSearchQuery]);

  // Alphabetically sorted & filtered persons for godchildren
  const filteredGodchildPersons = useMemo(() => {
    const q = godchildSearchQuery.trim().toLowerCase();
    return persons
      .filter((p) => {
        if (p.id === currentPersonId) return false;
        if (linkedGodchildren.some((g) => g.person.id === p.id)) return false;
        if (tempGodchildren.some((t) => t.id === p.id)) return false;
        if (!q) return true;
        const name = `${p.name?.surname || p.lastName || ''} ${p.name?.given || p.firstName || ''} ${p.name?.patronymic || p.patronymic || ''}`.toLowerCase();
        return name.includes(q);
      })
      .sort((a, b) => {
        const nameA = `${a.name?.surname || a.lastName || ''} ${a.name?.given || a.firstName || ''}`.trim().toLowerCase();
        const nameB = `${b.name?.surname || b.lastName || ''} ${b.name?.given || b.firstName || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB, 'uk');
      });
  }, [persons, currentPersonId, linkedGodchildren, tempGodchildren, godchildSearchQuery]);

  // Alphabetically sorted & filtered persons for witnesses
  const filteredWitnessPersons = useMemo(() => {
    const q = witnessedSearchQuery.trim().toLowerCase();
    return persons
      .filter((p) => {
        if (p.id === currentPersonId) return false;
        if (linkedWitnessedPersons.some((w) => w.person.id === p.id)) return false;
        if (tempWitnessedPersons.some((t) => t.id === p.id)) return false;
        if (!q) return true;
        const name = `${p.name?.surname || p.lastName || ''} ${p.name?.given || p.firstName || ''} ${p.name?.patronymic || p.patronymic || ''}`.toLowerCase();
        return name.includes(q);
      })
      .sort((a, b) => {
        const nameA = `${a.name?.surname || a.lastName || ''} ${a.name?.given || a.firstName || ''}`.trim().toLowerCase();
        const nameB = `${b.name?.surname || b.lastName || ''} ${b.name?.given || b.firstName || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB, 'uk');
      });
  }, [persons, currentPersonId, linkedWitnessedPersons, tempWitnessedPersons, witnessedSearchQuery]);

  // Combined godchildren (saved + temp for new person)
  const allDisplayGodchildren = useMemo(() => {
    const list = [...linkedGodchildren];
    tempGodchildren.forEach((tg) => {
      if (!list.some((item) => item.person.id === tg.id)) {
        list.push({
          person: tg.person,
          roleLabel: tg.person.gender === 'female' ? 'Хрещениця' : 'Хрещеник',
          notes: tg.notes,
          parentsLabel: undefined,
          coGodparents: undefined
        });
      }
    });
    return list;
  }, [linkedGodchildren, tempGodchildren]);

  // Combined witnessed persons (saved + temp for new person)
  const allDisplayWitnessedPersons = useMemo(() => {
    const list = [...linkedWitnessedPersons];
    tempWitnessedPersons.forEach((tw) => {
      if (!list.some((item) => item.person.id === tw.id)) {
        list.push({
          person: tw.person,
          roleLabel: 'Свідок / Поручитель',
          eventLabel: undefined,
          notes: tw.notes,
          coWitnesses: undefined
        });
      }
    });
    return list;
  }, [linkedWitnessedPersons, tempWitnessedPersons]);

  const handleAddGodchild = () => {
    if (godchildMode === 'select_existing') {
      if (!selectedExistingGodchildId) {
        setGodchildFeedbackMsg({ text: 'Будь ласка, оберіть особу зі списку.', type: 'info' });
        return;
      }
      const childPerson = persons.find((p) => p.id === selectedExistingGodchildId);
      if (!childPerson) return;

      const childFullName = `${childPerson.name?.surname || childPerson.lastName || ''} ${childPerson.name?.given || childPerson.firstName || ''}`.trim() || 'Особу';

      if (!effectivePerson) {
        setTempGodchildren((prev) => [...prev, {
          id: childPerson.id,
          person: childPerson,
          notes: newGodchildNotes.trim()
        }]);
        setSelectedExistingGodchildId('');
        setGodchildSearchQuery('');
        setNewGodchildNotes('');
        setShowAddGodchildForm(false);
        setGodchildFeedbackMsg({
          text: `Особу «${childFullName}» додано як хрещеника!`,
          type: 'success'
        });
        setTimeout(() => setGodchildFeedbackMsg(null), 5000);
        return;
      }

      const isFem = gender === 'female' || gender === 'F';
      const selfName = `${lastName || ''} ${firstName || ''}`.trim() || 'Хрещений';

      const newGp: GodparentItem = {
        id: crypto.randomUUID(),
        personId: effectivePerson.id,
        name: selfName,
        role: isFem ? 'godmother' : 'godfather',
        notes: newGodchildNotes.trim() || (isFem ? 'Хрещена мати' : 'Хрещений батько')
      };

      const updatedChildGps = [...(childPerson.godparents || []).filter((g) => g.personId !== effectivePerson.id), newGp];
      const updatedChildGpIds = Array.from(new Set([...(childPerson.godparentIds || []), effectivePerson.id]));

      updatePerson({
        ...childPerson,
        godparents: updatedChildGps,
        godparentIds: updatedChildGpIds
      });

      const updatedMyGodchildren = Array.from(new Set([...(effectivePerson.godchildrenIds || []), childPerson.id]));
      updatePerson({
        ...effectivePerson,
        godchildrenIds: updatedMyGodchildren
      });

      setSelectedExistingGodchildId('');
      setGodchildSearchQuery('');
      setNewGodchildNotes('');
      setShowAddGodchildForm(false);
      setGodchildFeedbackMsg({
        text: `Особу «${childFullName}» додано як хрещеника!`,
        type: 'success'
      });
      setTimeout(() => setGodchildFeedbackMsg(null), 5000);
      return;
    }

    // Create new person as godchild
    if (!newGodchildName.trim()) {
      setGodchildFeedbackMsg({ text: 'Будь ласка, введіть ПІБ або ім\'я хрещеника.', type: 'info' });
      return;
    }

    const parsed = parseFullNameComponents(newGodchildName.trim());
    const detectedGender = newGodchildGender || (detectGenderFromName(parsed.given, parsed.patronymic, parsed.surname) as Gender) || 'male';
    const newChildId = `p-ch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const fullDisplayName = [parsed.surname, parsed.given, parsed.patronymic].filter(Boolean).join(' ') || newGodchildName.trim();

    const isFem = gender === 'female' || gender === 'F';
    const selfName = `${lastName || ''} ${firstName || ''}`.trim() || 'Хрещений';

    const newChildPerson: Person = {
      id: newChildId,
      name: {
        given: parsed.given,
        surname: parsed.surname,
        patronymic: parsed.patronymic || undefined
      },
      firstName: parsed.given,
      lastName: parsed.surname,
      patronymic: parsed.patronymic || undefined,
      gender: detectedGender,
      birthYear: newGodchildBirthYear.trim() ? parseInt(newGodchildBirthYear.trim(), 10) : undefined,
      researchStatus: 'confirmed',
      researchBranch: researchBranch && researchBranch !== 'Без прив\'язки' ? researchBranch : 'Без прив\'язки',
      notes: newGodchildNotes.trim() || undefined,
      isLiving: false,
      godparents: currentPersonId
        ? [
            {
              id: crypto.randomUUID(),
              personId: currentPersonId,
              name: selfName,
              role: isFem ? 'godmother' : 'godfather',
              notes: isFem ? 'Хрещена мати' : 'Хрещений батько'
            }
          ]
        : undefined,
      godparentIds: currentPersonId ? [currentPersonId] : undefined
    };

    addPerson(newChildPerson);

    if (effectivePerson) {
      const updatedMyGodchildren = Array.from(new Set([...(effectivePerson.godchildrenIds || []), newChildId]));
      updatePerson({
        ...effectivePerson,
        godchildrenIds: updatedMyGodchildren
      });
    } else {
      setTempGodchildren((prev) => [...prev, { id: newChildId, person: newChildPerson, notes: newGodchildNotes.trim() }]);
    }

    setNewGodchildName('');
    setNewGodchildBirthYear('');
    setNewGodchildNotes('');
    setShowAddGodchildForm(false);
    setGodchildFeedbackMsg({
      text: `Створено нову особу «${fullDisplayName}» та додано як хрещеника!`,
      type: 'success'
    });
    setTimeout(() => setGodchildFeedbackMsg(null), 5000);
  };

  const handleUnlinkGodchild = (childPersonId: string) => {
    if (!effectivePerson) {
      setTempGodchildren((prev) => prev.filter((t) => t.id !== childPersonId));
      return;
    }
    const child = persons.find((p) => p.id === childPersonId);
    if (child) {
      const updatedGps = (child.godparents || []).filter((g) => g.personId !== currentPersonId);
      const updatedGpIds = (child.godparentIds || []).filter((id) => id !== currentPersonId);
      updatePerson({
        ...child,
        godparents: updatedGps.length > 0 ? updatedGps : undefined,
        godparentIds: updatedGpIds.length > 0 ? updatedGpIds : undefined
      });
    }
    const updatedGchildren = (effectivePerson.godchildrenIds || []).filter((id) => id !== childPersonId);
    updatePerson({
      ...effectivePerson,
      godchildrenIds: updatedGchildren.length > 0 ? updatedGchildren : undefined
    });
  };

  const handleAddWitnessedPerson = () => {
    if (!selectedExistingWitnessedId) {
      setWitnessedFeedbackMsg({ text: 'Будь ласка, оберіть особу зі списку.', type: 'info' });
      return;
    }
    const target = persons.find((p) => p.id === selectedExistingWitnessedId);
    if (!target) return;

    const targetFullName = `${target.name?.surname || target.lastName || ''} ${target.name?.given || target.firstName || ''}`.trim() || 'Особу';

    if (!effectivePerson) {
      setTempWitnessedPersons((prev) => [...prev, {
        id: target.id,
        person: target,
        notes: newWitnessedNotes.trim()
      }]);
      setSelectedExistingWitnessedId('');
      setWitnessedSearchQuery('');
      setNewWitnessedNotes('');
      setShowAddWitnessedForm(false);
      setWitnessedFeedbackMsg({
        text: `Особу «${targetFullName}» прив'язано до свідчень!`,
        type: 'success'
      });
      setTimeout(() => setWitnessedFeedbackMsg(null), 5000);
      return;
    }

    const selfName = `${lastName || ''} ${firstName || ''}`.trim() || 'Свідок';

    const newGp: GodparentItem = {
      id: crypto.randomUUID(),
      personId: effectivePerson.id,
      name: selfName,
      role: 'witness',
      notes: newWitnessedNotes.trim() || 'Свідок / поручитель'
    };

    const updatedGps = [...(target.godparents || []).filter((g) => g.personId !== effectivePerson.id), newGp];
    const updatedGpIds = Array.from(new Set([...(target.godparentIds || []), effectivePerson.id]));
    const updatedWitnessIds = Array.from(new Set([...(target.witnessIds || []), effectivePerson.id]));

    updatePerson({
      ...target,
      godparents: updatedGps,
      godparentIds: updatedGpIds,
      witnessIds: updatedWitnessIds
    });

    const updatedMyWitnessed = Array.from(new Set([...(effectivePerson.witnessedPersonIds || []), target.id]));
    updatePerson({
      ...effectivePerson,
      witnessedPersonIds: updatedMyWitnessed
    });

    setSelectedExistingWitnessedId('');
    setWitnessedSearchQuery('');
    setNewWitnessedNotes('');
    setShowAddWitnessedForm(false);
    setWitnessedFeedbackMsg({
      text: `Особу «${targetFullName}» прив'язано до свідчень!`,
      type: 'success'
    });
    setTimeout(() => setWitnessedFeedbackMsg(null), 5000);
  };

  const handleUnlinkWitnessedPerson = (witnessedPersonId: string) => {
    if (!effectivePerson) {
      setTempWitnessedPersons((prev) => prev.filter((t) => t.id !== witnessedPersonId));
      return;
    }
    const target = persons.find((p) => p.id === witnessedPersonId);
    if (target) {
      const updatedGps = (target.godparents || []).filter(
        (g) => !(g.personId === currentPersonId && (g.role === 'witness' || /свідок|поручитель/i.test(g.role || '')))
      );
      const updatedGpIds = (target.godparentIds || []).filter((id) => id !== currentPersonId);
      const updatedWitnessIds = (target.witnessIds || []).filter((id) => id !== currentPersonId);
      updatePerson({
        ...target,
        godparents: updatedGps.length > 0 ? updatedGps : undefined,
        godparentIds: updatedGpIds.length > 0 ? updatedGpIds : undefined,
        witnessIds: updatedWitnessIds.length > 0 ? updatedWitnessIds : undefined
      });
    }
    const updatedMyWitnessed = (effectivePerson.witnessedPersonIds || []).filter((id) => id !== witnessedPersonId);
    updatePerson({
      ...effectivePerson,
      witnessedPersonIds: updatedMyWitnessed.length > 0 ? updatedMyWitnessed : undefined
    });
  };

  // Add Life Event
  const handleAddLifeEvent = () => {
    if (!newEvent.title && !newEvent.type) return;
    if (newEventValidation.isFuture) {
      alert(`Неможливо додати подію: ${newEventValidation.message || 'дата події вказує на майбутній час'}.`);
      return;
    }
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

    // Duplicate check for new persons: warn if high confidence matches exist
    if (
      !effectivePerson &&
      potentialDuplicates.some((d) => d.confidence >= 65) &&
      !duplicateWarningDismissedForSave
    ) {
      setShowDuplicateSaveDialog(true);
      return;
    }

    // Chronological and future date validation check
    if (
      (personDateValidation.hasErrors || hasFutureLifeEvents) &&
      !dateValidationDismissedForSave
    ) {
      setShowDateValidationDialog(true);
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
        godparentIds: godparents.map((gp) => gp.personId).filter(Boolean) as string[],
        godchildrenIds: effectivePerson.godchildrenIds && effectivePerson.godchildrenIds.length > 0 ? effectivePerson.godchildrenIds : undefined,
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
        godparentIds: godparents.map((gp) => gp.personId).filter(Boolean) as string[],
        godchildrenIds: tempGodchildren.length > 0 ? tempGodchildren.map((t) => t.id) : undefined,
        witnessedPersonIds: tempWitnessedPersons.length > 0 ? tempWitnessedPersons.map((t) => t.id) : undefined,
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
          } else if (initialRelation.type === 'godparent') {
            const isFemale = gender === 'female' || gender === 'F';
            const role = isFemale ? 'godmother' : 'godfather';
            const existingGps = target.godparents || [];
            const newGp: GodparentItem = {
              id: crypto.randomUUID(),
              personId: savedPersonId,
              name: `${lastName || ''} ${firstName || ''}`.trim() || 'Хрещений',
              role,
              notes: isFemale ? 'Хрещена мати' : 'Хрещений батько'
            };
            updatePerson({
              ...target,
              godparents: [...existingGps, newGp],
              godparentIds: Array.from(new Set([...(target.godparentIds || []), savedPersonId]))
            });
            newPerson.godchildrenIds = Array.from(new Set([...(newPerson.godchildrenIds || []), target.id]));
          } else if (initialRelation.type === 'witness') {
            const existingGps = target.godparents || [];
            const newGp: GodparentItem = {
              id: crypto.randomUUID(),
              personId: savedPersonId,
              name: `${lastName || ''} ${firstName || ''}`.trim() || 'Свідок',
              role: 'witness',
              notes: 'Свідок / поручитель'
            };
            updatePerson({
              ...target,
              godparents: [...existingGps, newGp],
              godparentIds: Array.from(new Set([...(target.godparentIds || []), savedPersonId])),
              witnessIds: Array.from(new Set([...(target.witnessIds || []), savedPersonId]))
            });
            newPerson.witnessedPersonIds = Array.from(new Set([...(newPerson.witnessedPersonIds || []), target.id]));
          } else if (initialRelation.type === 'godchild') {
            const isTargetFemale = target.gender === 'female' || target.gender === 'F';
            const role = isTargetFemale ? 'godmother' : 'godfather';
            const targetName = `${target.name?.surname || target.lastName || ''} ${target.name?.given || target.firstName || ''}`.trim() || 'Хрещений';
            const newGp: GodparentItem = {
              id: crypto.randomUUID(),
              personId: target.id,
              name: targetName,
              role,
              notes: isTargetFemale ? 'Хрещена мати' : 'Хрещений батько'
            };
            newPerson.godparents = [newGp];
            newPerson.godparentIds = [target.id];
            updatePerson({
              ...target,
              godchildrenIds: Array.from(new Set([...(target.godchildrenIds || []), savedPersonId]))
            });
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

    // Synchronize all linked godparents and witnesses so their godchildrenIds / witnessedPersonIds includes this saved person
    if (godparents.length > 0) {
      godparents.forEach((gp) => {
        if (gp.personId) {
          const gpPerson = persons.find((p) => p.id === gp.personId);
          if (gpPerson) {
            const isWitness = gp.role === 'witness' || /свідок|поручитель/i.test(gp.role || '') || /свідок|поручитель/i.test(gp.notes || '');
            if (isWitness) {
              const currentWitnessed = gpPerson.witnessedPersonIds || [];
              if (!currentWitnessed.includes(savedPersonId)) {
                updatePerson({
                  ...gpPerson,
                  witnessedPersonIds: [...currentWitnessed, savedPersonId]
                });
              }
            } else {
              const currentGodchildren = gpPerson.godchildrenIds || [];
              if (!currentGodchildren.includes(savedPersonId)) {
                updatePerson({
                  ...gpPerson,
                  godchildrenIds: [...currentGodchildren, savedPersonId]
                });
              }
            }
          }
        }
      });
    }

    // Synchronize temp godchildren when saving newly created person
    if (!effectivePerson && tempGodchildren.length > 0) {
      tempGodchildren.forEach((tg) => {
        const childPerson = persons.find((p) => p.id === tg.id);
        if (childPerson) {
          const isFem = gender === 'female' || gender === 'F';
          const selfName = `${lastName || ''} ${firstName || ''}`.trim() || 'Хрещений';
          const newGp: GodparentItem = {
            id: crypto.randomUUID(),
            personId: savedPersonId,
            name: selfName,
            role: isFem ? 'godmother' : 'godfather',
            notes: tg.notes || (isFem ? 'Хрещена мати' : 'Хрещений батько')
          };
          const updatedChildGps = [...(childPerson.godparents || []).filter((g) => g.personId !== savedPersonId), newGp];
          const updatedChildGpIds = Array.from(new Set([...(childPerson.godparentIds || []), savedPersonId]));
          updatePerson({
            ...childPerson,
            godparents: updatedChildGps,
            godparentIds: updatedChildGpIds
          });
        }
      });
    }

    // Synchronize temp witnesses when saving newly created person
    if (!effectivePerson && tempWitnessedPersons.length > 0) {
      tempWitnessedPersons.forEach((tw) => {
        const target = persons.find((p) => p.id === tw.id);
        if (target) {
          const selfName = `${lastName || ''} ${firstName || ''}`.trim() || 'Свідок';
          const newGp: GodparentItem = {
            id: crypto.randomUUID(),
            personId: savedPersonId,
            name: selfName,
            role: 'witness',
            notes: tw.notes || 'Свідок / поручитель'
          };
          const updatedGps = [...(target.godparents || []).filter((g) => g.personId !== savedPersonId), newGp];
          const updatedGpIds = Array.from(new Set([...(target.godparentIds || []), savedPersonId]));
          const updatedWitnessIds = Array.from(new Set([...(target.witnessIds || []), savedPersonId]));
          updatePerson({
            ...target,
            godparents: updatedGps,
            godparentIds: updatedGpIds,
            witnessIds: updatedWitnessIds
          });
        }
      });
    }

    // If any godparent or witness was removed from an existing person, remove savedPersonId from their godchildrenIds / witnessedPersonIds
    if (effectivePerson) {
      const oldGps = effectivePerson.godparents || [];
      const oldGpIds = oldGps.map((gp) => gp.personId).filter(Boolean) as string[];
      const newGpIds = godparents.map((gp) => gp.personId).filter(Boolean) as string[];
      const removedGpIds = oldGpIds.filter((id) => !newGpIds.includes(id));
      removedGpIds.forEach((gpId) => {
        const gpPerson = persons.find((p) => p.id === gpId);
        if (gpPerson) {
          const oldGpRec = oldGps.find((g) => g.personId === gpId);
          const wasWitness = oldGpRec?.role === 'witness' || /свідок|поручитель/i.test(oldGpRec?.role || '');
          if (wasWitness && gpPerson.witnessedPersonIds) {
            updatePerson({
              ...gpPerson,
              witnessedPersonIds: gpPerson.witnessedPersonIds.filter((cid) => cid !== savedPersonId)
            });
          } else if (gpPerson.godchildrenIds) {
            updatePerson({
              ...gpPerson,
              godchildrenIds: gpPerson.godchildrenIds.filter((cid) => cid !== savedPersonId)
            });
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
      case 'godparent':
        return `Додати хрещеного/хрещену для: ${name}`;
      case 'witness':
        return `Додати свідка/поручителя для: ${name}`;
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

            {effectivePerson && (
              <button
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl text-neutral-600 dark:text-neutral-300 hover:text-amber-600 hover:bg-amber-500/10 border border-black/10 dark:border-white/10 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                title="Сформувати текстовий звіт про особу або експортувати в PDF"
              >
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden md:inline">Звіт (PDF/TXT)</span>
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

            {effectivePerson && !isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  setMergeModalPair({ idA: effectivePerson.id, idB: '' });
                  setIsMergeModalOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-xl text-neutral-600 dark:text-neutral-300 hover:text-amber-600 hover:bg-amber-500/10 border border-black/10 dark:border-white/10 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                title="Обʼєднати з іншою особою по ID"
              >
                <GitMerge className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden md:inline">Обʼєднати по ID</span>
              </button>
            )}

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
          <div className={`w-full md:w-64 lg:w-72 border-b md:border-b-0 md:border-r border-black/10 dark:border-white/10 flex flex-col shrink-0 bg-black/[0.02] dark:bg-white/[0.02] p-3 md:p-4 overflow-y-auto ${isMobileNavCollapsed ? 'max-md:py-2 max-md:px-3' : ''}`}>
            
            {/* Mobile-Only Collapsible Header Bar */}
            <div className="md:hidden flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border ${
                  avatarUrl
                    ? 'border-[#B88E3E]'
                    : gender === 'female'
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                }`}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{firstName ? firstName[0].toUpperCase() : '?'}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate text-neutral-900 dark:text-neutral-100 leading-tight">
                    {computedFullName}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate flex items-center gap-1.5 leading-tight mt-0.5">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {MODAL_SECTIONS.find((s) => s.id === activeSection)?.label || 'Основне'}
                    </span>
                    <span>•</span>
                    <span className="text-[#B88E3E] font-medium">{profileCompletion}%</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                id="toggle-mobile-person-sections-btn"
                onClick={() => setIsMobileNavCollapsed(!isMobileNavCollapsed)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#B88E3E]/15 hover:bg-[#B88E3E]/25 text-[#B88E3E] dark:text-amber-300 border border-[#B88E3E]/30 flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs"
                title={isMobileNavCollapsed ? 'Розгорнути список розділів' : 'Згорнути список розділів'}
              >
                <span>{isMobileNavCollapsed ? 'Розділи' : 'Згорнути'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMobileNavCollapsed ? '' : 'rotate-180'}`} />
              </button>
            </div>

            {/* Quick Horizontal Section Chips on Mobile when collapsed */}
            {isMobileNavCollapsed && (
              <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {MODAL_SECTIONS.map((item) => {
                  const isActive = activeSection === item.id;
                  const Icon = item.icon;
                  const hasSectionError =
                    (item.id === 'dates-places' && personDateValidation.hasErrors) ||
                    (item.id === 'events' && hasFutureLifeEvents);
                  return (
                    <button
                      key={`quick-${item.id}`}
                      type="button"
                      onClick={() => scrollToSection(item.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-xs font-bold'
                          : hasSectionError
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-400/50'
                          : 'bg-white dark:bg-slate-900 text-neutral-600 dark:text-neutral-300 border border-black/10 dark:border-white/10'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{item.label}</span>
                      {hasSectionError && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Collapsible Content Wrapper (hidden on mobile when collapsed, always flex on desktop) */}
            <div className={`${isMobileNavCollapsed ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}>
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
                {MODAL_SECTIONS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  const hasSectionError =
                    (item.id === 'dates-places' && personDateValidation.hasErrors) ||
                    (item.id === 'events' && hasFutureLifeEvents);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollToSection(item.id)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        isActive
                          ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 shadow-xs'
                          : hasSectionError
                          ? 'bg-rose-50/70 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800/40 hover:bg-rose-100/60'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : hasSectionError ? 'text-rose-500' : 'text-neutral-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.id === 'dates-places' && personDateValidation.hasErrors && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Помилка</span>
                          </span>
                        )}
                        {item.id === 'events' && hasFutureLifeEvents && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Майбутнє</span>
                          </span>
                        )}
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {effectivePerson && (
                <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsReportModalOpen(true)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-all cursor-pointer shadow-xs"
                    title="Сформувати текстовий звіт про особу або експортувати в PDF"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Звіт про особу (PDF/TXT)</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Scrollable Content Area */}
          <div
            ref={contentAreaRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin"
          >
            {/* Live Duplicate Prevention Banner */}
            {potentialDuplicates.length > 0 && (
              <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 shadow-xs animate-in fade-in duration-200 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-950 dark:text-amber-200">
                        Виявлено схожу особу в базі (можливий дублікат)
                      </h4>
                      <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                        {potentialDuplicates.length === 1
                          ? 'Знайдено 1 профіль зі схожими ПІБ, датами або звʼязками'
                          : `Знайдено ${potentialDuplicates.length} профілів зі схожими даними`}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 shrink-0">
                    Перевірка дублікатів
                  </span>
                </div>

                <div className="space-y-2">
                  {potentialDuplicates.slice(0, 3).map((match) => {
                    const matchPerson = match.person;
                    const matchName = `${matchPerson.name?.surname || matchPerson.lastName || ''} ${matchPerson.name?.given || matchPerson.firstName || ''} ${matchPerson.name?.patronymic || matchPerson.patronymic || ''}`.trim() || 'Без імені';
                    const father = persons.find((p) => p.id === matchPerson.fatherId);
                    const mother = persons.find((p) => p.id === matchPerson.motherId);

                    return (
                      <div
                        key={matchPerson.id}
                        className="p-3 rounded-xl bg-white/80 dark:bg-slate-850/90 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-neutral-900 dark:text-neutral-100 truncate">
                              {matchName}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                              ID: {matchPerson.id}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              match.confidence >= 75
                                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                : 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                            }`}>
                              {match.confidence}% схожість
                            </span>
                          </div>

                          <div className="text-[11px] text-neutral-500 flex flex-wrap items-center gap-x-2">
                            {(matchPerson.birthDate || matchPerson.birthYear) && (
                              <span>Нар: {matchPerson.birthDate || matchPerson.birthYear}</span>
                            )}
                            {(matchPerson.deathDate || matchPerson.deathYear) && (
                              <span>См: {matchPerson.deathDate || matchPerson.deathYear}</span>
                            )}
                            {matchPerson.birthPlace && <span>Місце: {matchPerson.birthPlace}</span>}
                            {(father || mother) && (
                              <span>
                                Батьки: {father ? (father.name?.surname || father.lastName || father.firstName) : ''}
                                {father && mother ? ', ' : ''}
                                {mother ? (mother.name?.surname || mother.lastName || mother.firstName) : ''}
                              </span>
                            )}
                          </div>

                          {match.reasons.length > 0 && (
                            <div className="text-[10px] text-amber-700 dark:text-amber-400">
                              Причина збігу: {match.reasons.join(', ')}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleUseExistingPerson(matchPerson)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1"
                            title="Використати цей існуючий профіль, щоб не створювати дублікат"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{initialRelation ? 'Приєднати цю особу' : 'Відкрити профіль'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setMergeModalPair({
                                idA: effectivePerson?.id || matchPerson.id,
                                idB: effectivePerson ? matchPerson.id : ''
                              });
                              setIsMergeModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 transition-colors cursor-pointer flex items-center gap-1"
                            title="Обʼєднати з цією особою по ID"
                          >
                            <GitMerge className="w-3.5 h-3.5 text-amber-500" />
                            <span>Злити по ID</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDismissedDuplicateIds((prev) => [...prev, matchPerson.id])}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            title="Ігнорувати / Це інша особа"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Accordion Controls Bar with persistence indicator & quick controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 py-1 px-1 text-xs">
              <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 font-medium">
                <span className="text-xs uppercase tracking-wider font-bold text-[#B88E3E]">Анкета особи</span>
                <span>•</span>
                <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  {openSectionsCount} з 8 відкрито
                </span>
                <span
                  className="hidden sm:inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20"
                  title="Стан розгорнутих секцій автоматично зберігається при закритті чи переході"
                >
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Стан збережено</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                {openSectionsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetSectionsToDefault}
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    title="Скинути розкриття секцій до початкового стану (всі секції згорнуті)"
                  >
                    За замовчуванням
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExpandAllSections}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5 border border-black/10 dark:border-white/10 transition-colors cursor-pointer"
                >
                  Розгорнути всі
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAllSections}
                  disabled={openSectionsCount === 0}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                    openSectionsCount === 0
                      ? 'opacity-40 border-black/5 dark:border-white/5 text-neutral-400 cursor-not-allowed'
                      : 'text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5 border-black/10 dark:border-white/10'
                  }`}
                >
                  Згорнути всі
                </button>
              </div>
            </div>

            {/* SECTION 1: Основне (Accordion) */}
            <div id="sec-basic" className={`rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all`}>
              <button
                type="button"
                onClick={() => toggleSectionAccordion('basic')}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${openSections.basic ? 'bg-[#B88E3E] text-white' : 'bg-black/5 dark:bg-white/5 text-neutral-500'}`}>
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Основне та теги</h3>
                    <p className={`text-xs ${theme.textMuted}`}>Дослідження, статус, хештеги та статус життя</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!openSections.basic && (
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium hidden sm:inline-block">
                      {isLiving ? '🟢' : '✝'} • {researchBranch} {currentTagsList.length > 0 && `• #${currentTagsList[0]}`}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${openSections.basic ? 'rotate-180 text-[#B88E3E]' : ''}`} />
                </div>
              </button>

              {openSections.basic && (
                <div className="p-4 pt-2 border-t border-black/5 dark:border-white/5 space-y-2.5">
                  {/* Compact row: 1. Дослідження, 2. Статус дослідження, 3. Хештеги, 4. Статус життя */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                    {/* 1. Дослідження */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[10px] flex items-center gap-1">
                          <span>🌳</span>
                          <span>Дослідження</span>
                        </label>
                        {currentInheritance.suggestedBranch && researchBranch === currentInheritance.suggestedBranch && (
                          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>успадковано</span>
                          </span>
                        )}
                      </div>
                      <select
                        value={researchBranch}
                        onChange={(e) => {
                          setResearchBranch(e.target.value);
                          setAutoInheritedValues(prev => ({ ...prev, branch: undefined }));
                        }}
                        className={`w-full py-1.5 px-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E] h-[34px]`}
                      >
                        {allAvailableBranches.map((br) => (
                          <option key={br} value={br}>
                            {br}
                          </option>
                        ))}
                      </select>
                      {currentInheritance.suggestedBranch && researchBranch !== currentInheritance.suggestedBranch && (
                        <button
                          type="button"
                          onClick={() => {
                            setResearchBranch(currentInheritance.suggestedBranch!);
                            setAutoInheritedValues(prev => ({ ...prev, branch: currentInheritance.suggestedBranch }));
                          }}
                          className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                          title="Застосувати гілку дослідження від батьків"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                          <span className="truncate">Гілка батьків: {currentInheritance.suggestedBranch}</span>
                        </button>
                      )}
                    </div>

                    {/* 2. Статус дослідження */}
                    <div className="space-y-1">
                      <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[10px] flex items-center gap-1">
                        <span>📋</span>
                        <span>Статус <span className="text-rose-500">*</span></span>
                      </label>
                      <select
                        value={researchStatus}
                        onChange={(e) => setResearchStatus(e.target.value)}
                        className={`w-full py-1.5 px-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E] h-[34px]`}
                      >
                        <option value="hypothetical">❓ Гіпотетична</option>
                        <option value="confirmed">✅ Підтверджена</option>
                        <option value="in_progress">⏳ В процесі</option>
                        <option value="needs_verification">⚠️ Потребує перевірки</option>
                        <option value="archival_search">🔍 Архівний пошук</option>
                      </select>
                    </div>

                    {/* 3. Хештег (розміщено замість статі для компактності) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[10px] flex items-center gap-1">
                          <Tag className="w-3 h-3 text-[#B88E3E]" />
                          <span>Хештег</span>
                        </label>
                        {currentTagsList.length > 0 && (
                          <span className="text-[9px] text-[#B88E3E] font-medium">
                            {currentTagsList.length}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="relative flex-1">
                          <Hash className="w-3 h-3 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={newTagDraft}
                            onChange={(e) => setNewTagDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault();
                                handleAddHashtagsFromDraft();
                              }
                            }}
                            placeholder="тег..."
                            className={`w-full pl-6 pr-1.5 py-1.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E] h-[34px]`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddHashtagsFromDraft}
                          disabled={!newTagDraft.trim()}
                          className="px-2.5 h-[34px] rounded-xl bg-[#B88E3E] hover:bg-[#a07b34] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all flex items-center justify-center shrink-0 cursor-pointer"
                          title="Додати хештег"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>

                    {/* 4. Статус життя (компактні іконки без зайвих слів) */}
                    <div className="space-y-1">
                      <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[10px] flex items-center gap-1">
                        <span>Статус</span>
                      </label>
                      <div className={`flex items-center p-0.5 rounded-xl border ${theme.inputBorder} ${theme.inputBg} h-[34px]`}>
                        <button
                          type="button"
                          onClick={() => setIsLiving(true)}
                          className={`flex-1 h-full rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                            isLiving
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                          }`}
                          title="Жива особа"
                        >
                          <span className="text-sm">🟢</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsLiving(false)}
                          className={`flex-1 h-full rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                            !isLiving
                              ? 'bg-neutral-700 text-white shadow-xs'
                              : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                          }`}
                          title="Померла особа"
                        >
                          <span className="text-sm">✝</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Active tags badges and history */}
                  {(currentTagsList.length > 0 || popularHashtags.length > 0) && (
                    <div className="pt-2 border-t border-black/5 dark:border-white/5 space-y-1.5">
                      {currentTagsList.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          {currentTagsList.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#B88E3E]/15 text-[#B88E3E] border border-[#B88E3E]/30"
                            >
                              <Hash className="w-2.5 h-2.5 text-[#B88E3E]/70" />
                              <span>{tag}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(tag)}
                                className="p-0.5 hover:bg-[#B88E3E]/25 rounded cursor-pointer transition-colors text-[#B88E3E]"
                                title={`Видалити #${tag}`}
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                          <button
                            type="button"
                            onClick={handleClearAllTags}
                            className="text-[10px] text-rose-500 hover:text-rose-600 hover:underline cursor-pointer font-medium ml-1"
                          >
                            Очистити
                          </button>
                        </div>
                      )}

                      {popularHashtags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] text-neutral-400 font-medium">Раніше вводилися:</span>
                          {popularHashtags.map((h) => {
                            const isSelected = currentTagsList.some((t) => t.toLowerCase() === h.tag.toLowerCase());
                            return (
                              <button
                                key={h.tag}
                                type="button"
                                onClick={() => handleAddHashtagSuggestion(h.tag)}
                                disabled={isSelected}
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium border transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 opacity-50 cursor-default'
                                    : 'bg-black/[0.03] dark:bg-white/[0.04] hover:bg-[#B88E3E]/20 text-neutral-600 dark:text-neutral-300 hover:text-[#B88E3E] border-black/5 dark:border-white/10'
                                }`}
                                title={isSelected ? 'Вже додано' : `Додати #${h.tag}`}
                              >
                                #{h.tag} {h.count > 1 && <span className="opacity-60 text-[9px]">({h.count})</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 2: Імена та варіанти */}
            <div id="sec-names" className={`rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all`}>
              <button
                type="button"
                onClick={() => toggleSectionAccordion('names')}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${openSections.names ? 'bg-[#B88E3E] text-white' : 'bg-black/5 dark:bg-white/5 text-neutral-500'}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Імена та варіанти</h3>
                    <p className={`text-xs ${theme.textMuted}`}>Стать, канонічне ім'я та варіанти написання</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!openSections.names && (
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium hidden sm:inline-block max-w-[240px] truncate">
                      <span className={gender === 'male' ? 'text-blue-500 font-bold mr-1' : gender === 'female' ? 'text-rose-500 font-bold mr-1' : 'text-neutral-400 mr-1'}>
                        {gender === 'male' ? '♂' : gender === 'female' ? '♀' : '?'}
                      </span>
                      {[lastName, firstName, patronymic].filter(Boolean).join(' ') || 'Не вказано'}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${openSections.names ? 'rotate-180 text-[#B88E3E]' : ''}`} />
                </div>
              </button>

              {openSections.names && (
                <div className="p-4 sm:p-5 pt-2 space-y-4 border-t border-black/5 dark:border-white/5">
                  <div className="space-y-3.5 text-xs">
                {/* Row 1: Стать (Toggles) + Прізвище (+ Дівоче прізвище якщо жінка) */}
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  {/* 1. Стать (Toggles) */}
                  <div className="space-y-1 shrink-0 w-full sm:w-auto">
                    <div className="flex items-center justify-between gap-1">
                      <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px] flex items-center gap-1">
                        <span>Стать</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      {!genderManuallyChanged && (
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">авто</span>
                      )}
                    </div>
                    <div className={`inline-flex p-1 rounded-xl border ${theme.inputBorder} ${theme.inputBg} h-[38px] items-center gap-0.5 w-full sm:w-auto justify-center`}>
                      <button
                        type="button"
                        onClick={() => applyGenderChange('male', true)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          gender === 'male'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                        }`}
                        title="Чоловіча стать"
                      >
                        <span className="font-bold text-sm">♂</span>
                        <span>Чоловік</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyGenderChange('female', true)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          gender === 'female'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                        }`}
                        title="Жіноча стать"
                      >
                        <span className="font-bold text-sm">♀</span>
                        <span>Жінка</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyGenderChange('other', true)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                          gender === 'other'
                            ? 'bg-neutral-600 text-white shadow-xs'
                            : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                        }`}
                        title="Невідомо або інша"
                      >
                        <span>?</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Прізвище (зменшене поле, щоб поміщалось поруч) */}
                  <div className="space-y-1 flex-1 min-w-[140px] w-full">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                        Прізвище <span className="text-rose-500">*</span>
                      </label>
                      {currentInheritance.suggestedLastName && lastName === currentInheritance.suggestedLastName && (
                        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>від батька</span>
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLastName(val);
                        setAutoInheritedValues(prev => ({ ...prev, lastName: undefined }));
                        if (!genderManuallyChanged) {
                          const detected = detectGenderFromName(firstName, val, patronymic, maidenName);
                          if (detected) setGender(detected);
                        }
                      }}
                      placeholder="Шевченко"
                      className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E] h-[38px]`}
                      autoFocus
                    />
                    {currentInheritance.suggestedLastName && currentInheritance.suggestedLastName !== lastName && (
                      <button
                        type="button"
                        onClick={() => {
                          setLastName(currentInheritance.suggestedLastName!);
                          setAutoInheritedValues(prev => ({ ...prev, lastName: currentInheritance.suggestedLastName }));
                        }}
                        className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-md cursor-pointer transition-colors font-medium mt-1"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>Від батька: <strong>{currentInheritance.suggestedLastName}</strong></span>
                      </button>
                    )}
                    {gender === 'female' && lastName && adaptUkrainianSurnameForGender(lastName, 'female') !== lastName && (
                      <button
                        type="button"
                        onClick={() => {
                          const adapted = adaptUkrainianSurnameForGender(lastName, 'female');
                          setLastName(adapted);
                          setAutoInheritedValues(prev => ({ ...prev, lastName: adapted }));
                        }}
                        className="inline-flex items-center gap-1 text-[10px] text-purple-700 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 px-2 py-0.5 rounded-md cursor-pointer transition-colors font-medium mt-1"
                      >
                        <Sparkles className="w-3 h-3 text-purple-500 shrink-0" />
                        <span>Закінчення: <strong>{adaptUkrainianSurnameForGender(lastName, 'female')}</strong></span>
                      </button>
                    )}
                  </div>

                  {/* 3. Дівоче прізвище (лише якщо жінка) */}
                  {gender === 'female' && (
                    <div className="space-y-1 flex-1 min-w-[140px] w-full">
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
                            applyGenderChange('female', false);
                          }
                        }}
                        placeholder="Дівоче до шлюбу"
                        className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E] h-[38px]`}
                      />
                    </div>
                  )}
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
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                        По батькові
                      </label>
                      {currentInheritance.suggestedPatronymic && patronymic === currentInheritance.suggestedPatronymic && (
                        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>згенеровано від батька</span>
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={patronymic}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPatronymic(val);
                        setAutoInheritedValues(prev => ({ ...prev, patronymic: undefined }));
                        if (!genderManuallyChanged) {
                          const detected = detectGenderFromName(firstName, lastName, val, maidenName);
                          if (detected) setGender(detected);
                        }
                      }}
                      placeholder="Григорович"
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                    {currentInheritance.suggestedPatronymic && currentInheritance.suggestedPatronymic !== patronymic && (
                      <button
                        type="button"
                        onClick={() => {
                          setPatronymic(currentInheritance.suggestedPatronymic!);
                          setAutoInheritedValues(prev => ({ ...prev, patronymic: currentInheritance.suggestedPatronymic }));
                        }}
                        className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-md cursor-pointer transition-colors font-medium mt-1"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>По батькові від батька ({selectedFather?.name?.given || selectedFather?.firstName || 'обраного'}): <strong>{currentInheritance.suggestedPatronymic}</strong></span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Spoiler link button for secondary fields */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowNameExtras(!showNameExtras)}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-[#B88E3E] hover:text-[#9c752c] dark:hover:text-[#d4af37] transition-colors cursor-pointer select-none py-1 group"
                  >
                    {showNameExtras ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>− Згорнути додаткові варіанти імен, титул та примітки</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>+ Додаткові варіанти імен, титул та примітки</span>
                      </>
                    )}
                    {!showNameExtras && (prefix || nameVariants || surnameVariants || (fullNameOverride && fullNameOverride !== computedFullName)) && (
                      <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-[#B88E3E]/10 dark:bg-[#B88E3E]/20 text-[#B88E3E] font-medium border border-[#B88E3E]/30">
                        Заповнено
                      </span>
                    )}
                  </button>
                </div>

                {/* Secondary fields when expanded */}
                {showNameExtras && (
                  <div className="pt-2 space-y-3.5 border-t border-black/5 dark:border-white/5">
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
                )}
              </div>
                </div>
              )}
            </div>

            {/* SECTION 3: Батьки та зв'язки */}
            <div id="sec-parents" className={`rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all`}>
              <button
                type="button"
                onClick={() => toggleSectionAccordion('parents')}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${openSections.parents ? 'bg-[#B88E3E] text-white' : 'bg-black/5 dark:bg-white/5 text-neutral-500'}`}>
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Батьки та родинні зв'язки</h3>
                    <p className={`text-xs ${theme.textMuted}`}>Батьки, подружжя, діти, брати/сестри та хрещені батьки (куми)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!openSections.parents && (
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium hidden sm:inline-block">
                      {fatherId || motherId ? 'Батьки вказані' : 'Батьки не обрані'}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${openSections.parents ? 'rotate-180 text-[#B88E3E]' : ''}`} />
                </div>
              </button>

              {openSections.parents && (
                <div className="p-4 sm:p-5 pt-2 space-y-4 border-t border-black/5 dark:border-white/5">
                  <div className="space-y-4 text-xs">
                {/* Parents selectors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Father */}
                  <div className="space-y-1.5 p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 text-xs">
                        <User className="w-3.5 h-3.5 text-blue-500" />
                        <span>Батько</span>
                      </label>
                      {fatherId && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>автозаповнення активне</span>
                        </span>
                      )}
                    </div>
                    <select
                      value={fatherId}
                      onChange={(e) => handleFatherSelect(e.target.value)}
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
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 text-xs">
                        <User className="w-3.5 h-3.5 text-rose-500" />
                        <span>Матір</span>
                      </label>
                      {motherId && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>зв'язок встановлено</span>
                        </span>
                      )}
                    </div>
                    <select
                      value={motherId}
                      onChange={(e) => handleMotherSelect(e.target.value)}
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

                {/* Smart Parent Context & Auto-inheritance Card */}
                {(selectedFather || selectedMother) && (
                  <div className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-700/60 bg-gradient-to-r from-amber-50/60 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/20 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Розумне автозаповнення та успадкування від батьків</span>
                      </div>
                      <button
                        type="button"
                        onClick={applyAllParentAttributes}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                        title="Автоматично застосувати прізвище, патронім, гілку та місцевість"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Застосувати всі ознаки</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                      {currentInheritance.suggestedLastName && (
                        <div className="p-2 rounded-lg bg-white/80 dark:bg-neutral-800/80 border border-black/5 dark:border-white/5 flex flex-col justify-between">
                          <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">
                            Прізвище ({gender === 'female' ? 'донька' : 'син'}):
                          </span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                            {currentInheritance.suggestedLastName}
                          </span>
                        </div>
                      )}

                      {currentInheritance.suggestedPatronymic && (
                        <div className="p-2 rounded-lg bg-white/80 dark:bg-neutral-800/80 border border-black/5 dark:border-white/5 flex flex-col justify-between">
                          <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">По батькові:</span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                            {currentInheritance.suggestedPatronymic}
                          </span>
                        </div>
                      )}

                      {currentInheritance.suggestedBranch && (
                        <div className="p-2 rounded-lg bg-white/80 dark:bg-neutral-800/80 border border-black/5 dark:border-white/5 flex flex-col justify-between">
                          <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">Гілка роду:</span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                            {currentInheritance.suggestedBranch}
                          </span>
                        </div>
                      )}

                      {currentInheritance.suggestedBirthPlace && (
                        <div className="p-2 rounded-lg bg-white/80 dark:bg-neutral-800/80 border border-black/5 dark:border-white/5 flex flex-col justify-between">
                          <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">Населений пункт:</span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                            {currentInheritance.suggestedBirthPlace}
                          </span>
                        </div>
                      )}

                      {currentInheritance.suggestedEstate && (
                        <div className="p-2 rounded-lg bg-white/80 dark:bg-neutral-800/80 border border-black/5 dark:border-white/5 flex flex-col justify-between">
                          <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">Стан / Верства:</span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                            {currentInheritance.suggestedEstate}
                          </span>
                        </div>
                      )}

                      {currentInheritance.suggestedConfession && (
                        <div className="p-2 rounded-lg bg-white/80 dark:bg-neutral-800/80 border border-black/5 dark:border-white/5 flex flex-col justify-between">
                          <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">Віросповідання:</span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                            {currentInheritance.suggestedConfession}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

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

                {/* Unified Spiritual Relations Section: Хрещені, хресники та свідки */}
                <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.015] p-3 sm:p-3.5 space-y-3">
                  {/* Section Title & Segmented Tab Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-black/5 dark:border-white/5">
                    <div>
                      <h4 className="font-bold text-xs text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                        <Church className="w-3.5 h-3.5 text-[#B88E3E]" />
                        <span>Хрещені, хресники та свідки</span>
                      </h4>
                      <p className="text-[10px] text-neutral-500">Швидкий вибір із наявних осіб дерева або створення нових</p>
                    </div>

                    {/* Segmented Switcher */}
                    <div className="inline-flex p-0.5 rounded-lg bg-black/5 dark:bg-white/5 text-xs font-semibold self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setSpiritualTab('godparents');
                          setShowAddGodparentForm(false);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
                          spiritualTab === 'godparents'
                            ? 'bg-white dark:bg-slate-800 text-neutral-900 dark:text-white shadow-xs font-bold'
                            : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                        }`}
                      >
                        <span>Хрещені</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${spiritualTab === 'godparents' ? 'bg-[#B88E3E]/20 text-[#B88E3E]' : 'bg-black/5 dark:bg-white/10'}`}>
                          {(displayGodparents.length || godparents.length)}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSpiritualTab('godchildren');
                          setShowAddGodchildForm(false);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
                          spiritualTab === 'godchildren'
                            ? 'bg-white dark:bg-slate-800 text-neutral-900 dark:text-white shadow-xs font-bold'
                            : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                        }`}
                      >
                        <span>Хресники</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${spiritualTab === 'godchildren' ? 'bg-[#B88E3E]/20 text-[#B88E3E]' : 'bg-black/5 dark:bg-white/10'}`}>
                          {allDisplayGodchildren.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSpiritualTab('witnesses');
                          setShowAddWitnessedForm(false);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
                          spiritualTab === 'witnesses'
                            ? 'bg-white dark:bg-slate-800 text-neutral-900 dark:text-white shadow-xs font-bold'
                            : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                        }`}
                      >
                        <span>Свідки</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${spiritualTab === 'witnesses' ? 'bg-[#B88E3E]/20 text-[#B88E3E]' : 'bg-black/5 dark:bg-white/10'}`}>
                          {allDisplayWitnessedPersons.length}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Feedback Message */}
                  {(godparentFeedbackMsg || godchildFeedbackMsg || witnessedFeedbackMsg) && (
                    <div className="p-2 rounded-lg text-xs flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 animate-in fade-in duration-150">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{godparentFeedbackMsg?.text || godchildFeedbackMsg?.text || witnessedFeedbackMsg?.text}</span>
                    </div>
                  )}

                  {/* TAB 1: GODPARENTS (Хрещені батьки) */}
                  {spiritualTab === 'godparents' && (
                    <div className="space-y-3">
                      {/* Direct Compact Selector from Existing Persons */}
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 space-y-2">
                        {persons.length > 5 && (
                          <div className="relative">
                            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input
                              type="text"
                              value={godparentSearchQuery}
                              onChange={(e) => setGodparentSearchQuery(e.target.value)}
                              placeholder="Фільтр за ім'ям чи прізвищем..."
                              className={`w-full pl-7 pr-2.5 py-1 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E]`}
                            />
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <select
                            value={selectedExistingGodparentId}
                            onChange={(e) => handleSelectExistingGodparent(e.target.value)}
                            className={`flex-1 p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E] truncate`}
                          >
                            <option value="">-- Оберіть особу з дерева ({filteredGodparentPersons.length}) --</option>
                            {filteredGodparentPersons.map((p) => {
                              const genderSym = p.gender === 'female' ? '♀' : p.gender === 'male' ? '♂' : '?';
                              const lifespan = p.birthYear ? `(${p.birthYear})` : '';
                              const pName = `${p.name?.surname || p.lastName || ''} ${p.name?.given || p.firstName || ''} ${p.name?.patronymic || p.patronymic || ''}`.trim() || 'Без імені';
                              return (
                                <option key={p.id} value={p.id}>
                                  {genderSym} {pName} {lifespan}
                                </option>
                              );
                            })}
                          </select>

                          <select
                            value={newGodparentRole}
                            onChange={(e) => setNewGodparentRole(e.target.value as any)}
                            className={`p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E] w-full sm:w-40 shrink-0`}
                          >
                            <option value="godfather">Хрещений батько</option>
                            <option value="godmother">Хрещена мати</option>
                            <option value="witness">Восприємник / Свідок</option>
                          </select>

                          <button
                            type="button"
                            disabled={!selectedExistingGodparentId}
                            onClick={() => {
                              setGodparentMode('select_existing');
                              handleAddGodparent();
                            }}
                            className="px-3 py-2 rounded-lg bg-[#B88E3E] hover:bg-[#a37c33] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Прив'язати</span>
                          </button>
                        </div>

                        {/* Inline toggle for creating a brand new person */}
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddGodparentForm(!showAddGodparentForm);
                              setGodparentMode('create_new');
                            }}
                            className="text-[11px] text-[#B88E3E] hover:underline font-medium cursor-pointer flex items-center gap-1"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>{showAddGodparentForm ? 'Сховати форму нової особи' : '+ Немає в дереві? Створити нову особу'}</span>
                          </button>
                        </div>

                        {/* Expandable Form to Create New Person as Godparent */}
                        {showAddGodparentForm && (
                          <div className="pt-2.5 mt-2 border-t border-black/5 dark:border-white/5 space-y-2 animate-in fade-in duration-150">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="sm:col-span-2">
                                <input
                                  type="text"
                                  value={newGodparentName}
                                  onChange={(e) => setNewGodparentName(e.target.value)}
                                  placeholder="ПІБ або ім'я нового хрещеного *"
                                  className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E]`}
                                />
                              </div>
                              <div>
                                <select
                                  value={newGodparentRole}
                                  onChange={(e) => setNewGodparentRole(e.target.value as any)}
                                  className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E]`}
                                >
                                  <option value="godfather">Хрещений батько</option>
                                  <option value="godmother">Хрещена мати</option>
                                  <option value="witness">Восприємник / Свідок</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <input
                                  type="text"
                                  value={newGodparentYear}
                                  onChange={(e) => setNewGodparentYear(e.target.value)}
                                  placeholder="Рік народження (напр. 1880)"
                                  className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E]`}
                                />
                              </div>
                              <div>
                                <input
                                  type="text"
                                  value={newGodparentPlace}
                                  onChange={(e) => setNewGodparentPlace(e.target.value)}
                                  placeholder="Місце проживання"
                                  className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E]`}
                                />
                              </div>
                              <div>
                                <input
                                  type="text"
                                  value={newGodparentNotes}
                                  onChange={(e) => setNewGodparentNotes(e.target.value)}
                                  placeholder="Стан / парафія / примітки"
                                  className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E]`}
                                />
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setShowAddGodparentForm(false)}
                                className="px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer"
                              >
                                Скасувати
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setGodparentMode('create_new');
                                  handleAddGodparent();
                                }}
                                className="px-3 py-1 bg-[#B88E3E] hover:bg-[#a37c33] text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                              >
                                Створити особу та додати
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Compact List of Linked Godparents */}
                      {(displayGodparents.length > 0 || godparents.length > 0) ? (
                        <div className="space-y-1.5">
                          {(displayGodparents.length > 0 ? displayGodparents : godparents).map((gp, idx) => {
                            const isWitnessRole = gp.role === 'witness' || /свідок|поручитель/i.test(gp.role || '');
                            const otherGodchildren = !isWitnessRole
                              ? getGodparentOtherGodchildren(gp.personId, gp.name, currentPersonId, persons)
                              : [];
                            const otherWitnessed = isWitnessRole
                              ? getWitnessOtherWitnessed(gp.personId, gp.name, currentPersonId, persons)
                              : [];

                            return (
                              <div
                                key={gp.id || idx}
                                className="px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 flex items-center justify-between gap-2 text-xs hover:border-[#B88E3E]/40 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                                  <span className="w-5 h-5 rounded-md bg-[#B88E3E]/10 text-[#B88E3E] flex items-center justify-center shrink-0 text-[11px] font-bold">
                                    {gp.role === 'godmother' ? '♀' : '♂'}
                                  </span>

                                  {gp.personId && onSelectPerson ? (
                                    <button
                                      type="button"
                                      onClick={() => onSelectPerson(gp.personId!)}
                                      className="font-bold text-neutral-800 dark:text-neutral-200 hover:text-[#B88E3E] hover:underline transition-colors cursor-pointer truncate max-w-[180px] sm:max-w-none text-left"
                                      title="Відкрити картку цієї особи"
                                    >
                                      {gp.name}
                                    </button>
                                  ) : (
                                    <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate">
                                      {gp.name}
                                    </span>
                                  )}

                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#B88E3E]/10 text-[#B88E3E]">
                                    {gp.role === 'godmother' ? 'Хрещена мати' : gp.role === 'witness' ? 'Восприємник / Свідок' : 'Хрещений батько'}
                                  </span>

                                  {gp.notes && (
                                    <span className="text-[10px] text-neutral-400 truncate max-w-[150px]">
                                      ({gp.notes})
                                    </span>
                                  )}

                                  {otherGodchildren.length > 0 && (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                      • кум({otherGodchildren.length})
                                    </span>
                                  )}

                                  {otherWitnessed.length > 0 && (
                                    <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium">
                                      • свідок({otherWitnessed.length})
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveGodparent(gp.id)}
                                  className="text-neutral-400 hover:text-rose-500 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0"
                                  title="Видалити зв'язок з хрещеним"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-neutral-400 italic text-center py-2">
                          Хрещених батьків поки не додано. Оберіть особу зі списку вище.
                        </p>
                      )}
                    </div>
                  )}

                  {/* TAB 2: GODCHILDREN (Хресники) */}
                  {spiritualTab === 'godchildren' && (
                    <div className="space-y-3">
                      {/* Direct Compact Selector from Existing Persons */}
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 space-y-2">
                        {persons.length > 5 && (
                          <div className="relative">
                            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input
                              type="text"
                              value={godchildSearchQuery}
                              onChange={(e) => setGodchildSearchQuery(e.target.value)}
                              placeholder="Фільтр за ім'ям чи прізвищем хресника..."
                              className={`w-full pl-7 pr-2.5 py-1 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E]`}
                            />
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <select
                            value={selectedExistingGodchildId}
                            onChange={(e) => setSelectedExistingGodchildId(e.target.value)}
                            className={`flex-1 p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E] truncate`}
                          >
                            <option value="">-- Оберіть хресника з дерева ({filteredGodchildPersons.length}) --</option>
                            {filteredGodchildPersons.map((p) => {
                              const genderSym = p.gender === 'female' ? '♀' : p.gender === 'male' ? '♂' : '?';
                              const lifespan = p.birthYear ? `(${p.birthYear})` : '';
                              const pName = `${p.name?.surname || p.lastName || ''} ${p.name?.given || p.firstName || ''} ${p.name?.patronymic || p.patronymic || ''}`.trim() || 'Без імені';
                              return (
                                <option key={p.id} value={p.id}>
                                  {genderSym} {pName} {lifespan}
                                </option>
                              );
                            })}
                          </select>

                          <input
                            type="text"
                            value={newGodchildNotes}
                            onChange={(e) => setNewGodchildNotes(e.target.value)}
                            placeholder="Рік / церква (необов'язково)"
                            className={`p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E] w-full sm:w-44 shrink-0`}
                          />

                          <button
                            type="button"
                            disabled={!selectedExistingGodchildId}
                            onClick={() => {
                              setGodchildMode('select_existing');
                              handleAddGodchild();
                            }}
                            className="px-3 py-2 rounded-lg bg-[#B88E3E] hover:bg-[#a37c33] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Прив'язати</span>
                          </button>
                        </div>

                        {/* Inline toggle for creating a new godchild */}
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddGodchildForm(!showAddGodchildForm);
                              setGodchildMode('create_new');
                            }}
                            className="text-[11px] text-[#B88E3E] hover:underline font-medium cursor-pointer flex items-center gap-1"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>{showAddGodchildForm ? 'Сховати форму нової особи' : '+ Немає в дереві? Створити нову дитину-хресника'}</span>
                          </button>
                        </div>

                        {/* Expandable Form to Create New Godchild */}
                        {showAddGodchildForm && (
                          <div className="pt-2.5 mt-2 border-t border-black/5 dark:border-white/5 space-y-2 animate-in fade-in duration-150">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="sm:col-span-2">
                                <input
                                  type="text"
                                  value={newGodchildName}
                                  onChange={(e) => setNewGodchildName(e.target.value)}
                                  placeholder="ПІБ або ім'я хресника *"
                                  className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E]`}
                                />
                              </div>
                              <div>
                                <select
                                  value={newGodchildGender}
                                  onChange={(e) => setNewGodchildGender(e.target.value as Gender)}
                                  className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E]`}
                                >
                                  <option value="male">Чоловіча (хрещеник)</option>
                                  <option value="female">Жіноча (хрещениця)</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <input
                                  type="text"
                                  value={newGodchildBirthYear}
                                  onChange={(e) => setNewGodchildBirthYear(e.target.value)}
                                  placeholder="Рік народження (напр. 1895)"
                                  className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E]`}
                                />
                              </div>
                              <div>
                                <input
                                  type="text"
                                  value={newGodchildNotes}
                                  onChange={(e) => setNewGodchildNotes(e.target.value)}
                                  placeholder="Парафія / церква / нотатки"
                                  className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E]`}
                                />
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setShowAddGodchildForm(false)}
                                className="px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer"
                              >
                                Скасувати
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setGodchildMode('create_new');
                                  handleAddGodchild();
                                }}
                                className="px-3 py-1 bg-[#B88E3E] hover:bg-[#a37c33] text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                              >
                                Створити особу та додати
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Compact List of Linked Godchildren */}
                      {allDisplayGodchildren.length > 0 ? (
                        <div className="space-y-1.5">
                          {allDisplayGodchildren.map(({ person: ch, roleLabel, notes: chNotes, parentsLabel }) => {
                            const fullName = `${ch.name?.surname || ch.lastName || ''} ${ch.name?.given || ch.firstName || ''} ${ch.name?.patronymic || ch.patronymic || ''}`.trim() || 'Без імені';
                            const lifespan = ch.birthDate || ch.birthYear ? `(${ch.birthDate || ch.birthYear})` : '';

                            return (
                              <div
                                key={ch.id}
                                className="px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 flex items-center justify-between gap-2 text-xs hover:border-[#B88E3E]/40 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                                  <span className="w-5 h-5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 text-[11px] font-bold">
                                    {ch.gender === 'female' ? '♀' : '♂'}
                                  </span>

                                  {onSelectPerson ? (
                                    <button
                                      type="button"
                                      onClick={() => onSelectPerson(ch.id)}
                                      className="font-bold text-neutral-800 dark:text-neutral-200 hover:text-[#B88E3E] hover:underline transition-colors cursor-pointer truncate max-w-[180px] sm:max-w-none text-left"
                                      title="Відкрити картку цієї особи"
                                    >
                                      {fullName}
                                    </button>
                                  ) : (
                                    <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate">
                                      {fullName}
                                    </span>
                                  )}

                                  {lifespan && (
                                    <span className="text-[10px] text-neutral-400 font-medium">
                                      {lifespan}
                                    </span>
                                  )}

                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                    {roleLabel || 'Хрещеник'}
                                  </span>

                                  {parentsLabel && (
                                    <span className="text-[10px] text-neutral-400 truncate max-w-[160px]">
                                      (батьки: {parentsLabel})
                                    </span>
                                  )}

                                  {chNotes && (
                                    <span className="text-[10px] text-neutral-400 truncate max-w-[140px]">
                                      • {chNotes}
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleUnlinkGodchild(ch.id)}
                                  className="text-neutral-400 hover:text-rose-500 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0"
                                  title="Від'єднати хрещеника"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-neutral-400 italic text-center py-2">
                          Хресників поки не вказано. Оберіть особу зі списку вище.
                        </p>
                      )}
                    </div>
                  )}

                  {/* TAB 3: WITNESSES (Свідчення та поручительства) */}
                  {spiritualTab === 'witnesses' && (
                    <div className="space-y-3">
                      {/* Direct Compact Selector from Existing Persons */}
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 space-y-2">
                        {persons.length > 5 && (
                          <div className="relative">
                            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input
                              type="text"
                              value={witnessedSearchQuery}
                              onChange={(e) => setWitnessedSearchQuery(e.target.value)}
                              placeholder="Фільтр за ім'ям чи прізвищем особи..."
                              className={`w-full pl-7 pr-2.5 py-1 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E]`}
                            />
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <select
                            value={selectedExistingWitnessedId}
                            onChange={(e) => setSelectedExistingWitnessedId(e.target.value)}
                            className={`flex-1 p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E] truncate`}
                          >
                            <option value="">-- Оберіть особу, для якої була свідком ({filteredWitnessPersons.length}) --</option>
                            {filteredWitnessPersons.map((p) => {
                              const genderSym = p.gender === 'female' ? '♀' : p.gender === 'male' ? '♂' : '?';
                              const lifespan = p.birthYear ? `(${p.birthYear})` : '';
                              const pName = `${p.name?.surname || p.lastName || ''} ${p.name?.given || p.firstName || ''} ${p.name?.patronymic || p.patronymic || ''}`.trim() || 'Без імені';
                              return (
                                <option key={p.id} value={p.id}>
                                  {genderSym} {pName} {lifespan}
                                </option>
                              );
                            })}
                          </select>

                          <input
                            type="text"
                            value={newWitnessedNotes}
                            onChange={(e) => setNewWitnessedNotes(e.target.value)}
                            placeholder="Подія / запис (напр. вінчання 1895 р.)"
                            className={`p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-1 focus:ring-[#B88E3E] w-full sm:w-48 shrink-0`}
                          />

                          <button
                            type="button"
                            disabled={!selectedExistingWitnessedId}
                            onClick={handleAddWitnessedPerson}
                            className="px-3 py-2 rounded-lg bg-[#B88E3E] hover:bg-[#a37c33] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Прив'язати</span>
                          </button>
                        </div>
                      </div>

                      {/* Compact List of Witnessed Persons */}
                      {allDisplayWitnessedPersons.length > 0 ? (
                        <div className="space-y-1.5">
                          {allDisplayWitnessedPersons.map(({ person: wp, notes: wNotes, roleLabel, eventLabel }) => {
                            const fullName = `${wp.name?.surname || wp.lastName || ''} ${wp.name?.given || wp.firstName || ''} ${wp.name?.patronymic || wp.patronymic || ''}`.trim() || 'Без імені';
                            const lifespan = wp.birthDate || wp.birthYear ? `(${wp.birthDate || wp.birthYear})` : '';

                            return (
                              <div
                                key={wp.id}
                                className="px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 flex items-center justify-between gap-2 text-xs hover:border-[#B88E3E]/40 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                                  <span className="w-5 h-5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 text-[11px] font-bold">
                                    ✍
                                  </span>

                                  {onSelectPerson ? (
                                    <button
                                      type="button"
                                      onClick={() => onSelectPerson(wp.id)}
                                      className="font-bold text-neutral-800 dark:text-neutral-200 hover:text-[#B88E3E] hover:underline transition-colors cursor-pointer truncate max-w-[180px] sm:max-w-none text-left"
                                      title="Відкрити картку цієї особи"
                                    >
                                      {fullName}
                                    </button>
                                  ) : (
                                    <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate">
                                      {fullName}
                                    </span>
                                  )}

                                  {lifespan && (
                                    <span className="text-[10px] text-neutral-400 font-medium">
                                      {lifespan}
                                    </span>
                                  )}

                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300">
                                    {roleLabel || 'Свідок'}
                                  </span>

                                  {eventLabel && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-black/5 dark:bg-white/10 text-neutral-600 dark:text-neutral-400">
                                      {eventLabel}
                                    </span>
                                  )}

                                  {wNotes && (
                                    <span className="text-[10px] text-neutral-400 truncate max-w-[160px]">
                                      • {wNotes}
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleUnlinkWitnessedPerson(wp.id)}
                                  className="text-neutral-400 hover:text-rose-500 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0"
                                  title="Від'єднати запис свідка"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-neutral-400 italic text-center py-2">
                          Записів про свідчення поки немає. Оберіть особу зі списку вище.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
                </div>
              )}
            </div>

            {/* SECTION 4: Дати та події / Місця на карті */}
            <div id="sec-dates-places" className={`rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all`}>
              <button
                type="button"
                onClick={() => toggleSectionAccordion('dates-places')}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${openSections['dates-places'] ? 'bg-[#B88E3E] text-white' : 'bg-black/5 dark:bg-white/5 text-neutral-500'}`}>
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Дати та місця подій</h3>
                    <p className={`text-xs ${theme.textMuted}`}>Дати життя та локації на карті</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {personDateValidation.hasErrors && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-bold border border-rose-500/30 animate-pulse">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Помилка дат</span>
                    </span>
                  )}
                  {!openSections['dates-places'] && (
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium hidden sm:inline-block">
                      {[birthDate, deathDate].filter(Boolean).join(' — ') || 'Дати не вказані'}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${openSections['dates-places'] ? 'rotate-180 text-[#B88E3E]' : ''}`} />
                </div>
              </button>

              {openSections['dates-places'] && (
                <div className="p-4 sm:p-5 pt-2 space-y-4 border-t border-black/5 dark:border-white/5">
                  {personDateValidation.hasErrors && (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200 animate-in fade-in duration-150">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                      <div className="space-y-1">
                        <span className="font-bold">Виявлено хронологічні невідповідності дат:</span>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-700 dark:text-rose-300">
                          {personDateValidation.errorsList.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

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
                        onChange={(e) => {
                          setBirthDate(e.target.value);
                          setDateValidationDismissedForSave(false);
                        }}
                        placeholder="дд.мм.рррр або рррр (напр. 1814)"
                        className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 transition-colors ${
                          personDateValidation.birthDateError
                            ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 ring-1 ring-rose-500 focus:ring-rose-500'
                            : `${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:ring-[#B88E3E]`
                        }`}
                      />
                      {personDateValidation.birthDateError && (
                        <div className="flex items-start gap-1.5 mt-1.5 p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] font-semibold animate-in fade-in duration-150">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
                          <span>{personDateValidation.birthDateError}</span>
                        </div>
                      )}
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
                        onChange={(e) => {
                          setMarriageDate(e.target.value);
                          setDateValidationDismissedForSave(false);
                        }}
                        placeholder="дд.мм.рррр або рррр"
                        className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 transition-colors ${
                          personDateValidation.marriageDateError
                            ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 ring-1 ring-rose-500 focus:ring-rose-500'
                            : `${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:ring-[#B88E3E]`
                        }`}
                      />
                      {personDateValidation.marriageDateError && (
                        <div className="flex items-start gap-1.5 mt-1.5 p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] font-semibold animate-in fade-in duration-150">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
                          <span>{personDateValidation.marriageDateError}</span>
                        </div>
                      )}
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
                          onChange={(e) => {
                            setDeathDate(e.target.value);
                            setDateValidationDismissedForSave(false);
                          }}
                          placeholder="дд.мм.рррр або рррр"
                          className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 transition-colors ${
                            personDateValidation.deathDateError
                              ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 ring-1 ring-rose-500 focus:ring-rose-500'
                              : `${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:ring-[#B88E3E]`
                          }`}
                        />
                        {personDateValidation.deathDateError && (
                          <div className="flex items-start gap-1.5 mt-1.5 p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] font-semibold animate-in fade-in duration-150">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
                            <span>{personDateValidation.deathDateError}</span>
                          </div>
                        )}
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
              )}
            </div>

            {/* SECTION 5: Біографія і нотатки */}
            <div id="sec-bio-notes" className={`rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all`}>
              <button
                type="button"
                onClick={() => toggleSectionAccordion('bio-notes')}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${openSections['bio-notes'] ? 'bg-[#B88E3E] text-white' : 'bg-black/5 dark:bg-white/5 text-neutral-500'}`}>
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Біографія, нотатки та коментарі</h3>
                    <p className={`text-xs ${theme.textMuted}`}>Життєпис предка, дослідницькі нотатки та джерела</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!openSections['bio-notes'] && (
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium hidden sm:inline-block">
                      {bio ? 'Є життєпис' : (notes ? 'Є нотатки' : 'Порожньо')}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${openSections['bio-notes'] ? 'rotate-180 text-[#B88E3E]' : ''}`} />
                </div>
              </button>

              {openSections['bio-notes'] && (
                <div className="p-4 sm:p-5 pt-2 space-y-4 border-t border-black/5 dark:border-white/5">
                  <div className="space-y-4 text-xs">
                {/* Large Textarea for Biography */}
                <div className="space-y-1.5">
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#B88E3E]" />
                    <span>Життєпис / Біографія особи</span>
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Введіть життєпис, родинні спогади, відомості про діяльність та життя особи..."
                    className={`w-full p-3 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E] leading-relaxed`}
                    readOnly={isReadOnly}
                  />
                </div>

                {/* Dedicated Researcher Notes & Comments (Requested feature) */}
                <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Текстові нотатки та коментарі дослідника</span>
                    </label>
                    <span className="text-[10px] text-neutral-400">дрібні факти, сумніви, робочі гіпотези</span>
                  </div>

                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Поле для фіксації додаткових дрібних фактів, сумнівів щодо спорідненості чи дат, розбіжностей у джерелах (метрики, сповідні розписи, ревізії) або планів на архівний пошук.
                  </p>

                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Зафіксуйте додаткові дрібні факти або сумніви щодо особи (наприклад: 'У ревізії 1858 р. вказаний вік 34 роки, а в метриці 1826 р. — розбіжність у 2 роки; перевірити метрику сусіднього приходу')..."
                    className={`w-full p-3 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed font-sans`}
                    readOnly={isReadOnly}
                  />

                  {!isReadOnly && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-neutral-400 font-medium">Швидкі позначки:</span>
                      {[
                        { label: '❓ Потребує перевірки в архівах', prefix: '[Потребує перевірки]: ' },
                        { label: '⚠️ Розбіжність у датах / віці', prefix: '[Розбіжність у датах]: ' },
                        { label: '🔍 Робоча гіпотеза', prefix: '[Гіпотеза]: ' },
                        { label: '📜 Запис у метриці', prefix: '[Метричний запис]: ' },
                        { label: '💬 Родинний переказ', prefix: '[Переказ]: ' }
                      ].map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setNotes((prev) => (prev && prev.trim() ? `${prev.trim()}\n${chip.prefix}` : chip.prefix));
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] font-medium bg-black/5 dark:bg-white/5 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 text-neutral-600 dark:text-neutral-400 border border-black/5 dark:border-white/5 transition-all cursor-pointer"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}
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
                      <span>Хештеги та мітки {currentTagsList.length > 0 && `(${currentTagsList.length})`}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-neutral-400">розділяйте комою або #</span>
                      {currentTagsList.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAllTags}
                          className="text-[10px] text-rose-500 hover:text-rose-600 hover:underline cursor-pointer font-medium"
                        >
                          Очистити всі
                        </button>
                      )}
                    </div>
                  </div>

                  {currentTagsList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                      {currentTagsList.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#B88E3E]/15 text-[#B88E3E] border border-[#B88E3E]/30"
                        >
                          <Hash className="w-3 h-3 text-[#B88E3E]/70" />
                          <span>{tag}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="p-0.5 hover:bg-[#B88E3E]/25 rounded-md cursor-pointer transition-colors text-[#B88E3E]"
                            title={`Видалити хештег #${tag}`}
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
                    placeholder="#козак, #ветеран, #полтавщина, #дворянин, #хлібороб"
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  />
                  {popularHashtags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] text-neutral-400 flex items-center gap-0.5 font-medium">
                        <Hash className="w-3 h-3 text-[#B88E3E]" /> Популярні в дереві:
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
              )}
            </div>

            {/* SECTION 6: Події та факти */}
            <div id="sec-events" className={`rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all`}>
              <button
                type="button"
                onClick={() => toggleSectionAccordion('events')}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${openSections.events ? 'bg-[#B88E3E] text-white' : 'bg-black/5 dark:bg-white/5 text-neutral-500'}`}>
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Події та факти</h3>
                    <p className={`text-xs ${theme.textMuted}`}>Додаткові життєві події, переписи, ревізії, служба</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasFutureLifeEvents && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-bold border border-rose-500/30 animate-pulse">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Майбутня дата</span>
                    </span>
                  )}
                  {!openSections.events && (
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium hidden sm:inline-block">
                      {lifeEvents.length > 0 ? `${lifeEvents.length} подій` : '0 подій'}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${openSections.events ? 'rotate-180 text-[#B88E3E]' : ''}`} />
                </div>
              </button>

              {openSections.events && (
                <div className="p-4 sm:p-5 pt-2 space-y-4 border-t border-black/5 dark:border-white/5">
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
                            className={`w-full p-2 rounded-lg border text-xs transition-colors ${
                              newEventValidation.isFuture
                                ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 ring-1 ring-rose-500'
                                : `${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`
                            }`}
                          />
                          {newEventValidation.message && (
                            <div className={`flex items-start gap-1 mt-1 text-[11px] font-semibold ${
                              newEventValidation.isFuture ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
                            }`}>
                              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                              <span>{newEventValidation.message}</span>
                            </div>
                          )}
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
                      {lifeEvents.map((evt, idx) => {
                        const evtValidation = lifeEventsValidation[idx] || validateLifeEventDate(evt.date, birthDate, deathDate, isLiving);
                        const isInvalid = evtValidation.isFuture;
                        const hasWarning = !isInvalid && Boolean(evtValidation.isBeforeBirth || evtValidation.isAfterDeath);

                        return (
                          <div
                            key={evt.id || idx}
                            className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs transition-all ${
                              isInvalid
                                ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800'
                                : hasWarning
                                ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300/60 dark:border-amber-800/40'
                                : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5'
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md bg-[#B88E3E]/15 text-[#B88E3E] font-bold text-[10px]">
                                  {getEventTypeName(evt.type)}
                                </span>
                                <span className="font-bold text-neutral-800 dark:text-neutral-200">{evt.title}</span>
                                {evt.date && (
                                  <span className={`font-medium ${isInvalid ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-neutral-500'}`}>
                                    ({evt.date})
                                  </span>
                                )}
                                {isInvalid && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>У майбутньому</span>
                                  </span>
                                )}
                                {hasWarning && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>{evtValidation.message}</span>
                                  </span>
                                )}
                              </div>
                              {evt.place && <div className="text-neutral-500 text-[11px]">📍 {evt.place}</div>}
                              {evt.description && <div className="text-neutral-600 dark:text-neutral-400 text-[11px] mt-1">{evt.description}</div>}
                              {isInvalid && evtValidation.message && (
                                <div className="text-rose-600 dark:text-rose-400 text-[11px] font-semibold mt-1">
                                  ⚠️ {evtValidation.message}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveLifeEvent(evt.id)}
                              className="text-neutral-400 hover:text-rose-500 p-1 cursor-pointer shrink-0"
                              title="Видалити подію"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-neutral-400 italic">Додаткових подій поки немає.</p>
                  )}
                </div>
              </div>
                </div>
              )}
            </div>

            {/* SECTION 7: Фотографії */}
            <div id="sec-photos" className={`rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all`}>
              <button
                type="button"
                onClick={() => toggleSectionAccordion('photos')}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${openSections.photos ? 'bg-[#B88E3E] text-white' : 'bg-black/5 dark:bg-white/5 text-neutral-500'}`}>
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Фотографії</h3>
                    <p className={`text-xs ${theme.textMuted}`}>Світлини особи, вибір головного зображення та аватар</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!openSections.photos && (
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium hidden sm:inline-block">
                      {photosList.length > 0 ? `${photosList.length} фото` : (avatarUrl ? 'Є аватар' : 'Без фото')}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${openSections.photos ? 'rotate-180 text-[#B88E3E]' : ''}`} />
                </div>
              </button>

              {openSections.photos && (
                <div className="p-4 sm:p-5 pt-2 space-y-4 border-t border-black/5 dark:border-white/5">
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
              )}
            </div>

            {/* SECTION 8: Власні поля */}
            <div id="sec-custom-fields" className={`rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all`}>
              <button
                type="button"
                onClick={() => toggleSectionAccordion('custom-fields')}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${openSections['custom-fields'] ? 'bg-[#B88E3E] text-white' : 'bg-black/5 dark:bg-white/5 text-neutral-500'}`}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Власні поля</h3>
                    <p className={`text-xs ${theme.textMuted}`}>Користувацькі атрибути та архівні параметри</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!openSections['custom-fields'] && (
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium hidden sm:inline-block">
                      {customFields.length > 0 ? `${customFields.length} полів` : '0 полів'}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${openSections['custom-fields'] ? 'rotate-180 text-[#B88E3E]' : ''}`} />
                </div>
              </button>

              {openSections['custom-fields'] && (
                <div className="p-4 sm:p-5 pt-2 space-y-4 border-t border-black/5 dark:border-white/5">
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
              )}
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

      {/* Person Report Modal */}
      {isReportModalOpen && effectivePerson && (
        <PersonReportModal
          personId={effectivePerson.id}
          database={
            getGenealogyDatabase
              ? getGenealogyDatabase()
              : {
                  persons: persons.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}),
                  families: families || {},
                  sources: sources || {},
                  events: events || {}
                }
          }
          onClose={() => setIsReportModalOpen(false)}
          onSelectPerson={(id) => {
            if (onSelectPerson) onSelectPerson(id);
          }}
        />
      )}

      {/* Merge Persons By ID Modal */}
      {isMergeModalOpen && (
        <MergePersonsByIdModal
          isOpen={isMergeModalOpen}
          onClose={() => {
            setIsMergeModalOpen(false);
            setMergeModalPair(null);
          }}
          initialPersonAId={mergeModalPair?.idA}
          initialPersonBId={mergeModalPair?.idB}
          onMergeSuccess={(master) => {
            if (onSelectPerson) onSelectPerson(master.id);
            onClose();
          }}
        />
      )}

      {/* Duplicate Save Confirmation Dialog */}
      {showDuplicateSaveDialog && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-amber-500/40 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Виявлено схожу особу в базі
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                  У вашому родинному дереві вже є особа зі схожими даними. Щоб запобігти створенню дублікатів, перевірте знайдений запис:
                </p>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 border border-neutral-200 dark:border-neutral-800 rounded-xl p-2 bg-neutral-50 dark:bg-neutral-950">
              {potentialDuplicates.slice(0, 3).map((match) => {
                const mp = match.person;
                const mpName = `${mp.name?.surname || mp.lastName || ''} ${mp.name?.given || mp.firstName || ''} ${mp.name?.patronymic || mp.patronymic || ''}`.trim() || 'Без імені';
                return (
                  <div key={mp.id} className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                        <span>{mpName}</span>
                        <span className="text-[10px] font-mono text-neutral-400">ID: {mp.id}</span>
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {mp.birthDate || mp.birthYear ? `Нар: ${mp.birthDate || mp.birthYear}` : ''}
                        {mp.birthPlace ? `, ${mp.birthPlace}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDuplicateSaveDialog(false);
                        handleUseExistingPerson(mp);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shrink-0 cursor-pointer"
                    >
                      {initialRelation ? 'Приєднати' : 'Відкрити'}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowDuplicateSaveDialog(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                Повернутися до редагування
              </button>
              <button
                type="button"
                onClick={() => {
                  setDuplicateWarningDismissedForSave(true);
                  setShowDuplicateSaveDialog(false);
                  setTimeout(() => handleSave(false), 50);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
              >
                Все одно створити окремо
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date Validation Warning Confirmation Dialog */}
      {showDateValidationDialog && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-rose-500/40 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Невідповідність або помилка у датах
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                  У формі виявлено хронологічні конфлікти або дати в майбутньому. Рекомендується перевірити введені значення:
                </p>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-2 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3 bg-rose-50/50 dark:bg-rose-950/20 text-xs">
              <ul className="list-disc list-inside space-y-1.5 text-rose-800 dark:text-rose-200 font-medium">
                {personDateValidation.errorsList.map((err, i) => (
                  <li key={`pv-${i}`}>{err}</li>
                ))}
                {lifeEventsValidation
                  .filter((v) => v.isFuture)
                  .map((v, i) => (
                    <li key={`lev-${i}`}>
                      Подія «{v.event.title}» ({v.event.date}): {v.message}
                    </li>
                  ))}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setShowDateValidationDialog(false);
                  scrollToSection('dates-places');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer transition-colors shadow-sm"
              >
                Виправити дати
              </button>
              <button
                type="button"
                onClick={() => {
                  setDateValidationDismissedForSave(true);
                  setShowDateValidationDialog(false);
                  setTimeout(() => handleSave(false), 50);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
              >
                Все одно зберегти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
