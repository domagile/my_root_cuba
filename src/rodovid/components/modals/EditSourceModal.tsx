import React, { useState, useMemo } from 'react';
import {
  X,
  BookOpen,
  Save,
  Trash2,
  Tag,
  Hash,
  Link as LinkIcon,
  ExternalLink,
  Plus,
  Layers,
  FileText,
  Archive,
  Calendar,
  Eye
} from 'lucide-react';
import { GenealogyDatabase, Source, CustomFieldItem } from '../../types/genealogy';
import { ConfirmDeleteModal } from '../../../components/common/ConfirmDeleteModal';
import { useUIStore } from '../../../stores/useUIStore';
import { getThemeConfig } from '../../../utils/theme';

interface EditSourceModalProps {
  sourceId: string | null;
  database: GenealogyDatabase;
  onClose: () => void;
  onSave: (source: Source) => void;
  onDelete?: (id: string) => void;
}

const DOCUMENT_TYPES = [
  { id: 'Метрична книга', label: 'Метрична книга (запис про народження/шлюб/смерть)' },
  { id: 'Сповідальний розпис', label: 'Сповідальний розпис (сповідна відомість)' },
  { id: 'Ревізька казка', label: 'Ревізька казка (поіменний перепис ревізії)' },
  { id: 'Акт цивільного стану', label: 'Акт цивільного стану (РАЦС / ЗАГС)' },
  { id: 'Дворянська справа', label: 'Дворянська справа / Грамота / Дворянська книга' },
  { id: 'Родовідний розпис', label: 'Родовідний розпис / Генеалогічне дослідження' },
  { id: 'Друковане видання', label: 'Друковане видання / Книга / Газета' },
  { id: 'Архівна справа', label: 'Архівна справа / Фонд / Документ' },
  { id: 'Інше', label: 'Інше першоджерело' }
];

const PRESET_TAGS = [
  'метрика',
  'сповідний_розпис',
  'ревізька_казка',
  'рацс',
  'онлайн_скан',
  'familysearch',
  'архів',
  'полтавщина',
  'київщина',
  'галичина',
  'поділля',
  'козаки',
  'шляхта',
  'селяни',
  'священнослужителі',
  'дворяни'
];

export const EditSourceModal: React.FC<EditSourceModalProps> = ({
  sourceId,
  database,
  onClose,
  onSave,
  onDelete
}) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const existingSource = sourceId && sourceId !== 'NEW' ? database.sources[sourceId] : null;

  // Form states
  const [title, setTitle] = useState(existingSource?.title || '');
  const [documentType, setDocumentType] = useState(
    existingSource?.documentType ||
      (existingSource?.title?.toLowerCase().includes('метрич')
        ? 'Метрична книга'
        : existingSource?.title?.toLowerCase().includes('сповід')
        ? 'Сповідальний розпис'
        : existingSource?.title?.toLowerCase().includes('ревіз')
        ? 'Ревізька казка'
        : existingSource?.title?.toLowerCase().includes('акт')
        ? 'Акт цивільного стану'
        : existingSource?.title?.toLowerCase().includes('дерево') ||
          existingSource?.title?.toLowerCase().includes('родовід')
        ? 'Родовідний розпис'
        : 'Метрична книга')
  );
  const [author, setAuthor] = useState(existingSource?.author || '');
  const [publication, setPublication] = useState(existingSource?.publication || existingSource?.date || '');
  const [repository, setRepository] = useState(existingSource?.repository || existingSource?.archive || '');
  const [archiveReference, setArchiveReference] = useState(
    existingSource?.archiveReference ||
      (existingSource?.fund || existingSource?.inventory || existingSource?.caseNumber
        ? [
            existingSource.fund ? `Ф. ${existingSource.fund}` : '',
            existingSource.inventory ? `Оп. ${existingSource.inventory}` : '',
            existingSource.caseNumber ? `Спр. ${existingSource.caseNumber}` : '',
            existingSource.page ? `Арк. ${existingSource.page}` : ''
          ]
            .filter(Boolean)
            .join(', ')
        : '')
  );
  const [url, setUrl] = useState(existingSource?.url || existingSource?.documentLink || '');
  const [notes, setNotes] = useState(existingSource?.notes || existingSource?.transcription || '');

  // Tags state
  const [tagsStr, setTagsStr] = useState((existingSource?.tags || []).join(', '));

  // Custom Fields state
  const parseInitialCustomFields = (): CustomFieldItem[] => {
    if (!existingSource?.customFields) return [];
    if (Array.isArray(existingSource.customFields)) {
      return existingSource.customFields;
    }
    return [];
  };

  const [customFields, setCustomFields] = useState<CustomFieldItem[]>(parseInitialCustomFields);
  const [showAddCustomField, setShowAddCustomField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<string>('link');
  const [newFieldValue, setNewFieldValue] = useState('');

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'main' | 'archive' | 'custom' | 'notes'>('main');
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Helper to parse and normalize tags
  const parseAndNormalizeTags = (input: string): string[] => {
    if (!input) return [];
    return input
      .split(/[,#;\s]+/)
      .map((t) => t.trim().replace(/^#+/, ''))
      .filter((t) => t.length > 0)
      .filter((val, idx, self) => self.indexOf(val) === idx);
  };

  const currentTagsList = useMemo(() => {
    return parseAndNormalizeTags(tagsStr);
  }, [tagsStr]);

  // Aggregate popular hashtags from database sources and preset
  const popularHashtags = useMemo(() => {
    const counts: Record<string, number> = {};

    PRESET_TAGS.forEach((t) => {
      counts[t] = (counts[t] || 0) + 1;
    });

    Object.values(database.sources || {}).forEach((s) => {
      if (Array.isArray(s.tags)) {
        s.tags.forEach((t) => {
          const clean = t.trim().replace(/^#+/, '').toLowerCase();
          if (clean) {
            counts[clean] = (counts[clean] || 0) + 2;
          }
        });
      }
    });

    return Object.entries(counts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [database.sources]);

  const handleAddHashtagSuggestion = (tagToAdd: string) => {
    const current = parseAndNormalizeTags(tagsStr);
    if (!current.some((t) => t.toLowerCase() === tagToAdd.toLowerCase())) {
      const updated = [...current, tagToAdd];
      setTagsStr(updated.join(', '));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const current = parseAndNormalizeTags(tagsStr);
    const updated = current.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase());
    setTagsStr(updated.join(', '));
  };

  // Add custom field handler
  const handleAddCustomField = () => {
    if (!newFieldLabel.trim()) return;

    const newField: CustomFieldItem = {
      id: `cf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      label: newFieldLabel.trim(),
      type: newFieldType,
      value: newFieldValue.trim()
    };

    setCustomFields((prev) => [...prev, newField]);
    setNewFieldLabel('');
    setNewFieldValue('');
    setShowAddCustomField(false);
  };

  const handleRemoveCustomField = (idOrIndex: string | number) => {
    setCustomFields((prev) =>
      prev.filter((field, idx) => (field.id ? field.id !== idOrIndex : idx !== idOrIndex))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      return;
    }

    const generatedId =
      existingSource?.id || `S${String(Object.keys(database.sources || {}).length + 1).padStart(4, '0')}`;

    const normalizedTags = parseAndNormalizeTags(tagsStr);

    const newSource: Source = {
      id: generatedId,
      title: title.trim(),
      documentType: documentType || undefined,
      author: author.trim() || undefined,
      publication: publication.trim() || undefined,
      repository: repository.trim() || undefined,
      archiveReference: archiveReference.trim() || undefined,
      url: url.trim() || undefined,
      documentLink: url.trim() || undefined,
      notes: notes.trim() || undefined,
      tags: normalizedTags.length > 0 ? normalizedTags : undefined,
      customFields: customFields.length > 0 ? customFields : undefined
    };

    onSave(newSource);
    onClose();
  };

  const handleDelete = () => {
    if (existingSource && onDelete) {
      onDelete(existingSource.id);
      setIsConfirmDeleteOpen(false);
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div
          className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-4 sm:my-8 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]`}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-black/5 dark:bg-white/5 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#B88E3E]/20 text-[#B88E3E] border border-[#B88E3E]/30">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className={`text-base font-bold ${theme.textPrimary}`}>
                  {existingSource ? 'Редагувати архівне джерело' : 'Додати нове архівне джерело'}
                </h2>
                <p className={`text-[11px] ${theme.textMuted}`}>
                  {existingSource ? `Код: ${existingSource.id}` : 'Внесення метричної книги, розпису або документа'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`p-2 ${theme.textMuted} hover:${theme.textPrimary} hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 px-4 pt-3 pb-1 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] overflow-x-auto text-xs shrink-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('main')}
              className={`px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'main'
                  ? 'bg-[#B88E3E] text-white shadow-xs'
                  : `${theme.textMuted} hover:${theme.textPrimary} hover:bg-black/5 dark:hover:bg-white/5`
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Основне та тип</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('archive')}
              className={`px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'archive'
                  ? 'bg-[#B88E3E] text-white shadow-xs'
                  : `${theme.textMuted} hover:${theme.textPrimary} hover:bg-black/5 dark:hover:bg-white/5`
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Архівосховище та шифри</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'custom'
                  ? 'bg-[#B88E3E] text-white shadow-xs'
                  : `${theme.textMuted} hover:${theme.textPrimary} hover:bg-black/5 dark:hover:bg-white/5`
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Власні поля {customFields.length > 0 && `(${customFields.length})`}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('notes')}
              className={`px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'notes'
                  ? 'bg-[#B88E3E] text-white shadow-xs'
                  : `${theme.textMuted} hover:${theme.textPrimary} hover:bg-black/5 dark:hover:bg-white/5`
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Примітки та цитати</span>
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 scrollbar-thin">
            {/* TAB 1: Main Information & Tags */}
            {activeTab === 'main' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider opacity-75 mb-1.5">
                    Назва джерела / Документа *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Наприклад: Метрична книга церкви Покрови Пресвятої Богородиці 1878 року"
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  />
                </div>

                {/* Document Type & Year */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider opacity-75 mb-1.5">
                      Тип документа / Запису
                    </label>
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    >
                      {DOCUMENT_TYPES.map((dt) => (
                        <option key={dt.id} value={dt.id}>
                          {dt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider opacity-75 mb-1.5">
                      Рік або період публікації
                    </label>
                    <input
                      type="text"
                      value={publication}
                      onChange={(e) => setPublication(e.target.value)}
                      placeholder="Наприклад: 1878 рік, 1850–1858 рр."
                      className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>
                </div>

                {/* Author / Creator */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider opacity-75 mb-1.5">
                    Автор / Укладач / Духовна консисторія / Відомство
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Полтавська духовна консисторія, Свято-Покровський приход"
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  />
                </div>

                {/* Online Link / URL */}
                <div className="p-3.5 rounded-xl border border-black/10 dark:border-white/10 space-y-2 bg-black/[0.02] dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider opacity-75 flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-[#B88E3E]" />
                      <span>Посилання на документ / Онлайн-скан (URL)</span>
                    </label>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-[#B88E3E] hover:underline flex items-center gap-1"
                      >
                        <span>Перевірити лінк</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://familysearch.org/... або https://chashniki.archives.gov.ua/..."
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  />
                  <p className="text-[11px] text-neutral-400">
                    Вказане посилання буде клікабельним у картці джерела та відкриватиме скан у новій вкладці.
                  </p>
                </div>

                {/* Tags & Hashtags */}
                <div className="pt-2 border-t border-black/5 dark:border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-[#B88E3E]" />
                      <span>Хештеги / Теги запису</span>
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
                    placeholder="#метрика, #1878, #полтавщина, #онлайн_скан, #козаки"
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  />

                  {popularHashtags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] text-neutral-400 flex items-center gap-0.5 font-medium">
                        <Hash className="w-3 h-3 text-[#B88E3E]" /> Популярні теги:
                      </span>
                      {popularHashtags.map((h) => {
                        const isSelected = currentTagsList.some(
                          (t) => t.toLowerCase() === h.tag.toLowerCase()
                        );
                        return (
                          <button
                            key={h.tag}
                            type="button"
                            onClick={() => handleAddHashtagSuggestion(h.tag)}
                            disabled={isSelected}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 opacity-60 cursor-default'
                                : 'bg-black/5 dark:bg-white/5 hover:bg-[#B88E3E]/20 text-neutral-600 dark:text-neutral-300 hover:text-[#B88E3E] border-black/10 dark:border-white/10'
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
            )}

            {/* TAB 2: Archive & References */}
            {activeTab === 'archive' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider opacity-75 mb-1.5">
                    Архівосховище (Репозиторій / Архів / Онлайн-база)
                  </label>
                  <input
                    type="text"
                    value={repository}
                    onChange={(e) => setRepository(e.target.value)}
                    placeholder="Державний архів Полтавської області (ДАПО), ЦДІАК України, FamilySearch..."
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider opacity-75 mb-1.5">
                    Архівний шифр (Фонд, Опис, Справа, Аркуш)
                  </label>
                  <input
                    type="text"
                    value={archiveReference}
                    onChange={(e) => setArchiveReference(e.target.value)}
                    placeholder="Фонд 1011, Опис 1, Справа 45, Арк. 12 зв."
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs font-mono text-[#B88E3E] focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Шифр допоможе миттєво згрупувати та знайти справи одного архівного фонду.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: Custom Fields (Власні поля з типом 'лінк' та іншими) */}
            {activeTab === 'custom' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="border-b border-black/5 dark:border-white/5 pb-2">
                  <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Власні поля</h3>
                  <p className={`text-xs ${theme.textMuted}`}>
                    Додаткові поля, налаштовані для модуля джерел та архівних документів цього проекту.
                  </p>
                </div>

                {/* Notice banner & Add trigger */}
                <div className="p-3.5 rounded-xl border border-black/10 dark:border-white/10 space-y-3 bg-black/[0.02] dark:bg-white/[0.02]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-neutral-800 dark:text-neutral-200">
                        Користувацькі атрибути та параметри
                      </h4>
                      <p className="text-[11px] text-neutral-500">
                        Створюйте власні поля довільних типів (веб-лінк на скан, номер ревізької душі, інвентарний опис тощо).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAddCustomField(!showAddCustomField)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 border border-emerald-500/30 shrink-0 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{showAddCustomField ? 'Скасувати додавання' : '+ Додати власне поле'}</span>
                    </button>
                  </div>

                  {/* Add Custom Field Form (Matches user screenshot) */}
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
                            placeholder="Наприклад: Посилання на FamilySearch"
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
                            className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E] font-medium`}
                          >
                            <option value="link">🔗 Посилання / Веб-лінк (URL)</option>
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
                        ) : newFieldType === 'link' ? (
                          <div className="relative">
                            <input
                              type="url"
                              value={newFieldValue}
                              onChange={(e) => setNewFieldValue(e.target.value)}
                              placeholder="https://..."
                              className={`w-full p-2.5 pl-8 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                            />
                            <LinkIcon className="w-3.5 h-3.5 text-[#B88E3E] absolute left-2.5 top-3" />
                          </div>
                        ) : (
                          <input
                            type={newFieldType === 'number' ? 'number' : newFieldType === 'date' ? 'date' : 'text'}
                            value={newFieldValue}
                            onChange={(e) => setNewFieldValue(e.target.value)}
                            placeholder="Введіть значення поля..."
                            className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                          />
                        )}
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleAddCustomField}
                          disabled={!newFieldLabel.trim()}
                          className="px-4 py-2 rounded-xl bg-[#B88E3E] hover:bg-[#a07a32] text-white font-bold text-xs disabled:opacity-50 cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Зберегти поле</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Existing Custom Fields List */}
                <div className="space-y-2">
                  {customFields.length > 0 ? (
                    <div className="space-y-2">
                      {customFields.map((field, idx) => (
                        <div
                          key={field.id || idx}
                          className={`p-3 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} flex items-center justify-between gap-3`}
                        >
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                                {field.label}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 font-mono text-neutral-400">
                                {field.type === 'link' ? '🔗 Лінк' : field.type || 'текст'}
                              </span>
                            </div>

                            {field.type === 'link' || field.value?.startsWith('http://') || field.value?.startsWith('https://') ? (
                              <a
                                href={field.value}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-bold text-[#B88E3E] hover:underline flex items-center gap-1 break-all"
                              >
                                <span>{field.value}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            ) : (
                              <p className={`text-xs font-medium ${theme.textPrimary} break-words`}>
                                {field.value || <span className="italic opacity-50">Порожньо</span>}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveCustomField(field.id || idx)}
                            className="p-1.5 text-neutral-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                            title="Видалити поле"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-5 text-center text-xs text-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl italic">
                      Власних полів ще немає. Натисніть «+ Додати власне поле», щоб створити перше.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: Notes & Transcriptions */}
            {activeTab === 'notes' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider opacity-75 mb-1.5">
                    Примітки, цитування та розшифровка тексту
                  </label>
                  <textarea
                    rows={6}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Повний поіменний список родини, цитати з метричного запису, розшифровка рукописного тексту чи коментарі дослідника..."
                    className={`w-full p-3 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Будь-які веб-посилання у примітках будуть автоматично перетворені на клікабельні.
                  </p>
                </div>
              </div>
            )}

            {/* Footer with Delete and Submit buttons */}
            <div className="flex items-center justify-between gap-2 pt-4 border-t border-black/10 dark:border-white/10 shrink-0">
              <div>
                {existingSource && onDelete && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmDeleteOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Видалити джерело</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 rounded-xl text-xs font-bold ${theme.surfaceBg} hover:bg-black/10 dark:hover:bg-white/10 ${theme.textPrimary} border ${theme.borderSubtle} transition-colors cursor-pointer`}
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#B88E3E] hover:bg-[#a07a32] text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Зберегти джерело</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {isConfirmDeleteOpen && existingSource && (
        <ConfirmDeleteModal
          isOpen={isConfirmDeleteOpen}
          title="Видалити архівне джерело"
          itemName={existingSource.title}
          itemType="архівне джерело"
          message={`Ви дійсно бажаєте видалити джерело «${existingSource.title}»? Посилання на це джерело в подіях збережуться, але запис буде видалено з реєстру.`}
          confirmText="Так, видалити джерело"
          cancelText="Скасувати"
          onConfirm={handleDelete}
          onClose={() => setIsConfirmDeleteOpen(false)}
          isPermanent={true}
        />
      )}
    </>
  );
};
