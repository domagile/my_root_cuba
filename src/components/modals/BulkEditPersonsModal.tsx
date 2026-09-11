import React, { useState, useMemo } from 'react';
import {
  X,
  Tag,
  Heart,
  UserCheck,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Users,
  Sparkles,
  Layers,
  Check,
  SlidersHorizontal,
  ChevronDown,
  Info
} from 'lucide-react';
import { Person, ThemePalette } from '../../types';
import { getThemeConfig } from '../../utils/theme';
import { 
  formatHashtag, 
  parseAndNormalizeTags, 
  COMMON_GENEALOGY_HASHTAG_PRESETS 
} from '../../utils/tagUtils';
import { isPersonFemale } from '../../utils/genderUtils';

export interface BulkEditParams {
  tagAction: 'none' | 'add' | 'replace' | 'remove';
  tagValues: string[];
  livingStatus: 'keep' | 'living' | 'deceased';
  clearDeathDataIfLiving: boolean;
  researchStatus: 'keep' | 'confirmed' | 'hypothetical';
}

interface BulkEditPersonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: Set<string>;
  persons: Person[];
  availableHashtags: { tag: string; count: number }[];
  themePalette?: ThemePalette;
  onApply: (params: BulkEditParams) => void;
  onDeselectPerson?: (id: string) => void;
}

export const BulkEditPersonsModal: React.FC<BulkEditPersonsModalProps> = ({
  isOpen,
  onClose,
  selectedIds,
  persons,
  availableHashtags,
  themePalette = 'dark',
  onApply,
  onDeselectPerson
}) => {
  const theme = getThemeConfig(themePalette);

  // Filter selected persons
  const selectedPersons = useMemo(() => {
    return persons.filter((p) => selectedIds.has(p.id));
  }, [persons, selectedIds]);

  // Form State
  const [tagAction, setTagAction] = useState<'none' | 'add' | 'replace' | 'remove'>('add');
  const [tagInput, setTagInput] = useState<string>('');
  const [selectedTagChips, setSelectedTagChips] = useState<string[]>([]);
  
  const [livingStatus, setLivingStatus] = useState<'keep' | 'living' | 'deceased'>('keep');
  const [clearDeathDataIfLiving, setClearDeathDataIfLiving] = useState<boolean>(true);
  
  const [researchStatus, setResearchStatus] = useState<'keep' | 'confirmed' | 'hypothetical'>('keep');

  // Expanded tag selector accordion
  const [showTagPresets, setShowTagPresets] = useState<boolean>(true);

  if (!isOpen) return null;

  // Compute parsed tags
  const combinedTagList = useMemo(() => {
    const fromInput = parseAndNormalizeTags(tagInput);
    const combined = Array.from(new Set([...selectedTagChips, ...fromInput]));
    return combined;
  }, [tagInput, selectedTagChips]);

  const handleToggleTagChip = (tag: string) => {
    const clean = tag.replace(/^#+/, '').trim();
    if (!clean) return;
    setSelectedTagChips((prev) => {
      if (prev.includes(clean)) {
        return prev.filter((t) => t !== clean);
      } else {
        return [...prev, clean];
      }
    });
  };

  const handleAddCustomInputTag = () => {
    if (!tagInput.trim()) return;
    const parsed = parseAndNormalizeTags(tagInput);
    if (parsed.length > 0) {
      setSelectedTagChips((prev) => Array.from(new Set([...prev, ...parsed])));
      setTagInput('');
    }
  };

  const handleKeyDownTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddCustomInputTag();
    }
  };

  const handleRemoveChip = (chip: string) => {
    setSelectedTagChips((prev) => prev.filter((c) => c !== chip));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAddCustomInputTag();

    const finalTags = combinedTagList;

    onApply({
      tagAction: finalTags.length === 0 ? 'none' : tagAction,
      tagValues: finalTags,
      livingStatus,
      clearDeathDataIfLiving,
      researchStatus
    });

    onClose();
  };

  const hasAnyChange = 
    (tagAction !== 'none' && combinedTagList.length > 0) ||
    livingStatus !== 'keep' ||
    researchStatus !== 'keep';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-[#171717] border border-[#2E2E2E] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#E5E5E5] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#262626] flex items-center justify-between bg-[#1B1B1B]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#B88E3E]/15 border border-[#B88E3E]/40 text-[#B88E3E] flex items-center justify-center shrink-0 shadow-xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 truncate">
                <span>Масове редагування</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#B88E3E]/20 text-[#B88E3E] border border-[#B88E3E]/30 shrink-0">
                  {selectedPersons.length} {selectedPersons.length === 1 ? 'особа' : selectedPersons.length < 5 ? 'особи' : 'осіб'}
                </span>
              </h2>
              <p className="text-xs text-[#8C8C8C] truncate">
                Встановлення спільних тегів, зміна статусу життя та параметрів дослідження
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C8C8C] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer shrink-0"
            title="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scrollbar">
          
          {/* Selected Persons Strip */}
          <div className="p-3 bg-[#1F1F1F] rounded-xl border border-[#2B2B2B] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#A3A3A3] flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Users className="w-3.5 h-3.5 text-[#B88E3E]" />
                Вибрані фігуранти ({selectedPersons.length})
              </span>
              <span className="text-[11px] text-[#737373]">
                Натисніть хрестик на особі, щоб виключити її з групи
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap max-h-28 overflow-y-auto pr-1">
              {selectedPersons.map((p) => {
                const feminine = isPersonFemale(p, persons);
                const initials = `${p.lastName?.[0] || ''}${p.firstName?.[0] || ''}`.toUpperCase();
                return (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#262626] border border-[#383838] text-xs font-medium text-[#E5E5E5] group hover:border-[#B88E3E]/50 transition-colors"
                  >
                    <span
                      className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
                        feminine ? 'bg-[#A54968] text-white' : 'bg-[#2563EB] text-white'
                      }`}
                    >
                      {initials}
                    </span>
                    <span className="font-semibold">{p.lastName || ''} {p.firstName || ''}</span>
                    {p.isLiving ? (
                      <span className="text-[10px] text-emerald-400 font-normal">🌱</span>
                    ) : (
                      <span className="text-[10px] text-neutral-400 font-normal">🕊️</span>
                    )}
                    {onDeselectPerson && selectedPersons.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeselectPerson(p.id);
                        }}
                        className="ml-0.5 text-[#8C8C8C] hover:text-rose-400 cursor-pointer transition-colors"
                        title="Вилучити зі списку"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Section 1: Hashtags & Tags */}
          <div className="p-4 bg-[#1C1C1C] rounded-xl border border-[#2B2B2B] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#B88E3E]" />
                <label className="text-sm font-bold text-white">
                  Спільні теги (Hashtags)
                </label>
              </div>

              {/* Tag Action Mode */}
              <div className="flex items-center gap-1 bg-[#121212] p-0.5 rounded-lg border border-[#2E2E2E] text-xs">
                <button
                  type="button"
                  onClick={() => setTagAction('add')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    tagAction === 'add'
                      ? 'bg-[#B88E3E] text-black font-bold shadow-xs'
                      : 'text-[#8C8C8C] hover:text-[#E5E5E5]'
                  }`}
                  title="Додати тег до вибраних (зберегти існуючі)"
                >
                  + Додати
                </button>
                <button
                  type="button"
                  onClick={() => setTagAction('replace')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    tagAction === 'replace'
                      ? 'bg-[#B88E3E] text-black font-bold shadow-xs'
                      : 'text-[#8C8C8C] hover:text-[#E5E5E5]'
                  }`}
                  title="Замінити всі теги обраними"
                >
                  Замінити всі
                </button>
                <button
                  type="button"
                  onClick={() => setTagAction('remove')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    tagAction === 'remove'
                      ? 'bg-rose-600 text-white font-bold shadow-xs'
                      : 'text-[#8C8C8C] hover:text-rose-300'
                  }`}
                  title="Видалити вказані теги у вибраних осіб"
                >
                  - Видалити
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTagAction('none');
                    setSelectedTagChips([]);
                    setTagInput('');
                  }}
                  className={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    tagAction === 'none'
                      ? 'bg-[#333333] text-[#E5E5E5] font-bold'
                      : 'text-[#737373] hover:text-[#A3A3A3]'
                  }`}
                  title="Не вносити змін до тегів"
                >
                  Без змін
                </button>
              </div>
            </div>

            {tagAction !== 'none' ? (
              <div className="space-y-3">
                {/* Input & Selected Chips */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8C8C] font-mono text-sm">#</span>
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleKeyDownTagInput}
                        placeholder="Введіть тег (наприклад: козак, полтавщина, ревізія 1850)..."
                        className="w-full pl-7 pr-3 py-2 bg-[#121212] border border-[#333333] rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-[#B88E3E] transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCustomInputTag}
                      disabled={!tagInput.trim()}
                      className="px-3.5 py-2 bg-[#2A2A2A] hover:bg-[#383838] disabled:opacity-40 disabled:hover:bg-[#2A2A2A] text-xs font-bold text-white rounded-xl border border-[#404040] transition-all cursor-pointer"
                    >
                      Додати
                    </button>
                  </div>

                  {/* Selected Tags Chips */}
                  {combinedTagList.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap p-2.5 bg-[#141414] rounded-xl border border-[#2B2B2B]">
                      <span className="text-[11px] font-bold text-[#8C8C8C] uppercase mr-1">
                        {tagAction === 'remove' ? 'Теги до вилучення:' : 'Цільові теги:'}
                      </span>
                      {combinedTagList.map((tag) => (
                        <span
                          key={tag}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                            tagAction === 'remove'
                              ? 'bg-rose-950/60 text-rose-200 border-rose-800'
                              : 'bg-[#B88E3E]/20 text-[#E5B558] border-[#B88E3E]/40'
                          }`}
                        >
                          <span>#{tag}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveChip(tag)}
                            className="hover:text-white cursor-pointer ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Popular Tags & Presets */}
                <div className="pt-2 border-t border-[#2B2B2B] space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowTagPresets((prev) => !prev)}
                    className="flex items-center justify-between w-full text-xs font-semibold text-[#8C8C8C] hover:text-[#E5E5E5] transition-colors cursor-pointer py-1"
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#B88E3E]" />
                      <span>Швидкий вибір із бази дерева та шаблонів</span>
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTagPresets ? 'rotate-180' : ''}`} />
                  </button>

                  {showTagPresets && (
                    <div className="space-y-2.5 pt-1">
                      {/* Tree Existing Tags */}
                      {availableHashtags.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-[#737373] uppercase tracking-wider">
                            Вже використані в проєкті:
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto pr-1">
                            {availableHashtags.map((h) => {
                              const isSelected = combinedTagList.includes(h.tag);
                              return (
                                <button
                                  key={h.tag}
                                  type="button"
                                  onClick={() => handleToggleTagChip(h.tag)}
                                  className={`px-2 py-0.5 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1 ${
                                    isSelected
                                      ? 'bg-[#B88E3E] text-black border-[#B88E3E] font-bold'
                                      : 'bg-[#181818] hover:bg-[#252525] border-[#333333] text-[#A3A3A3]'
                                  }`}
                                >
                                  <span>#{h.tag}</span>
                                  <span className={`text-[10px] ${isSelected ? 'text-black/70' : 'text-[#666666]'}`}>
                                    {h.count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Standard Presets */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-[#737373] uppercase tracking-wider">
                          Історичні категорії та мітки:
                        </span>
                        <div className="space-y-1.5">
                          {COMMON_GENEALOGY_HASHTAG_PRESETS.map((cat) => (
                            <div key={cat.category} className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-[#8C8C8C] font-semibold w-24 shrink-0">
                                {cat.category}:
                              </span>
                              <div className="flex items-center gap-1 flex-wrap flex-1">
                                {cat.tags.map((t) => {
                                  const isSelected = combinedTagList.includes(t);
                                  return (
                                    <button
                                      key={t}
                                      type="button"
                                      onClick={() => handleToggleTagChip(t)}
                                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all cursor-pointer ${
                                        isSelected
                                          ? 'bg-[#B88E3E] text-black border-[#B88E3E] font-bold'
                                          : 'bg-[#1A1A1A] hover:bg-[#2A2A2A] border-[#333333] text-[#A3A3A3]'
                                      }`}
                                    >
                                      #{t}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#737373] italic">
                Теги обраних осіб залишаться без жодних змін.
              </p>
            )}
          </div>

          {/* Section 2: Living Status (Статус життя) */}
          <div className="p-4 bg-[#1C1C1C] rounded-xl border border-[#2B2B2B] space-y-3.5">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-emerald-400" />
              <label className="text-sm font-bold text-white">
                Статус життя (Живий / Померлий)
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Keep */}
              <button
                type="button"
                onClick={() => setLivingStatus('keep')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  livingStatus === 'keep'
                    ? 'bg-[#2A2A2A] border-[#B88E3E] ring-1 ring-[#B88E3E]/40'
                    : 'bg-[#141414] border-[#2E2E2E] hover:border-[#404040]'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                  livingStatus === 'keep' ? 'border-[#B88E3E] bg-[#B88E3E]' : 'border-[#555555]'
                }`}>
                  {livingStatus === 'keep' && <Check className="w-3 h-3 text-black stroke-[3]" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Без змін</div>
                  <div className="text-[11px] text-[#737373]">Зберегти поточний стан кожної особи</div>
                </div>
              </button>

              {/* Set Living */}
              <button
                type="button"
                onClick={() => setLivingStatus('living')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  livingStatus === 'living'
                    ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/40'
                    : 'bg-[#141414] border-[#2E2E2E] hover:border-emerald-800/50'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                  livingStatus === 'living' ? 'border-emerald-500 bg-emerald-500' : 'border-[#555555]'
                }`}>
                  {livingStatus === 'living' && <Check className="w-3 h-3 text-black stroke-[3]" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                    <span>🌱 Всі живі</span>
                  </div>
                  <div className="text-[11px] text-emerald-500/80">Встановити «Живий» (isLiving: true)</div>
                </div>
              </button>

              {/* Set Deceased */}
              <button
                type="button"
                onClick={() => setLivingStatus('deceased')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  livingStatus === 'deceased'
                    ? 'bg-neutral-800/80 border-neutral-400 ring-1 ring-neutral-400/40'
                    : 'bg-[#141414] border-[#2E2E2E] hover:border-neutral-600'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                  livingStatus === 'deceased' ? 'border-neutral-400 bg-neutral-400' : 'border-[#555555]'
                }`}>
                  {livingStatus === 'deceased' && <Check className="w-3 h-3 text-black stroke-[3]" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-200 flex items-center gap-1">
                    <span>🕊️ Всі померлі</span>
                  </div>
                  <div className="text-[11px] text-neutral-400">Встановити «Померлий» (isLiving: false)</div>
                </div>
              </button>
            </div>

            {/* If setting to living, option to clear death dates */}
            {livingStatus === 'living' && (
              <div className="p-2.5 bg-emerald-950/30 border border-emerald-900/50 rounded-lg flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="clearDeathDatesCheck"
                  checked={clearDeathDataIfLiving}
                  onChange={(e) => setClearDeathDataIfLiving(e.target.checked)}
                  className="rounded border-[#404040] bg-[#121212] text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="clearDeathDatesCheck" className="text-xs text-emerald-200 cursor-pointer select-none">
                  Очистити дату, рік та місце смерті для живих осіб (рекомендовано для уникнення конфліктів)
                </label>
              </div>
            )}
          </div>

          {/* Section 3: Research Status (Статус дослідження) */}
          <div className="p-4 bg-[#1C1C1C] rounded-xl border border-[#2B2B2B] space-y-3.5">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-sky-400" />
              <label className="text-sm font-bold text-white">
                Статус дослідження
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setResearchStatus('keep')}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                  researchStatus === 'keep'
                    ? 'bg-[#2A2A2A] border-[#B88E3E]'
                    : 'bg-[#141414] border-[#2E2E2E] hover:border-[#404040]'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                  researchStatus === 'keep' ? 'border-[#B88E3E] bg-[#B88E3E]' : 'border-[#555555]'
                }`}>
                  {researchStatus === 'keep' && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
                </div>
                <span className="text-xs font-semibold text-white">Без змін</span>
              </button>

              <button
                type="button"
                onClick={() => setResearchStatus('confirmed')}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                  researchStatus === 'confirmed'
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                    : 'bg-[#141414] border-[#2E2E2E] text-[#A3A3A3] hover:border-emerald-800'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                  researchStatus === 'confirmed' ? 'border-emerald-500 bg-emerald-500' : 'border-[#555555]'
                }`}>
                  {researchStatus === 'confirmed' && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
                </div>
                <span className="text-xs font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Підтверджена особа
                </span>
              </button>

              <button
                type="button"
                onClick={() => setResearchStatus('hypothetical')}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                  researchStatus === 'hypothetical'
                    ? 'bg-amber-950/40 border-amber-500 text-amber-300'
                    : 'bg-[#141414] border-[#2E2E2E] text-[#A3A3A3] hover:border-amber-800'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                  researchStatus === 'hypothetical' ? 'border-amber-500 bg-amber-500' : 'border-[#555555]'
                }`}>
                  {researchStatus === 'hypothetical' && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
                </div>
                <span className="text-xs font-semibold flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                  Гіпотеза
                </span>
              </button>
            </div>
          </div>

          {/* Action Summary Box */}
          {hasAnyChange && (
            <div className="p-3 bg-[#B88E3E]/10 border border-[#B88E3E]/30 rounded-xl space-y-1.5 text-xs text-[#E5B558]">
              <div className="font-bold flex items-center gap-1.5 text-white">
                <Sparkles className="w-3.5 h-3.5 text-[#B88E3E]" />
                Підсумок масових змін для {selectedPersons.length} осіб:
              </div>
              <ul className="list-disc list-inside space-y-1 text-[#E5E5E5] pl-1 font-medium">
                {tagAction !== 'none' && combinedTagList.length > 0 && (
                  <li>
                    Теги: {tagAction === 'add' ? 'додати' : tagAction === 'replace' ? 'замінити на' : 'видалити'}{' '}
                    <span className="font-bold text-[#B88E3E]">
                      {combinedTagList.map((t) => `#${t}`).join(', ')}
                    </span>
                  </li>
                )}
                {livingStatus !== 'keep' && (
                  <li>
                    Статус життя:{' '}
                    <span className="font-bold text-white">
                      {livingStatus === 'living' ? '🌱 Всі живі (isLiving = true)' : '🕊️ Всі померлі (isLiving = false)'}
                    </span>
                    {livingStatus === 'living' && clearDeathDataIfLiving && (
                      <span className="text-emerald-400 text-[11px] ml-1"> (з очищенням дат смерті)</span>
                    )}
                  </li>
                )}
                {researchStatus !== 'keep' && (
                  <li>
                    Статус дослідження:{' '}
                    <span className="font-bold text-white">
                      {researchStatus === 'confirmed' ? 'Підтверджена особа' : 'Гіпотеза'}
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </form>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-[#262626] bg-[#1B1B1B] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#262626] hover:bg-[#333333] text-[#A3A3A3] hover:text-white transition-colors cursor-pointer"
          >
            Скасувати
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!hasAnyChange || selectedPersons.length === 0}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-[#B88E3E] hover:bg-[#9E7830] disabled:opacity-40 disabled:hover:bg-[#B88E3E] text-black transition-all cursor-pointer shadow-md flex items-center gap-1.5"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Застосувати для {selectedPersons.length} осіб</span>
          </button>
        </div>
      </div>
    </div>
  );
};
