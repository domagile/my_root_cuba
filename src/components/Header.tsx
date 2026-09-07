import React, { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, Palette, LogOut, Bell, Menu, Sun, Moon, Cloud, CloudCheck, CloudOff, RefreshCw, Upload, Download, Check, AlertCircle, Lock, Flame, X, MoreVertical } from 'lucide-react';
import { useGenealogy, useUIStore } from '../context/GenealogyContext';
import { useAuthStore, isMasterAdminEmail } from '../stores/useAuthStore';
import { isUserWhitelisted } from '../rodovid/utils/privacy';
import { ThemePalette } from '../types';
import { THEME_CONFIGS, getThemeConfig } from '../utils/theme';
import { ShareTreeModal } from '../rodovid/components/modals/ShareTreeModal';
import { GedcomModal } from '../rodovid/components/modals/GedcomModal';
import { HeaderSearchBar } from './HeaderSearchBar';
import { GlobalSearchModal } from './GlobalSearchModal';

interface HeaderProps {
  onOpenAddPerson: () => void;
  onInspectPerson?: (id: string) => void;
  onOpenContactModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAddPerson, onInspectPerson, onOpenContactModal }) => {
  const { 
    searchQuery, 
    setSearchQuery, 
    persons, 
    families,
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
  const setRodovidView = useUIStore((s) => s.setRodovidView);

  const { currentUser, whitelist, accessRequests, logout } = useAuthStore();
  const isWhitelisted = isUserWhitelisted(currentUser, whitelist);

  const isAdmin = Boolean(
    currentUser &&
    currentUser.isAuthenticated &&
    (currentUser.role === 'admin' ||
      isMasterAdminEmail(currentUser.email) ||
      whitelist.some(
        (w) => w.email.toLowerCase() === currentUser.email?.toLowerCase() && w.role === 'admin' && w.status === 'active'
      ))
  );

  const theme = getThemeConfig(themePalette);

  const pendingRequestsCount = accessRequests.filter((r) => r.status === 'pending').length;

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showGedcomModal, setShowGedcomModal] = useState(false);
  const [showGlobalSearchModal, setShowGlobalSearchModal] = useState(false);
  const [showCloudPopover, setShowCloudPopover] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [cloudActionMsg, setCloudActionMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const mobileMoreRef = useRef<HTMLDivElement>(null);

  // Global keyboard shortcut for search (Cmd+K / Ctrl+K / slash)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowGlobalSearchModal(true);
      } else if (e.key === '/' && !isInput) {
        e.preventDefault();
        setShowGlobalSearchModal(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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

  const [isFullSyncing, setIsFullSyncing] = useState(false);

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

  const handleFullSync = async () => {
    setIsFullSyncing(true);
    setCloudActionMsg(null);
    try {
      const pushRes = await triggerUploadToCloud();
      if (!pushRes.success) {
        setCloudActionMsg({ text: pushRes.message, isError: true });
        return;
      }
      const pullRes = await triggerDownloadFromCloud();
      if (pullRes.success) {
        setCloudActionMsg({ text: 'Синхронізацію успішно завершено! Дані актуалізовано в БД Firestore.', isError: false });
      } else {
        setCloudActionMsg({ text: `Вивантажено в БД, але помилка оновлення: ${pullRes.message}`, isError: true });
      }
    } catch (e: any) {
      setCloudActionMsg({ text: e?.message || 'Помилка синхронізації з Firestore', isError: true });
    } finally {
      setIsFullSyncing(false);
      setTimeout(() => setCloudActionMsg(null), 5000);
    }
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

  const isSyncingActive = syncStatus === 'syncing' || isManualPushing || isManualPulling || isFullSyncing;

  return (
    <>
      <header id="app-header" className={`h-16 ${theme.headerBg} border-b ${theme.headerBorder} ${theme.headerText} px-2 sm:px-4 md:px-6 flex items-center justify-between gap-1.5 sm:gap-2.5 md:gap-4 flex-shrink-0 transition-colors duration-300 relative w-full max-w-full z-30`}>
        {/* Left Sidebar Menu Toggle Button */}
        <button
          id="app-sidebar-toggle"
          onClick={toggleSidebar}
          className="p-1.5 sm:p-2 rounded-xl text-[#B88E3E] hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer flex items-center gap-1"
          title={isSidebarVisible ? "Сховати бічну панель" : "Відкрити бічну панель"}
        >
          <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline text-xs font-semibold">Меню</span>
        </button>

        {/* Search Bar with live autocomplete & instant navigation */}
        <HeaderSearchBar 
          onOpenAddPerson={isWhitelisted ? onOpenAddPerson : () => openAuthModal('Додавання особи')}
          onInspectPerson={onInspectPerson}
          onOpenGlobalModal={() => setShowGlobalSearchModal(true)}
        />

        {/* Quick Cloud Sync Status Flame Icon Button */}
        <div className="relative flex items-center">
          <button
            id="cloud-sync-flame-btn"
            onClick={() => setShowCloudPopover(!showCloudPopover)}
            className={`p-2 rounded-xl border transition-all cursor-pointer shadow-xs relative flex items-center justify-center ${
              isSyncingActive
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-500 hover:bg-amber-500/30 ring-2 ring-amber-400/40'
                : syncStatus === 'error'
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-500 hover:bg-rose-500/30'
                : 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
            }`}
            title={
              isSyncingActive
                ? 'Firestore: Синхронізація з БД триває...'
                : syncStatus === 'error'
                ? 'Firestore: Помилка синхронізації'
                : `Firestore: Синхронізовано з БД (${persons.length} осіб) — Натисніть для меню`
            }
          >
            <Flame className={`w-4 h-4 ${isSyncingActive ? 'animate-pulse text-amber-400' : ''}`} />
            {isSyncingActive ? (
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
              {/* Semi-transparent backdrop to dismiss on click outside anywhere */}
              <div 
                className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-[0.5px]" 
                onClick={() => setShowCloudPopover(false)} 
              />

              <div 
                ref={popoverRef}
                className={`absolute top-full mt-2.5 right-0 sm:left-1/2 sm:-translate-x-1/2 w-84 sm:w-92 max-w-[calc(100vw-20px)] rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl p-4 z-[100] space-y-3.5 ${theme.cardTitle} animate-in fade-in zoom-in-95 duration-150`}
              >
                {/* Popover Header */}
                <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-500">
                      <Flame className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs leading-tight">Синхронізація з БД</h4>
                      <p className="text-[10px] opacity-65 font-mono">Firestore Cloud Database</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCloudPopover(false)}
                    className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors cursor-pointer"
                    title="Закрити"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Status and Metrics List */}
                <div className="space-y-2 text-[11px] opacity-95">
                  <div className="flex items-center justify-between">
                    <span className="opacity-70">Стан підключення:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      {isSyncingActive ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
                          <span className="text-amber-500">Йде синхронізація...</span>
                        </>
                      ) : syncStatus === 'error' ? (
                        <>
                          <AlertCircle className="w-3 h-3 text-rose-500" />
                          <span className="text-rose-500">Помилка підключення</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>Підключено до БД</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="opacity-70">Останній сеанс:</span>
                    <span className="font-mono text-xs font-semibold">{formatLastSync(lastSyncTime)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="opacity-70">Об'єктів у проекті:</span>
                    <span className="font-medium">
                      {persons.length} осіб • {Object.keys(families || {}).length} родин • {metricRecords.length} метрик
                    </span>
                  </div>

                  {lastSyncError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] leading-relaxed">
                      {lastSyncError}
                    </div>
                  )}
                </div>

                {/* Status action alert message */}
                {cloudActionMsg && (
                  <div className={`p-2.5 rounded-xl text-[11px] flex items-center gap-2 ${
                    cloudActionMsg.isError
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {cloudActionMsg.isError ? (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    ) : (
                      <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                    )}
                    <span className="leading-snug">{cloudActionMsg.text}</span>
                  </div>
                )}

                {/* Primary Sync Button: Full Sync Now */}
                <button
                  id="primary-sync-now-btn"
                  onClick={handleFullSync}
                  disabled={isSyncingActive}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50`}
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingActive ? 'animate-spin' : ''}`} />
                  <span>{isSyncingActive ? 'Синхронізація з БД...' : 'Синхронізувати зараз'}</span>
                </button>

                {/* Granular Quick Actions inside Popover */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    id="popover-push-cloud-btn"
                    onClick={handleHeaderPush}
                    disabled={isSyncingActive}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} font-bold text-[11px] transition-all cursor-pointer disabled:opacity-50 shadow-xs`}
                    title="Зберегти всі локальні зміни в базу даних Firestore"
                  >
                    <Upload className={`w-3.5 h-3.5 ${isManualPushing ? 'animate-bounce' : ''}`} />
                    <span>{isManualPushing ? 'Запис...' : 'Вивантажити'}</span>
                  </button>

                  <button
                    id="popover-pull-cloud-btn"
                    onClick={handleHeaderPull}
                    disabled={isSyncingActive}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl ${theme.badgeBg} ${theme.badgeText} border ${theme.cardBorder} font-bold text-[11px] transition-all cursor-pointer hover:opacity-90 disabled:opacity-50 shadow-xs`}
                    title="Отримати найновіші дані з бази даних Firestore"
                  >
                    <Download className={`w-3.5 h-3.5 ${isManualPulling ? 'animate-bounce' : ''}`} />
                    <span>{isManualPulling ? 'Читання...' : 'Завантажити'}</span>
                  </button>
                </div>

                {/* Footer Link to Settings */}
                <div className="text-center pt-2 border-t border-black/5 dark:border-white/5">
                  <button
                    onClick={() => {
                      setShowCloudPopover(false);
                      setActiveTab('settings');
                    }}
                    className="text-[11px] text-[#B88E3E] hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>Відкрити повні налаштування Firestore</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
          {/* Quick Dark / Light Mode Toggle */}
          <button
            onClick={toggleDarkLight}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-[#B88E3E] transition-colors shrink-0 cursor-pointer"
            title={theme.category === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
          >
            {theme.category === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Theme Palette Toggle Button (Desktop/Tablet) */}
          <button
            onClick={() => setShowThemeModal(true)}
            className="hidden sm:flex p-1.5 sm:p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-[#B88E3E] transition-colors shrink-0 cursor-pointer"
            title="Палітра кольорових тем оформлення"
          >
            <Palette className="w-4 h-4" />
          </button>

          {/* GEDCOM / Database Import & Export Button (Desktop/Tablet) */}
          <button
            onClick={isWhitelisted ? () => setShowGedcomModal(true) : () => openAuthModal('Імпорт / Експорт GEDCOM')}
            className={`hidden sm:flex p-1.5 sm:p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
              theme.category === 'dark'
                ? 'hover:bg-white/10 text-emerald-400'
                : 'hover:bg-black/10 text-emerald-600'
            }`}
            title="Імпорт / Експорт GEDCOM та бази даних"
          >
            <Upload className="w-4 h-4" />
          </button>

          {/* Mobile Secondary Actions More Menu (Only on small screens < sm) */}
          <div className="relative sm:hidden" ref={mobileMoreRef}>
            <button
              onClick={() => setShowMobileMore(!showMobileMore)}
              className="p-1.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-[#B88E3E] transition-colors shrink-0 cursor-pointer"
              title="Додаткові дії"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMobileMore && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowMobileMore(false)} 
                />
                <div className={`absolute top-full right-0 mt-2 w-48 rounded-xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl p-1.5 z-50 space-y-1 ${theme.cardTitle}`}>
                  <button
                    onClick={() => {
                      setShowMobileMore(false);
                      setShowThemeModal(true);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
                  >
                    <Palette className="w-3.5 h-3.5 text-[#B88E3E]" />
                    <span>Палітра тем</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMobileMore(false);
                      if (isWhitelisted) {
                        setShowGedcomModal(true);
                      } else {
                        openAuthModal('Імпорт / Експорт GEDCOM');
                      }
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-500" />
                    <span>GEDCOM імпорт/експорт</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Pending Requests Badge for Admin */}
          {(isAdmin || currentUser?.role === 'admin') && pendingRequestsCount > 0 && (
            <button
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30 transition-colors animate-pulse shrink-0 cursor-pointer"
              title={`Є нові вхідні заявки на доступ (${pendingRequestsCount}). Натисніть для перегляду в Налаштуваннях`}
            >
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] font-mono px-1 py-0.2 rounded-full bg-amber-500 text-white leading-tight">
                {pendingRequestsCount}
              </span>
            </button>
          )}

          {/* Add Person Button - Icon Only */}
          <button
            onClick={isWhitelisted ? onOpenAddPerson : () => openAuthModal('Додавання особи')}
            id="add-person-btn"
            className={`p-1.5 sm:p-2 ${theme.accentBtn} ${theme.accentBtnText} font-medium rounded-xl text-xs transition-colors shadow-sm shrink-0 cursor-pointer ${!isWhitelisted ? 'opacity-90' : ''}`}
            title={!isWhitelisted ? 'Для редагування надішліть запит на доступ або увійдіть' : 'Додати особу'}
          >
            {isWhitelisted ? <UserPlus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>

          {/* Sign Out / Lock Session Button */}
          {isWhitelisted && (
            <button
              onClick={() => logout()}
              className="p-1.5 sm:p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs transition-colors shrink-0 cursor-pointer"
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

      {showGlobalSearchModal && (
        <GlobalSearchModal
          isOpen={showGlobalSearchModal}
          onClose={() => setShowGlobalSearchModal(false)}
          onInspectPerson={onInspectPerson}
        />
      )}
    </>
  );
};
