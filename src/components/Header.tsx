import React, { useState } from 'react';
import { Search, UserPlus, Palette, LogOut, Bell, Menu, Sun, Moon } from 'lucide-react';
import { useGenealogy, useUIStore } from '../context/GenealogyContext';
import { useAuthStore } from '../stores/useAuthStore';
import { ThemePalette } from '../types';
import { THEME_CONFIGS, getThemeConfig } from '../utils/theme';

interface HeaderProps {
  onOpenAddPerson: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAddPerson }) => {
  const { 
    searchQuery, 
    setSearchQuery, 
    persons, 
    metricRecords, 
    themePalette, 
    setThemePalette,
    setActiveTab
  } = useGenealogy();

  const isMobileMenuOpen = useUIStore((s) => s.isMobileMenuOpen);
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);

  const { currentUser, accessRequests, logout } = useAuthStore();
  const theme = getThemeConfig(themePalette);

  const pendingRequestsCount = accessRequests.filter((r) => r.status === 'pending').length;

  const [showThemeModal, setShowThemeModal] = useState(false);

  const themeList = Object.values(THEME_CONFIGS);
  const lightThemes = themeList.filter(t => t.category === 'light');
  const darkThemes = themeList.filter(t => t.category === 'dark');

  const toggleLightDarkQuick = () => {
    if (theme.category === 'light') {
      setThemePalette('dark-emerald');
    } else {
      setThemePalette('light-parchment');
    }
  };

  return (
    <>
      <header id="app-header" className={`h-16 ${theme.headerBg} border-b ${theme.headerBorder} ${theme.headerText} px-3 md:px-6 flex items-center justify-between gap-2 md:gap-4 flex-shrink-0 transition-colors duration-300`}>
        {/* Mobile Hamburger Menu Toggle */}
        <button
          id="mobile-drawer-toggle"
          onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 rounded-lg text-[#B88E3E] hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          title="Відкрити навігаційне меню"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search Input */}
        <div className="relative flex-1 max-w-[260px] md:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Пошук особи..."
            className={`w-full pl-9 pr-3 py-1.5 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs md:text-sm ${theme.inputText} placeholder-opacity-60 focus:outline-none focus:border-[#B88E3E] transition-colors`}
          />
        </div>

        {/* Quick Stats Badges */}
        <div className="hidden lg:flex items-center gap-4 text-xs opacity-80">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Cloud Firestore: <strong>Синхронізовано</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#B88E3E]"></span>
            <span>Дерево: <strong className="font-semibold">{persons.length}</strong> осіб</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#52C480]"></span>
            <span>Метрики: <strong className="font-semibold">{metricRecords.length}</strong> збережено</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 md:gap-2.5">
          {/* Theme Palette Toggle Button */}
          <button
            onClick={() => setShowThemeModal(true)}
            className="p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-[#B88E3E] text-xs transition-colors shrink-0 cursor-pointer"
            title="Змінити тему оформлення"
          >
            <Palette className="w-4 h-4" />
          </button>

          {/* Pending Requests Badge for Admin */}
          {currentUser?.role === 'admin' && pendingRequestsCount > 0 && (
            <button
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30 transition-colors animate-pulse"
              title="Є нові вхідні запити на доступ"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Запити ({pendingRequestsCount})</span>
              <span className="sm:hidden font-mono">{pendingRequestsCount}</span>
            </button>
          )}

          {/* User Role & Email Badge */}
          {currentUser && (
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs">
              <div className="w-6 h-6 rounded-full bg-[#B88E3E]/20 text-[#B88E3E] flex items-center justify-center font-bold text-[11px]">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="text-left">
                <div className="text-[11px] font-bold leading-tight truncate max-w-[120px]">
                  {currentUser.email.split('@')[0]}
                </div>
                <div className="text-[9px] text-[#B88E3E] uppercase font-bold tracking-wider">
                  {currentUser.role === 'admin' ? 'Адміністратор' : currentUser.role === 'editor' ? 'Редактор' : currentUser.role === 'researcher' ? 'Дослідник' : 'Переглядач'}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={onOpenAddPerson}
            id="add-person-btn"
            className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 ${theme.accentBtn} ${theme.accentBtnText} font-medium rounded-lg text-xs transition-colors shadow-sm shrink-0 cursor-pointer`}
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Додати особу</span>
          </button>

          {/* Sign Out / Lock Session Button */}
          <button
            onClick={() => logout()}
            className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs transition-colors shrink-0 cursor-pointer"
            title="Вийти з облікового запису / Заблокувати сесію"
          >
            <LogOut className="w-4 h-4" />
          </button>
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
    </>
  );
};
