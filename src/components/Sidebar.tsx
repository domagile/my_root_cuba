/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  CalendarDays, 
  CheckSquare, 
  Bookmark, 
  Lightbulb, 
  Settings, 
  FolderTree, 
  ShieldCheck, 
  ShieldAlert,
  Sparkles, 
  PanelLeftClose, 
  PanelLeftOpen, 
  FlaskConical,
  X,
  ChevronLeft,
  Lock,
  KeyRound,
  Mail
} from 'lucide-react';
import { TreeIcon, FanIcon } from './common/GenealogyIcons';
import { useUIStore } from '../stores/useUIStore';
import { useGenealogyStore } from '../stores/useGenealogyStore';
import { useAuthStore } from '../stores/useAuthStore';
import { NavigationTab, ViewMode } from '../types';
import { getThemeConfig } from '../utils/theme';

export const Sidebar: React.FC = () => {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const rodovidView = useUIStore((s) => s.rodovidView);
  const setRodovidView = useUIStore((s) => s.setRodovidView);
  const isMobileMenuOpen = useUIStore((s) => s.isMobileMenuOpen);
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);
  const isSidebarVisible = useUIStore((s) => s.isSidebarVisible);
  const setSidebarVisible = useUIStore((s) => s.setSidebarVisible);
  const openAuthModal = useUIStore((s) => s.openAuthModal);
  const openContactModal = useUIStore((s) => s.openContactModal);
  const themePalette = useUIStore((s) => s.themePalette);
  const personsCount = useGenealogyStore((s) => s.persons.length);
  
  const currentUser = useAuthStore((s) => s.currentUser);
  const whitelist = useAuthStore((s) => s.whitelist);
  const accessRequests = useAuthStore((s) => s.accessRequests);
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

  const pendingRequestsCount = accessRequests.filter((r) => r.status === 'pending').length;

  const theme = getThemeConfig(themePalette);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const rodovidItems: { id: ViewMode; label: string; icon: React.FC<{ className?: string }>; isPublic?: boolean }[] = [
    { id: 'tree', label: 'Дерево', icon: TreeIcon, isPublic: true },
    { id: 'fan', label: 'Віяло (Кругове)', icon: FanIcon, isPublic: true },
    { id: 'persons', label: `Особи (${personsCount})`, icon: Users },
    { id: 'timeline', label: 'Хроніка', icon: Calendar },
    { id: 'places', label: 'Місця', icon: MapPin },
    { id: 'sources', label: 'Архів джерел', icon: BookOpen },
    { id: 'kinship', label: 'Спорідненість', icon: Compass },
    { id: 'stats', label: 'Статистика', icon: BarChart3 },
    { id: 'reports', label: 'Звіти', icon: FileText },
    { id: 'conflicts', label: 'Аудит & Дублікати', icon: ShieldAlert }
  ];

  const researchItems: { id: NavigationTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'ai-analysis', label: 'Слідчий AI аналіз', icon: Sparkles },
    { id: 'documents', label: 'Речові докази', icon: FileText },
    { id: 'research', label: 'Детективні розкопки', icon: Compass },
    { id: 'matrix', label: 'Літопис подій', icon: CalendarDays },
    { id: 'notes', label: 'Чернетки & Завдання', icon: CheckSquare },
    { id: 'findings', label: 'Зачіпки', icon: Bookmark },
    { id: 'hypotheses', label: 'Підозри & Гіпотези', icon: Lightbulb },
    { id: 'experiment', label: 'Експеримент', icon: FlaskConical }
  ];

  const handleRodovidClick = (item: { id: ViewMode; label: string; isPublic?: boolean }) => {
    if (!item.isPublic && !isWhitelisted) {
      openAuthModal(item.label);
      return;
    }
    setActiveTab('tree');
    setRodovidView(item.id);
    setMobileMenuOpen(false);
  };

  const handleNavTabClick = (item: { id: NavigationTab; label: string }) => {
    if (!isWhitelisted) {
      openAuthModal(item.label);
      return;
    }
    setActiveTab(item.id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* 1. Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        />
      )}

      {/* 2. Responsive Sidebar / Desktop Side Panel */}
      <aside 
        id="app-sidebar" 
        className={`
          fixed md:relative top-0 bottom-0 left-0 z-50 md:z-20
          ${isSidebarVisible ? (isCollapsed ? 'md:w-16' : 'md:w-64') : 'md:w-0 md:border-r-0 md:overflow-hidden md:p-0'} 
          w-72 max-w-[85vw]
          ${theme.sidebarBg} ${theme.sidebarText} 
          flex flex-col h-full border-r ${theme.sidebarBorder} select-none flex-shrink-0 
          transition-all duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : (isSidebarVisible ? '-translate-x-full md:translate-x-0' : '-translate-x-full')}
        `}
      >
        {/* Brand Header & Action Controls */}
        <div className={`p-3.5 border-b ${theme.sidebarBorder} flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-[#B88E3E]/20 border border-[#B88E3E]/40 flex items-center justify-center text-[#B88E3E] shrink-0">
              <FolderTree className="w-4 h-4" />
            </div>
            {(!isCollapsed || isMobileMenuOpen) && (
              <div className="whitespace-nowrap overflow-hidden">
                <h1 className="font-bold text-sm leading-tight tracking-wide">Родовід</h1>
                <p className="text-[10px] opacity-75">Генеалогія & Архіви</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop Collapse / Expand Button */}
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`hidden md:flex p-1.5 rounded-lg ${theme.sidebarHover} transition-colors text-[#B88E3E] shrink-0 cursor-pointer`}
              title={isCollapsed ? 'Розгорнути назви' : 'Згорнути до значків'}
            >
              {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>

            {/* Desktop Hide Panel Button */}
            <button 
              onClick={() => setSidebarVisible(false)}
              className={`hidden md:flex p-1.5 rounded-lg ${theme.sidebarHover} transition-colors text-neutral-400 hover:text-white shrink-0 cursor-pointer`}
              title="Сховати бічну панель"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Mobile Close Button */}
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className={`md:hidden p-1.5 rounded-lg ${theme.sidebarHover} text-neutral-400 hover:text-white cursor-pointer`}
              title="Закрити меню"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto scrollbar-thin">
          {/* Section 1: Родовід (Інструменти родинного дерева) */}
          <div className="space-y-1">
            {(!isCollapsed || isMobileMenuOpen) && isWhitelisted && (
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#B88E3E] opacity-90 flex items-center justify-between">
                <span>Родовід</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#B88E3E]/15 font-mono">{rodovidItems.length}</span>
              </div>
            )}
            {(isWhitelisted ? rodovidItems : rodovidItems.filter((i) => i.isPublic)).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === 'tree' && rodovidView === item.id;
              return (
                <button
                  key={`rodovid-${item.id}`}
                  id={`nav-btn-rodovid-${item.id}`}
                  onClick={() => handleRodovidClick(item)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${isCollapsed ? 'md:justify-center md:px-0' : 'gap-2.5 px-3'} gap-2.5 px-3 py-2 rounded-xl text-xs md:text-sm font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? theme.sidebarActiveNav
                      : `${theme.sidebarText} ${theme.sidebarHover}`
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#B88E3E]' : 'text-emerald-500'}`} />
                  <span className={`truncate flex-1 text-left ${isCollapsed ? 'md:hidden' : 'block'}`}>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Section 2: Дослідження та Докази (Only visible for whitelisted members) */}
          {isWhitelisted && (
            <div className="space-y-1 pt-2 border-t border-white/5">
              {(!isCollapsed || isMobileMenuOpen) && (
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 opacity-90 flex items-center justify-between">
                  <span>Дослідження & AI</span>
                </div>
              )}
              {researchItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={`research-${item.id}`}
                    id={`nav-btn-${item.id}`}
                    onClick={() => handleNavTabClick(item)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center ${isCollapsed ? 'md:justify-center md:px-0' : 'gap-2.5 px-3'} gap-2.5 px-3 py-2 rounded-xl text-xs md:text-sm font-medium transition-all duration-150 cursor-pointer ${
                      isActive
                        ? theme.sidebarActiveNav
                        : `${theme.sidebarText} ${theme.sidebarHover}`
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0 text-[#B88E3E]" />
                    <span className={`truncate flex-1 text-left ${isCollapsed ? 'md:hidden' : 'block'}`}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        {/* Contact Author Link */}
        <div className={`px-2 py-1.5 border-t ${theme.sidebarBorder} shrink-0`}>
          <button
            id="sidebar-contact-author-btn"
            onClick={() => openContactModal()}
            className={`w-full flex items-center ${isCollapsed ? 'md:justify-center px-0' : 'gap-2 px-2'} py-1.5 rounded-lg text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer`}
            title="Шукаєте спільних предків? Написати автору (domagile@gmail.com)"
          >
            <Mail className="w-4 h-4 shrink-0 text-emerald-500" />
            <div className={`text-left min-w-0 ${isCollapsed ? 'md:hidden' : 'block'}`}>
              <div className="text-[10px] opacity-70 leading-none">Зв'язок з автором:</div>
              <div className="text-[11px] font-mono font-semibold truncate text-emerald-700 dark:text-emerald-300">domagile@gmail.com</div>
            </div>
          </button>
        </div>

        {/* Footer info & settings */}
        <div className={`p-2.5 border-t ${theme.sidebarBorder} flex items-center ${isCollapsed ? 'md:justify-center' : 'justify-between'} justify-between text-xs shrink-0`}>
          <div className={`flex items-center gap-1.5 opacity-80 ${isCollapsed ? 'md:hidden' : 'flex'}`}>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="text-[11px] truncate">Осіб: {personsCount}</span>
          </div>
          {isWhitelisted ? (
            <button
              onClick={() => handleNavTabClick({ id: 'settings', label: 'Налаштування' })}
              className={`p-1.5 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-[#B88E3E]/20 text-[#B88E3E]' : theme.sidebarHover} cursor-pointer flex items-center gap-1.5 relative`}
              title={isAdmin && pendingRequestsCount > 0 ? `Налаштування (Є ${pendingRequestsCount} нових заявок)` : 'Налаштування'}
            >
              <Settings className="w-3.5 h-3.5" />
              {(!isCollapsed || isMobileMenuOpen) && <span className="text-[11px]">Налаштування</span>}
              {isAdmin && pendingRequestsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-mono text-[9px] font-bold leading-none animate-pulse">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => openAuthModal()}
              className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              title="Авторизуватися"
            >
              <KeyRound className="w-3 h-3 text-amber-400" />
              {(!isCollapsed || isMobileMenuOpen) && <span>Вхід</span>}
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
