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
  FlaskConical
} from 'lucide-react';
import { useGenealogy } from '../context/GenealogyContext';
import { NavigationTab } from '../types';
import { getThemeConfig } from '../utils/theme';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, persons, themePalette } = useGenealogy();
  const theme = getThemeConfig(themePalette);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems: { id: NavigationTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'tree', label: 'Родовід', icon: GitFork },
    { id: 'persons', label: 'Фігуранти справи', icon: Users },
    { id: 'timeline', label: 'Хроніка', icon: Clock },
    { id: 'experiment', label: 'Експеримент', icon: FlaskConical },
    { id: 'ai-analysis', label: 'Слідчий AI аналіз', icon: Sparkles },
    { id: 'research', label: 'Детективні розкопки', icon: Compass },
    { id: 'documents', label: 'Речові докази', icon: FileText },
    { id: 'matrix', label: 'Літопис подій', icon: CalendarDays },
    { id: 'notes', label: 'Чернетки', icon: CheckSquare },
    { id: 'findings', label: 'Зачіпки', icon: Bookmark },
    { id: 'hypotheses', label: 'Підозри', icon: Lightbulb }
  ];

  return (
    <aside 
      id="app-sidebar" 
      className={`${isCollapsed ? 'w-16' : 'w-64'} ${theme.sidebarBg} ${theme.sidebarText} flex flex-col h-screen border-r ${theme.sidebarBorder} select-none flex-shrink-0 transition-all duration-300 relative`}
    >
      {/* Brand Header & Toggle */}
      <div className={`p-4 border-b ${theme.sidebarBorder} flex items-center justify-between`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-[#B88E3E]/20 border border-[#B88E3E]/40 flex items-center justify-center text-[#B88E3E] shrink-0">
            <FolderTree className="w-5 h-5" />
          </div>
          {!isCollapsed && (
            <div className="whitespace-nowrap overflow-hidden">
              <h1 className="font-semibold text-base leading-tight tracking-wide">Родовід</h1>
              <p className="text-[11px] opacity-75">Генеалогія & Архіви</p>
            </div>
          )}
        </div>

        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1.5 rounded-lg ${theme.sidebarHover} transition-colors text-[#B88E3E] shrink-0 ml-1`}
          title={isCollapsed ? 'Розгорнути панель вкладок' : 'Згорнути панель вкладок'}
        >
          {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
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
              onClick={() => setActiveTab(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3.5 px-3.5'} py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? theme.sidebarActiveNav
                  : `${theme.sidebarText} ${theme.sidebarHover}`
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className={`p-3 border-t ${theme.sidebarBorder} flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} text-xs`}>
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-2 opacity-80">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-[11px]">Осіб у родоводі ({persons.length})</span>
            </div>
            <button
              onClick={() => setActiveTab('settings')}
              className={`p-1.5 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-[#B88E3E]/20 text-[#B88E3E]' : theme.sidebarHover}`}
              title="Перейти до Налаштувань"
            >
              <Settings className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={() => setActiveTab('settings')}
            className={`p-1.5 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-[#B88E3E]/20 text-[#B88E3E]' : theme.sidebarHover}`}
            title="Налаштування"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};
