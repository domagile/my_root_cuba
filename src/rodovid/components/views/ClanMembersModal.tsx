import React, { useState, useMemo } from 'react';
import {
  X,
  User,
  GitFork,
  Search,
  ExternalLink,
  MapPin,
  Calendar,
  Sparkles,
  Users
} from 'lucide-react';
import { TreeIcon } from '../../../components/common/GenealogyIcons';
import { Person } from '../../types/genealogy';
import { FanChartClan } from '../../utils/treeLayout';
import { getAhnentafelRelationTitle } from './FanChartView';

export interface ClanMemberItem {
  person: Person;
  isInFan: boolean;
  ahnentafelNumber?: number;
  generation?: number;
  kinshipTitle?: string;
}

export interface ClanMembersModalProps {
  clan: FanChartClan;
  members: ClanMemberItem[];
  canvasTheme?: 'parchment' | 'dark' | 'emerald' | 'slate' | string;
  onClose: () => void;
  onSelectPerson: (personId: string) => void;
  onChangeRoot?: (personId: string) => void;
  onSwitchToTree?: () => void;
}

export const ClanMembersModal: React.FC<ClanMembersModalProps> = ({
  clan,
  members,
  canvasTheme = 'parchment',
  onClose,
  onSelectPerson,
  onChangeRoot,
  onSwitchToTree
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'fan' | 'male' | 'female'>('all');

  const inFanCount = useMemo(() => members.filter((m) => m.isInFan).length, [members]);
  const maleCount = useMemo(
    () => members.filter((m) => m.person.gender === 'male' || m.person.gender === 'M').length,
    [members]
  );
  const femaleCount = useMemo(
    () => members.filter((m) => m.person.gender === 'female' || m.person.gender === 'F').length,
    [members]
  );

  const filteredMembers = useMemo(() => {
    return members.filter((item) => {
      const p = item.person;
      // Filter tab
      if (activeFilter === 'fan' && !item.isInFan) return false;
      if (activeFilter === 'male' && p.gender !== 'male' && p.gender !== 'M') return false;
      if (activeFilter === 'female' && p.gender !== 'female' && p.gender !== 'F') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const surname = (p.name?.surname || p.lastName || '').toLowerCase();
        const maiden = (p.name?.maidenName || p.maidenName || '').toLowerCase();
        const given = (p.name?.given || p.firstName || '').toLowerCase();
        const patronymic = (p.name?.patronymic || p.patronymic || '').toLowerCase();
        const birthY = String(p.birthYear || p.birthDate || '');
        const deathY = String(p.deathYear || p.deathDate || '');
        const place = (p.birthPlace || '').toLowerCase();

        return (
          surname.includes(q) ||
          maiden.includes(q) ||
          given.includes(q) ||
          patronymic.includes(q) ||
          birthY.includes(q) ||
          deathY.includes(q) ||
          place.includes(q)
        );
      }

      return true;
    });
  }, [members, activeFilter, searchQuery]);

  const isDark = canvasTheme !== 'parchment';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl border transition-all ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-neutral-200 text-neutral-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className={`p-4 border-b flex items-center justify-between gap-3 ${
            isDark ? 'border-slate-800 bg-slate-900/50' : 'border-neutral-200 bg-neutral-50/70'
          } rounded-t-2xl`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="w-5 h-5 rounded-md shrink-0 shadow-sm ring-2 ring-white/20"
              style={{ backgroundColor: clan.color }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg leading-tight truncate">{clan.name}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium shrink-0 ${
                    isDark ? 'bg-slate-800 text-slate-300' : 'bg-neutral-200 text-neutral-700'
                  }`}
                >
                  {members.length} {members.length === 1 ? 'особа' : members.length < 5 ? 'особи' : 'осіб'}
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-neutral-500'} mt-0.5`}>
                Представники цього роду: {inFanCount} у віялі
                {members.length > inFanCount && ` • ${members.length - inFanCount} додатково у базі родоводу`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
            title="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div
          className={`p-3 border-b space-y-2.5 ${
            isDark ? 'border-slate-800 bg-slate-950/40' : 'border-neutral-100 bg-neutral-50/40'
          }`}
        >
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук особи за ім'ям, роками життя чи місцем..."
              className={`w-full pl-9 pr-8 py-2 text-xs rounded-xl border transition-colors outline-hidden ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-400 focus:border-emerald-500'
                  : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-emerald-600'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors cursor-pointer font-medium ${
                activeFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : isDark
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Всі особи ({members.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('fan')}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors cursor-pointer font-medium ${
                activeFilter === 'fan'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : isDark
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Лише у віялі ({inFanCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('male')}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors cursor-pointer font-medium ${
                activeFilter === 'male'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Чоловіки ({maleCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('female')}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors cursor-pointer font-medium ${
                activeFilter === 'female'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : isDark
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Жінки ({femaleCount})
            </button>
          </div>
        </div>

        {/* Member List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar min-h-60">
          {filteredMembers.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 text-xs">
              Осіб за даним фільтром чи запитом не знайдено
            </div>
          ) : (
            filteredMembers.map(({ person: p, isInFan, ahnentafelNumber, generation, kinshipTitle }) => {
              const isFemale = p.gender === 'female' || p.gender === 'F';
              const maiden = (p.name?.maidenName || p.maidenName || '').trim();
              const maidenFormatted = isFemale && maiden ? `(${maiden})` : '';
              const surname = (p.name?.surname || p.lastName || '').trim();
              const given = (p.name?.given || p.firstName || '').trim();
              const patronymic = (p.name?.patronymic || p.patronymic || '').trim();

              const displayName = `${surname} ${maidenFormatted} ${given} ${patronymic}`
                .replace(/\s+/g, ' ')
                .trim() || 'Без імені';

              const birthYear = p.birthYear || (p.birthDate ? String(p.birthDate).slice(0, 4) : '');
              const deathYear = p.deathYear || (p.deathDate ? String(p.deathDate).slice(0, 4) : '');
              const datesStr = p.isLiving
                ? `нар. ${birthYear || '?'}`
                : `${birthYear || '?'} — ${deathYear || '?'}`;

              const relationText = kinshipTitle || getAhnentafelRelationTitle(ahnentafelNumber, p.gender);

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectPerson(p.id);
                    onClose();
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer group flex items-center justify-between gap-3 ${
                    isDark
                      ? 'bg-slate-800/60 border-slate-700 hover:bg-slate-800 hover:border-emerald-500/50'
                      : 'bg-neutral-50/70 border-neutral-200 hover:bg-emerald-50/50 hover:border-emerald-400'
                  }`}
                  title="Натисніть, щоб відкрити повну картку особи"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover shrink-0 border border-neutral-300 dark:border-slate-700 shadow-xs"
                      />
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs shadow-xs ${
                          isFemale
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-900/40'
                            : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-900/40'
                        }`}
                      >
                        {surname?.[0] || ''}
                        {given?.[0] || ''}
                      </div>
                    )}

                    {/* Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-xs sm:text-sm truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {displayName}
                        </h4>
                        {isInFan ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            У віялі
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-neutral-500/15 text-neutral-600 dark:text-neutral-400">
                            У базі
                          </span>
                        )}
                      </div>

                      <div
                        className={`flex items-center gap-2 text-[11px] mt-0.5 flex-wrap ${
                          isDark ? 'text-slate-400' : 'text-neutral-500'
                        }`}
                      >
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-neutral-400" />
                          {datesStr}
                        </span>

                        {relationText && (
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            • {relationText}
                          </span>
                        )}

                        {generation !== undefined && generation > 0 && (
                          <span className="opacity-75">• Покоління {generation}</span>
                        )}

                        {p.birthPlace && (
                          <span className="flex items-center gap-0.5 truncate max-w-[160px] opacity-80">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {p.birthPlace}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {onChangeRoot && (
                      <button
                        type="button"
                        onClick={() => {
                          onChangeRoot(p.id);
                          onClose();
                        }}
                        className={`p-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-slate-700/80 hover:bg-emerald-600 text-slate-200 hover:text-white'
                            : 'bg-white hover:bg-emerald-600 text-neutral-700 hover:text-white border border-neutral-300 hover:border-emerald-600 shadow-xs'
                        }`}
                        title="Зробити цю особу центром віяла"
                      >
                        <GitFork className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {onSwitchToTree && (
                      <button
                        type="button"
                        onClick={() => {
                          onSwitchToTree();
                          onClose();
                        }}
                        className={`p-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-slate-700/80 hover:bg-emerald-600 text-slate-200 hover:text-white'
                            : 'bg-white hover:bg-emerald-600 text-neutral-700 hover:text-white border border-neutral-300 hover:border-emerald-600 shadow-xs'
                        }`}
                        title="Переглянути в родинному дереві"
                      >
                        <TreeIcon className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onSelectPerson(p.id);
                        onClose();
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Картка</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`p-3 border-t flex items-center justify-between text-xs ${
            isDark
              ? 'border-slate-800 bg-slate-900/50 text-slate-400'
              : 'border-neutral-200 bg-neutral-50/70 text-neutral-500'
          } rounded-b-2xl`}
        >
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-500" />
            <span>
              Показано {filteredMembers.length} з {members.length} особ
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-800'
            }`}
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
};
