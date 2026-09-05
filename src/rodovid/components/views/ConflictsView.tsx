/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive Data Health & Conflict Audit and Duplicate Person Detector View
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  HelpCircle,
  Search,
  Filter,
  Wrench,
  Users,
  GitMerge,
  ArrowRight,
  Clock,
  Dna,
  RefreshCw,
  Eye,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Info,
  Calendar,
  MapPin,
  Heart,
  FileText,
  Zap,
  EyeOff,
  Check,
  X,
  Layers
} from 'lucide-react';
import { Person, Family, TreeConflict, DuplicatePair } from '../../../types';
import { runTreeDataHealthAudit, autoFixTreeConflict } from '../../../utils/treeAudit';
import { detectDuplicatePersons } from '../../../utils/duplicateDetector';
import { quickMergePersons, batchMergeSafeDuplicates } from '../../../utils/personMerge';
import { SmartMergeModal } from '../modals/SmartMergeModal';
import { PersonDetailModal } from '../../../components/Tree/PersonDetailModal';
import { MergePersonsByIdModal } from '../../../components/modals/MergePersonsByIdModal';

interface ConflictsViewProps {
  persons: Person[];
  families: Record<string, Family>;
  initialSubTab?: 'health' | 'duplicates';
  onUpdatePersons: (persons: Person[]) => void;
  onUpdateFamilies?: (families: Record<string, Family>) => void;
  onSelectPerson?: (id: string) => void;
}

export const ConflictsView: React.FC<ConflictsViewProps> = ({
  persons,
  families,
  initialSubTab = 'health',
  onUpdatePersons,
  onUpdateFamilies,
  onSelectPerson
}) => {
  // Navigation tabs within this view
  const [activeSubTab, setActiveSubTab] = useState<'health' | 'duplicates'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Search & Filters for Data Health Audit
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'critical' | 'warning' | 'gap'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Duplicate Detector Filters & State
  const [duplicateSearchQuery, setDuplicateSearchQuery] = useState('');
  const [minConfidenceFilter, setMinConfidenceFilter] = useState<number>(50);
  const [duplicateCriteriaFilter, setDuplicateCriteriaFilter] = useState<'all' | 'parents' | 'pib' | 'birth'>('all');
  const [isScanningDuplicates, setIsScanningDuplicates] = useState(false);
  const [showIgnoredPairs, setShowIgnoredPairs] = useState(false);
  const [isBatchConfirmOpen, setIsBatchConfirmOpen] = useState(false);

  // Ignored pairs persistence
  const [ignoredPairIds, setIgnoredPairIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('rodovid_ignored_duplicate_pairs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Active Modals state
  const [activeMergePair, setActiveMergePair] = useState<DuplicatePair | null>(null);
  const [isMergeByIdOpen, setIsMergeByIdOpen] = useState(false);
  const [initialMergeIdA, setInitialMergeIdA] = useState<string | undefined>(undefined);
  const [initialMergeIdB, setInitialMergeIdB] = useState<string | undefined>(undefined);
  const [inspectingPersonId, setInspectingPersonId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Toggle ignore pair
  const handleToggleIgnorePair = (pairId: string) => {
    let next: string[];
    if (ignoredPairIds.includes(pairId)) {
      next = ignoredPairIds.filter(id => id !== pairId);
      showNotification('Пару відновлено для перевірки.');
    } else {
      next = [...ignoredPairIds, pairId];
      showNotification('Пару позначено як різних осіб та приховано.');
    }
    setIgnoredPairIds(next);
    try {
      localStorage.setItem('rodovid_ignored_duplicate_pairs', JSON.stringify(next));
    } catch (e) {
      console.error(e);
    }
  };

  // Run Realtime Audits
  const auditReport = useMemo(() => {
    return runTreeDataHealthAudit(persons, families);
  }, [persons, families]);

  const duplicatePairs = useMemo(() => {
    return detectDuplicatePersons(persons);
  }, [persons]);

  // Duplicate pairs statistics
  const duplicateStats = useMemo(() => {
    const total = duplicatePairs.length;
    const exact = duplicatePairs.filter(p => p.confidence >= 85).length;
    const probable = duplicatePairs.filter(p => p.confidence >= 70 && p.confidence < 85).length;
    const withParents = duplicatePairs.filter(p => p.criteria?.parentsMatch && p.criteria.parentsMatch !== 'none').length;
    const ignored = duplicatePairs.filter(p => ignoredPairIds.includes(p.id)).length;
    return { total, exact, probable, withParents, ignored };
  }, [duplicatePairs, ignoredPairIds]);

  // Safe pairs for batch merge (confidence >= 85% and not ignored)
  const safeBatchPairs = useMemo(() => {
    return duplicatePairs.filter(p => p.confidence >= 85 && !ignoredPairIds.includes(p.id));
  }, [duplicatePairs, ignoredPairIds]);

  // Quick 1-click merge
  const handleQuickMerge = (pair: DuplicatePair) => {
    const res = quickMergePersons(pair.personA, pair.personB, persons, families);
    onUpdatePersons(res.updatedPersons);
    if (onUpdateFamilies) {
      onUpdateFamilies(res.updatedFamilies);
    }
    const nameStr = res.masterPerson.name?.given
      ? `${res.masterPerson.name.surname || ''} ${res.masterPerson.name.given}`.trim()
      : res.masterPerson.id;
    showNotification(`Швидке злиття виконано успішно! Особи об'єднано у профіль «${nameStr}».`);
  };

  // Batch merge safe duplicates
  const handleExecuteBatchMerge = () => {
    if (safeBatchPairs.length === 0) {
      showNotification('Немає безпечних дублікатів (>85%) для пакетного злиття.');
      return;
    }
    const res = batchMergeSafeDuplicates(safeBatchPairs, persons, families, 85);
    onUpdatePersons(res.updatedPersons);
    if (onUpdateFamilies) {
      onUpdateFamilies(res.updatedFamilies);
    }
    setIsBatchConfirmOpen(false);
    showNotification(`Автоматично об'єднано ${res.mergedCount} дублікатів у базі даних!`);
  };

  // Trigger manual rescan with visual indicator
  const handleTriggerRescan = () => {
    setIsScanningDuplicates(true);
    setTimeout(() => {
      setIsScanningDuplicates(false);
      showNotification(`Перевірку бази завершено! Проаналізовано ${persons.length} осіб.`);
    }, 600);
  };

  // Filtered conflicts
  const filteredConflicts = useMemo(() => {
    return auditReport.conflicts.filter(conflict => {
      // Severity filter
      if (selectedSeverity !== 'all' && conflict.severity !== selectedSeverity) {
        return false;
      }
      // Category filter
      if (selectedCategory !== 'all' && conflict.type !== selectedCategory) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inPerson = conflict.personName.toLowerCase().includes(q);
        const inTitle = conflict.title.toLowerCase().includes(q);
        const inDesc = conflict.description.toLowerCase().includes(q);
        const inRelated = conflict.relatedPersonName ? conflict.relatedPersonName.toLowerCase().includes(q) : false;
        return inPerson || inTitle || inDesc || inRelated;
      }
      return true;
    });
  }, [auditReport.conflicts, selectedSeverity, selectedCategory, searchQuery]);

  // Filtered duplicates
  const filteredDuplicates = useMemo(() => {
    return duplicatePairs.filter(pair => {
      const isIgnored = ignoredPairIds.includes(pair.id);
      if (showIgnoredPairs) {
        if (!isIgnored) return false;
      } else {
        if (isIgnored) return false;
      }

      if (pair.confidence < minConfidenceFilter) return false;

      if (duplicateCriteriaFilter === 'parents') {
        if (!pair.criteria?.parentsMatch || pair.criteria.parentsMatch === 'none') return false;
      } else if (duplicateCriteriaFilter === 'pib') {
        if (pair.criteria?.pibMatch !== 'exact') return false;
      } else if (duplicateCriteriaFilter === 'birth') {
        if (pair.criteria?.birthMatch !== 'exact') return false;
      }

      if (duplicateSearchQuery.trim()) {
        const q = duplicateSearchQuery.toLowerCase().trim();
        const nameA = `${pair.personA.name?.surname || pair.personA.lastName || ''} ${pair.personA.name?.given || pair.personA.firstName || ''}`.toLowerCase();
        const nameB = `${pair.personB.name?.surname || pair.personB.lastName || ''} ${pair.personB.name?.given || pair.personB.firstName || ''}`.toLowerCase();
        return nameA.includes(q) || nameB.includes(q);
      }
      return true;
    });
  }, [duplicatePairs, minConfidenceFilter, duplicateSearchQuery, ignoredPairIds, showIgnoredPairs, duplicateCriteriaFilter]);

  // Auto fix single conflict
  const handleAutoFix = (conflict: TreeConflict) => {
    const result = autoFixTreeConflict(conflict, persons);
    onUpdatePersons(result.updatedPersons);
    showNotification(result.message);
  };

  // Auto fix ALL asymmetric links and self-loops in batch
  const handleAutoFixAllSafe = () => {
    const fixableConflicts = auditReport.conflicts.filter(c => c.canAutoFix);
    if (fixableConflicts.length === 0) {
      showNotification('Немає доступних автоматичних виправлень.');
      return;
    }

    let currentPersons = [...persons];
    let fixCount = 0;

    for (const conflict of fixableConflicts) {
      const res = autoFixTreeConflict(conflict, currentPersons);
      currentPersons = res.updatedPersons;
      fixCount++;
    }

    onUpdatePersons(currentPersons);
    showNotification(`Успішно виправлено ${fixCount} асиметрій та звʼязків у базі даних!`);
  };

  // Handle merge complete
  const handleMergeComplete = (
    updatedPersons: Person[],
    updatedFamilies: Record<string, Family>,
    masterName: string
  ) => {
    onUpdatePersons(updatedPersons);
    if (onUpdateFamilies) {
      onUpdateFamilies(updatedFamilies);
    }
    showNotification(`Персони успішно злито! Запис «${masterName}» оновлено.`);
  };

  // Health Score Color & Rating
  const healthScore = auditReport.stats.healthScore;
  const healthRating = healthScore >= 85
    ? { label: 'Відмінно', color: 'text-emerald-400', barBg: 'bg-emerald-500' }
    : healthScore >= 60
    ? { label: 'Задовільно', color: 'text-amber-400', barBg: 'bg-amber-500' }
    : { label: 'Потребує уваги', color: 'text-rose-400', barBg: 'bg-rose-500' };

  return (
    <div className="flex flex-col h-full bg-[#121212] text-neutral-200 overflow-y-auto overflow-x-auto">
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 bg-neutral-900 border border-emerald-500/50 text-emerald-300 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-semibold animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="p-4 md:p-6 border-b border-neutral-800/80 bg-neutral-900/60 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#B88E3E]/20 border border-[#B88E3E]/40 flex items-center justify-center text-[#B88E3E] shadow-sm">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                Аудит даних & Пошук дублікатів
              </h1>
              <p className="text-xs md:text-sm text-neutral-400 mt-0.5">
                Аналітичний контроль цілісності родоводу, хронології, біологічних звʼязків та злиття повторів
              </p>
            </div>
          </div>

          {/* Sub-tab switcher */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-neutral-950/80 border border-neutral-800 rounded-xl">
            <button
              onClick={() => setActiveSubTab('health')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'health'
                  ? 'bg-[#B88E3E] text-neutral-950 shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Аудит цілісності</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeSubTab === 'health' ? 'bg-black/20 text-neutral-900' : 'bg-neutral-800 text-neutral-300'
              }`}>
                {auditReport.stats.total}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('duplicates')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'duplicates'
                  ? 'bg-[#B88E3E] text-neutral-950 shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Пошук дублікатів</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeSubTab === 'duplicates' ? 'bg-black/20 text-neutral-900' : 'bg-neutral-800 text-neutral-300'
              }`}>
                {duplicatePairs.length}
              </span>
            </button>
          </div>

        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">

        {/* ========================================================================= */}
        {/* SUBTAB 1: DATA HEALTH & CONFLICT AUDIT */}
        {/* ========================================================================= */}
        {activeSubTab === 'health' && (
          <div className="space-y-6">
            
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Health Score Card */}
              <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-semibold uppercase tracking-wider">Індекс здоровʼя</span>
                  <span className={`font-bold ${healthRating.color}`}>{healthRating.label}</span>
                </div>
                <div className="my-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">{healthScore}%</span>
                  <span className="text-xs text-neutral-500">цілісність</span>
                </div>
                <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${healthRating.barBg} transition-all duration-500`}
                    style={{ width: `${healthScore}%` }}
                  />
                </div>
              </div>

              {/* Critical Errors */}
              <div 
                onClick={() => setSelectedSeverity('critical')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedSeverity === 'critical'
                    ? 'bg-rose-500/10 border-rose-500/50 shadow-sm'
                    : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-semibold uppercase tracking-wider text-rose-400">Критичні помилки</span>
                  <AlertOctagon className="w-4 h-4 text-rose-500" />
                </div>
                <div className="my-2 text-3xl font-extrabold text-rose-400">
                  {auditReport.stats.critical}
                </div>
                <p className="text-[11px] text-neutral-400">
                  Хронологічні та біологічні аномалії, цикли
                </p>
              </div>

              {/* Warnings */}
              <div 
                onClick={() => setSelectedSeverity('warning')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedSeverity === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                    : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-semibold uppercase tracking-wider text-amber-400">Застереження</span>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div className="my-2 text-3xl font-extrabold text-amber-400">
                  {auditReport.stats.warning}
                </div>
                <p className="text-[11px] text-neutral-400">
                  Незвичні вікові межі, односторонні звʼязки
                </p>
              </div>

              {/* Data Gaps */}
              <div 
                onClick={() => setSelectedSeverity('gap')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedSeverity === 'gap'
                    ? 'bg-blue-500/10 border-blue-500/50 shadow-sm'
                    : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-semibold uppercase tracking-wider text-blue-400">Прогалини в даних</span>
                  <HelpCircle className="w-4 h-4 text-blue-500" />
                </div>
                <div className="my-2 text-3xl font-extrabold text-blue-400">
                  {auditReport.stats.gap}
                </div>
                <p className="text-[11px] text-neutral-400">
                  Відсутні прізвища, ключові дати чи локації
                </p>
              </div>

            </div>

            {/* Quick Actions & Filter Bar */}
            <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4">
              
              {/* Search & Category filter */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto flex-1">
                
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Пошук за ПІБ особи або описом помилки..."
                    className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-[#B88E3E]"
                  />
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                  {[
                    { id: 'all', label: 'Всі категорії' },
                    { id: 'chronology', label: 'Хронологія' },
                    { id: 'biology', label: 'Біологія' },
                    { id: 'cycles', label: 'Цикли (Loops)' },
                    { id: 'relations', label: 'Звʼязки' },
                    { id: 'data_gaps', label: 'Прогалини' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        selectedCategory === cat.id
                          ? 'bg-[#B88E3E]/20 text-[#B88E3E] border border-[#B88E3E]/40 font-semibold'
                          : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

              </div>

              {/* Batch auto-fix button */}
              <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                <button
                  onClick={handleAutoFixAllSafe}
                  className="w-full md:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-[#B88E3E] hover:bg-[#a37c33] text-neutral-950 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Виправити всі звʼязки в 1 клік</span>
                </button>
              </div>

            </div>

            {/* Conflicts List */}
            {filteredConflicts.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800/60">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Конфліктів та аномалій не виявлено!
                </h3>
                <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                  У вибраній категорії дані родоводу є повністю узгодженими, без порушень хронології та біологічних обмежень.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredConflicts.map(conflict => {
                  const isCritical = conflict.severity === 'critical';
                  const isWarning = conflict.severity === 'warning';

                  return (
                    <div
                      key={conflict.id}
                      className={`p-4 md:p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isCritical
                          ? 'bg-rose-950/10 border-rose-900/40 hover:border-rose-700/60'
                          : isWarning
                          ? 'bg-amber-950/10 border-amber-900/40 hover:border-amber-700/60'
                          : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      {/* Info side */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                            isCritical
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : isWarning
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}>
                            {isCritical ? 'Критично' : isWarning ? 'Застереження' : 'Прогалина'}
                          </span>

                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-800 text-neutral-300">
                            {conflict.type === 'chronology' && '⏳ Хронологія'}
                            {conflict.type === 'biology' && '🧬 Біологія батьківства'}
                            {conflict.type === 'cycles' && '🔄 Кільцевий цикл'}
                            {conflict.type === 'relations' && '🔗 Родинні звʼязки'}
                            {conflict.type === 'data_gaps' && '📋 Прогалина в даних'}
                          </span>

                          <h3 className="text-sm font-bold text-white ml-1">
                            {conflict.title}
                          </h3>
                        </div>

                        <p className="text-xs text-neutral-300">
                          {conflict.description}
                        </p>

                        <div className="flex items-start gap-1.5 text-xs text-[#d1b06c] pt-1">
                          <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#B88E3E] mt-0.5" />
                          <span>
                            <strong className="text-[#B88E3E]">Порада щодо виправлення:</strong> {conflict.recommendation}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        {conflict.canAutoFix && (
                          <button
                            onClick={() => handleAutoFix(conflict)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>Авто-виправити</span>
                          </button>
                        )}

                        <button
                          onClick={() => setInspectingPersonId(conflict.personId)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Картка</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBTAB 2: DUPLICATE PERSON DETECTOR & SMART MERGE */}
        {/* ========================================================================= */}
        {activeSubTab === 'duplicates' && (
          <div className="space-y-6">
            
            {/* Header info & Top Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <GitMerge className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Автоматичний інструмент перевірки та об'єднання дублікатів
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Порівняння ПІБ (фонетика та варіанти), дат народження та батьків (батько, мати, по батькові).
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Rescan button */}
                <button
                  type="button"
                  onClick={handleTriggerRescan}
                  disabled={isScanningDuplicates}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Запустити повторний аналіз усієї бази осіб"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isScanningDuplicates ? 'animate-spin' : ''}`} />
                  <span>{isScanningDuplicates ? 'Сканування...' : 'Пересканувати базу'}</span>
                </button>

                {/* Batch merge button */}
                <button
                  type="button"
                  onClick={() => setIsBatchConfirmOpen(true)}
                  disabled={safeBatchPairs.length === 0}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Швидко об'єднати всі пари з надійністю понад 85%"
                >
                  <Zap className="w-4 h-4" />
                  <span>Авто-злиття безпечних ({safeBatchPairs.length})</span>
                </button>

                {/* Merge by ID button */}
                <button
                  type="button"
                  onClick={() => {
                    setInitialMergeIdA(undefined);
                    setInitialMergeIdB(undefined);
                    setIsMergeByIdOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-neutral-950 shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <GitMerge className="w-4 h-4" />
                  <span>Злити по ID</span>
                </button>
              </div>
            </div>

            {/* Stats Overview Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <span className="text-[11px] text-neutral-400 font-medium">Осіб у базі</span>
                <p className="text-xl font-extrabold text-white mt-0.5">{persons.length}</p>
                <span className="text-[10px] text-neutral-500">проаналізовано</span>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <span className="text-[11px] text-neutral-400 font-medium">Знайдено пар</span>
                <p className="text-xl font-extrabold text-amber-400 mt-0.5">{duplicateStats.total}</p>
                <span className="text-[10px] text-neutral-500">потенційних збігів</span>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <span className="text-[11px] text-neutral-400 font-medium">Безпечні (&gt;85%)</span>
                <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{duplicateStats.exact}</p>
                <span className="text-[10px] text-neutral-500">готові до 1-клік злиття</span>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <span className="text-[11px] text-neutral-400 font-medium">Збіг батьків</span>
                <p className="text-xl font-extrabold text-sky-400 mt-0.5">{duplicateStats.withParents}</p>
                <span className="text-[10px] text-neutral-500">підтверджено сім'ю</span>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <span className="text-[11px] text-neutral-400 font-medium">Приховані пари</span>
                <p className="text-xl font-extrabold text-neutral-400 mt-0.5">{duplicateStats.ignored}</p>
                <span className="text-[10px] text-neutral-500">позначені як різні</span>
              </div>
            </div>

            {/* Filter & Search Bar for Duplicates */}
            <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col gap-3">
              
              <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    value={duplicateSearchQuery}
                    onChange={(e) => setDuplicateSearchQuery(e.target.value)}
                    placeholder="Пошук серед дублікатів за імʼям, прізвищем або по батькові..."
                    className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-[#B88E3E]"
                  />
                </div>

                {/* Confidence threshold tabs */}
                <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto shrink-0">
                  <span className="text-xs text-neutral-400 font-medium whitespace-nowrap mr-1">Поріг:</span>
                  {[
                    { val: 50, label: 'Всі (>50%)' },
                    { val: 70, label: 'Висока (>70%)' },
                    { val: 85, label: 'Майже точні (>85%)' }
                  ].map(item => (
                    <button
                      key={item.val}
                      onClick={() => setMinConfidenceFilter(item.val)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        minConfidenceFilter === item.val
                          ? 'bg-[#B88E3E]/20 text-[#B88E3E] border border-[#B88E3E]/40 font-semibold'
                          : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Criteria Pills Filter Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-800/60">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-neutral-400 font-medium mr-1 flex items-center gap-1">
                    <Filter className="w-3 h-3 text-neutral-500" />
                    Критерій:
                  </span>
                  <button
                    onClick={() => setDuplicateCriteriaFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      duplicateCriteriaFilter === 'all'
                        ? 'bg-neutral-700 text-white font-semibold'
                        : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-white'
                    }`}
                  >
                    Всі критерії
                  </button>
                  <button
                    onClick={() => setDuplicateCriteriaFilter('parents')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      duplicateCriteriaFilter === 'parents'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                        : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-white'
                    }`}
                  >
                    👨‍👩‍👧 Зі збігом батьків ({duplicateStats.withParents})
                  </button>
                  <button
                    onClick={() => setDuplicateCriteriaFilter('pib')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      duplicateCriteriaFilter === 'pib'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
                        : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-white'
                    }`}
                  >
                    👤 100% збіг ПІБ
                  </button>
                  <button
                    onClick={() => setDuplicateCriteriaFilter('birth')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      duplicateCriteriaFilter === 'birth'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                        : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-white'
                    }`}
                  >
                    📅 Точна дата народження
                  </button>
                </div>

                {/* Show Ignored toggle */}
                <button
                  type="button"
                  onClick={() => setShowIgnoredPairs(!showIgnoredPairs)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showIgnoredPairs
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-neutral-200'
                  }`}
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>{showIgnoredPairs ? 'Показати активні' : `Приховані пари (${duplicateStats.ignored})`}</span>
                </button>
              </div>

            </div>

            {/* Duplicate Pairs List */}
            {filteredDuplicates.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800/60">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {showIgnoredPairs
                    ? 'Список прихованих дублікатів порожній'
                    : 'Потенційних дублікатів за обраними критеріями не знайдено!'}
                </h3>
                <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                  {showIgnoredPairs
                    ? 'Ви ще не позначали пари як «не дублікат».'
                    : 'Усі записи у дереві є унікальними за обраним рівнем фільтрації.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDuplicates.map(pair => {
                  const { personA, personB, confidence, reasons, criteria } = pair;
                  const isPairIgnored = ignoredPairIds.includes(pair.id);

                  const nameA = `${personA.name?.surname || personA.lastName || ''} ${personA.name?.given || personA.firstName || ''} ${personA.name?.patronymic || personA.patronymic || ''}`.trim() || personA.id;
                  const nameB = `${personB.name?.surname || personB.lastName || ''} ${personB.name?.given || personB.firstName || ''} ${personB.name?.patronymic || personB.patronymic || ''}`.trim() || personB.id;

                  // Resolve parent names
                  const fatherA = personA.fatherId ? persons.find(p => p.id === personA.fatherId) : null;
                  const fatherB = personB.fatherId ? persons.find(p => p.id === personB.fatherId) : null;
                  const motherA = personA.motherId ? persons.find(p => p.id === personA.motherId) : null;
                  const motherB = personB.motherId ? persons.find(p => p.id === personB.motherId) : null;

                  const fatherAName = fatherA ? `${fatherA.name?.surname || fatherA.lastName || ''} ${fatherA.name?.given || fatherA.firstName || ''}`.trim() : 'Не вказано';
                  const fatherBName = fatherB ? `${fatherB.name?.surname || fatherB.lastName || ''} ${fatherB.name?.given || fatherB.firstName || ''}`.trim() : 'Не вказано';
                  const motherAName = motherA ? `${motherA.name?.surname || motherA.lastName || ''} ${motherA.name?.given || motherA.firstName || ''}`.trim() : 'Не вказано';
                  const motherBName = motherB ? `${motherB.name?.surname || motherB.lastName || ''} ${motherB.name?.given || motherB.firstName || ''}`.trim() : 'Не вказано';

                  return (
                    <div
                      key={pair.id}
                      className={`p-5 rounded-2xl bg-neutral-900/70 border transition-all space-y-4 shadow-sm ${
                        confidence >= 85
                          ? 'border-emerald-900/50 hover:border-emerald-700/70'
                          : confidence >= 70
                          ? 'border-amber-900/50 hover:border-amber-700/70'
                          : 'border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      {/* Top Bar with score, status & all 4 actions */}
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase ${
                            confidence >= 85
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : confidence >= 70
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}>
                            {confidence}% Схожість
                          </span>
                          <span className="text-xs font-semibold text-white">
                            {confidence >= 85 ? 'Майже точний дублікат' : confidence >= 70 ? 'Висока ймовірність' : 'Можливий дублікат'}
                          </span>
                          {isPairIgnored && (
                            <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-400 text-[10px] font-mono">
                              Приховано
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* 1-Click Quick Merge */}
                          <button
                            type="button"
                            onClick={() => handleQuickMerge(pair)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                            title="Автоматично об'єднати записи за одне натискання (більш повний профіль стане головним)"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Швидке злиття</span>
                          </button>

                          {/* Full Interactive Smart Merge Wizard */}
                          <button
                            type="button"
                            onClick={() => setActiveMergePair(pair)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#B88E3E] hover:bg-[#a37c33] text-neutral-950 transition-all flex items-center gap-1.5 shadow-md shadow-[#B88E3E]/20 cursor-pointer"
                            title="Відкрити майстер з можливістю покрокового вибору кожного поля та батьків"
                          >
                            <GitMerge className="w-3.5 h-3.5" />
                            <span>Майстер злиття</span>
                          </button>

                          {/* Manual Merge By ID */}
                          <button
                            type="button"
                            onClick={() => {
                              setInitialMergeIdA(pair.personA.id);
                              setInitialMergeIdB(pair.personB.id);
                              setIsMergeByIdOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-all flex items-center gap-1 cursor-pointer"
                            title="Злити через діалог по ID"
                          >
                            <span>По ID</span>
                          </button>

                          {/* Toggle Ignore */}
                          <button
                            type="button"
                            onClick={() => handleToggleIgnorePair(pair.id)}
                            className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800 transition-colors cursor-pointer"
                            title={isPairIgnored ? 'Відновити в список дублікатів' : 'Позначити як різні особи (ігнорувати)'}
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 3 Verification Pillars Section (PIB, Birth, Parents) */}
                      {criteria && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 p-3 rounded-xl bg-neutral-950/70 border border-neutral-800/80 text-xs">
                          
                          {/* Pillar 1: PIB */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-400 font-medium flex items-center gap-1">
                                <span>👤</span>
                                <span>ПІБ</span>
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                criteria.pibMatch === 'exact'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : criteria.pibMatch === 'partial'
                                  ? 'bg-purple-500/20 text-purple-400'
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {criteria.pibMatch === 'exact' ? '100% збіг' : `${criteria.pibScore}% схожість`}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-300 leading-tight">
                              {criteria.pibDetails}
                            </p>
                          </div>

                          {/* Pillar 2: Birth */}
                          <div className="space-y-1 border-t md:border-t-0 md:border-l border-neutral-800 pt-2 md:pt-0 md:pl-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-400 font-medium flex items-center gap-1">
                                <span>📅</span>
                                <span>Народження</span>
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                criteria.birthMatch === 'exact'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : criteria.birthMatch === 'close'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-neutral-800 text-neutral-400'
                              }`}>
                                {criteria.birthMatch === 'exact' ? 'Точний рік' : criteria.birthMatch === 'close' ? 'Близький рік' : 'Невідомо'}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-300 leading-tight">
                              {criteria.birthDetails}
                            </p>
                          </div>

                          {/* Pillar 3: Parents */}
                          <div className="space-y-1 border-t md:border-t-0 md:border-l border-neutral-800 pt-2 md:pt-0 md:pl-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-400 font-medium flex items-center gap-1">
                                <span>👨‍👩‍👧</span>
                                <span>Батьки</span>
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                criteria.parentsMatch === 'both'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : criteria.parentsMatch === 'father' || criteria.parentsMatch === 'mother'
                                  ? 'bg-sky-500/20 text-sky-400'
                                  : criteria.parentsMatch === 'patronymic'
                                  ? 'bg-indigo-500/20 text-indigo-400'
                                  : 'bg-neutral-800 text-neutral-400'
                              }`}>
                                {criteria.parentsMatch === 'both' ? 'Обоє батьків' : criteria.parentsMatch === 'father' ? 'Батько збігається' : criteria.parentsMatch === 'mother' ? 'Мати збігається' : criteria.parentsMatch === 'patronymic' ? 'По батькові' : 'Не збігаються'}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-300 leading-tight truncate" title={criteria.parentsDetails}>
                              {criteria.parentsDetails}
                            </p>
                          </div>

                        </div>
                      )}

                      {/* Side by side comparison cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Person A card */}
                        <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xs">
                                A
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-white">{nameA}</h4>
                                <span className="text-[10px] text-neutral-500 font-mono">ID: {personA.id}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setInspectingPersonId(personA.id)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                              title="Переглянути картку особи A"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-xs text-neutral-400 space-y-1.5 pt-1">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                              <span>
                                {personA.birthDate || personA.birthYear || 'Рік невідомий'} – {personA.deathDate || personA.deathYear || (personA.isLiving ? 'живий' : '—')}
                              </span>
                            </div>
                            {personA.birthPlace && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                <span className="truncate">{personA.birthPlace}</span>
                              </div>
                            )}

                            {/* Parents of A */}
                            <div className="pt-1 border-t border-neutral-800/80 space-y-0.5 text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="text-neutral-500">Батько:</span>
                                <span className="text-neutral-300 font-medium truncate max-w-[170px]" title={fatherAName}>
                                  {fatherAName}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-neutral-500">Мати:</span>
                                <span className="text-neutral-300 font-medium truncate max-w-[170px]" title={motherAName}>
                                  {motherAName}
                                </span>
                              </div>
                            </div>

                            {(personA.childrenIds?.length || 0) > 0 && (
                              <div className="flex items-center gap-2 pt-0.5">
                                <Users className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                <span>Дітей: {personA.childrenIds?.length}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Person B card */}
                        <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs">
                                B
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-white">{nameB}</h4>
                                <span className="text-[10px] text-neutral-500 font-mono">ID: {personB.id}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setInspectingPersonId(personB.id)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                              title="Переглянути картку особи B"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-xs text-neutral-400 space-y-1.5 pt-1">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                              <span>
                                {personB.birthDate || personB.birthYear || 'Рік невідомий'} – {personB.deathDate || personB.deathYear || (personB.isLiving ? 'живий' : '—')}
                              </span>
                            </div>
                            {personB.birthPlace && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                <span className="truncate">{personB.birthPlace}</span>
                              </div>
                            )}

                            {/* Parents of B */}
                            <div className="pt-1 border-t border-neutral-800/80 space-y-0.5 text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="text-neutral-500">Батько:</span>
                                <span className="text-neutral-300 font-medium truncate max-w-[170px]" title={fatherBName}>
                                  {fatherBName}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-neutral-500">Мати:</span>
                                <span className="text-neutral-300 font-medium truncate max-w-[170px]" title={motherBName}>
                                  {motherBName}
                                </span>
                              </div>
                            </div>

                            {(personB.childrenIds?.length || 0) > 0 && (
                              <div className="flex items-center gap-2 pt-0.5">
                                <Users className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                <span>Дітей: {personB.childrenIds?.length}</span>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* Matching reasons pills */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-1">
                        <span className="text-neutral-500 font-semibold mr-1">Ознаки збігу:</span>
                        {reasons.map((r, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-md bg-[#B88E3E]/10 text-[#d1b06c] border border-[#B88E3E]/20">
                            {r}
                          </span>
                        ))}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

      </div>

      {/* Batch Merge Confirmation Modal */}
      {isBatchConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl p-6 space-y-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Автоматичне об'єднання {safeBatchPairs.length} пар дублікатів</h3>
                  <p className="text-xs text-neutral-400">Поріг схожості &gt;85% (висока надійність)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchConfirmOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-neutral-300">
              <p>
                Для кожної пари алгоритм автоматично обере найповніший запис за головний профіль, перенесе всі родинні звʼязки (батьків, подружжя, дітей), події та джерела.
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 rounded-xl bg-neutral-950/80 border border-neutral-800">
                {safeBatchPairs.map(p => {
                  const nA = `${p.personA.name?.surname || p.personA.lastName || ''} ${p.personA.name?.given || p.personA.firstName || ''}`.trim() || p.personA.id;
                  const nB = `${p.personB.name?.surname || p.personB.lastName || ''} ${p.personB.name?.given || p.personB.firstName || ''}`.trim() || p.personB.id;
                  return (
                    <div key={p.id} className="flex items-center justify-between text-[11px] py-1 border-b border-neutral-900 last:border-0">
                      <span className="font-medium text-white truncate max-w-[280px]">
                        {nA} ⟷ {nB}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                        {p.confidence}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsBatchConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchMerge}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Підтвердити об'єднання ({safeBatchPairs.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Merge Modal */}
      {activeMergePair && (
        <SmartMergeModal
          pair={activeMergePair}
          allPersons={persons}
          allFamilies={families}
          isOpen={!!activeMergePair}
          onClose={() => setActiveMergePair(null)}
          onMergeComplete={handleMergeComplete}
        />
      )}

      {/* Person Detail Inspection Modal */}
      {inspectingPersonId && (
        <PersonDetailModal
          personId={inspectingPersonId}
          onClose={() => setInspectingPersonId(null)}
          onEdit={() => {}}
          onOpenAddRelation={() => {}}
        />
      )}

      {/* Merge Persons by ID Modal */}
      {isMergeByIdOpen && (
        <MergePersonsByIdModal
          isOpen={isMergeByIdOpen}
          onClose={() => {
            setIsMergeByIdOpen(false);
            setInitialMergeIdA(undefined);
            setInitialMergeIdB(undefined);
          }}
          initialPersonAId={initialMergeIdA}
          initialPersonBId={initialMergeIdB}
          onMergeSuccess={(master) => {
            showNotification(`Особи успішно об'єднані в профіль «${master.name?.surname || master.lastName || ''} ${master.name?.given || master.firstName || ''}»!`);
          }}
        />
      )}

    </div>
  );
};
