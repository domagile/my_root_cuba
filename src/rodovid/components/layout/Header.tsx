import React, { useState, useRef, useEffect } from 'react';
import {
  GitFork,
  PieChart,
  Users,
  HeartHandshake,
  Calendar,
  MapPin,
  BookOpen,
  Compass,
  BarChart3,
  FileText,
  Upload,
  UserPlus,
  TreeDeciduous,
  ChevronDown,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { ViewMode } from '../../types/genealogy';

interface HeaderProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onOpenGedcomModal: () => void;
  onOpenAddPersonModal: () => void;
  databaseTitle: string;
  totalPersonsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  onOpenGedcomModal,
  onOpenAddPersonModal,
  totalPersonsCount
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gramps_theme_mode');
      return saved !== null ? saved === 'dark' : true;
    } catch {
      return true;
    }
  });
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    try {
      localStorage.setItem('gramps_theme_mode', isDarkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDarkMode]);

  const navItems: Array<{ id: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'tree', label: 'Дерево', icon: GitFork },
    { id: 'fan', label: 'Віяло', icon: PieChart },
    { id: 'persons', label: `Особи (${totalPersonsCount})`, icon: Users },
    { id: 'families', label: "Сім'ї", icon: HeartHandshake },
    { id: 'timeline', label: 'Хроніка', icon: Calendar },
    { id: 'places', label: 'Місця', icon: MapPin },
    { id: 'sources', label: 'Архів', icon: BookOpen },
    { id: 'kinship', label: 'Спорідненість', icon: Compass },
    { id: 'stats', label: 'Статистика', icon: BarChart3 },
    { id: 'reports', label: 'Звіти', icon: FileText }
  ];

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Primary items visible on desktop (items 0 to 5), remaining in "Більше" dropdown on smaller screens
  const primaryNav = navItems.slice(0, 6);
  const secondaryNav = navItems.slice(6);
  const isSecondaryActive = secondaryNav.some((item) => item.id === currentView);

  return (
    <header className="bg-slate-900 text-slate-100 border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="w-full px-3 sm:px-4 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Zone: Icon only as requested */}
        <button
          onClick={() => {
            onViewChange('tree');
            setIsMobileNavOpen(false);
          }}
          className="w-9 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 flex items-center justify-center text-white shadow-sm shrink-0 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
          title="Gramps Web — Повернутися до дерева"
          aria-label="Gramps Web — Головна"
        >
          <TreeDeciduous className="w-5 h-5" />
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 py-1">
          {/* Primary items */}
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id);
                  setIsMoreMenuOpen(false);
                }}
                className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Secondary items visible directly on 2xl screens or in dropdown */}
          <div className="hidden 2xl:flex items-center gap-1">
            {secondaryNav.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* "Інструменти" Dropdown for standard screens */}
          <div className="relative 2xl:hidden" ref={moreMenuRef}>
            <button
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isSecondaryActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Додаткові інструменти та розділи"
              aria-expanded={isMoreMenuOpen}
            >
              <span>{isSecondaryActive ? (secondaryNav.find((i) => i.id === currentView)?.label || 'Інструменти') : 'Інструменти'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMoreMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isMoreMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3.5 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800 mb-1">
                  Додаткові інструменти
                </div>
                {secondaryNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onViewChange(item.id);
                        setIsMoreMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs text-left transition-colors ${
                        isActive
                          ? 'bg-emerald-600/90 text-white font-semibold'
                          : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Action Zone: Theme Toggle, GEDCOM, Add Person & Mobile menu toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Night / Day mode toggle */}
          <button
            onClick={() => setIsDarkMode((prev) => !prev)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
            title={isDarkMode ? 'Увімкнути денний режим' : 'Увімкнути нічний режим'}
            aria-label="Перемикач теми"
          >
            {isDarkMode ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
            )}
          </button>

          <button
            onClick={onOpenGedcomModal}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap"
            title="Імпорт / Експорт GEDCOM та резервні копії"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">GEDCOM / База</span>
          </button>

          <button
            onClick={onOpenAddPersonModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-colors whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Додати</span>
          </button>

          {/* Mobile navigation toggle button */}
          <button
            onClick={() => setIsMobileNavOpen((prev) => !prev)}
            className="md:hidden p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Меню інструментів"
            aria-label="Відкрити меню"
          >
            {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu with ALL 11 tools */}
      {isMobileNavOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900/98 px-3 py-3 shadow-2xl animate-in slide-in-from-top duration-200">
          <div className="grid grid-cols-2 gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onViewChange(item.id);
                    setIsMobileNavOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};

