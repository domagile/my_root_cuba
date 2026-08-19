import React from 'react';
import { 
  GitFork, 
  Users, 
  Sparkles, 
  Clock, 
  Menu,
  FileText,
  Compass
} from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { NavigationTab } from '../types';
import { getThemeConfig } from '../utils/theme';

export const BottomNav: React.FC = () => {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const isMobileMenuOpen = useUIStore((s) => s.isMobileMenuOpen);
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);

  const primaryMobileTabs: { id: NavigationTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'tree', label: 'Родовід', icon: GitFork },
    { id: 'persons', label: 'Особи', icon: Users },
    { id: 'ai-analysis', label: 'AI Слідчий', icon: Sparkles },
    { id: 'timeline', label: 'Хроніка', icon: Clock },
    { id: 'documents', label: 'Докази', icon: FileText }
  ];

  return (
    <nav 
      id="mobile-bottom-nav"
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 border-t ${theme.headerBorder} ${theme.headerBg} flex items-center justify-around px-2 shadow-lg backdrop-blur-md transition-colors duration-300`}
    >
      {primaryMobileTabs.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id && !isMobileMenuOpen;
        const isAi = item.id === 'ai-analysis';

        return (
          <button
            key={item.id}
            id={`bottom-nav-${item.id}`}
            onClick={() => {
              setMobileMenuOpen(false);
              setActiveTab(item.id);
            }}
            className={`flex flex-col items-center justify-center min-w-[56px] h-12 rounded-xl transition-all relative ${
              isActive 
                ? 'text-[#B88E3E] font-bold' 
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <div className={`relative p-1 rounded-lg ${isActive ? 'bg-[#B88E3E]/15' : ''}`}>
              <Icon className={`w-5 h-5 ${isAi && !isActive ? 'text-[#B88E3E]' : ''}`} />
              {isAi && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#B88E3E] animate-pulse" />
              )}
            </div>
            <span className="text-[10px] leading-tight tracking-tight mt-0.5 truncate max-w-[58px]">
              {item.label}
            </span>
          </button>
        );
      })}

      {/* Menu / More Drawer button */}
      <button
        id="bottom-nav-more"
        onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
        className={`flex flex-col items-center justify-center min-w-[56px] h-12 rounded-xl transition-all ${
          isMobileMenuOpen 
            ? 'text-[#B88E3E] font-bold bg-[#B88E3E]/15' 
            : 'text-neutral-400 hover:text-neutral-200'
        }`}
      >
        <div className="p-1">
          <Menu className="w-5 h-5" />
        </div>
        <span className="text-[10px] leading-tight tracking-tight mt-0.5">
          Меню
        </span>
      </button>
    </nav>
  );
};
