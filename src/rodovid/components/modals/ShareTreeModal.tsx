import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  Copy, 
  Check, 
  Lock, 
  Unlock, 
  Eye, 
  QrCode, 
  Globe, 
  ShieldCheck, 
  CloudUpload, 
  Sparkles,
  Users,
  AlertCircle,
  Clock,
  X
} from 'lucide-react';
import { GenealogyDatabase } from '../../types/genealogy';
import { SharedTreeData, publishSharedTreeToCloud } from '../../../lib/firebase';
import { useAuthStore } from '../../../stores/useAuthStore';
import { getThemeConfig } from '../../../utils/theme';
import { useUIStore } from '../../../stores/useUIStore';

interface ShareTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  database: GenealogyDatabase;
  activePersonId?: string;
}

export const ShareTreeModal: React.FC<ShareTreeModalProps> = ({
  isOpen,
  onClose,
  database,
  activePersonId
}) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const currentUser = useAuthStore((s) => s.currentUser);

  // Stored / generated share ID
  const [treeTitle, setTreeTitle] = useState('Родовід нашої родини');
  const [authorName, setAuthorName] = useState('Дослідник родоводу');
  const [contactEmail, setContactEmail] = useState('domagile@gmail.com');
  const [isPinProtected, setIsPinProtected] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [hideLivingDates, setHideLivingDates] = useState(false);
  const [mode, setMode] = useState<'readonly' | 'editable'>('readonly');
  
  const [shareId, setShareId] = useState<string>('');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [lastPublished, setLastPublished] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Initialize or load existing share key
  useEffect(() => {
    if (isOpen) {
      const storedId = localStorage.getItem('rodovid_last_share_id');
      const generatedId = storedId || `tree-${Math.random().toString(36).substring(2, 9)}`;
      setShareId(generatedId);

      let baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
      if (baseUrl.includes('ais-dev-')) {
        baseUrl = baseUrl.replace('ais-dev-', 'ais-pre-');
      }
      setShareUrl(`${baseUrl}?share=${generatedId}`);

      const savedMeta = localStorage.getItem(`rodovid_share_meta_${generatedId}`);
      if (savedMeta) {
        try {
          const parsed = JSON.parse(savedMeta);
          if (parsed.title) setTreeTitle(parsed.title);
          if (parsed.authorName) setAuthorName(parsed.authorName);
          if (parsed.contactEmail) setContactEmail(parsed.contactEmail);
          if (parsed.isPinProtected !== undefined) setIsPinProtected(parsed.isPinProtected);
          if (parsed.pinCode) setPinCode(parsed.pinCode);
          if (parsed.hideLivingDates !== undefined) setHideLivingDates(parsed.hideLivingDates);
          if (parsed.lastPublished) setLastPublished(parsed.lastPublished);
        } catch {}
      } else {
        const personsCount = Object.keys(database.persons).length;
        const mainPerson = database.persons[activePersonId || database.rootPersonId];
        const surname = mainPerson?.lastName ? `роду ${mainPerson.lastName}` : 'родини';
        setTreeTitle(`Генеалогічне дерево ${surname} (${personsCount} осіб)`);
        setAuthorName(currentUser?.name || currentUser?.email || 'Головний дослідник');
      }
    }
  }, [isOpen, database, activePersonId, currentUser]);

  if (!isOpen) return null;

  const totalPersons = Object.keys(database.persons).length;

  const handlePublish = async () => {
    setIsPublishing(true);
    setStatusMessage(null);

    // Prepare payload
    const payload: SharedTreeData = {
      id: shareId,
      title: treeTitle.trim() || 'Родинне дерево',
      authorName: authorName.trim() || 'Дослідник родоводу',
      authorEmail: contactEmail.trim() || 'domagile@gmail.com',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rootPersonId: activePersonId || database.rootPersonId || Object.keys(database.persons)[0] || 'p1',
      mode,
      isPinProtected,
      pinHash: isPinProtected && pinCode.trim() ? pinCode.trim() : undefined,
      hideLivingDates,
      personsCount: totalPersons,
      database: {
        persons: database.persons,
        families: database.families,
        sources: database.sources,
        events: database.events
      }
    };

    const res = await publishSharedTreeToCloud(payload);
    setIsPublishing(false);

    if (res.success) {
      setShareUrl(res.shareUrl);
      const now = new Date().toISOString();
      setLastPublished(now);
      localStorage.setItem('rodovid_last_share_id', shareId);
      localStorage.setItem(`rodovid_share_meta_${shareId}`, JSON.stringify({
        title: treeTitle,
        authorName,
        contactEmail,
        isPinProtected,
        pinCode,
        hideLivingDates,
        lastPublished: now
      }));
      setStatusMessage({ text: 'Дерево успішно опубліковано в хмарі! Посилання готове до надсилання родичам.' });
    } else {
      setStatusMessage({ text: res.error || 'Помилка публікації в хмарі', isError: true });
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-xl rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className={`px-5 py-4 border-b ${theme.cardBorder} flex items-center justify-between bg-black/5 dark:bg-white/5`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#B88E3E] to-amber-600 flex items-center justify-center text-white shadow-md">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`font-bold text-base sm:text-lg ${theme.cardTitle}`}>
                Спільний перегляд дерева
              </h2>
              <p className="text-xs opacity-70">
                Створіть пряме посилання для родичів онлайн
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">
          {/* Main Info Card */}
          <div className={`p-4 rounded-xl border ${theme.cardBorder} bg-black/5 dark:bg-white/5 space-y-3`}>
            <div>
              <label className="block text-xs font-semibold mb-1 opacity-80">
                Назва родинного дерева:
              </label>
              <input
                type="text"
                value={treeTitle}
                onChange={(e) => setTreeTitle(e.target.value)}
                placeholder="Наприклад: Родовід родини Коваленків"
                className={`w-full px-3 py-2 rounded-lg border ${theme.inputBorder} ${theme.inputBg} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E] transition-colors font-medium`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 opacity-80">
                  Автор / Дослідник:
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Ваше ім'я або email"
                  className={`w-full px-3 py-2 rounded-lg border ${theme.inputBorder} ${theme.inputBg} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E] transition-colors`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 opacity-80">
                  Обсяг дерева:
                </label>
                <div className={`px-3 py-2 rounded-lg border ${theme.inputBorder} bg-black/5 dark:bg-white/5 flex items-center gap-2 text-xs font-semibold`}>
                  <Users className="w-4 h-4 text-[#B88E3E]" />
                  <span>{totalPersons} осіб / {Object.keys(database.families).length} сімей</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 opacity-80 flex items-center justify-between">
                <span>Контактна пошта для зв'язку (пошук предків):</span>
                <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">Для відвідувачів</span>
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="domagile@gmail.com"
                className={`w-full px-3 py-2 rounded-lg border ${theme.inputBorder} ${theme.inputBg} ${theme.inputText} text-xs focus:outline-none focus:border-[#B88E3E] transition-colors font-mono`}
              />
              <p className="text-[10px] opacity-65 mt-1">
                Відвідувачі та незареєстровані гості зможуть написати вам на цю адресу, якщо також досліджують цих предків.
              </p>
            </div>
          </div>

          {/* Privacy and Security Settings */}
          <div className={`p-4 rounded-xl border ${theme.cardBorder} space-y-3.5`}>
            <h3 className="font-bold text-xs uppercase tracking-wider opacity-80 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Параметри доступу та приватності
            </h3>

            <div className="space-y-2.5">
              {/* Access Mode */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-xs">Режим для родичів:</div>
                  <div className="text-[11px] opacity-70">Родичі зможуть переглядати схему, біографії та шукати родичів</div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  Тільки перегляд (Read-only)
                </span>
              </div>

              {/* PIN Code Protection Toggle */}
              <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    {isPinProtected ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Unlock className="w-3.5 h-3.5 opacity-60" />}
                    Захистити дерево PIN-кодом
                  </div>
                  <div className="text-[11px] opacity-70">
                    Відкрити дерево зможуть лише родичі, які знають 4-значний код
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isPinProtected}
                  onChange={(e) => setIsPinProtected(e.target.checked)}
                  className="w-4 h-4 mt-1 accent-[#B88E3E] cursor-pointer"
                />
              </div>

              {isPinProtected && (
                <div className="pl-5 pt-1 animate-in fade-in">
                  <label className="block text-[11px] font-semibold mb-1 opacity-80">
                    Встановіть PIN-код доступу (наприклад 1945 або 2026):
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="Введіть код..."
                    className={`w-36 px-3 py-1.5 rounded-lg border ${theme.inputBorder} ${theme.inputBg} ${theme.inputText} text-xs font-mono font-bold tracking-widest text-center focus:outline-none focus:border-[#B88E3E]`}
                  />
                </div>
              )}

              {/* Privacy Filter Toggle */}
              <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-sky-500" />
                    Приховати точні дати живих людей
                  </div>
                  <div className="text-[11px] opacity-70">
                    Захист персональних даних (показуватиметься лише рік або "Живий")
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={hideLivingDates}
                  onChange={(e) => setHideLivingDates(e.target.checked)}
                  className="w-4 h-4 mt-1 accent-[#B88E3E] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Cloud Status / Publish Action */}
          <div className="space-y-3">
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className={`w-full py-2.5 px-4 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer hover:opacity-90 disabled:opacity-50`}
            >
              <CloudUpload className={`w-4 h-4 ${isPublishing ? 'animate-bounce' : ''}`} />
              <span>{isPublishing ? 'Публікація в хмарі...' : lastPublished ? 'Оновити родовід у хмарі' : 'Опублікувати та отримати посилання'}</span>
            </button>

            {statusMessage && (
              <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                statusMessage.isError 
                  ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' 
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              }`}>
                {statusMessage.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
                <span>{statusMessage.text}</span>
              </div>
            )}
          </div>

          {/* Share Link & Action Controls */}
          {shareUrl && (
            <div className={`p-4 rounded-xl border ${theme.cardBorder} bg-black/5 dark:bg-white/5 space-y-3.5`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-[#B88E3E]" />
                  Посилання для родичів:
                </span>
                {lastPublished && (
                  <span className="text-[10px] opacity-60 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Оновлено: {new Date(lastPublished).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              {/* Link Bar with Copy Button */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className={`flex-1 px-3 py-2 rounded-lg border ${theme.inputBorder} ${theme.inputBg} ${theme.inputText} text-xs font-mono select-all focus:outline-none`}
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-3.5 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                    copied 
                      ? 'bg-emerald-600 text-white' 
                      : `${theme.badgeBg} ${theme.badgeText} border ${theme.cardBorder} hover:bg-black/10 dark:hover:bg-white/10`
                  }`}
                  title="Скопіювати посилання"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Скопійовано!' : 'Копіювати'}</span>
                </button>
              </div>

              {/* QR Code Toggle */}
              <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                <button
                  onClick={() => setShowQr(!showQr)}
                  className="flex items-center gap-1.5 text-xs text-[#B88E3E] font-semibold hover:underline cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>{showQr ? 'Сховати QR-код' : 'Показати QR-код для телефона'}</span>
                </button>
              </div>

              {showQr && (
                <div className="p-4 rounded-xl bg-white text-black flex flex-col items-center justify-center gap-2 animate-in fade-in">
                  {/* Stylized QR representation / direct scan link */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`}
                    alt="QR-код для перегляду родинного дерева"
                    className="w-44 h-44 rounded-lg shadow-xs border border-gray-200"
                    loading="lazy"
                  />
                  <span className="text-[11px] text-gray-600 font-medium">
                    Наведіть камеру смартфона для перегляду родоводу
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={`px-5 py-3 border-t ${theme.cardBorder} flex items-center justify-between bg-black/5 dark:bg-white/5`}>
          <div className="text-[11px] opacity-60 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#B88E3E]" />
            <span>Спільний доступ працює в реальному часі</span>
          </div>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-xl border ${theme.cardBorder} ${theme.badgeBg} ${theme.badgeText} text-xs font-semibold hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer`}
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
};
