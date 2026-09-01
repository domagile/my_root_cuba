import React, { useState, useRef, useEffect } from 'react';
import {
  GitFork,
  PieChart,
  Users,
  Calendar,
  MapPin,
  BookOpen,
  Compass,
  BarChart3,
  FileText,
  ShieldAlert,
  Upload,
  UserPlus,
  TreeDeciduous,
  ChevronDown,
  Menu,
  Sun,
  Moon,
  Share2,
  Lock,
  LogOut,
  Eye,
  ShieldCheck
} from 'lucide-react';
import { ViewMode } from '../../types/genealogy';
import { useUIStore } from '../../../stores/useUIStore';
import { getThemeConfig } from '../../../utils/theme';
import { AuthUser } from '../../../types';

import { TreeIcon, FanIcon } from '../../../components/common/GenealogyIcons';

interface HeaderProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onOpenGedcomModal: () => void;
  onOpenAddPersonModal: () => void;
  onOpenShareModal?: () => void;
  databaseTitle: string;
  totalPersonsCount: number;
  isReadOnly?: boolean;
  onOpenAuthModal?: () => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  onOpenGedcomModal,
  onOpenAddPersonModal,
  onOpenShareModal,
  totalPersonsCount,
  isReadOnly = false,
  onOpenAuthModal,
  currentUser,
  onLogout
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const isMobileMenuOpen = useUIStore((s) => s.isMobileMenuOpen);
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);
  const themePalette = useUIStore((s) => s.themePalette);
  const setThemePalette = useUIStore((s) => s.setThemePalette);
  const theme = getThemeConfig(themePalette);
  const isDarkMode = theme.category === 'dark';

  const toggleThemeMode = () => {
    if (isDarkMode) {
      setThemePalette('classic');
    } else {
      setThemePalette('dark');
    }
  };

  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [isDarkMode]);

  const allNavItems: Array<{ id: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'tree', label: 'Дерево', icon: TreeIcon },
    { id: 'fan', label: 'Віяло', icon: FanIcon },
    { id: 'persons', label: `Особи (${totalPersonsCount})`, icon: Users },
    { id: 'timeline', label: 'Хроніка', icon: Calendar },
    { id: 'places', label: 'Місця', icon: MapPin },
    { id: 'sources', label: 'Архів', icon: BookOpen },
    { id: 'kinship', label: 'Спорідненість', icon: Compass },
    { id: 'stats', label: 'Статистика', icon: BarChart3 },
    { id: 'reports', label: 'Звіти', icon: FileText },
    { id: 'conflicts', label: 'Аудит', icon: ShieldAlert }
  ];

  // If in read-only / guest mode, restrict navigation ONLY to Tree and Fan!
  const navItems = isReadOnly
    ? [
        { id: 'tree' as ViewMode, label: 'Дерево', icon: TreeIcon },
        { id: 'fan' as ViewMode, label: 'Віяло', icon: FanIcon }
      ]
    : allNavItems;

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

  const primaryNav = navItems.slice(0, 6);
  const secondaryNav = navItems.slice(6);
  const isSecondaryActive = secondaryNav.some((item) => item.id === currentView);

  return (
    <header className={`${theme.headerBg} ${theme.headerBorder} border-b sticky top-0 z-30 shadow-xs transition-colors duration-200`}>
      <div className="w-full px-3 sm:px-4 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Zone: Icon and Title */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              onViewChange('tree');
              setMobileMenuOpen(false);
            }}
            className="w-9 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 flex items-center justify-center text-white shadow-xs shrink-0 transition-all focus:outline-hidden focus:ring-2 focus:ring-emerald-400 cursor-pointer"
            title="Gramps Web — Повернутися до дерева"
            aria-label="Gramps Web — Головна"
          >
            <TreeDeciduous className="w-5 h-5" />
          </button>

          {isReadOnly && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-semibold">
              <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Тільки перегляд</span>
            </div>
          )}
        </div>

        {/* Desktop Navigation */}
        <nav className="flex items-center gap-1 py-1">
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
                className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : isDarkMode
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                    : 'text-neutral-700 hover:text-neutral-950 hover:bg-neutral-200/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Secondary items visible directly on 2xl screens or in dropdown */}
          {!isReadOnly && secondaryNav.length > 0 && (
            <>
              <div className="hidden 2xl:flex items-center gap-1">
                {secondaryNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onViewChange(item.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isDarkMode
                          ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                          : 'text-neutral-700 hover:text-neutral-950 hover:bg-neutral-200/80'
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
                  className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSecondaryActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isDarkMode
                      ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                      : 'text-neutral-700 hover:text-neutral-950 hover:bg-neutral-200/80'
                  }`}
                  title="Додаткові інструменти та розділи"
                  aria-expanded={isMoreMenuOpen}
                >
                  <span>{isSecondaryActive ? (secondaryNav.find((i) => i.id === currentView)?.label || 'Інструменти') : 'Інструменти'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMoreMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isMoreMenuOpen && (
                  <div className={`absolute right-0 top-full mt-2 w-56 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-neutral-200 shadow-xl'} border rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150`}>
                    <div className={`px-3.5 py-1 text-[10px] uppercase font-bold tracking-wider ${isDarkMode ? 'text-slate-400 border-slate-800' : 'text-neutral-500 border-neutral-200'} border-b mb-1`}>
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
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs text-left transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-emerald-600 text-white font-semibold'
                              : isDarkMode
                              ? 'text-slate-200 hover:bg-slate-800 hover:text-white'
                              : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                          }`}
                        >
                          <Icon className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </nav>

        {/* Action Zone: Theme Toggle, Auth, GEDCOM, Add Person */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Night / Day mode toggle */}
          <button
            onClick={toggleThemeMode}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-md text-xs font-medium ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-300'
            } border transition-colors flex items-center gap-1.5 cursor-pointer`}
            title={isDarkMode ? 'Увімкнути денний / світлий режим' : 'Увімкнути нічний режим'}
            aria-label="Перемикач теми"
          >
            {isDarkMode ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-indigo-600" />
            )}
          </button>

          {/* Whitelist Login Button for Guests / Read-only users */}
          {isReadOnly && onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              className="p-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-colors shrink-0 cursor-pointer"
              title="Вхід за Білим списком для редагування"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}

          {/* Authenticated Admin / Editor Controls */}
          {!isReadOnly && currentUser && (
            <>
              <button
                onClick={onOpenGedcomModal}
                className={`p-2 rounded-lg text-xs font-medium ${
                  isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-300'
                } border transition-colors shrink-0 cursor-pointer`}
                title="Імпорт / Експорт GEDCOM та резервні копії"
              >
                <Upload className="w-4 h-4 text-emerald-500" />
              </button>

              {onOpenShareModal && (
                <button
                  onClick={onOpenShareModal}
                  className={`p-2 rounded-lg text-xs font-semibold ${
                    isDarkMode
                      ? 'bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 border-amber-500/40'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                  } border transition-colors shrink-0 cursor-pointer shadow-xs`}
                  title="Поділитися родоводом"
                >
                  <Share2 className="w-4 h-4 text-amber-500" />
                </button>
              )}

              <button
                onClick={onOpenAddPersonModal}
                className="p-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors shrink-0 cursor-pointer"
                title="Додати особу"
              >
                <UserPlus className="w-4 h-4" />
              </button>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs transition-colors shrink-0 cursor-pointer"
                  title="Вийти з облікового запису"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </>
          )}

          {/* Mobile navigation toggle button (if not in simple read-only) */}
          {!isReadOnly && (
            <button
              onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
              className={`md:hidden p-1.5 ${
                isDarkMode ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-neutral-700 hover:text-neutral-950 hover:bg-neutral-200'
              } rounded-lg transition-colors cursor-pointer`}
              title="Меню інструментів та родоводу"
              aria-label="Відкрити меню"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

