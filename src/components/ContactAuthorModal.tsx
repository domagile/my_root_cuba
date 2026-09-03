import React from 'react';
import { 
  Mail, 
  X, 
  Users 
} from 'lucide-react';
import { useGenealogy } from '../context/GenealogyContext';
import { getThemeConfig } from '../utils/theme';

export const AUTHOR_CONTACT_EMAIL = 'domagile@gmail.com';

interface ContactAuthorModalProps {
  isOpen: boolean;
  onClose: () => void;
  personName?: string;
  personYears?: string;
}

export const ContactAuthorModal: React.FC<ContactAuthorModalProps> = ({
  isOpen,
  onClose,
  personName,
  personYears
}) => {
  const { themePalette } = useGenealogy();
  const theme = getThemeConfig(themePalette);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div 
        className={`relative w-full max-w-lg rounded-3xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl p-5 sm:p-7 z-10 ${theme.cardTitle} animate-in zoom-in-95 duration-150 space-y-5`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-black/10 dark:border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#B88E3E]/15 text-[#B88E3E] flex items-center justify-center shrink-0 shadow-inner">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">Зв'язок з автором дерева</h2>
              <p className="text-xs opacity-75 mt-0.5">
                Шукаєте спільних предків або маєте доповнення?
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors cursor-pointer"
            title="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Person context notice if opened from person profile */}
        {personName && (
          <div className="p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-xs flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
            <Users className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <span>Звернення щодо особи: </span>
              <strong className="font-bold">{personName}</strong>
              {personYears && <span className="opacity-80"> ({personYears})</span>}
            </div>
          </div>
        )}

        {/* Primary Email Showcase Box */}
        <div className="p-4 sm:p-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider opacity-60">
            Електронна адреса дослідника
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Mail className="w-4 h-4" />
              </div>
              <a 
                href={`mailto:${AUTHOR_CONTACT_EMAIL}${personName ? `?subject=${encodeURIComponent(`Родовід: ${personName}`)}` : ''}`}
                className="font-mono font-bold text-base sm:text-lg text-[#B88E3E] hover:underline break-all"
                title="Відкрити поштову програму"
              >
                {AUTHOR_CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>

        {/* Friendly Note */}
        <p className="text-[11px] opacity-65 text-center leading-relaxed">
          Родинне дерево відкрите для збереження пам'яті поколінь. Якщо ваші предки походять з тих самих населених пунктів — напишіть, будь-яка інформація цінна!
        </p>
      </div>
    </div>
  );
};
