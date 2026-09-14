import React from 'react';
import { 
  BookOpen, 
  Search, 
  Sparkles, 
  FileText, 
  Layers, 
  MapPin, 
  Building2, 
  ExternalLink,
  Cpu,
  CheckCircle2,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { NyshporkaTab } from './types';
import archivesData from '../../data/nyshporka/archives.json';
import decodedData from '../../data/nyshporka/decoded_frames.json';

interface NyshporkaDashboardProps {
  onNavigate: (tab: NyshporkaTab) => void;
  theme: any;
}

export const NyshporkaDashboard: React.FC<NyshporkaDashboardProps> = ({ onNavigate, theme }) => {
  const repositoriesCount = Object.keys((archivesData as any).repositories || {}).length || 38;
  const sampleFramesCount = Object.keys((decodedData as any).frames || {}).length || 3;

  return (
    <div className="space-y-6">
      {/* Brand Hero Card */}
      <div className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm relative overflow-hidden`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-2 shrink-0 flex items-center justify-center shadow-inner">
              <img 
                src="/nyshporka/assets/mark.svg" 
                alt="Нишпорка" 
                className="w-12 h-12 object-contain drop-shadow"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/nyshporka/assets/mark.png';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className={`text-2xl font-bold ${theme.cardTitle} tracking-tight`}>
                  Нишпорка
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  v0.13.1 (HTR)
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  AGPL-3.0
                </span>
              </div>
              <p className="text-sm italic font-medium text-amber-600 dark:text-amber-400/90 mt-0.5">
                «Читає рукопис. Приносить знайдене.»
              </p>
              <p className={`text-xs ${theme.cardSubtext} mt-1 max-w-2xl leading-relaxed`}>
                Спеціалізований інструмент генеалога для читання рукописних архівних справ XVIII–XIX ст. 
                (метричні книги, сповідні розписи, ревізькі казки, справи консисторій) та автоматичного пошуку предків.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a 
              href="https://github.com/SERGIUSH-UA/nyshporka" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              GitHub репозиторій
            </a>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl ${theme.cardBg} border ${theme.cardBorder} shadow-xs`}>
          <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 mb-1">
            <Building2 className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium">Державні архіви</span>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {repositoriesCount}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            Україна, Польща, Молдова
          </div>
        </div>

        <div className={`p-4 rounded-xl ${theme.cardBg} border ${theme.cardBorder} shadow-xs`}>
          <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 mb-1">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium">Зразкові справи</span>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            ДАХмО 315-1-159
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            1821–1822 рр. (Поділля)
          </div>
        </div>

        <div className={`p-4 rounded-xl ${theme.cardBg} border ${theme.cardBorder} shadow-xs`}>
          <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 mb-1">
            <Layers className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium">Декодовані аркуші</span>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {sampleFramesCount} аркуші
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            118 рядків скоропису
          </div>
        </div>

        <div className={`p-4 rounded-xl ${theme.cardBg} border ${theme.cardBorder} shadow-xs`}>
          <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 mb-1">
            <Cpu className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-medium">HTR Моделі</span>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            2 голоси
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            PySar (скоропис) + Diak (устав)
          </div>
        </div>
      </div>

      {/* Quick Doors / Action Cards */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3 px-1">
          Швидкий доступ до модулів Нишпорки
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Viewer */}
          <button
            type="button"
            onClick={() => onNavigate('viewer')}
            className={`text-left p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/50 transition-all group cursor-pointer shadow-sm hover:shadow-md`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-amber-500 transition-colors group-hover:translate-x-0.5 transform" />
            </div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 mb-1">
              Гортач архівних сканів
            </h3>
            <p className={`text-xs ${theme.cardSubtext} leading-relaxed`}>
              Оригінальні скани справи 1821 року поруч із розпізнаним скорописом, накладання боксів рядків та перемикання голосів (PySar / Diak).
            </p>
          </button>

          {/* Card 2: AI HTR Reading */}
          <button
            type="button"
            onClick={() => onNavigate('reading')}
            className={`text-left p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/50 transition-all group cursor-pointer shadow-sm hover:shadow-md`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-purple-500 transition-colors group-hover:translate-x-0.5 transform" />
            </div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 mb-1">
              ШІ-читання рукописів
            </h3>
            <p className={`text-xs ${theme.cardSubtext} leading-relaxed`}>
              Завантажте свій скан метричної книги чи ревізії — штучний інтелект транскрибує скоропис та знайде родинні факти.
            </p>
          </button>

          {/* Card 3: Search with Archival Normalization */}
          <button
            type="button"
            onClick={() => onNavigate('search')}
            className={`text-left p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/50 transition-all group cursor-pointer shadow-sm hover:shadow-md`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <Search className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-500 transition-colors group-hover:translate-x-0.5 transform" />
            </div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 mb-1">
              Пошук прізвищ за скорописом
            </h3>
            <p className={`text-xs ${theme.cardSubtext} leading-relaxed`}>
              Пошук з урахуванням дореформеної орфографії (яті ѣ, фіти ѳ, єри ъ, закінчення -скій / -ський / -овъ) та помилок розпізнавання.
            </p>
          </button>

          {/* Card 4: Catalog */}
          <button
            type="button"
            onClick={() => onNavigate('catalog')}
            className={`text-left p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/50 transition-all group cursor-pointer shadow-sm hover:shadow-md`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-emerald-500 transition-colors group-hover:translate-x-0.5 transform" />
            </div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 mb-1">
              Каталог архівів та фондів
            </h3>
            <p className={`text-xs ${theme.cardSubtext} leading-relaxed`}>
              38 державних архівів України (ЦДІАК, ДАХмО, ДАКО, ДАЖО тощо), їхні фонди, описи та прямі посилання на оцифровані реєстри.
            </p>
          </button>

          {/* Card 5: Gazetteer */}
          <button
            type="button"
            onClick={() => onNavigate('gazetteer')}
            className={`text-left p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/50 transition-all group cursor-pointer shadow-sm hover:shadow-md`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
                <MapPin className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-rose-500 transition-colors group-hover:translate-x-0.5 transform" />
            </div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 mb-1">
              Газетир (Де шукати моє село)
            </h3>
            <p className={`text-xs ${theme.cardSubtext} leading-relaxed`}>
              Введіть назву населеного пункту і дізнайтеся, до якого повіту він належав, яка церква діяла та в яких фондах лежать метричні книги.
            </p>
          </button>

          {/* Card 6: Library */}
          <button
            type="button"
            onClick={() => onNavigate('library')}
            className={`text-left p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/50 transition-all group cursor-pointer shadow-sm hover:shadow-md`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-cyan-500 transition-colors group-hover:translate-x-0.5 transform" />
            </div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 mb-1">
              Бібліотека справ
            </h3>
            <p className={`text-xs ${theme.cardSubtext} leading-relaxed`}>
              Реєстр опрацьовуваних справ за шифрами (архів/фонд/справа), статус читання та переходи до сканів.
            </p>
          </button>
        </div>
      </div>

      {/* Why Nyshporka Explainer */}
      <div className={`p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-neutral-800 dark:text-neutral-200 text-xs space-y-2`}>
        <div className="flex items-center gap-2 font-bold text-sm text-amber-700 dark:text-amber-400">
          <ShieldAlert className="w-4 h-4" />
          Чому саме Нишпорка для архівного скоропису?
        </div>
        <p className="leading-relaxed">
          Комерційні OCR (ABBYY, Tesseract тощо) не читають східнослов'янський скоропис XVIII–XIX ст., 
          а хмарні закордонні сервіси не мають моделей під специфіку документів українських та польських архівів.
          Нишпорка створена саме для вирішення цієї проблеми: беремо архівні скани та отримуємо повний розпізнаний текст, 
          у якому можна миттєво шукати прізвища роду навіть з історичними ятями, єрами та скорописними лігатурами.
        </p>
      </div>
    </div>
  );
};
