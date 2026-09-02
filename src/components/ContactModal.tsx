import React, { useState } from 'react';
import { 
  Mail, 
  Copy, 
  Check, 
  ExternalLink, 
  Send, 
  Sparkles, 
  Users, 
  FileText, 
  BookOpen, 
  X,
  HeartHandshake,
  MessageSquare
} from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { getThemeConfig } from '../utils/theme';

export const AUTHOR_EMAIL = 'domagile@gmail.com';

interface ContactModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose
}) => {
  const storeIsOpen = useUIStore((s) => s.isContactModalOpen);
  const storeClose = useUIStore((s) => s.closeContactModal);
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);

  const isOpen = propIsOpen !== undefined ? propIsOpen : storeIsOpen;
  const handleClose = propOnClose || storeClose;

  const [copied, setCopied] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<'match' | 'docs' | 'correction' | 'general'>('match');
  const [customNote, setCustomNote] = useState('');

  if (!isOpen) return null;

  const topics = [
    {
      id: 'match' as const,
      label: 'Спільні родичі або прізвища',
      icon: Users,
      defaultSubject: 'Спільні предки в родоводі',
      defaultBody: 'Доброго дня! Я переглядаю ваше родовідне дерево і знайшов(ла) спільні прізвища / можливих родичів. Хочу обмінятися інформацією.'
    },
    {
      id: 'docs' as const,
      label: 'Маю фотографії чи документи',
      icon: FileText,
      defaultSubject: 'Архівні документи та фото для родоводу',
      defaultBody: 'Доброго дня! У моєму сімейному архіві є документи / фотографії, пов’язані з особами з вашого родоводу. Буду радий(а) поділитися копіями.'
    },
    {
      id: 'correction' as const,
      label: 'Уточнення дат чи біографії',
      icon: BookOpen,
      defaultSubject: 'Уточнення інформації щодо особи в родоводі',
      defaultBody: 'Доброго дня! Хочу поділитися уточненнями щодо дат, місць народження чи біографічних фактів однієї з гілок роду.'
    },
    {
      id: 'general' as const,
      label: 'Загальне питання чи знайомство',
      icon: MessageSquare,
      defaultSubject: 'Питання щодо родовідного дослідження',
      defaultBody: 'Доброго дня! Переглядаю ваше генеалогічне дерево. Хотів(ла) би поспілкуватися щодо дослідження роду.'
    }
  ];

  const currentTopic = topics.find((t) => t.id === selectedTopic) || topics[0];
  const emailSubject = currentTopic.defaultSubject;
  const emailBody = customNote.trim() ? `${customNote}\n\n---\n(Повідомлення з родовідного дерева)` : `${currentTopic.defaultBody}\n\n---\n(Повідомлення з родовідного дерева)`;

  const mailtoUrl = `mailto:${AUTHOR_EMAIL}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  const gmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(AUTHOR_EMAIL)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(AUTHOR_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = AUTHOR_EMAIL;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div 
        className="fixed inset-0" 
        onClick={handleClose} 
      />

      <div className={`relative w-full max-w-lg rounded-3xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl overflow-hidden flex flex-col z-10 max-h-[90vh]`}>
        {/* Header */}
        <div className={`px-5 sm:px-6 py-4 border-b ${theme.cardBorder} flex items-center justify-between gap-3 shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-bold text-base sm:text-lg ${theme.cardTitle} flex items-center gap-2`}>
                <span>Зв'язок з автором родоводу</span>
              </h3>
              <p className="text-xs opacity-75">
                Шукаєте спільних предків або хочете поділитися даними?
              </p>
            </div>
          </div>

          <button
            id="contact-modal-close-btn"
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors cursor-pointer"
            title="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Welcome Message */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 text-xs leading-relaxed flex items-start gap-2.5">
            <HeartHandshake className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong>Відкрите родинне дослідження:</strong> це дерево створено для пошуку предків та відновлення родинної пам’яті. Якщо ви маєте спільне коріння, сімейні перекази чи архівні знахідки — автор буде дуже радий поспілкуватися та об'єднати гілки роду!
            </div>
          </div>

          {/* Email Card */}
          <div className={`p-4 rounded-2xl border ${theme.cardBorder} bg-black/5 dark:bg-white/5 space-y-3`}>
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-70 flex items-center justify-between">
              <span>Електронна пошта для зв'язку</span>
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold normal-case">
                <Sparkles className="w-3 h-3" />
                Автор дослідження
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 select-all truncate">
                    {AUTHOR_EMAIL}
                  </div>
                  <div className="text-[10px] opacity-60">
                    Натисніть для копіювання або відправки
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  id="contact-copy-email-btn"
                  type="button"
                  onClick={handleCopy}
                  className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
                  }`}
                  title="Скопіювати адресу"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Скопійовано!' : 'Копіювати'}</span>
                </button>

                <a
                  id="contact-mailto-link-btn"
                  href={mailtoUrl}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="Відкрити поштовий клієнт"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Написати</span>
                </a>
              </div>
            </div>
          </div>

          {/* Inquiry Topic Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold opacity-80">
              Оберіть мету вашого звернення (для теми листа):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {topics.map((t) => {
                const Icon = t.icon;
                const isSelected = selectedTopic === t.id;
                return (
                  <button
                    key={t.id}
                    id={`contact-topic-${t.id}`}
                    type="button"
                    onClick={() => setSelectedTopic(t.id)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer flex items-center gap-2.5 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs'
                        : `border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 opacity-80`
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'opacity-60'}`} />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message Preview or Custom Note */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold opacity-80">
              Текст повідомлення (можна відредагувати перед відправкою):
            </label>
            <textarea
              id="contact-custom-note-input"
              rows={3}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder={currentTopic.defaultBody}
              className={`w-full p-2.5 rounded-xl border ${theme.inputBorder} ${theme.inputBg} ${theme.inputText} text-xs focus:outline-none focus:border-emerald-500 shadow-inner resize-none leading-relaxed`}
            />
          </div>

          {/* Quick Launch Buttons */}
          <div className="pt-1 flex flex-col sm:flex-row gap-2">
            <a
              id="contact-send-email-client-btn"
              href={mailtoUrl}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Надіслати через поштову програму</span>
            </a>

            <a
              id="contact-open-gmail-btn"
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-4 rounded-xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              title="Відкрити форму написання листа у веб-інтерфейсі Gmail"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Відкрити в Gmail</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
