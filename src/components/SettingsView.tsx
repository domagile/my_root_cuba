import React, { useState } from 'react';
import { 
  Palette, 
  Download, 
  Upload, 
  RefreshCw, 
  Github, 
  Database, 
  Sun, 
  Moon, 
  Check, 
  FileCode, 
  ShieldCheck, 
  Info,
  Sparkles,
  GitBranch,
  GitCommit,
  CheckCircle2,
  Trash2,
  Clock,
  Lock,
  Key,
  Copy,
  ExternalLink,
  LockKeyhole,
  LogOut
} from 'lucide-react';
import { useGenealogy } from '../context/GenealogyContext';
import { THEME_CONFIGS, getThemeConfig } from '../utils/theme';
import { ThemePalette } from '../types';
import { pushProjectToGithub } from '../utils/githubSync';

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
    sharedInvites,
    addSharedInvite,
    deleteSharedInvite,
    gitConfig,
    setGitConfig,
    accessLockConfig,
    setAccessLockConfig,
    lockAppSession
  } = useGenealogy();

  const theme = getThemeConfig(themePalette);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Git form states
  const [repoUrlInput, setRepoUrlInput] = useState(gitConfig?.repoUrl || '');
  const [branchInput, setBranchInput] = useState(gitConfig?.branch || 'main');
  const [tokenInput, setTokenInput] = useState(gitConfig?.token || '');
  const [isGitSyncing, setIsGitSyncing] = useState(false);
  const [gitStatusMsg, setGitStatusMsg] = useState<string | null>(null);

  // Access Lock & Secret Link states
  const [pinEditInput, setPinEditInput] = useState(accessLockConfig?.pinCode || '1234');
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false);

  const handleConnectGit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrlInput.trim()) {
      alert('Будь ласка, вкажіть URL вашого Git репозиторію.');
      return;
    }
    setIsGitSyncing(true);
    setGitStatusMsg('Перевірка з\'єднання та первинна відправка даних у GitHub...');

    const newConfig = {
      repoUrl: repoUrlInput.trim(),
      branch: branchInput.trim() || 'main',
      token: tokenInput.trim(),
      connected: true,
      lastSync: new Date().toLocaleString('uk-UA'),
      autoSyncDaily: true,
      autoSyncTime: '18:00'
    };

    const res = await pushProjectToGithub(newConfig, {
      persons,
      metricRecords,
      tasks,
      hypotheses,
      documents,
      findings,
      requests,
      matrixEntries
    });

    setIsGitSyncing(false);
    if (res.success) {
      setGitConfig(newConfig);
      setGitStatusMsg(`Успішно! ${res.message}`);
    } else {
      setGitConfig(newConfig);
      setGitStatusMsg(`Репозиторій збережено, але пуш повернув: ${res.message}`);
    }
    setTimeout(() => setGitStatusMsg(null), 6000);
  };

  const handleGitSyncNow = async () => {
    if (!gitConfig) return;
    setIsGitSyncing(true);
    setGitStatusMsg('Відправка та фіксація коду й бази даних у GitHub...');

    const res = await pushProjectToGithub(gitConfig, {
      persons,
      metricRecords,
      tasks,
      hypotheses,
      documents,
      findings,
      requests,
      matrixEntries
    });

    const now = new Date().toLocaleString('uk-UA');
    setIsGitSyncing(false);

    if (res.success) {
      setGitConfig({
        ...gitConfig,
        lastSync: now
      });
      setGitStatusMsg(`Зміни й код успішно відправлені у GitHub! (${now})`);
    } else {
      setGitStatusMsg(`Помилка пушу: ${res.message}`);
    }
    setTimeout(() => setGitStatusMsg(null), 6000);
  };

  const handleDisconnectGit = () => {
    if (confirm('Ви впевнені, що бажаєте відключити Git репозиторій?')) {
      setGitConfig(null);
      setRepoUrlInput('');
      setBranchInput('main');
      setTokenInput('');
      setGitStatusMsg('Git репозиторій відключено.');
      setTimeout(() => setGitStatusMsg(null), 3000);
    }
  };

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

      {/* SECTION 2.5: Shared Access & Collaboration */}
      <section className="space-y-4 pt-4 border-t border-black/10">
        <div>
          <h2 className={`text-lg font-bold ${theme.cardTitle} flex items-center gap-2`}>
            <ShieldCheck className="w-5 h-5 text-[#B88E3E]" />
            <span>Спільний доступ до родоводу за поштою Google</span>
          </h2>
          <p className={`text-xs ${theme.cardSubtext} mt-1`}>
            Надавайте права перегляду чи редагування вашим родичам та дослідникам за поштою Google
          </p>
        </div>

        <div className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-4`}>
          <form onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const input = form.elements.namedItem('inviteEmail') as HTMLInputElement;
            const roleSelect = form.elements.namedItem('inviteRole') as HTMLSelectElement;
            if (input && input.value && input.value.includes('@')) {
              addSharedInvite({
                id: `invite-${Date.now()}`,
                name: input.value.split('@')[0],
                email: input.value,
                role: roleSelect?.value as any || 'editor',
                inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
                createdAt: new Date().toISOString()
              });
              input.value = '';
              alert('Запрошення надіслано та збережено!');
            } else {
              alert('Будь ласка, вкажіть коректну Google пошту.');
            }
          }} className="flex flex-col sm:flex-row gap-2">
            <input 
              name="inviteEmail"
              type="email" 
              placeholder="user@gmail.com (Google пошта)" 
              className={`flex-1 px-3.5 py-2 rounded-xl text-xs border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-none focus:border-[#B88E3E]`}
              required
            />
            <select 
              name="inviteRole"
              className={`px-3 py-2 rounded-xl text-xs border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
            >
              <option value="viewer">Перегляд (Лише читання)</option>
              <option value="editor">Редагування (Повний доступ)</option>
            </select>
            <button 
              type="submit" 
              className={`px-4 py-2 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} font-bold text-xs flex items-center gap-1.5 shrink-0 justify-center shadow-sm`}
            >
              <span>Надати доступ</span>
            </button>
          </form>

          {/* List of Shared Invites */}
          <div className="space-y-2 pt-2">
            <h4 className={`text-xs font-bold ${theme.cardTitle}`}>Активні доступи та запрошення:</h4>
            {sharedInvites.length > 0 ? (
              <div className="space-y-2">
                {sharedInvites.map(inv => (
                  <div key={inv.id} className={`p-3 rounded-xl border ${theme.cardBorder} flex items-center justify-between text-xs`}>
                    <div>
                      <span className={`font-semibold ${theme.cardTitle} block`}>{inv.email}</span>
                      <span className={`text-[10px] ${theme.cardSubtext}`}>
                        Роль: {inv.role === 'editor' ? 'Редактор' : 'Читач'} • Створено: {inv.createdAt}
                      </span>
                    </div>
                    <button 
                      onClick={() => deleteSharedInvite(inv.id)} 
                      className="text-rose-500 hover:text-rose-700 text-xs font-medium px-2 py-1 bg-rose-500/10 rounded-lg"
                    >
                      Видалити
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-xs italic ${theme.cardSubtext}`}>Ще немає доданих адрес для спільного доступу.</p>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 2.7: Private Access & PIN Protection */}
      <section className="space-y-4 pt-4 border-t border-black/10">
        <div>
          <h2 className={`text-lg font-bold ${theme.cardTitle} flex items-center gap-2`}>
            <LockKeyhole className="w-5 h-5 text-[#B88E3E]" />
            <span>Приватне посилання та захист PIN-кодом</span>
          </h2>
          <p className={`text-xs ${theme.cardSubtext} mt-1`}>
            Обмежте доступ до вашого сайту родоводу, щоб він був доступний тільки вам або людям з вашим secret-посиланням/PIN-кодом
          </p>
        </div>

        <div className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-6`}>
          {/* Main Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10">
            <div className="space-y-0.5">
              <h4 className={`text-sm font-bold ${theme.cardTitle} flex items-center gap-2`}>
                <Lock className="w-4 h-4 text-[#B88E3E]" />
                <span>Захист архіву PIN-кодом</span>
              </h4>
              <p className={`text-xs ${theme.cardSubtext}`}>
                Якщо увімкнено, відвідувачі без PIN-коду або без секретного ключа в лінку побачать екран авторизації
              </p>
            </div>

            <button
              onClick={() => {
                const updated = { ...accessLockConfig, enabled: !accessLockConfig.enabled };
                setAccessLockConfig(updated);
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                accessLockConfig.enabled ? 'bg-[#B88E3E]' : 'bg-gray-400/40'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  accessLockConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Settings when Lock is enabled */}
          {accessLockConfig.enabled && (
            <div className="space-y-5 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* PIN code setup */}
                <div className="space-y-1.5">
                  <label className={`text-xs font-semibold ${theme.cardTitle} flex items-center gap-1.5`}>
                    <Key className="w-3.5 h-3.5 text-[#B88E3E]" />
                    <span>Ваш секретний PIN-код</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={pinEditInput}
                      onChange={(e) => setPinEditInput(e.target.value)}
                      placeholder="1234"
                      className={`flex-1 px-3.5 py-2 rounded-xl text-xs font-mono border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-none focus:border-[#B88E3E]`}
                    />
                    <button
                      onClick={() => {
                        if (!pinEditInput.trim()) {
                          alert('Будь ласка, вкажіть PIN-код.');
                          return;
                        }
                        setAccessLockConfig({ ...accessLockConfig, pinCode: pinEditInput.trim() });
                        alert('PIN-код успішно збережено!');
                      }}
                      className={`px-3.5 py-2 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} font-bold text-xs shrink-0`}
                    >
                      Зберегти PIN
                    </button>
                  </div>
                </div>

                {/* Regenerate Secret Key */}
                <div className="space-y-1.5">
                  <label className={`text-xs font-semibold ${theme.cardTitle} flex items-center gap-1.5`}>
                    <RefreshCw className="w-3.5 h-3.5 text-[#B88E3E]" />
                    <span>Секретний маркер доступу</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={accessLockConfig.secretKey}
                      className={`flex-1 px-3.5 py-2 rounded-xl text-xs font-mono border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} opacity-80`}
                    />
                    <button
                      onClick={() => {
                        const newKey = 'rodovid-key-' + Math.random().toString(36).substring(2, 9);
                        setAccessLockConfig({ ...accessLockConfig, secretKey: newKey });
                      }}
                      className={`px-3 py-2 rounded-xl ${theme.badgeBg} ${theme.badgeText} border ${theme.cardBorder} text-xs font-medium shrink-0`}
                    >
                      Оновити ключ
                    </button>
                  </div>
                </div>
              </div>

              {/* Secret Link Box */}
              <div className="p-4 rounded-xl bg-[#B88E3E]/10 border border-[#B88E3E]/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${theme.cardTitle} flex items-center gap-1.5`}>
                    <ExternalLink className="w-3.5 h-3.5 text-[#B88E3E]" />
                    <span>Секретне посилання для друзів та родичів (Прямий вхід без PIN)</span>
                  </span>
                  {copyLinkSuccess && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Скопійовано!</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/?key=${accessLockConfig.secretKey}`}
                    className={`flex-1 px-3.5 py-2 rounded-xl text-xs font-mono border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
                  />
                  <button
                    onClick={() => {
                      const fullUrl = `${window.location.origin}/?key=${accessLockConfig.secretKey}`;
                      navigator.clipboard.writeText(fullUrl);
                      setCopyLinkSuccess(true);
                      setTimeout(() => setCopyLinkSuccess(false), 3000);
                    }}
                    className={`px-4 py-2 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} font-bold text-xs flex items-center gap-1.5 shrink-0`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Скопіювати лінк</span>
                  </button>
                </div>
                <p className={`text-[11px] ${theme.cardSubtext}`}>
                  Усі, хто відкриє сайт за цим посиланням, автоматично увійдуть в родовід без введення PIN-коду.
                </p>
              </div>

              {/* Lock session button */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => {
                    lockAppSession();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-bold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Заблокувати сесію зараз (Захистити вхід)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 3: GitHub Integration & Push */}
      <section className="space-y-4 pt-4 border-t border-black/10">
        <div>
          <h2 className={`text-lg font-bold ${theme.cardTitle} flex items-center gap-2`}>
            <Github className="w-5 h-5 text-[#B88E3E]" />
            <span>Інтеграція з GitHub & Синхронізація коду</span>
          </h2>
          <p className={`text-xs ${theme.cardSubtext} mt-1`}>
            Прикріпіть ваш GitHub-репозиторій для регулярного відправлення коду додатка та генеалогічної бази даних
          </p>
        </div>

        {/* Info Box about AI Studio Export */}
        <div className="p-4 rounded-xl bg-[#B88E3E]/10 border border-[#B88E3E]/30 flex items-start gap-3">
          <Info className="w-5 h-5 text-[#B88E3E] shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <strong className={`font-bold ${theme.cardTitle} block`}>Два способи зв'язку з GitHub:</strong>
            <p className={theme.cardSubtext}>
              <strong>1. Через меню AI Studio:</strong> У верхній/боковій панелі браузера відкрийте меню налаштувань AI Studio та виберіть <em>"Export to GitHub"</em> або <em>"Connect to GitHub"</em>. Це створить репозиторій напряму.
            </p>
            <p className={theme.cardSubtext}>
              <strong>2. Прямий автоматичний пуш із додатка (нижче):</strong> Вкажіть посилання на ваш репозиторій та Personal Access Token від GitHub для відправки останньої версії коду та даних родоводу одним кліком.
            </p>
          </div>
        </div>

        <div className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-6`}>
          {gitConfig?.connected ? (
            /* Connected state */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${theme.cardTitle} flex items-center gap-2`}>
                      <span>GitHub репозиторій підключено</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono">
                        {gitConfig.branch || 'main'}
                      </span>
                    </h4>
                    <a 
                      href={gitConfig.repoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs text-[#B88E3E] hover:underline font-mono break-all"
                    >
                      {gitConfig.repoUrl}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleGitSyncNow}
                    disabled={isGitSyncing}
                    className={`px-4 py-2 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGitSyncing ? 'animate-spin' : ''}`} />
                    <span>{isGitSyncing ? 'Синхронізація...' : 'Пуш коду зараз'}</span>
                  </button>

                  <button
                    onClick={handleDisconnectGit}
                    className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {gitConfig.lastSync && (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 pl-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Останній пуш у GitHub: <strong>{gitConfig.lastSync}</strong></span>
                </div>
              )}
            </div>
          ) : (
            /* Setup Form */
            <form onSubmit={handleConnectGit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={`text-xs font-semibold ${theme.cardTitle} flex items-center gap-1.5`}>
                    <GitBranch className="w-3.5 h-3.5 text-[#B88E3E]" />
                    <span>URL GitHub Репозиторію</span>
                  </label>
                  <input
                    type="url"
                    value={repoUrlInput}
                    onChange={(e) => setRepoUrlInput(e.target.value)}
                    placeholder="https://github.com/username/my-genealogy-app"
                    className={`w-full px-3.5 py-2 rounded-xl text-xs border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-none focus:border-[#B88E3E]`}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`text-xs font-semibold ${theme.cardTitle} flex items-center gap-1.5`}>
                    <GitCommit className="w-3.5 h-3.5 text-[#B88E3E]" />
                    <span>Назва гілки (Branch)</span>
                  </label>
                  <input
                    type="text"
                    value={branchInput}
                    onChange={(e) => setBranchInput(e.target.value)}
                    placeholder="main"
                    className={`w-full px-3.5 py-2 rounded-xl text-xs border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-none focus:border-[#B88E3E]`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={`text-xs font-semibold ${theme.cardTitle} flex items-center gap-1.5`}>
                    <ShieldCheck className="w-3.5 h-3.5 text-[#B88E3E]" />
                    <span>Personal Access Token (PAT)</span>
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=GenealogyApp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#B88E3E] hover:underline flex items-center gap-1"
                  >
                    <span>Як отримати токен на GitHub ↗</span>
                  </a>
                </div>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className={`w-full px-3.5 py-2 rounded-xl text-xs border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-none focus:border-[#B88E3E] font-mono`}
                  required
                />
                <p className={`text-[10px] ${theme.cardSubtext}`}>
                  Токен повинен мати дозвіл <code>repo</code> (Full control of private repositories).
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isGitSyncing}
                  className={`px-5 py-2.5 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50`}
                >
                  <Github className="w-4 h-4" />
                  <span>{isGitSyncing ? 'Підключення...' : 'Зберегти та синхронізувати з GitHub'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Status notification */}
          {gitStatusMsg && (
            <div className="p-3.5 rounded-xl bg-[#B88E3E]/15 border border-[#B88E3E]/40 text-xs flex items-center gap-2 text-[#B88E3E] font-medium">
              <Info className="w-4 h-4 shrink-0" />
              <span>{gitStatusMsg}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
