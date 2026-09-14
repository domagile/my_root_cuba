import React, { useState } from 'react';
import { BookOpen, HelpCircle, X, ChevronRight, Sparkles, FileText, Check } from 'lucide-react';

interface PaleoCheatSheetProps {
  theme: any;
  isOpen: boolean;
  onClose: () => void;
}

export const PaleoCheatSheet: React.FC<PaleoCheatSheetProps> = ({ theme, isOpen, onClose }) => {
  const [activeCategory, setActiveCategory] = useState<'letters' | 'abbreviations' | 'metrics' | 'estates'>('letters');

  if (!isOpen) return null;

  const cursiveLetters = [
    {
      letter: 'Ѣ, ѣ (ять)',
      sound: '«і» / «е»',
      look: 'У скорописі схоже на перекреслену латинську «b», вісімку з хвостиком або «ь» з хрестиком',
      example: 'дѣло, вѣра, грѣхъ, Липовенькаго'
    },
    {
      letter: 'Ѳ, ѳ (фіта)',
      sound: '«ф» / «т»',
      look: 'Коло з горизонтальною хвилькою або перетинкою всередині',
      example: 'Ѳеодоръ (Федір), Ѳома (Хома), Ѳекла'
    },
    {
      letter: 'Скорописне «д»',
      sound: '«д»',
      look: 'Має нижню петлю, дуже схоже на сучасну рукописну англійську «g» чи «з»',
      example: 'дочери, диаконъ, дѣвица'
    },
    {
      letter: 'Скорописне «т»',
      sound: '«т»',
      look: 'Пишеться з горизонтальним верхнім дашком-хвилькою або як латинське «m» з трьома ніжками',
      example: 'тояжде, тысяща, лѣтъ'
    },
    {
      letter: 'Ъ, ъ (єр)',
      sound: 'твердий знак',
      look: 'Писався наприкінці майже кожного слова після твердого приголосного',
      example: 'сынъ, мужъ, приходъ, попъ'
    },
    {
      letter: 'Ѵ, ѵ (іжиця)',
      sound: '«і»',
      look: 'Схожа на латинську «v» або «y», часто над нею ставили дві крапки',
      example: 'сѵнодъ, мѵро, Паѵелъ'
    },
    {
      letter: 'І, і (і десятеричне)',
      sound: '«і»',
      look: 'Паличка з однією або двома крапками. Вживалася перед голосними та перед «й»',
      example: 'Подольскія, Россійская, Георгій'
    }
  ];

  const abbreviations = [
    { short: 'гд̃ь / г̃и', full: 'Господь / Господи', note: 'Слово під титлом (хвилястою рискою)' },
    { short: 'б̃гъ / б̃ца', full: 'Бог / Богородиця', note: 'Священні скорочення під титлом' },
    { short: 'м̃ца', full: 'Мѣсяца', note: 'Стандартне скорочення у датах метрик' },
    { short: 'д̃нь', full: 'День', note: 'Число місяця' },
    { short: 'тояжд̃е', full: 'Тояжде (того ж самого)', note: 'Повтор села, парафії чи прізвища' },
    { short: 'св̃щк / і̃ерей', full: 'Священник / Ієрей', note: 'Посада в церкві' },
    { short: 'ді̃ак / дьяк̃', full: 'Діаконъ', note: 'Церковнослужитель' },
    { short: 'воспрі̃емн.', full: 'Воспріемники', note: 'Хрещені батьки дитини' },
    { short: 'поѣ̃зж.', full: 'Поѣзжане / Поручители', note: 'Свідки на вінчанні' }
  ];

  const metricBookParts = [
    {
      part: 'Частина 1: «О рождающихся»',
      columns: [
        '№ за порядком (окремо чоловіча та жіноча стать)',
        'День народження та день хрещення',
        'Ім’я новонародженого (за святцями)',
        'Звання, ім’я, по батькові та прізвище батьків, віросповідання',
        'Звання, ім’я, по батькові та прізвище хрещених батьків (воспріємників)',
        'Хто здійснив таїнство хрещення'
      ]
    },
    {
      part: 'Частина 2: «О бракосочетавшихся»',
      columns: [
        '№ вінчання',
        'Місяць і день шлюбу',
        'Звання, ім’я, по батькові, прізвище нареченого, вік, який шлюб (перший, другий)',
        'Звання, ім’я, по батькові, прізвище нареченої, вік, шлюб (дівиця, вдова)',
        'Хто були поручителі (свідки з боку нареченого і нареченої)',
        'Хто вінчав'
      ]
    },
    {
      part: 'Частина 3: «О умерших»',
      columns: [
        '№ смерті (окремо чоловіки і жінки)',
        'Місяць і день смерті та поховання',
        'Звання, ім’я, по батькові та прізвище померлого (або чий син/дочка/дружина)',
        'Вік померлого (у літах, місяцях або днях)',
        'Від чого помер (хвороба / натурально)',
        'Хто сповідав, причащав та поховав'
      ]
    }
  ];

  const socialEstates = [
    { title: 'Селяни поміщицькі (кріпаки)', desc: 'Записані у володіннях шляхтичів та поміщиків до 1861 р. Ревізії подавалися поміщиком.' },
    { title: 'Селяни державні / казенні', desc: 'Особисто вільні селяни на землях казни, платили подушний оклад державі.' },
    { title: 'Однодворці / Військові поселенці', desc: 'Нащадки дрібної шляхти Правобережжя та служилих людей, мали особливий статус.' },
    { title: 'Міщани та цехові', desc: 'Жителі міст і містечок, записані до міщанських управ або ремісничих цехів.' },
    { title: 'Шляхта / Дворянство', desc: 'Дворяни спадкові або особисті, чиншова та застінкова шляхта Поділля, Київщини, Волині.' },
    { title: 'Духовенство (причт)', desc: 'Священники (ієреї), диякони, дяки, паламарі та їхні родини (духовного звання).' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className={`w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                Шпаргалка палеографа: як читати скоропис XVIII–XIX ст.
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Оптичні конфузери, літери старої орфографії та формуляри метрик
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-1.5 gap-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveCategory('letters')}
            className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
              activeCategory === 'letters'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
            }`}
          >
            Хитрі літери (ѣ, ѳ, д, т)
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('abbreviations')}
            className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
              activeCategory === 'abbreviations'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
            }`}
          >
            Титли & скорочення
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('metrics')}
            className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
              activeCategory === 'metrics'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
            }`}
          >
            Структура метричних книг
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('estates')}
            className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
              activeCategory === 'estates'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
            }`}
          >
            Стани та звання
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
          {activeCategory === 'letters' && (
            <div className="space-y-2.5">
              {cursiveLetters.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-serif font-bold text-sm text-amber-600 dark:text-amber-400">
                      {item.letter}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                      Звучання: {item.sound}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    {item.look}
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-serif italic pt-0.5">
                    Приклади в текстах: {item.example}
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeCategory === 'abbreviations' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {abbreviations.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-serif font-bold text-sm text-amber-600 dark:text-amber-400">
                      {item.short}
                    </span>
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      = {item.full}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {item.note}
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeCategory === 'metrics' && (
            <div className="space-y-4">
              {metricBookParts.map((part, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <h4 className="font-bold text-xs text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-500" />
                    {part.part}
                  </h4>
                  <ul className="space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                    {part.columns.map((col, cIdx) => (
                      <li key={cIdx} className="flex items-start gap-1.5 leading-snug">
                        <span className="text-amber-500 font-mono text-[10px] mt-0.5">•</span>
                        <span>{col}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {activeCategory === 'estates' && (
            <div className="space-y-2.5">
              {socialEstates.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
                  <h4 className="font-bold text-xs text-neutral-900 dark:text-neutral-100">
                    {item.title}
                  </h4>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex items-center justify-between text-xs text-neutral-500">
          <span>Складено за палеографічною традицією українських архівів</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
          >
            Зрозуміло
          </button>
        </div>
      </div>
    </div>
  );
};
