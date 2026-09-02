import React, { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, Palette, LogOut, Bell, Menu, Sun, Moon, Cloud, CloudCheck, CloudOff, RefreshCw, Upload, Download, Check, AlertCircle, Share2, Copy, ShieldCheck, Lock, Flame, X, Mail } from 'lucide-react';
import { useGenealogy, useUIStore } from '../context/GenealogyContext';
import { useAuthStore } from '../stores/useAuthStore';
import { ThemePalette } from '../types';
import { THEME_CONFIGS, getThemeConfig } from '../utils/theme';
import { ShareTreeModal } from '../rodovid/components/modals/ShareTreeModal';
import { GedcomModal } from '../rodovid/components/modals/GedcomModal';
import { HeaderSearchBar } from './HeaderSearchBar';

interface HeaderProps {
  onOpenAddPerson: () => void;
  onInspectPerson?: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAddPerson, onInspectPerson }) => {
  const { 
    searchQuery, 
    setSearchQuery, 
    persons, 
    metricRecords, 
    themePalette, 
    setThemePalette,
    setActiveTab,
    syncStatus,
    lastSyncTime,
    lastSyncError,
    isManualPushing,
    isManualPulling,
    triggerUploadToCloud,
    triggerDownloadFromCloud,
    getGenealogyDatabase,
    loadGenealogyDatabase,
    selectedPersonId
  } = useGenealogy();

  const isMobileMenuOpen = useUIStore((s) => s.isMobileMenuOpen);
  const isSidebarVisible = useUIStore((s) => s.isSidebarVisible);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openAuthModal = useUIStore((s) => s.openAuthModal);
  const openContactModal = useUIStore((s) => s.openContactModal);
  const setRodovidView = useUIStore((s) => s.setRodovidView);

  const { currentUser, whitelist, accessRequests, logout } = useAuthStore();
  const isWhitelisted = Boolean(
    currentUser &&
    currentUser.isAuthenticated &&
    (currentUser.role === 'admin' ||
      whitelist.some(
        (w) => w.email.toLowerCase() === currentUser.email?.toLowerCase() && w.status === 'active'
      ))
  );

  const isAdmin = Boolean(
    currentUser &&
    currentUser.isAuthenticated &&
    (currentUser.role === 'admin' ||
      whitelist.some(
        (w) => w.email.toLowerCase() === currentUser.email?.toLowerCase() && w.role === 'admin' && w.status === 'active'
      ))
  );

  const theme = getThemeConfig(themePalette);

  const pendingRequestsCount = accessRequests.filter((r) => r.status === 'pending').length;

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showGedcomModal, setShowGedcomModal] = useState(false);
  const [showCloudPopover, setShowCloudPopover] = useState(false);
  const [cloudActionMsg, setCloudActionMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Close cloud popover on click outside or escape key
  useEffect(() => {
    if (!showCloudPopover) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowCloudPopover(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowCloudPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCloudPopover]);

  const toggleDarkLight = () => {
    if (theme.category === 'dark') {
      setThemePalette('classic');
    } else {
      setThemePalette('dark');
    }
  };

  const themeList = Object.values(THEME_CONFIGS);
  const lightThemes = themeList.filter(t => t.category === 'light');
  const darkThemes = themeList.filter(t => t.category === 'dark');

  const handleHeaderPush = async () => {
    setCloudActionMsg(null);
    const res = await triggerUploadToCloud();
    setCloudActionMsg({ text: res.message, isError: !res.success });
    setTimeout(() => setCloudActionMsg(null), 4000);
  };

  const handleHeaderPull = async () => {
    setCloudActionMsg(null);
    const res = await triggerDownloadFromCloud();
    setCloudActionMsg({ text: res.message, isError: !res.success });
    setTimeout(() => setCloudActionMsg(null), 4000);
  };

  const formatLastSync = (iso: string | null) => {
    if (!iso) return 'Немає даних';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  const handleShareOrCopyUrl = async () => {
    if (isAdmin) {
      setShowShareModal(true);
    } else {
      // Non-admins: copy direct page URL
      try {
        let urlToCopy = window.location.href;
        if (urlToCopy.includes('ais-dev-')) {
          urlToCopy = urlToCopy.replace('ais-dev-', 'ais-pre-');
        }
        await navigator.clipboard.writeText(urlToCopy);
        setCopiedUrl(true);
        setToastNotice('Адресу сторінки родоводу скопійовано в буфер обміну!');
        setTimeout(() => setCopiedUrl(false), 2500);
        setTimeout(() => setToastNotice(null), 3500);
      } catch {
        const textArea = document.createElement('textarea');
        let urlToCopy = window.location.href;
        if (urlToCopy.includes('ais-dev-')) {
          urlToCopy = urlToCopy.replace('ais-dev-', 'ais-pre-');
        }
        textArea.value = urlToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopiedUrl(true);
        setToastNotice('Адресу сторінки родоводу скопійовано в буфер обміну!');
        setTimeout(() => setCopiedUrl(false), 2500);
        setTimeout(() => setToastNotice(null), 3500);
      }
    }
  };

  return (
    <>
      <header id="app-header" className={`h-16 ${theme.headerBg} border-b ${theme.headerBorder} ${theme.headerText} px-3 md:px-6 flex items-center justify-between gap-2 md:gap-4 flex-shrink-0 transition-colors duration-300 relative`}>
        {/* Left Sidebar Menu Toggle Button */}
        <button
          id="app-sidebar-toggle"
          onClick={toggleSidebar}
          className="p-2 rounded-xl text-[#B88E3E] hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
          title={isSidebarVisible ? "Сховати бічну панель" : "Відкрити бічну панель"}
        >
          <Menu className="w-5 h-5" />
          <span className="hidden sm:inline text-xs font-semibold">Меню</span>
        </button>

        {/* Search Bar with live autocomplete & instant navigation */}
        <HeaderSearchBar 
          onOpenAddPerson={isWhitelisted ? onOpenAddPerson : () => openAuthModal('Додавання особи')}
          onInspectPerson={onInspectPerson}
        />

        {/* Quick Cloud Sync Status Flame Icon Button */}
        <div className="relative flex items-center">
          <button
            onClick={() => setShowCloudPopover(!showCloudPopover)}
            className={`p-2 rounded-xl border transition-all cursor-pointer shadow-xs relative flex items-center justify-center ${
              syncStatus === 'syncing' || isManualPushing || isManualPulling
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-500 hover:bg-amber-500/30'
                : syncStatus === 'error'
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-500 hover:bg-rose-500/30'
                : 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
            }`}
            title={
              syncStatus === 'syncing' || isManualPushing || isManualPulling
                ? 'Firestore: Синхронізація...'
                : syncStatus === 'error'
                ? 'Firestore: Помилка синхронізації'
                : `Firestore: Синхронізовано (${persons.length} осіб)`
            }
          >
            <Flame className={`w-4 h-4 ${syncStatus === 'syncing' || isManualPushing || isManualPulling ? 'animate-pulse text-amber-400' : ''}`} />
            {syncStatus === 'syncing' || isManualPushing || isManualPulling ? (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            ) : syncStatus === 'error' ? (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            ) : (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            )}
          </button>

          {/* Cloud Details Popover */}
          {showCloudPopover && (
            <>
              {/* Invisible backdrop to dismiss on click outside anywhere */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowCloudPopover(false)} 
              />

              <div 
                ref={popoverRef}
                className={`absolute top-full mt-2.5 right-0 sm:left-0 sm:right-auto w-80 max-w-[calc(100vw-24px)] rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl p-4 z-50 space-y-3 ${theme.cardTitle}`}
              >
                <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[#B88E3E]" />
                    <span className="font-bold text-xs">Хмарна синхронізація Firestore</span>
                  </div>
                  <button
                    onClick={() => setShowCloudPopover(false)}
                    className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors cursor-pointer"
                    title="Закрити"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 text-[11px] opacity-90">
                  <div className="flex justify-between">
                    <span className="opacity-70">Стан зв'язку:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {syncStatus === 'syncing' ? 'Йде запис...' : syncStatus === 'error' ? 'Помилка підключення' : 'Атомарно підключено'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Останній запис:</span>
                    <span className="font-mono">{formatLastSync(lastSyncTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Записів у базі:</span>
                    <span>{persons.length} осіб / {metricRecords.length} метрик</span>
                  </div>
                  {lastSyncError && (
                    <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px]">
                      {lastSyncError}
                    </div>
                  )}
                </div>

                {cloudActionMsg && (
                  <div className={`p-2 rounded-lg text-[10px] flex items-center gap-1.5 ${
                    cloudActionMsg.isError
                      ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  }`}>
                    {cloudActionMsg.isError ? <AlertCircle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    <span>{cloudActionMsg.text}</span>
                  </div>
                )}

                {/* Quick Actions inside Popover */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleHeaderPush}
                    disabled={isManualPushing || isManualPulling}
                    className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} font-bold text-[11px] transition-all cursor-pointer disabled:opacity-50`}
                  >
                    <Upload className={`w-3.5 h-3.5 ${isManualPushing ? 'animate-bounce' : ''}`} />
                    <span>{isManualPushing ? 'Запис...' : 'Вивантажити'}</span>
                  </button>

                  <button
                    onClick={handleHeaderPull}
                    disabled={isManualPushing || isManualPulling}
                    className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl ${theme.badgeBg} ${theme.badgeText} border ${theme.cardBorder} font-bold text-[11px] transition-all cursor-pointer hover:opacity-90 disabled:opacity-50`}
                  >
                    <Download className={`w-3.5 h-3.5 ${isManualPulling ? 'animate-bounce' : ''}`} />
                    <span>{isManualPulling ? 'Читання...' : 'Завантажити'}</span>
                  </button>
                </div>

                <div className="text-center pt-1 border-t border-black/5 dark:border-white/5">
                  <button
                    onClick={() => {
                      setShowCloudPopover(false);
                      setActiveTab('settings');
                    }}
                    className="text-[10px] text-[#B88E3E] hover:underline font-medium cursor-pointer"
                  >
                    Відкрити повні налаштування Firestore →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Quick Dark / Light Mode Toggle */}
          <button
            onClick={toggleDarkLight}
            className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-[#B88E3E] transition-colors shrink-0 cursor-pointer"
            title={theme.category === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
          >
            {theme.category === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Theme Palette Toggle Button */}
          <button
            onClick={() => setShowThemeModal(true)}
            className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-[#B88E3E] transition-colors shrink-0 cursor-pointer"
            title="Палітра кольорових тем оформлення"
          >
            <Palette className="w-4 h-4" />
          </button>

          {/* GEDCOM / Database Import & Export Button */}
          <button
            onClick={isWhitelisted ? () => setShowGedcomModal(true) : () => openAuthModal('Імпорт / Експорт GEDCOM')}
            className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
              theme.category === 'dark'
                ? 'hover:bg-white/10 text-emerald-400'
                : 'hover:bg-black/10 text-emerald-600'
            }`}
            title="Імпорт / Експорт GEDCOM та бази даних"
          >
            <Upload className="w-4 h-4" />
          </button>

          {/* Pending Requests Badge for Admin */}
          {currentUser?.role === 'admin' && pendingRequestsCount > 0 && (
            <button
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30 transition-colors animate-pulse shrink-0 cursor-pointer"
              title={`Є нові вхідні запити на доступ (${pendingRequestsCount})`}
            >
              <Bell className="w-4 h-4" />
            </button>
          )}

          {/* Whitelist Login Button when not authenticated */}
          {!isWhitelisted && (
            <button
              onClick={() => openAuthModal()}
              className="p-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/40 text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              title="Увійти за поштою або Google для редагування"
            >
              <ShieldCheck className="w-4 h-4 text-amber-500" />
            </button>
          )}

          {/* Contact Author Button (domagile@gmail.com) */}
          <button
            id="header-contact-author-btn"
            onClick={() => openContactModal()}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all shrink-0 cursor-pointer shadow-xs ${
              theme.category === 'dark'
                ? 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-500/30'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
            }`}
            title="Шукаєте спільних предків? Написати автору дослідження (domagile@gmail.com)"
          >
            <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="hidden sm:inline">Зв'язок з автором</span>
          </button>

          {/* Share Tree (Admin only modal) or Copy Address (Others) Button */}
          <button
            onClick={handleShareOrCopyUrl}
            className={`p-2 rounded-xl border font-semibold text-xs transition-colors shrink-0 cursor-pointer ${
              copiedUrl
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                : theme.category === 'dark'
                ? 'bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 border-amber-500/40'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
            }`}
            title={
              isAdmin
                ? 'Спільний перегляд дерева (Налаштування та публікація онлайн)'
                : copiedUrl
                ? 'Адресу сторінки скопійовано!'
                : 'Скопіювати адресу сторінки (Спільний перегляд дерева доступний тільки адміністраторам)'
            }
          >
            {copiedUrl ? (
              <Check className="w-4 h-4 text-white" />
            ) : isAdmin ? (
              <Share2 className="w-4 h-4 text-amber-500" />
            ) : (
              <Copy className="w-4 h-4 text-amber-500" />
            )}
          </button>

          {/* Add Person Button - Icon Only */}
          <button
            onClick={isWhitelisted ? onOpenAddPerson : () => openAuthModal('Додавання особи')}
            id="add-person-btn"
            className={`p-2 ${theme.accentBtn} ${theme.accentBtnText} font-medium rounded-xl text-xs transition-colors shadow-sm shrink-0 cursor-pointer ${!isWhitelisted ? 'opacity-90' : ''}`}
            title={!isWhitelisted ? 'Редагування доступне після входу за Whitelist' : 'Додати особу'}
          >
            {isWhitelisted ? <UserPlus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>

          {/* Sign Out / Lock Session Button */}
          {isWhitelisted && (
            <button
              onClick={() => logout()}
              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs transition-colors shrink-0 cursor-pointer"
              title="Вийти з облікового запису / Заблокувати сесію"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Theme Palette Selection Modal */}
      {showThemeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl max-w-xl w-full p-6 ${theme.cardTitle} shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto`}>
            <div className={`flex items-start justify-between border-b ${theme.cardBorder} pb-3`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#B88E3E]/20 flex items-center justify-center text-[#B88E3E]">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Кольорове оформлення та фон</h3>
                  <p className="text-xs opacity-75">Оберіть найприємніший для очей фон інтерфейсу</p>
                </div>
              </div>
              <button onClick={() => setShowThemeModal(false)} className="opacity-70 hover:opacity-100 text-lg px-2">
                ✕
              </button>
            </div>

            {/* Light Themes */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#B88E3E] flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5" />
                <span>Світлі та пастельні теми (М'який пергамент, шавлія, пісок)</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {lightThemes.map((p) => {
                  const isSelected = themePalette === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setThemePalette(p.id as ThemePalette)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'border-[#B88E3E] ring-2 ring-[#B88E3E]/40 shadow-md bg-amber-50/50'
                          : 'border-black/10 hover:border-[#B88E3E]/50'
                      }`}
                      style={{ backgroundColor: p.colors[0] }}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-xs" style={{ color: p.colors[3] }}>{p.name.split('(')[0]}</span>
                          {isSelected && <span className="px-1.5 py-0.2 text-[9px] bg-[#B88E3E] text-white font-bold rounded">Активна</span>}
                        </div>
                        <p className="text-[10px] opacity-80 leading-snug" style={{ color: p.colors[3] }}>{p.desc}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        {p.colors.map((c, i) => (
                          <div key={i} className="w-4 h-4 rounded-full border border-black/20" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dark Themes */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#B88E3E] flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5" />
                <span>Темні та класичні теми (Смарагд, дерево, сапфір)</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {darkThemes.map((p) => {
                  const isSelected = themePalette === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setThemePalette(p.id as ThemePalette)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'border-[#B88E3E] ring-2 ring-[#B88E3E]/40 shadow-md'
                          : 'border-white/10 hover:border-[#B88E3E]/50'
                      }`}
                      style={{ backgroundColor: p.colors[0] }}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-xs" style={{ color: p.colors[3] }}>{p.name.split('(')[0]}</span>
                          {isSelected && <span className="px-1.5 py-0.2 text-[9px] bg-[#B88E3E] text-white font-bold rounded">Активна</span>}
                        </div>
                        <p className="text-[10px] opacity-80 leading-snug" style={{ color: p.colors[3] }}>{p.desc}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        {p.colors.map((c, i) => (
                          <div key={i} className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setShowThemeModal(false)}
                className={`px-5 py-2 ${theme.accentBtn} ${theme.accentBtnText} font-medium text-xs rounded-xl transition-colors`}
              >
                Застосувати та закрити
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notice */}
      {toastNotice && (
        <div className="fixed top-18 right-6 z-50 bg-neutral-900/95 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-white/20 text-xs font-semibold flex items-center gap-2 backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastNotice}</span>
        </div>
      )}

      {showShareModal && (
        <ShareTreeModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          database={getGenealogyDatabase()}
          activePersonId={selectedPersonId || undefined}
        />
      )}

      {showGedcomModal && (
        <GedcomModal
          database={getGenealogyDatabase()}
          onClose={() => setShowGedcomModal(false)}
          onImportDatabase={(newDb) => {
            loadGenealogyDatabase(newDb);
            setShowGedcomModal(false);
          }}
        />
      )}
    </>
  );
};
