import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Building2, 
  MapPin, 
  BookOpen, 
  Sparkles, 
  Settings, 
  LayoutDashboard,
  Layers,
  ChevronRight
} from 'lucide-react';
import { NyshporkaTab } from './types';
import { NyshporkaDashboard } from './NyshporkaDashboard';
import { NyshporkaViewer } from './NyshporkaViewer';
import { NyshporkaCatalog } from './NyshporkaCatalog';
import { NyshporkaGazetteer } from './NyshporkaGazetteer';
import { NyshporkaSearch } from './NyshporkaSearch';
import { NyshporkaReading } from './NyshporkaReading';
import { NyshporkaLibrary } from './NyshporkaLibrary';
import { NyshporkaProfile } from './NyshporkaProfile';

interface NyshporkaAppProps {
  theme: any;
}

export const NyshporkaApp: React.FC<NyshporkaAppProps> = ({ theme }) => {
  const [activeTab, setActiveTab] = useState<NyshporkaTab>('dashboard');
  const [activeViewerFrame, setActiveViewerFrame] = useState<string>('0001');
  const [activeViewerLine, setActiveViewerLine] = useState<number | null>(null);

  const navItems: Array<{ id: NyshporkaTab; label: string; icon: any }> = [
    { id: 'dashboard', label: 'Огляд', icon: LayoutDashboard },
    { id: 'viewer', label: 'Гортач сканів', icon: FileText },
    { id: 'reading', label: 'ШІ-читання', icon: Sparkles },
    { id: 'search', label: 'Пошук у скорописі', icon: Search },
    { id: 'catalog', label: 'Каталог архівів', icon: Building2 },
    { id: 'gazetteer', label: 'Газетир сіл', icon: MapPin },
    { id: 'library', label: 'Бібліотека', icon: BookOpen },
    { id: 'profile', label: 'Профіль роду', icon: Settings }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Sub-navigation bar inside Nyshporka */}
      <div className={`p-2 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-xs flex items-center justify-between gap-2 overflow-x-auto select-none`}>
        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-amber-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Small repository link info */}
        <div className="hidden xl:flex items-center gap-2 pr-3 text-[11px] text-neutral-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Nyshporka Engine Active</span>
        </div>
      </div>

      {/* Render Active Tab */}
      {activeTab === 'dashboard' && (
        <NyshporkaDashboard 
          onNavigate={(tab) => setActiveTab(tab)} 
          theme={theme} 
        />
      )}

      {activeTab === 'viewer' && (
        <NyshporkaViewer 
          theme={theme}
          initialFrameId={activeViewerFrame}
          initialLineIdx={activeViewerLine}
          onNavigateToReading={() => setActiveTab('reading')}
        />
      )}

      {activeTab === 'reading' && (
        <NyshporkaReading 
          theme={theme} 
        />
      )}

      {activeTab === 'search' && (
        <NyshporkaSearch 
          theme={theme}
          onOpenViewerWithFrame={(frameId, lineIdx) => {
            setActiveViewerFrame(frameId);
            setActiveViewerLine(lineIdx ?? null);
            setActiveTab('viewer');
          }}
        />
      )}

      {activeTab === 'catalog' && (
        <NyshporkaCatalog 
          theme={theme}
          onSelectCase={() => setActiveTab('library')}
        />
      )}

      {activeTab === 'gazetteer' && (
        <NyshporkaGazetteer 
          theme={theme}
          onOpenViewer={() => setActiveTab('viewer')}
        />
      )}

      {activeTab === 'library' && (
        <NyshporkaLibrary 
          theme={theme}
          onOpenCase={() => setActiveTab('viewer')}
          onNavigateToCatalog={() => setActiveTab('catalog')}
        />
      )}

      {activeTab === 'profile' && (
        <NyshporkaProfile 
          theme={theme} 
        />
      )}
    </div>
  );
};
