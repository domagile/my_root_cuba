import React, { useState } from 'react';
import { 
  GitFork, 
  Compass, 
  FileText, 
  Inbox, 
  CalendarDays, 
  CheckSquare, 
  Bookmark, 
  Lightbulb, 
  Users, 
  Settings, 
  FolderTree, 
  ShieldCheck, 
  Sparkles, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Clock, 
  FlaskConical,
  X
} from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { useGenealogyStore } from '../stores/useGenealogyStore';
import { NavigationTab } from '../types';
import { getThemeConfig } from '../utils/theme';

export const Sidebar: React.FC = () => {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const isMobileMenuOpen = useUIStore((s) => s.isMobileMenuOpen);
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);
  const themePalette = useUIStore((s) => s.themePalette);
  const personsCount = useGenealogyStore((s) => s.persons.length);
  const theme = getThemeConfig(themePalette);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems: { id: NavigationTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'tree', label: 'Родовід', icon: GitFork },
    { id: 'persons', label: 'Фігуранти справи', icon: Users },
    { id: 'timeline', label: 'Хроніка', icon: Clock },
    { id: 'ai-analysis', label: 'Слідчий AI аналіз', icon: Sparkles },
    { id: 'documents', label: 'Речові докази', icon: FileText },
    { id: 'research', label: 'Детективні розкопки', icon: Compass },
    { id: 'matrix', label: 'Літопис подій', icon: CalendarDays },
    { id: 'notes', label: 'Чернетки & Завдання', icon: CheckSquare },
    { id: 'findings', label: 'Зачіпки', icon: Bookmark },
    { id: 'hypotheses', label: 'Підозри & Гіпотези', icon: Lightbulb },
    { id: 'experiment', label: 'Експеримент', icon: FlaskConical }
  ];

  const handleTabClick = (tabId: NavigationTab) => {
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
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-btn-${item.id}`}
                onClick={() => handleTabClick(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center ${isCollapsed ? 'md:justify-center md:px-0' : 'gap-3.5 px-3.5'} gap-3.5 px-3.5 py-3 md:py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? theme.sidebarActiveNav
                    : `${theme.sidebarText} ${theme.sidebarHover}`
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0 text-[#B88E3E]" />
                <span className={`truncate ${isCollapsed ? 'md:hidden' : 'block'}`}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer info & settings */}
        <div className={`p-3 border-t ${theme.sidebarBorder} flex items-center ${isCollapsed ? 'md:justify-center' : 'justify-between'} justify-between text-xs`}>
          <div className={`flex items-center gap-2 opacity-80 ${isCollapsed ? 'md:hidden' : 'flex'}`}>
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-[11px] truncate">Осіб у родоводі ({personsCount})</span>
          </div>
          <button
            onClick={() => handleTabClick('settings')}
            className={`p-2 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-[#B88E3E]/20 text-[#B88E3E]' : theme.sidebarHover} cursor-pointer`}
            title="Налаштування"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
};
