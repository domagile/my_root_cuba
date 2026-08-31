/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  User,
  Edit3,
  Plus,
  Calendar,
  MapPin,
  Briefcase,
  FileText,
  Heart,
  Shield,
  Users,
  Tag,
  Award,
  BookOpen,
  GitFork,
  FilePlus,
  Save,
  Trash2,
  Unlink,
  Search,
  Check,
  ExternalLink
} from 'lucide-react';
import { useGenealogy, useUIStore } from '../../context/GenealogyContext';
import { getThemeConfig } from '../../utils/theme';
import { Person, Source, Family } from '../../types';

interface PersonDetailModalProps {
  personId: string;
  onClose: () => void;
  onEdit: (person: Person) => void;
  onOpenAddRelation: (type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling', targetPersonId: string) => void;
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
  personId,
  onClose,
  onEdit,
  onOpenAddRelation
}) => {
  const {
    persons,
    families,
    sources,
    themePalette,
    setSelectedPersonId,
    updatePerson,
    saveFamily,
    deleteFamily,
    saveSource
  } = useGenealogy();
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const setRodovidView = useUIStore((s) => s.setRodovidView);
  const theme = getThemeConfig(themePalette);

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');

  // Source Modal
  const [sourceModal, setSourceModal] = useState<{
    isOpen: boolean;
    title: string;
    archive: string;
    fund: string;
    inventory: string;
    caseNumber: string;
    page: string;
    transcription: string;
    url: string;
  } | null>(null);

  const person = persons.find((p) => p.id === personId);
  if (!person) return null;

  const father = persons.find((p) => p.id === person.fatherId);
  const mother = persons.find((p) => p.id === person.motherId);
  const spouses = persons.filter((p) => person.spouseIds?.includes(p.id) || p.spouseIds?.includes(person.id));
  const children = persons.filter((p) => p.fatherId === person.id || p.motherId === person.id || person.childrenIds?.includes(p.id));

  const given = person.name?.given || person.firstName || '';
  const surname = person.name?.surname || person.lastName || '';
  const patronymic = person.name?.patronymic || person.patronymic || '';
  const maidenName = person.name?.maidenName || person.maidenName || '';
  const prefix = person.name?.prefix || person.prefix || '';
  const avatar = person.avatarUrl || person.avatar || person.photoUrl;
  const estate = person.estateOrSocialStatus || person.estate || person.socialStatus;

  // Handle navigate to tree
  const handleNavigateToTree = () => {
    setSelectedPersonId(person.id);
    setActiveTab('tree');
    setRodovidView('tree');
    onClose();
  };

  // Save notes inline
  const handleSaveNotes = () => {
    updatePerson({
      ...person,
      notes: notesDraft.trim() || undefined
    });
    setIsEditingNotes(false);
  };

  // Save bio inline
  const handleSaveBio = () => {
    updatePerson({
      ...person,
      bio: bioDraft.trim() || undefined
    });
    setIsEditingBio(false);
  };

  // Save Citation
  const handleSaveCitation = () => {
    if (!sourceModal) return;
    const currentCitations = [...(person.citations || [])];
    const currentSourceIds = Array.from(new Set([...(person.sourceIds || [])]));

    const newSourceId = `S${String(Date.now()).slice(-4)}`;
    const newSource: Source = {
      id: newSourceId,
      title: sourceModal.title.trim() || 'Архівний витяг',
      archive: sourceModal.archive.trim() || undefined,
      fund: sourceModal.fund.trim() || undefined,
      inventory: sourceModal.inventory.trim() || undefined,
      caseNumber: sourceModal.caseNumber.trim() || undefined,
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

    updatePerson({
      ...person,
      citations: currentCitations,
      sourceIds: currentSourceIds
    });
    setSourceModal(null);
  };

  // Unlink Citation
  const handleDeleteCitation = (index: number) => {
    const currentCitations = (person.citations || []).filter((_, idx) => idx !== index);
    updatePerson({
      ...person,
      citations: currentCitations
    });
  };

  // Citations list
  const personCitations = useMemo(() => {
    const list: Array<{ id?: string; sourceId?: string; title: string; page?: string; archiveRef?: string; url?: string }> = [];

    (person.citations || []).forEach((c, idx) => {
      const linkedSrc = c.sourceId ? sources?.[c.sourceId] : null;
      list.push({
        id: `c_${idx}`,
        sourceId: c.sourceId,
        title: linkedSrc?.title || c.citation || c.title || 'Архівне свідоцтво / джерело',
        page: c.page || linkedSrc?.page,
        archiveRef: linkedSrc ? [linkedSrc.archive, linkedSrc.fund && `Ф. ${linkedSrc.fund}`, linkedSrc.inventory && `Оп. ${linkedSrc.inventory}`, linkedSrc.caseNumber && `Спр. ${linkedSrc.caseNumber}`].filter(Boolean).join(', ') : undefined,
        url: linkedSrc?.url
      });
    });

    (person.sourceIds || []).forEach((sId, idx) => {
      if (!list.some((l) => l.sourceId === sId)) {
        const src = sources?.[sId];
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
  }, [person.citations, person.sourceIds, sources]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div className={`w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 relative scrollbar-thin my-auto`}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-5">
          <div className="flex items-center gap-4">
            {avatar ? (
              <img
                src={avatar}
                alt={given}
                className="w-16 h-16 rounded-2xl object-cover border border-[#B88E3E]/40 shadow-sm"
              />
            ) : (
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${
                  person.gender === 'female' || person.gender === 'F'
                    ? 'bg-rose-500/15 text-rose-600'
                    : 'bg-blue-500/15 text-blue-600'
                }`}
              >
                {given[0] || surname[0] || 'П'}
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#B88E3E]/20 text-[#B88E3E]">
                  {person.gender === 'female' || person.gender === 'F' ? 'Жінка' : 'Чоловік'}
                </span>
                {prefix && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-500 border border-amber-500/30">
                    {prefix}
                  </span>
                )}
                {estate && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    {estate}
                  </span>
                )}
                {person.confession && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400">
                    {person.confession}
                  </span>
                )}
              </div>
              <h2 className={`text-xl font-extrabold ${theme.cardTitle} mt-1`}>
                {surname} {given} {patronymic}
                {maidenName ? ` / ${maidenName}` : ''}
              </h2>
              <p className="text-[11px] text-neutral-400 font-mono">ID: {person.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tree Navigation Icon Button */}
            <button
              onClick={handleNavigateToTree}
              className="p-2 bg-neutral-100 hover:bg-emerald-600 dark:bg-neutral-800 dark:hover:bg-emerald-600 text-neutral-700 hover:text-white dark:text-neutral-300 rounded-xl transition-all cursor-pointer shadow-xs border border-neutral-200 dark:border-neutral-700"
              title="Перейти до родинного дерева"
              aria-label="Перейти до дерева"
            >
              <GitFork className="w-4 h-4 text-emerald-500 hover:text-white" />
            </button>

            <button
              onClick={() => onEdit(person)}
              className="px-3.5 py-2 bg-[#B88E3E] hover:bg-[#A37B30] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Редагувати</span>
            </button>
          </div>
        </div>

        {/* Biographic Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-1">
            <span className="text-xs text-neutral-400 flex items-center gap-1.5 font-medium">
              <Calendar className="w-4 h-4 text-[#B88E3E]" />
              Народження
            </span>
            <div className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
              {person.birthDate || person.birthYear || 'Дата невідома'}
            </div>
            {person.birthPlace && (
              <div className="text-xs text-neutral-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{person.birthPlace}</span>
              </div>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-1">
            <span className="text-xs text-neutral-400 flex items-center gap-1.5 font-medium">
              <Calendar className="w-4 h-4 text-rose-500" />
              Смерть
            </span>
            <div className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
              {person.isLiving ? 'Нині живий / жива' : (person.deathDate || person.deathYear || 'Невідомо')}
            </div>
            {person.deathPlace && !person.isLiving && (
              <div className="text-xs text-neutral-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{person.deathPlace}</span>
              </div>
            )}
          </div>
        </div>

        {/* Occupation, Military Rank, Estate, Confession */}
        {(person.occupation || person.militaryRank || estate || person.confession) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-800 text-xs">
            {person.occupation && (
              <div className="flex items-center gap-2.5">
                <Briefcase className="w-4 h-4 text-[#B88E3E] shrink-0" />
                <div>
                  <span className="text-neutral-400 block text-[10px]">Професія / Посада:</span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">{person.occupation}</span>
                </div>
              </div>
            )}
            {estate && (
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-neutral-400 block text-[10px]">Стан / Соціальний статус:</span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">{estate}</span>
                </div>
              </div>
            )}
            {person.militaryRank && (
              <div className="flex items-center gap-2.5">
                <Award className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="text-neutral-400 block text-[10px]">Військовий чин / Звання:</span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">{person.militaryRank}</span>
                </div>
              </div>
            )}
            {person.confession && (
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <span className="text-neutral-400 block text-[10px]">Віросповідання / Конфесія:</span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">{person.confession}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Biography Section */}
        <div className="space-y-2 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-[#B88E3E]" />
              Життєпис / Біографія
            </span>
            {!isEditingBio && (
              <button
                type="button"
                onClick={() => {
                  setBioDraft(person.bio || '');
                  setIsEditingBio(true);
                }}
                className="text-xs text-[#B88E3E] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>{person.bio ? 'Редагувати' : '+ Додати життєпис'}</span>
              </button>
            )}
          </div>

          {isEditingBio ? (
            <div className="space-y-2 pt-1">
              <textarea
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                rows={3}
                placeholder="Введіть життєпис або біографічні факти..."
                className={`w-full p-2.5 rounded-xl text-xs border border-neutral-300 dark:border-neutral-700 ${theme.cardBg} ${theme.textPrimary}`}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingBio(false)}
                  className="px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-700 cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={handleSaveBio}
                  className="px-3 py-1 bg-[#B88E3E] hover:bg-[#a07a32] text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span>Зберегти</span>
                </button>
              </div>
            </div>
          ) : person.bio ? (
            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
              {person.bio}
            </p>
          ) : (
            <p className="text-xs text-neutral-400 italic">Життєпис ще не заповнено.</p>
          )}
        </div>

        {/* Family Ties (Parents, Spouses & Children) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${theme.cardTitle} flex items-center gap-1.5`}>
              <Users className="w-4 h-4 text-[#B88E3E]" />
              <span>Родинні зв'язки та діти</span>
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => onOpenAddRelation('father', person.id)}
                className="text-[11px] px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-[#B88E3E] hover:text-white rounded-lg text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
              >
                + Батько
              </button>
              <button
                onClick={() => onOpenAddRelation('mother', person.id)}
                className="text-[11px] px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-[#B88E3E] hover:text-white rounded-lg text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
              >
                + Мати
              </button>
              <button
                onClick={() => onOpenAddRelation('child', person.id)}
                className="text-[11px] px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-[#B88E3E] hover:text-white rounded-lg text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
              >
                + Дитина
              </button>
              <button
                onClick={() => onOpenAddRelation('spouse', person.id)}
                className="text-[11px] px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-[#B88E3E] hover:text-white rounded-lg text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
              >
                + Подружжя
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Parents */}
            <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-1.5">
              <span className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider block">Батьки:</span>
              <div className="text-xs space-y-1">
                <div>
                  <span className="text-neutral-400">Батько: </span>
                  {father ? (
                    <span
                      onClick={() => setSelectedPersonId(father.id)}
                      className="font-semibold text-[#B88E3E] cursor-pointer hover:underline"
                    >
                      {father.name?.surname || father.lastName} {father.name?.given || father.firstName}
                    </span>
                  ) : (
                    <span className="text-neutral-400 italic">не вказано</span>
                  )}
                </div>
                <div>
                  <span className="text-neutral-400">Мати: </span>
                  {mother ? (
                    <span
                      onClick={() => setSelectedPersonId(mother.id)}
                      className="font-semibold text-[#B88E3E] cursor-pointer hover:underline"
                    >
                      {mother.name?.surname || mother.lastName} {mother.name?.given || mother.firstName}
                    </span>
                  ) : (
                    <span className="text-neutral-400 italic">не вказано</span>
                  )}
                </div>
              </div>
            </div>

            {/* Spouses & Children */}
            <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-1.5">
              <span className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider block">
                Подружжя ({spouses.length}) та Діти ({children.length}):
              </span>
              <div className="text-xs space-y-1.5">
                {spouses.length > 0 && (
                  <div>
                    <span className="text-neutral-400">Шлюб: </span>
                    {spouses.map((s) => (
                      <span
                        key={s.id}
                        onClick={() => setSelectedPersonId(s.id)}
                        className="font-semibold text-rose-500 mr-2 cursor-pointer hover:underline"
                      >
                        {s.name?.surname || s.lastName} {s.name?.given || s.firstName}
                      </span>
                    ))}
                  </div>
                )}
                {children.length > 0 ? (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {children.map((c) => (
                      <span
                        key={c.id}
                        onClick={() => setSelectedPersonId(c.id)}
                        className="px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 cursor-pointer hover:text-[#B88E3E] font-medium"
                      >
                        {c.name?.given || c.firstName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-neutral-400 italic text-[11px]">Дітей не зазначено</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Archive Notes & Sources Section */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${theme.cardTitle} flex items-center gap-1.5`}>
              <BookOpen className="w-4 h-4 text-[#B88E3E]" />
              <span>Архівні примітки та джерела</span>
            </h3>

            <button
              type="button"
              onClick={() =>
                setSourceModal({
                  isOpen: true,
                  title: '',
                  archive: '',
                  fund: '',
                  inventory: '',
                  caseNumber: '',
                  page: '',
                  transcription: '',
                  url: ''
                })
              }
              className="text-[11px] px-2.5 py-1 rounded-lg bg-[#B88E3E]/15 hover:bg-[#B88E3E]/25 text-[#B88E3E] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <FilePlus className="w-3 h-3" />
              <span>+ Джерело</span>
            </button>
          </div>

          {/* Research Notes Block */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Дослідницькі примітки
              </span>
              {!isEditingNotes && (
                <button
                  type="button"
                  onClick={() => {
                    setNotesDraft(typeof person.notes === 'string' ? person.notes : '');
                    setIsEditingNotes(true);
                  }}
                  className="text-xs text-[#B88E3E] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{person.notes ? 'Редагувати' : '+ Додати примітку'}</span>
                </button>
              )}
            </div>

            {isEditingNotes ? (
              <div className="space-y-2 pt-1">
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={3}
                  placeholder="Введіть архівні витяги, метричні записи або примітки..."
                  className={`w-full p-2.5 rounded-xl text-xs border border-neutral-300 dark:border-neutral-700 ${theme.cardBg} ${theme.textPrimary}`}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingNotes(false)}
                    className="px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-700 cursor-pointer"
                  >
                    Скасувати
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    className="px-3 py-1 bg-[#B88E3E] hover:bg-[#a07a32] text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3 h-3" />
                    <span>Зберегти</span>
                  </button>
                </div>
              </div>
            ) : person.notes ? (
              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                {typeof person.notes === 'string' ? person.notes : JSON.stringify(person.notes)}
              </p>
            ) : (
              <p className="text-xs text-neutral-400 italic">Примітки відсутні.</p>
            )}
          </div>

          {/* Sources List */}
          {personCitations.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-neutral-400 block">Прив'язані джерела ({personCitations.length}):</span>
              {personCitations.map((c, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 flex items-start justify-between gap-2"
                >
                  <div className="text-xs space-y-0.5 min-w-0">
                    <div className="font-bold text-neutral-800 dark:text-neutral-200">{c.title}</div>
                    {c.archiveRef && <div className="text-[11px] text-neutral-500">{c.archiveRef}</div>}
                    {c.page && <div className="text-[10px] text-neutral-400 font-mono">Аркуш/Стор: {c.page}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCitation(idx)}
                    className="text-rose-500 hover:opacity-80 p-1 cursor-pointer"
                    title="Від'єднати"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Source Creation Modal */}
      {sourceModal?.isOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl`}>
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
              <h3 className={`text-sm font-bold ${theme.cardTitle}`}>Додати архівне джерело</h3>
              <button onClick={() => setSourceModal(null)} className="text-xs text-neutral-400 hover:text-neutral-200">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-neutral-400">Назва джерела:</label>
                <input
                  type="text"
                  value={sourceModal.title}
                  onChange={(e) => setSourceModal({ ...sourceModal, title: e.target.value })}
                  placeholder="Метрична книга церкви..."
                  className={`w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 ${theme.surfaceBg} ${theme.textPrimary}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1 text-neutral-400">Архів:</label>
                  <input
                    type="text"
                    value={sourceModal.archive}
                    onChange={(e) => setSourceModal({ ...sourceModal, archive: e.target.value })}
                    placeholder="ДАПО"
                    className={`w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 ${theme.surfaceBg} ${theme.textPrimary}`}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-neutral-400">Фонд:</label>
                  <input
                    type="text"
                    value={sourceModal.fund}
                    onChange={(e) => setSourceModal({ ...sourceModal, fund: e.target.value })}
                    placeholder="Ф. 127"
                    className={`w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 ${theme.surfaceBg} ${theme.textPrimary}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold mb-1 text-neutral-400">Опис:</label>
                  <input
                    type="text"
                    value={sourceModal.inventory}
                    onChange={(e) => setSourceModal({ ...sourceModal, inventory: e.target.value })}
                    placeholder="Оп. 1"
                    className={`w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 ${theme.surfaceBg} ${theme.textPrimary}`}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-neutral-400">Справа:</label>
                  <input
                    type="text"
                    value={sourceModal.caseNumber}
                    onChange={(e) => setSourceModal({ ...sourceModal, caseNumber: e.target.value })}
                    placeholder="Спр. 45"
                    className={`w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 ${theme.surfaceBg} ${theme.textPrimary}`}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-neutral-400">Арк./Стор.:</label>
                  <input
                    type="text"
                    value={sourceModal.page}
                    onChange={(e) => setSourceModal({ ...sourceModal, page: e.target.value })}
                    placeholder="Арк. 12"
                    className={`w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 ${theme.surfaceBg} ${theme.textPrimary}`}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setSourceModal(null)}
                className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-700"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={handleSaveCitation}
                className="px-4 py-1.5 bg-[#B88E3E] hover:bg-[#a07a32] text-white text-xs font-bold rounded-lg"
              >
                Прив'язати джерело
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
