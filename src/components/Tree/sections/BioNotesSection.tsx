/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookOpen, ChevronDown, FileText, Tag, Hash, X } from 'lucide-react';

interface BioNotesSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  bio: string;
  onChangeBio: (val: string) => void;
  notes: string;
  onChangeNotes: React.Dispatch<React.SetStateAction<string>>;
  estate: string;
  onChangeEstate: (val: string) => void;
  occupation: string;
  onChangeOccupation: (val: string) => void;
  confession: string;
  onChangeConfession: (val: string) => void;
  militaryRank: string;
  onChangeMilitaryRank: (val: string) => void;
  tagsStr: string;
  onChangeTagsStr: (val: string) => void;
  currentTagsList: string[];
  onRemoveTag: (tag: string) => void;
  onClearAllTags: () => void;
  popularHashtags: { tag: string; count: number }[];
  onAddHashtagSuggestion: (tag: string) => void;
  isReadOnly?: boolean;
  theme: any;
}

export const BioNotesSection: React.FC<BioNotesSectionProps> = ({
  isOpen,
  onToggle,
  bio,
  onChangeBio,
  notes,
  onChangeNotes,
  estate,
  onChangeEstate,
  occupation,
  onChangeOccupation,
  confession,
  onChangeConfession,
  militaryRank,
  onChangeMilitaryRank,
  tagsStr,
  onChangeTagsStr,
  currentTagsList,
  onRemoveTag,
  onClearAllTags,
  popularHashtags,
  onAddHashtagSuggestion,
  isReadOnly = false,
  theme
}) => {
  return (
    <div id="sec-bio-notes" className={`rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isOpen ? 'bg-[#B88E3E] text-white' : 'bg-black/5 dark:bg-white/5 text-neutral-500'}`}>
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Біографія, нотатки та коментарі</h3>
            <p className={`text-xs ${theme.textMuted}`}>Життєпис предка, дослідницькі нотатки та джерела</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isOpen && (
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium hidden sm:inline-block">
              {bio ? 'Є життєпис' : (notes ? 'Є нотатки' : 'Порожньо')}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#B88E3E]' : ''}`} />
        </div>
      </button>

      {isOpen && (
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
                onChange={(e) => onChangeBio(e.target.value)}
                placeholder="Введіть життєпис, родинні спогади, відомості про діяльність та життя особи..."
                className={`w-full p-3 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E] leading-relaxed`}
                readOnly={isReadOnly}
              />
            </div>

            {/* Dedicated Researcher Notes & Comments */}
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
                onChange={(e) => onChangeNotes(e.target.value)}
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
                        onChangeNotes((prev: string) => (prev && prev.trim() ? `${prev.trim()}\n${chip.prefix}` : chip.prefix));
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
                  onChange={(e) => onChangeEstate(e.target.value)}
                  placeholder="Селянин, дворянин, міщанин, козак, шляхтич..."
                  className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  readOnly={isReadOnly}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                  Професія / Посада / Заняття
                </label>
                <input
                  type="text"
                  value={occupation}
                  onChange={(e) => onChangeOccupation(e.target.value)}
                  placeholder="Художник, коваль, вчитель, писар..."
                  className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  readOnly={isReadOnly}
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
                  onChange={(e) => onChangeConfession(e.target.value)}
                  placeholder="Православна, Греко-Католицька, Римо-Католицька..."
                  className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  readOnly={isReadOnly}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide text-[11px]">
                  Військове звання / Служба
                </label>
                <input
                  type="text"
                  value={militaryRank}
                  onChange={(e) => onChangeMilitaryRank(e.target.value)}
                  placeholder="Рядовий, унтер-офіцер, сотник, ветеран..."
                  className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  readOnly={isReadOnly}
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
                  {currentTagsList.length > 0 && !isReadOnly && (
                    <button
                      type="button"
                      onClick={onClearAllTags}
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
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => onRemoveTag(tag)}
                          className="p-0.5 hover:bg-[#B88E3E]/25 rounded-md cursor-pointer transition-colors text-[#B88E3E]"
                          title={`Видалити хештег #${tag}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={tagsStr}
                onChange={(e) => onChangeTagsStr(e.target.value)}
                placeholder="#козак, #ветеран, #полтавщина, #дворянин, #хлібороб"
                className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                readOnly={isReadOnly}
              />
              {popularHashtags.length > 0 && !isReadOnly && (
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
                        onClick={() => onAddHashtagSuggestion(h.tag)}
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

            {/* Archive Notes & Cloud Storage Actions */}
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

                {!isReadOnly && (
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
                          onChangeNotes((prev: string) => `${prev ? prev + '\n' : ''}Матеріал: ${url}`);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-black/5 text-xs font-semibold cursor-pointer"
                    >
                      Зовнішнє посилання
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1 pt-1">
                <label className="font-bold text-neutral-700 dark:text-neutral-300 text-[11px]">
                  Архівні шифри, витяги та примітки:
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => onChangeNotes(e.target.value)}
                  placeholder="ДАХО Ф. 40, оп. 1, спр. 12, арк. 15 зв. Запис № 42 про народження..."
                  className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  readOnly={isReadOnly}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
