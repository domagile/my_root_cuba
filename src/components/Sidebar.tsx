import React, { useState } from 'react';
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
  CalendarDays, 
  CheckSquare, 
  Bookmark, 
  Lightbulb, 
  Settings, 
  FolderTree, 
  ShieldCheck, 
  Sparkles, 
  PanelLeftClose, 
  PanelLeftOpen, 
  FlaskConical,
  X
} from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { useGenealogyStore } from '../stores/useGenealogyStore';
import { NavigationTab, ViewMode } from '../types';
import { getThemeConfig } from '../utils/theme';

export const Sidebar: React.FC = () => {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const rodovidView = useUIStore((s) => s.rodovidView);
  const setRodovidView = useUIStore((s) => s.setRodovidView);
  const isMobileMenuOpen = useUIStore((s) => s.isMobileMenuOpen);
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);
  const themePalette = useUIStore((s) => s.themePalette);
  const personsCount = useGenealogyStore((s) => s.persons.length);
  const theme = getThemeConfig(themePalette);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const rodovidItems: { id: ViewMode; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'tree', label: 'Дерево', icon: GitFork },
    { id: 'fan', label: 'Віяло (Кругове)', icon: PieChart },
    { id: 'persons', label: `Особи (${personsCount})`, icon: Users },
    { id: 'families', label: "Сім'ї", icon: HeartHandshake },
    { id: 'timeline', label: 'Хроніка', icon: Calendar },
    { id: 'places', label: 'Місця', icon: MapPin },
    { id: 'sources', label: 'Архів джерел', icon: BookOpen },
    { id: 'kinship', label: 'Спорідненість', icon: Compass },
    { id: 'stats', label: 'Статистика', icon: BarChart3 },
    { id: 'reports', label: 'Звіти', icon: FileText }
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

  const handleRodovidClick = (viewId: ViewMode) => {
    setActiveTab('tree');
    setRodovidView(viewId);
    setMobileMenuOpen(false);
  };

  const handleNavTabClick = (tabId: NavigationTab) => {
    setActiveTab(tabId);
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

      {/* 2. Responsive Sidebar / Mobile Drawer */}
      <aside 
        id="app-sidebar" 
        className={`
          fixed md:relative top-0 bottom-0 left-0 z-50 md:z-auto
          ${isCollapsed ? 'md:w-16' : 'md:w-64'} 
          w-72 max-w-[85vw]
          ${theme.sidebarBg} ${theme.sidebarText} 
          flex flex-col h-full border-r ${theme.sidebarBorder} select-none flex-shrink-0 
          transition-transform md:transition-all duration-300
          ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Brand Header & Toggle */}
        <div className={`p-4 border-b ${theme.sidebarBorder} flex items-center justify-between`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-[#B88E3E]/20 border border-[#B88E3E]/40 flex items-center justify-center text-[#B88E3E] shrink-0">
              <FolderTree className="w-5 h-5" />
            </div>
            {(!isCollapsed || isMobileMenuOpen) && (
              <div className="whitespace-nowrap overflow-hidden">
                <h1 className="font-semibold text-base leading-tight tracking-wide">Родовід</h1>
                <p className="text-[11px] opacity-75">Генеалогія & Архіви</p>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`hidden md:flex p-1.5 rounded-lg ${theme.sidebarHover} transition-colors text-[#B88E3E] shrink-0 ml-1 cursor-pointer`}
            title={isCollapsed ? 'Розгорнути панель вкладок' : 'Згорнути панель вкладок'}
          >
            {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>

          {/* Mobile Close Button */}
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className={`md:hidden p-2 rounded-lg ${theme.sidebarHover} text-neutral-400 hover:text-white cursor-pointer`}
            title="Закрити меню"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
          {/* Section 1: Родовід (Інструменти родинного дерева) */}
          <div className="space-y-1">
            {(!isCollapsed || isMobileMenuOpen) && (
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#B88E3E] opacity-90 flex items-center justify-between">
                <span>Родовід</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#B88E3E]/15 font-mono">{rodovidItems.length}</span>
              </div>
            )}
            {rodovidItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === 'tree' && rodovidView === item.id;
              return (
                <button
                  key={`rodovid-${item.id}`}
                  id={`nav-btn-rodovid-${item.id}`}
                  onClick={() => handleRodovidClick(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${isCollapsed ? 'md:justify-center md:px-0' : 'gap-3 px-3'} gap-3 px-3 py-2 rounded-xl text-xs md:text-sm font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? theme.sidebarActiveNav
                      : `${theme.sidebarText} ${theme.sidebarHover}`
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#B88E3E]' : 'text-emerald-500'}`} />
                  <span className={`truncate ${isCollapsed ? 'md:hidden' : 'block'}`}>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Section 2: Дослідження та Докази */}
          <div className="space-y-1 pt-2 border-t border-white/5">
            {(!isCollapsed || isMobileMenuOpen) && (
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 opacity-90">
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
                  onClick={() => handleNavTabClick(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${isCollapsed ? 'md:justify-center md:px-0' : 'gap-3 px-3'} gap-3 px-3 py-2 rounded-xl text-xs md:text-sm font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? theme.sidebarActiveNav
                      : `${theme.sidebarText} ${theme.sidebarHover}`
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0 text-[#B88E3E]" />
                  <span className={`truncate ${isCollapsed ? 'md:hidden' : 'block'}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Footer info & settings */}
        <div className={`p-3 border-t ${theme.sidebarBorder} flex items-center ${isCollapsed ? 'md:justify-center' : 'justify-between'} justify-between text-xs`}>
          <div className={`flex items-center gap-2 opacity-80 ${isCollapsed ? 'md:hidden' : 'flex'}`}>
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-[11px] truncate">Осіб у базі ({personsCount})</span>
          </div>
          <button
            onClick={() => handleNavTabClick('settings')}
            className={`p-2 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-[#B88E3E]/20 text-[#B88E3E]' : theme.sidebarHover} cursor-pointer flex items-center gap-2`}
            title="Налаштування"
          >
            <Settings className="w-4 h-4" />
            {(!isCollapsed || isMobileMenuOpen) && <span className="text-[11px]">Налаштування</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
