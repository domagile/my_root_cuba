/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive Data Health & Conflict Audit and Duplicate Person Detector View
 */

import React, { useState, useMemo } from 'react';
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
  FileText
} from 'lucide-react';
import { Person, Family, TreeConflict, DuplicatePair } from '../../../types';
import { runTreeDataHealthAudit, autoFixTreeConflict } from '../../../utils/treeAudit';
import { detectDuplicatePersons } from '../../../utils/duplicateDetector';
import { SmartMergeModal } from '../modals/SmartMergeModal';
import { PersonDetailModal } from '../../../components/Tree/PersonDetailModal';

interface ConflictsViewProps {
  persons: Person[];
  families: Record<string, Family>;
  onUpdatePersons: (persons: Person[]) => void;
  onUpdateFamilies?: (families: Record<string, Family>) => void;
  onSelectPerson?: (id: string) => void;
}

export const ConflictsView: React.FC<ConflictsViewProps> = ({
  persons,
  families,
  onUpdatePersons,
  onUpdateFamilies,
  onSelectPerson
}) => {
  // Navigation tabs within this view
  const [activeSubTab, setActiveSubTab] = useState<'health' | 'duplicates'>('health');

  // Search & Filters for Data Health Audit
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'critical' | 'warning' | 'gap'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Duplicate Detector Filters
  const [duplicateSearchQuery, setDuplicateSearchQuery] = useState('');
  const [minConfidenceFilter, setMinConfidenceFilter] = useState<number>(50);

  // Active Modals state
  const [activeMergePair, setActiveMergePair] = useState<DuplicatePair | null>(null);
  const [inspectingPersonId, setInspectingPersonId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Run Realtime Audits
  const auditReport = useMemo(() => {
    return runTreeDataHealthAudit(persons, families);
  }, [persons, families]);

  const duplicatePairs = useMemo(() => {
    return detectDuplicatePersons(persons);
  }, [persons]);

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
      if (pair.confidence < minConfidenceFilter) return false;
      if (duplicateSearchQuery.trim()) {
        const q = duplicateSearchQuery.toLowerCase().trim();
        const nameA = `${pair.personA.name?.surname || pair.personA.lastName || ''} ${pair.personA.name?.given || pair.personA.firstName || ''}`.toLowerCase();
        const nameB = `${pair.personB.name?.surname || pair.personB.lastName || ''} ${pair.personB.name?.given || pair.personB.firstName || ''}`.toLowerCase();
        return nameA.includes(q) || nameB.includes(q);
      }
      return true;
    });
  }, [duplicatePairs, minConfidenceFilter, duplicateSearchQuery]);

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
          <div className="flex items-center gap-2 p-1.5 bg-neutral-950/80 border border-neutral-800 rounded-xl">
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
            
            {/* Filter & Search for Duplicates */}
            <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4">
              
              <div className="relative flex-1 w-full md:w-auto">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  value={duplicateSearchQuery}
                  onChange={(e) => setDuplicateSearchQuery(e.target.value)}
                  placeholder="Пошук серед дублікатів за імʼям чи прізвищем..."
                  className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-[#B88E3E]"
                />
              </div>

              {/* Confidence filter */}
              <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                <span className="text-xs text-neutral-400 font-medium whitespace-nowrap">Поріг схожості:</span>
                {[
                  { val: 50, label: 'Всі (>50%)' },
                  { val: 70, label: 'Висока (>70%)' },
                  { val: 85, label: 'Майже точні (>85%)' }
                ].map(item => (
                  <button
                    key={item.val}
                    onClick={() => setMinConfidenceFilter(item.val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
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

            {/* Duplicate Pairs List */}
            {filteredDuplicates.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800/60">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Потенційних дублікатів не знайдено!
                </h3>
                <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                  У вашому родовому дереві всі записи є унікальними за фонетичним, хронологічним та родинним аналізом.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDuplicates.map(pair => {
                  const { personA, personB, confidence, reasons } = pair;
                  const nameA = `${personA.name?.surname || personA.lastName || ''} ${personA.name?.given || personA.firstName || ''}`.trim() || personA.id;
                  const nameB = `${personB.name?.surname || personB.lastName || ''} ${personB.name?.given || personB.firstName || ''}`.trim() || personB.id;

                  return (
                    <div
                      key={pair.id}
                      className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700 transition-all space-y-4 shadow-sm"
                    >
                      {/* Top Bar with score & reasons */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
                        <div className="flex items-center gap-2.5">
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
                        </div>

                        <button
                          onClick={() => setActiveMergePair(pair)}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-[#B88E3E] hover:bg-[#a37c33] text-neutral-950 transition-all flex items-center gap-1.5 shadow-md shadow-[#B88E3E]/20 cursor-pointer self-start sm:self-auto"
                        >
                          <GitMerge className="w-4 h-4" />
                          <span>Обʼєднати персон (Smart Merge)</span>
                        </button>
                      </div>

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
                              onClick={() => setInspectingPersonId(personA.id)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                              title="Переглянути картку"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-xs text-neutral-400 space-y-1 pt-1">
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
                            {(personA.childrenIds?.length || 0) > 0 && (
                              <div className="flex items-center gap-2">
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
                              onClick={() => setInspectingPersonId(personB.id)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                              title="Переглянути картку"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-xs text-neutral-400 space-y-1 pt-1">
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
                            {(personB.childrenIds?.length || 0) > 0 && (
                              <div className="flex items-center gap-2">
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

    </div>
  );
};
