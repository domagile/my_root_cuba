import React, { useState } from 'react';
import { 
  Palette, 
  Download, 
  Upload, 
  RefreshCw, 
  Database, 
  Sun, 
  Moon, 
  Check, 
  FileCode, 
  ShieldCheck, 
  Info,
  Sparkles,
  CheckCircle2,
  Trash2,
  Clock,
  Lock,
  Key,
  Copy,
  ExternalLink,
  LockKeyhole,
  LogOut,
  UserPlus,
  UserCheck,
  UserX,
  Shield,
  ShieldAlert,
  Send,
  Users,
  Mail,
  User,
  AlertCircle,
  KeyRound
} from 'lucide-react';
import { useGenealogy } from '../context/GenealogyContext';
import { useAuthStore } from '../stores/useAuthStore';
import { THEME_CONFIGS, getThemeConfig } from '../utils/theme';
import { ThemePalette, UserRole } from '../types';

export const SettingsView: React.FC = () => {
  const { 
    themePalette, 
    setThemePalette, 
    exportJsonData, 
    exportGedcomData, 
    importJsonData, 
    resetToSampleData,
    persons,
    metricRecords,
    tasks,
    hypotheses,
    documents,
    findings,
    requests,
    matrixEntries,
    accessLockConfig,
    setAccessLockConfig,
    lockAppSession
  } = useGenealogy();

  const {
    currentUser,
    whitelist,
    accessRequests,
    accessConfig,
    addToWhitelist,
    removeFromWhitelist,
    updateWhitelistRole,
    toggleWhitelistStatus,
    approveAccessRequest,
    rejectAccessRequest,
    setAccessConfig,
    logout
  } = useAuthStore();

  const theme = getThemeConfig(themePalette);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // New Whitelist User Form State
  const [newWhiteEmail, setNewWhiteEmail] = useState('');
  const [newWhiteName, setNewWhiteName] = useState('');
  const [newWhiteRole, setNewWhiteRole] = useState<UserRole>('viewer');
  const [newWhiteNotes, setNewWhiteNotes] = useState('');
  const [whiteSuccessMsg, setWhiteSuccessMsg] = useState<string | null>(null);

  // Access Lock & Secret Link states
  const [pinEditInput, setPinEditInput] = useState(accessLockConfig?.pinCode || '1234');
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false);

  const themeList = Object.values(THEME_CONFIGS);
  const lightThemes = themeList.filter(t => t.category === 'light');
  const darkThemes = themeList.filter(t => t.category === 'dark');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importJsonData(content);
        if (success) {
          setImportStatus('Дані родоводу успішно відновлено з JSON!');
          setTimeout(() => setImportStatus(null), 4000);
        } else {
          setImportStatus('Помилка: Невірний формат JSON файлу.');
          setTimeout(() => setImportStatus(null), 4000);
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={`flex-1 p-6 sm:p-8 overflow-y-auto ${theme.appBg} transition-colors duration-300 space-y-8`}>
      {/* Header Banner */}
      <div className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#B88E3E]/20 flex items-center justify-center text-[#B88E3E]">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${theme.cardTitle}`}>Загальні Налаштування & Кольори</h1>
            <p className={`text-xs ${theme.cardSubtext} mt-0.5`}>Управління палітрою фону, експортом та резервним копіюванням родоводу</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 text-xs rounded-xl font-medium border ${theme.badgeBg} ${theme.badgeText} ${theme.cardBorder}`}>
            Текуча тема: {theme.name.split('(')[0]}
          </span>
        </div>
      </div>

      {importStatus && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 text-sm flex items-center gap-3">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{importStatus}</span>
        </div>
      )}

      {/* SECTION 1: Theme Palette Selector */}
      <section className="space-y-6">
        <div>
          <h2 className={`text-lg font-bold ${theme.cardTitle} flex items-center gap-2`}>
            <Sparkles className="w-5 h-5 text-[#B88E3E]" />
            <span>Кольорове оформлення фону та інтерфейсу</span>
          </h2>
          <p className={`text-xs ${theme.cardSubtext} mt-1`}>
            Оберіть бажану фонову гаму. Тональності підібрані для максимальної зручності читання та атмосфери детективного архіву.
          </p>
        </div>

        {/* Light & Pastel Themes (Peony, Lavender, Parchment, Sage, Sand) */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#B88E3E] flex items-center gap-1.5">
            <Sun className="w-4 h-4" />
            <span>Світлі, пастельні та квітучі теми (Ніжний Пион, Лаванда, Пергамент, Пісок)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lightThemes.map((p) => {
              const isSelected = themePalette === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setThemePalette(p.id as ThemePalette)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between gap-3 shadow-sm hover:shadow-md ${
                    isSelected
                      ? 'border-[#B88E3E] ring-2 ring-[#B88E3E]/40 scale-[1.01]'
                      : 'border-black/10 hover:border-[#B88E3E]/60'
                  }`}
                  style={{ backgroundColor: p.colors[0] }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm" style={{ color: p.colors[3] }}>{p.name}</span>
                      {isSelected && (
                        <span className="px-2 py-0.5 text-[10px] bg-[#B88E3E] text-white font-bold rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Активна</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs opacity-80 leading-relaxed" style={{ color: p.colors[3] }}>{p.desc}</p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-black/10">
                    <span className="text-[10px] opacity-60 uppercase font-mono mr-auto" style={{ color: p.colors[3] }}>Палітра:</span>
                    {p.colors.map((c, i) => (
                      <div key={i} className="w-5 h-5 rounded-full border border-black/20 shadow-xs" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dark & Vintage Themes (Detective Noir, Emerald, Cocoa, Navy) */}
        <div className="space-y-3 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#B88E3E] flex items-center gap-1.5">
            <Moon className="w-4 h-4" />
            <span>Темні, нуарні та детективні теми (Детективний Нуар, Смарагд, Какао, Сапфір)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {darkThemes.map((p) => {
              const isSelected = themePalette === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setThemePalette(p.id as ThemePalette)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between gap-3 shadow-sm hover:shadow-md ${
                    isSelected
                      ? 'border-[#B88E3E] ring-2 ring-[#B88E3E]/40 scale-[1.01]'
                      : 'border-white/10 hover:border-[#B88E3E]/60'
                  }`}
                  style={{ backgroundColor: p.colors[0] }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm" style={{ color: p.colors[3] }}>{p.name}</span>
                      {isSelected && (
                        <span className="px-2 py-0.5 text-[10px] bg-[#B88E3E] text-white font-bold rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Активна</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs opacity-80 leading-relaxed" style={{ color: p.colors[3] }}>{p.desc}</p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                    <span className="text-[10px] opacity-60 uppercase font-mono mr-auto" style={{ color: p.colors[3] }}>Палітра:</span>
                    {p.colors.map((c, i) => (
                      <div key={i} className="w-5 h-5 rounded-full border border-white/20 shadow-xs" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 2: Data Storage, Export & Import */}
      <section className="space-y-4 pt-4 border-t border-black/10">
        <div>
          <h2 className={`text-lg font-bold ${theme.cardTitle} flex items-center gap-2`}>
            <Database className="w-5 h-5 text-[#B88E3E]" />
            <span>Збереження даних, експорт та імпорт</span>
          </h2>
          <p className={`text-xs ${theme.cardSubtext} mt-1`}>
            Усі ваші дані родоводу безпечно зберігаються у браузері. Ви можете експортувати резервні копії або завантажувати нові архіви.
          </p>
        </div>

        <div className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-6`}>
          {/* Summary status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10">
            <div>
              <span className={`text-[11px] ${theme.cardSubtext} block`}>Фігурантів теми</span>
              <strong className={`text-base font-bold ${theme.cardTitle}`}>{persons.length} осіб</strong>
            </div>
            <div>
              <span className={`text-[11px] ${theme.cardSubtext} block`}>Метричних записів</span>
              <strong className={`text-base font-bold ${theme.cardTitle}`}>{metricRecords.length} ревізій</strong>
            </div>
            <div>
              <span className={`text-[11px] ${theme.cardSubtext} block`}>Чернеток нотаток</span>
              <strong className={`text-base font-bold ${theme.cardTitle}`}>{tasks?.length || 0} заміток</strong>
            </div>
            <div>
              <span className={`text-[11px] ${theme.cardSubtext} block`}>Сформованих підозр</span>
              <strong className={`text-base font-bold ${theme.cardTitle}`}>{hypotheses.length} гіпотез</strong>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={exportJsonData}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} font-medium text-xs transition-all shadow-sm`}
            >
              <Download className="w-4 h-4" />
              <span>Експорт у JSON</span>
            </button>

            <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl ${theme.badgeBg} ${theme.badgeText} border ${theme.cardBorder} font-medium text-xs transition-all cursor-pointer hover:opacity-90`}>
              <Upload className="w-4 h-4" />
              <span>Імпорт з JSON</span>
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              onClick={exportGedcomData}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl ${theme.badgeBg} ${theme.badgeText} border ${theme.cardBorder} font-medium text-xs transition-all hover:opacity-90`}
            >
              <FileCode className="w-4 h-4" />
              <span>Експорт у GEDCOM</span>
            </button>

            {confirmReset ? (
              <div className="flex items-center justify-center gap-2 p-1.5 bg-rose-950/40 border border-rose-800/40 rounded-xl">
                <span className="text-xs text-rose-300 font-medium">Скинути всі дані?</span>
                <button
                  onClick={() => {
                    resetToSampleData();
                    setConfirmReset(false);
                  }}
                  className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded text-xs font-bold cursor-pointer"
                >
                  Так, скинути
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-2.5 py-1 bg-[#262626] text-gray-300 rounded text-xs cursor-pointer"
                >
                  Ні
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-medium text-xs transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Відновити демо-архів</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 2.7: Google Email Whitelist & Access Control Management */}
      <section className="space-y-4 pt-4 border-t border-black/10">
        <div>
          <div className="flex items-center justify-between">
            <h2 className={`text-lg font-bold ${theme.cardTitle} flex items-center gap-2`}>
              <ShieldCheck className="w-5 h-5 text-[#B88E3E]" />
              <span>Керування доступом та Білий список Google (Whitelist)</span>
            </h2>

            {currentUser && (
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-2.5 py-1 rounded-full ${theme.badgeBg} ${theme.badgeText} border ${theme.cardBorder} font-medium flex items-center gap-1.5`}>
                  <User className="w-3.5 h-3.5 text-[#B88E3E]" />
                  <span>Ви увійшли як: <strong>{currentUser.email}</strong> ({currentUser.role === 'admin' ? 'Адміністратор' : currentUser.role})</span>
                </span>
                <button
                  onClick={() => logout()}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 text-xs font-bold transition-colors cursor-pointer"
                >
                  Змінити акаунт
                </button>
              </div>
            )}
          </div>
          <p className={`text-xs ${theme.cardSubtext} mt-1`}>
            Захистіть конфіденційні генеалогічні матеріали: переглядати чи редагувати архів можуть лише авторизовані користувачі з підтвердженою Google-поштою.
          </p>
        </div>

        <div className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-6`}>
          {/* Security Mode Selector */}
          <div className="space-y-2">
            <label className={`text-xs font-bold uppercase tracking-wider text-[#B88E3E] block`}>
              Режим захисту доступу
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                onClick={() => setAccessConfig({ ...accessConfig, mode: 'whitelist_only' })}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1 ${
                  accessConfig.mode === 'whitelist_only'
                    ? 'border-[#B88E3E] bg-[#B88E3E]/10 ring-2 ring-[#B88E3E]/30'
                    : 'border-black/10 dark:border-white/10 hover:border-[#B88E3E]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${theme.cardTitle} flex items-center gap-1.5`}>
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Тільки Білий список (Strict)</span>
                  </span>
                  {accessConfig.mode === 'whitelist_only' && <Check className="w-4 h-4 text-[#B88E3E]" />}
                </div>
                <p className={`text-[11px] ${theme.cardSubtext} leading-tight`}>
                  Найвищий рівень: вхід дозволено виключно схваленим Google-поштам.
                </p>
              </div>

              <div
                onClick={() => setAccessConfig({ ...accessConfig, mode: 'whitelist_and_pin' })}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1 ${
                  accessConfig.mode === 'whitelist_and_pin'
                    ? 'border-[#B88E3E] bg-[#B88E3E]/10 ring-2 ring-[#B88E3E]/30'
                    : 'border-black/10 dark:border-white/10 hover:border-[#B88E3E]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${theme.cardTitle} flex items-center gap-1.5`}>
                    <KeyRound className="w-4 h-4 text-[#B88E3E]" />
                    <span>Список + Резервний PIN</span>
                  </span>
                  {accessConfig.mode === 'whitelist_and_pin' && <Check className="w-4 h-4 text-[#B88E3E]" />}
                </div>
                <p className={`text-[11px] ${theme.cardSubtext} leading-tight`}>
                  Основний вхід по Google email + можливість увійти за гостьовим PIN.
                </p>
              </div>

              <div
                onClick={() => setAccessConfig({ ...accessConfig, mode: 'open_demo' })}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1 ${
                  accessConfig.mode === 'open_demo'
                    ? 'border-[#B88E3E] bg-[#B88E3E]/10 ring-2 ring-[#B88E3E]/30'
                    : 'border-black/10 dark:border-white/10 hover:border-[#B88E3E]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${theme.cardTitle} flex items-center gap-1.5`}>
                    <Users className="w-4 h-4 text-blue-500" />
                    <span>Відкритий доступ (Демо)</span>
                  </span>
                  {accessConfig.mode === 'open_demo' && <Check className="w-4 h-4 text-[#B88E3E]" />}
                </div>
                <p className={`text-[11px] ${theme.cardSubtext} leading-tight`}>
                  Будь-який відвідувач може переглядати дерево без авторизації.
                </p>
              </div>
            </div>

            {/* Email Notification Dispatch Settings for Admin */}
            <div className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#B88E3E]" />
                  <span className={`text-xs font-bold ${theme.cardTitle}`}>
                    Email-сповіщення адміністратора про нові заявки
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accessConfig.enableEmailNotifications !== false}
                    onChange={(e) =>
                      setAccessConfig({
                        ...accessConfig,
                        enableEmailNotifications: e.target.checked
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#B88E3E]" />
                </label>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className={`text-[11px] font-semibold ${theme.cardSubtext}`}>
                  Адміністратори, які отримують копію кожного запиту:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {whitelist
                    .filter((w) => w.role === 'admin' && w.status === 'active')
                    .map((admin) => (
                      <span
                        key={admin.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      >
                        <Shield className="w-3 h-3 text-emerald-500" />
                        <span>{admin.email}</span>
                        {admin.name && <span className="opacity-70">({admin.name})</span>}
                      </span>
                    ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className={`text-[11px] font-semibold ${theme.cardSubtext}`}>
                    Додаткові email-адреси (через кому):
                  </label>
                  <input
                    type="text"
                    value={accessConfig.adminNotificationEmail || 'CubaTarara400@gmail.com'}
                    onChange={(e) =>
                      setAccessConfig({
                        ...accessConfig,
                        adminNotificationEmail: e.target.value
                      })
                    }
                    placeholder="admin1@gmail.com, admin2@gmail.com"
                    className={`w-full px-3 py-1.5 rounded-lg text-xs font-mono border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-none focus:border-[#B88E3E]`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={`text-[11px] font-semibold ${theme.cardSubtext}`}>
                    Webhook / Поштовий шлюз (необов'язково):
                  </label>
                  <input
                    type="url"
                    value={accessConfig.webhookUrl || ''}
                    onChange={(e) =>
                      setAccessConfig({
                        ...accessConfig,
                        webhookUrl: e.target.value
                      })
                    }
                    placeholder="https://formspree.io/f/..."
                    className={`w-full px-3 py-1.5 rounded-lg text-xs font-mono border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-none focus:border-[#B88E3E]`}
                  />
                </div>
              </div>

              <p className={`text-[10px] ${theme.cardSubtext} leading-tight`}>
                Коли хтось надсилає запит, повідомлення транслюється <strong>усім призначеним адміністраторам</strong> родоводу для оперативного розгляду та схвалення.
              </p>
            </div>
          </div>

          {/* SECTION: Pending Access Requests */}
          <div className="space-y-3 pt-2 border-t border-black/10 dark:border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-[#B88E3E]" />
                <h3 className={`text-sm font-bold ${theme.cardTitle}`}>
                  Вхідні запити на доступ ({accessRequests.filter((r) => r.status === 'pending').length})
                </h3>
              </div>
              <span className={`text-xs ${theme.cardSubtext}`}>
                Люди, які відкрили архів і попросили доступ
              </span>
            </div>

            {accessRequests.filter((r) => r.status === 'pending').length > 0 ? (
              <div className="space-y-2.5">
                {accessRequests
                  .filter((r) => r.status === 'pending')
                  .map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${theme.cardTitle}`}>{req.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-700 dark:text-amber-300">
                            {req.email}
                          </span>
                          <span className="text-[10px] opacity-60 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(req.createdAt).toLocaleString('uk-UA')}</span>
                          </span>
                        </div>
                        {req.note && (
                          <p className="text-xs text-gray-600 dark:text-gray-300 italic">
                            «{req.note}»
                          </p>
                        )}
                        <div className="text-[11px] text-[#B88E3E]">
                          Бажана роль: <strong>{req.requestedRole === 'editor' ? 'Редактор' : req.requestedRole === 'researcher' ? 'Дослідник' : 'Переглядач'}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                          onClick={() => approveAccessRequest(req.id, req.requestedRole)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Схвалити доступ</span>
                        </button>
                        <button
                          onClick={() => rejectAccessRequest(req.id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/30 text-xs font-medium cursor-pointer"
                        >
                          Відхилити
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 text-center text-xs text-gray-500">
                Немає нових запитів. Усі бажаючі вже отримали доступ.
              </div>
            )}
          </div>

          {/* SECTION: Add New Email to Whitelist */}
          <div className="space-y-3 pt-2 border-t border-black/10 dark:border-white/10">
            <h3 className={`text-sm font-bold ${theme.cardTitle} flex items-center gap-2`}>
              <UserPlus className="w-4 h-4 text-[#B88E3E]" />
              <span>Додати нову пошту до Білого списку (Whitelist)</span>
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newWhiteEmail.trim() || !newWhiteEmail.includes('@')) {
                  alert('Вкажіть коректну адресу Google-пошти.');
                  return;
                }
                addToWhitelist(newWhiteEmail, newWhiteRole, newWhiteName, newWhiteNotes);
                setWhiteSuccessMsg(`Пошту ${newWhiteEmail} успішно додано до білого списку з роллю "${newWhiteRole}"!`);
                setNewWhiteEmail('');
                setNewWhiteName('');
                setNewWhiteNotes('');
                setTimeout(() => setWhiteSuccessMsg(null), 5000);
              }}
              className="space-y-3 p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className={`text-xs font-semibold ${theme.cardTitle}`}>
                    Google Email користувача
                  </label>
                  <input
                    type="email"
                    value={newWhiteEmail}
                    onChange={(e) => setNewWhiteEmail(e.target.value)}
                    placeholder="relative@gmail.com"
                    className={`w-full px-3 py-2 rounded-lg text-xs border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-none focus:border-[#B88E3E]`}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className={`text-xs font-semibold ${theme.cardTitle}`}>
                    Ім'я / Прізвище
                  </label>
                  <input
                    type="text"
                    value={newWhiteName}
                    onChange={(e) => setNewWhiteName(e.target.value)}
                    placeholder="наприклад: Василь Коваленко"
                    className={`w-full px-3 py-2 rounded-lg text-xs border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-none focus:border-[#B88E3E]`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={`text-xs font-semibold ${theme.cardTitle}`}>
                    Рівень доступу (Роль)
                  </label>
                  <select
                    value={newWhiteRole}
                    onChange={(e) => setNewWhiteRole(e.target.value as UserRole)}
                    className={`w-full px-3 py-2 rounded-lg text-xs border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-none focus:border-[#B88E3E]`}
                  >
                    <option value="viewer">Переглядач (Тільки перегляд)</option>
                    <option value="researcher">Дослідник (Перегляд + нотатки)</option>
                    <option value="editor">Редактор (Повне наповнення)</option>
                    <option value="admin">Адміністратор (Повні права)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className={`text-xs font-semibold ${theme.cardTitle}`}>
                  Примітка або родинний статус (необов'язково)
                </label>
                <input
                  type="text"
                  value={newWhiteNotes}
                  onChange={(e) => setNewWhiteNotes(e.target.value)}
                  placeholder="наприклад: Двоюрідний брат, архівні документи гілки Полтави"
                  className={`w-full px-3 py-2 rounded-lg text-xs border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-none focus:border-[#B88E3E]`}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                {whiteSuccessMsg ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{whiteSuccessMsg}</span>
                  </span>
                ) : (
                  <span className={`text-[11px] ${theme.cardSubtext}`}>
                    Користувач зможе увійти за цим email без введення паролів чи PIN-кодів.
                  </span>
                )}

                <button
                  type="submit"
                  className={`px-4 py-2 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Додати до білого списку</span>
                </button>
              </div>
            </form>
          </div>

          {/* SECTION: Whitelist Table */}
          <div className="space-y-3 pt-2 border-t border-black/10 dark:border-white/10">
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-bold ${theme.cardTitle} flex items-center gap-2`}>
                <Users className="w-4 h-4 text-[#B88E3E]" />
                <span>Авторизовані користувачі у Білому списку ({whitelist.length})</span>
              </h3>
              <span className={`text-xs ${theme.cardSubtext}`}>
                Усі електронні адреси мають захищений доступ за ролями
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10 text-gray-500 font-semibold">
                    <th className="py-2.5 px-3">Користувач & Google Email</th>
                    <th className="py-2.5 px-3">Роль доступу</th>
                    <th className="py-2.5 px-3">Статус</th>
                    <th className="py-2.5 px-3">Примітки</th>
                    <th className="py-2.5 px-3 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {whitelist.map((w) => {
                    const isSelf = currentUser?.email.toLowerCase() === w.email.toLowerCase();
                    return (
                      <tr key={w.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#B88E3E]/20 text-[#B88E3E] font-bold flex items-center justify-center text-xs">
                              {w.name ? w.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="font-bold flex items-center gap-1.5">
                                <span>{w.name || 'Користувач'}</span>
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#B88E3E] text-white font-bold">
                                    Ви
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-[11px] text-gray-500">{w.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <select
                            value={w.role}
                            onChange={(e) => updateWhitelistRole(w.id, e.target.value as UserRole)}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold border ${theme.inputBorder} ${theme.inputBg} ${theme.inputText}`}
                          >
                            <option value="admin">Адміністратор</option>
                            <option value="editor">Редактор</option>
                            <option value="researcher">Дослідник</option>
                            <option value="viewer">Переглядач</option>
                          </select>
                        </td>

                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => toggleWhitelistStatus(w.id)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                              w.status === 'active'
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/30'
                                : 'bg-gray-400/20 text-gray-500 hover:bg-gray-400/30'
                            }`}
                          >
                            {w.status === 'active' ? '● Активний' : '○ Призупинено'}
                          </button>
                        </td>

                        <td className="py-2.5 px-3 text-gray-500 text-[11px] max-w-[200px] truncate">
                          {w.notes || '—'}
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => {
                                removeFromWhitelist(w.id);
                                setWhiteSuccessMsg(`Користувача ${w.email} видалено з білого списку.`);
                                setTimeout(() => setWhiteSuccessMsg(null), 4000);
                              }}
                              className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-500/15 active:scale-95 transition-all cursor-pointer"
                              title="Видалити з білого списку"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
