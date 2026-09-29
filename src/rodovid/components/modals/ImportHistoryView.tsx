/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Import and Merge History View
 * Displays statistics for the latest and past merge sessions:
 * - Number of added persons
 * - Number of merged records
 * - List of persons that required manual conflict resolution
 */

import React, { useState, useMemo } from 'react';
import {
  History,
  GitMerge,
  UserPlus,
  Users,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  Calendar,
  MapPin,
  Briefcase,
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  Download,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Clock,
  Layers,
  Heart
} from 'lucide-react';
import { useGenealogyStore } from '../../../stores/useGenealogyStore';
import { ImportHistorySession, ResolvedPersonConflictRecord, ResolvedFieldConflictItem } from '../../utils/mergeDatabase';

interface ImportHistoryViewProps {
  onSelectPerson?: (personId: string) => void;
  onClose?: () => void;
  onOpenImport?: () => void;
  isInsideModal?: boolean;
}

export const ImportHistoryView: React.FC<ImportHistoryViewProps> = ({
  onSelectPerson,
  onClose,
  onOpenImport,
  isInsideModal = false
}) => {
  const importHistory = useGenealogyStore((state) => state.importHistory || []);
  const clearImportHistory = useGenealogyStore((state) => state.clearImportHistory);
  const addImportHistorySession = useGenealogyStore((state) => state.addImportHistorySession);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [resolutionFilter, setResolutionFilter] = useState<'all' | 'take_incoming' | 'keep_existing' | 'combine'>('all');
  const [expandedPersonIds, setExpandedPersonIds] = useState<Record<string, boolean>>({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Active session being viewed (default to latest session)
  const activeSession: ImportHistorySession | null = useMemo(() => {
    if (importHistory.length === 0) return null;
    if (selectedSessionId) {
      const found = importHistory.find((s) => s.id === selectedSessionId);
      if (found) return found;
    }
    return importHistory[0]; // latest session
  }, [importHistory, selectedSessionId]);

  const isLatestSession = useMemo(() => {
    return activeSession && importHistory.length > 0 && activeSession.id === importHistory[0].id;
  }, [activeSession, importHistory]);

  // Filter persons that had conflicts in the active session
  const filteredConflictedPersons = useMemo(() => {
    if (!activeSession) return [];
    const list = activeSession.resolvedPersonsWithConflicts || [];

    return list.filter((person) => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = person.personName.toLowerCase().includes(q);
        const matchField = person.conflicts.some(
          (c) =>
            c.label.toLowerCase().includes(q) ||
            c.existingValue.toLowerCase().includes(q) ||
            c.incomingValue.toLowerCase().includes(q) ||
            c.finalValue.toLowerCase().includes(q)
        );
        if (!matchName && !matchField) return false;
      }

      // Resolution choice filter
      if (resolutionFilter !== 'all') {
        const hasChoice = person.conflicts.some((c) => c.chosenResolution === resolutionFilter);
        if (!hasChoice) return false;
      }

      return true;
    });
  }, [activeSession, searchQuery, resolutionFilter]);

  const togglePersonExpand = (personId: string) => {
    setExpandedPersonIds((prev) => ({
      ...prev,
      [personId]: !prev[personId]
    }));
  };

  const expandAll = () => {
    if (!activeSession) return;
    const map: Record<string, boolean> = {};
    (activeSession.resolvedPersonsWithConflicts || []).forEach((p) => {
      map[p.personId] = true;
    });
    setExpandedPersonIds(map);
  };

  const collapseAll = () => {
    setExpandedPersonIds({});
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const handleExportReport = () => {
    if (!activeSession) return;
    const lines = [
      `=== ЗВІТ ПРО ІМПОРТ ТА ЗЛИТТЯ ДЕРЕВА ===`,
      `Дата сеансу: ${formatDate(activeSession.timestamp)}`,
      `Файл / Джерело: ${activeSession.fileName || 'GEDCOM / JSON'}`,
      `Тип операції: ${activeSession.importType === 'merge' ? "Розумне об'єднання (Smart Merge)" : 'Повна заміна бази'}`,
      `----------------------------------------`,
      `Кількість доданих нових осіб: ${activeSession.newPersonsCount}`,
      `Кількість злитих спільних записів: ${activeSession.matchedCount}`,
      `Кількість осіб із ручним вирішенням конфліктів: ${activeSession.resolvedPersonsWithConflicts?.length || 0}`,
      `Кількість вирішених полів: ${activeSession.conflictsResolvedCount}`,
      activeSession.familiesMergedCount !== undefined ? `Об'єднано родин: ${activeSession.familiesMergedCount}` : '',
      `----------------------------------------`,
      `СПИСОК ОСІБ ІЗ ВИРІШЕНИМИ КОНФЛІКТАМИ:`,
      ''
    ].filter(Boolean);

    (activeSession.resolvedPersonsWithConflicts || []).forEach((p, idx) => {
      lines.push(`${idx + 1}. ${p.personName} (ID: ${p.personId})`);
      p.conflicts.forEach((c) => {
        let choiceText = 'Залишено поточне з дерева';
        if (c.chosenResolution === 'take_incoming') choiceText = 'Прийнято з імпортованого файлу';
        if (c.chosenResolution === 'combine') choiceText = 'Об\'єднано обидва тексти';
        lines.push(`   - [${c.label}]: ${choiceText}`);
        lines.push(`     * Було в дереві: ${c.existingValue || '(порожньо)'}`);
        lines.push(`     * Було у файлі:  ${c.incomingValue || '(порожньо)'}`);
        lines.push(`     * Підсумок:      ${c.finalValue}`);
      });
      lines.push('');
    });

    const reportContent = lines.join('\n');
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Rodovid_Import_Report_${new Date(activeSession.timestamp).toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  // Seed sample demo session if user wants to see what a report looks like
  const handleLoadDemoSession = () => {
    const demoSession: ImportHistorySession = {
      id: `demo_${Date.now()}`,
      timestamp: new Date().toISOString(),
      fileName: 'rodovid_kyiv_family_archive.ged',
      importType: 'merge',
      totalIncomingCount: 28,
      matchedCount: 9,
      newPersonsCount: 19,
      conflictsResolvedCount: 4,
      familiesMergedCount: 6,
      familiesAddedCount: 8,
      resolvedPersonsWithConflicts: [
        {
          personId: 'demo_p1',
          personName: 'Коваленко Василь Федорович',
          birthYear: '1892',
          conflicts: [
            {
              fieldKey: 'birthPlace',
              label: 'Місце народження',
              existingValue: 'м. Київ, Поділ',
              incomingValue: 'м. Київ, Куренівка, парафія св. Петра і Павла',
              chosenResolution: 'take_incoming',
              finalValue: 'м. Київ, Куренівка, парафія св. Петра і Павла'
            },
            {
              fieldKey: 'occupation',
              label: 'Рід занять / Професія',
              existingValue: 'Вчитель гімназії',
              incomingValue: 'Викладач словесності 4-ї Київської гімназії',
              chosenResolution: 'take_incoming',
              finalValue: 'Викладач словесності 4-ї Київської гімназії'
            }
          ]
        },
        {
          personId: 'demo_p2',
          personName: 'Мельник Олена Григорівна',
          birthYear: '1898',
          conflicts: [
            {
              fieldKey: 'deathPlace',
              label: 'Місце смерті',
              existingValue: 'м. Львів',
              incomingValue: 'с. Брюховичі, Львівська область',
              chosenResolution: 'keep_existing',
              finalValue: 'м. Львів'
            }
          ]
        },
        {
          personId: 'demo_p3',
          personName: 'Шевченко Микола Іванович',
          birthYear: '1915',
          conflicts: [
            {
              fieldKey: 'notes',
              label: 'Біографічні нотатки',
              existingValue: 'Учасник Другої світової війни. Нагороджений медалями.',
              incomingValue: 'Служив у 120-му стрілецькому полку. Працював інженером заводу "Арсенал" з 1948 по 1978 рік.',
              chosenResolution: 'combine',
              finalValue: 'Учасник Другої світової війни. Нагороджений медалями.\n\n[Злиття з GEDCOM]:\nСлужив у 120-му стрілецькому полку. Працював інженером заводу "Арсенал" з 1948 по 1978 рік.'
            }
          ]
        }
      ]
    };
    addImportHistorySession(demoSession);
    setSelectedSessionId(demoSession.id);
  };

  // Helper for field icon
  const getFieldIcon = (fieldKey: string) => {
    switch (fieldKey) {
      case 'birthPlace':
      case 'deathPlace':
      case 'burialPlace':
      case 'residencePlace':
        return <MapPin className="w-3.5 h-3.5 text-sky-400" />;
      case 'birthDate':
      case 'birthYear':
      case 'deathDate':
      case 'deathYear':
      case 'burialDate':
        return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
      case 'occupation':
        return <Briefcase className="w-3.5 h-3.5 text-indigo-400" />;
      case 'notes':
        return <FileText className="w-3.5 h-3.5 text-emerald-400" />;
      case 'father':
      case 'mother':
        return <Heart className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Helper for resolution badge
  const renderResolutionBadge = (resolution: 'take_incoming' | 'keep_existing' | 'combine') => {
    if (resolution === 'take_incoming') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Прийнято з файлу імпорту
        </span>
      );
    }
    if (resolution === 'combine') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/80">
          <Layers className="w-3 h-3 text-purple-400" />
          Об'єднано обидва тексти
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
        <CheckCircle2 className="w-3 h-3 text-slate-400" />
        Залишено поточне з дерева
      </span>
    );
  };

  // Empty state if no history exists yet
  if (importHistory.length === 0) {
    return (
      <div className="p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-emerald-400 shadow-xl">
          <History className="w-8 h-8" />
        </div>

        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-base font-bold text-white">Історія імпорту поки що порожня</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Після виконання імпорту або розумного об'єднання файлу GEDCOM тут з'явиться детальний звіт:
            кількість доданих родичів, злитих спільних записів та повний список осіб, у яких виникали розбіжності.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {onOpenImport && (
            <button
              type="button"
              onClick={onOpenImport}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow transition-colors flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Завантажити GEDCOM файл</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLoadDemoSession}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Переглянути зразок звіту</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-200">
      {/* Top Session Selector (if multiple sessions exist) */}
      {importHistory.length > 1 && (
        <div className="flex items-center justify-between gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Сеанси імпорту в базі:</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={activeSession?.id || ''}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {importHistory.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  {idx === 0 ? '★ Останній: ' : ''}
                  {formatDate(s.timestamp)} ({s.fileName || 'GEDCOM'}) — +{s.newPersonsCount} осіб, {s.matchedCount} злито
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Main Highlights Card for the Active Session */}
      {activeSession && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
          {/* Header of the Session */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                  {isLatestSession ? 'Останній сеанс об\'єднання' : 'Архівний сеанс об\'єднання'}
                </span>
                <span className="text-xs text-slate-400">
                  {formatDate(activeSession.timestamp)}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Джерело: {activeSession.fileName || 'GEDCOM / JSON файл'}</span>
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportReport}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Завантажити звіт у текстовому форматі"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>{copiedReport ? 'Збережено!' : 'Експорт звіту'}</span>
              </button>

              {!showClearConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Очистити історію імпортів"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-rose-950/80 border border-rose-800 px-2 py-1 rounded-lg text-[11px]">
                  <span className="text-rose-300">Очистити?</span>
                  <button
                    type="button"
                    onClick={() => {
                      clearImportHistory();
                      setShowClearConfirm(false);
                    }}
                    className="font-bold text-rose-200 hover:text-white underline cursor-pointer"
                  >
                    Так
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    Ні
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 3 Core Highlights Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Added Persons */}
            <div className="p-4 bg-slate-950/60 border border-emerald-900/40 rounded-xl space-y-1 relative overflow-hidden group">
              <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4" />
                  Додано нових осіб
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono">
                  +нові
                </span>
              </div>
              <div className="text-2xl font-black text-white font-mono tracking-tight">
                {activeSession.newPersonsCount}
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Нові картки родичів, додані до вашого родового дерева
              </p>
            </div>

            {/* 2. Merged Records */}
            <div className="p-4 bg-slate-950/60 border border-sky-900/40 rounded-xl space-y-1 relative overflow-hidden group">
              <div className="flex items-center justify-between text-xs text-sky-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <GitMerge className="w-4 h-4" />
                  Злито записів
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 font-mono">
                  спільні
                </span>
              </div>
              <div className="text-2xl font-black text-white font-mono tracking-tight">
                {activeSession.matchedCount}
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Спільні особи, знайдені за ПІБ та роком і доповнені даними
              </p>
            </div>

            {/* 3. Conflicted Persons requiring manual choice */}
            <div className="p-4 bg-slate-950/60 border border-amber-900/40 rounded-xl space-y-1 relative overflow-hidden group">
              <div className="flex items-center justify-between text-xs text-amber-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Вирішено конфліктів
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 font-mono">
                  {activeSession.conflictsResolvedCount} полів
                </span>
              </div>
              <div className="text-2xl font-black text-white font-mono tracking-tight">
                {activeSession.resolvedPersonsWithConflicts?.length || 0}
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Осіб, які вимагали ручного вибору між розбіжностями полів
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Conflicted Persons Section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Список осіб, що вимагали ручного вирішення конфліктів</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {activeSession?.resolvedPersonsWithConflicts?.length || 0}
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              Повний звіт про те, які значення полів розходилися у файлі та яке рішення було обрано під час злиття
            </p>
          </div>

          {activeSession && (activeSession.resolvedPersonsWithConflicts?.length || 0) > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={expandAll}
                className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-900 border border-slate-800 cursor-pointer"
              >
                Розгорнути всі
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-900 border border-slate-800 cursor-pointer"
              >
                Згорнути всі
              </button>
            </div>
          )}
        </div>

        {/* Search & Filter Toolbar */}
        {(activeSession?.resolvedPersonsWithConflicts?.length || 0) > 0 && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Пошук за ПІБ особи або назвою поля..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 text-[11px] hidden sm:inline">Фільтр рішень:</span>
              <button
                type="button"
                onClick={() => setResolutionFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer text-xs ${
                  resolutionFilter === 'all'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Всі
              </button>
              <button
                type="button"
                onClick={() => setResolutionFilter('take_incoming')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer text-xs ${
                  resolutionFilter === 'take_incoming'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                З файлу
              </button>
              <button
                type="button"
                onClick={() => setResolutionFilter('keep_existing')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer text-xs ${
                  resolutionFilter === 'keep_existing'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                З дерева
              </button>
              <button
                type="button"
                onClick={() => setResolutionFilter('combine')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer text-xs ${
                  resolutionFilter === 'combine'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Об'єднано
              </button>
            </div>
          </div>
        )}

        {/* Conflicted Persons Cards List */}
        {(!activeSession?.resolvedPersonsWithConflicts || activeSession.resolvedPersonsWithConflicts.length === 0) ? (
          <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-xl text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <div className="text-xs font-bold text-white">Усі дані об'єднано автоматично без конфліктів</div>
            <p className="text-[11px] text-slate-400 max-w-md mx-auto">
              Під час цього сеансу спільні особи не мали суперечливих даних. Всі нові дати, місця та нотатки
              були додані до дерева автоматично.
            </p>
          </div>
        ) : filteredConflictedPersons.length === 0 ? (
          <div className="p-6 bg-slate-950/40 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
            За вказаними критеріями пошуку не знайдено осіб із розбіжностями.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredConflictedPersons.map((person) => {
              const isExpanded = expandedPersonIds[person.personId] !== false; // expanded by default
              const conflictsCount = person.conflicts.length;

              return (
                <div
                  key={person.personId}
                  className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden transition-all shadow-md"
                >
                  {/* Person Header */}
                  <div className="p-3.5 flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 border-b border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => togglePersonExpand(person.personId)}
                      className="flex items-center gap-3 text-left flex-1 min-w-[200px] cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
                        {person.personName.trim().slice(0, 1) || '👤'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white hover:text-emerald-400 transition-colors flex items-center gap-2">
                          <span>{person.personName}</span>
                          {person.birthYear && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              (*{person.birthYear})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          <span className="text-amber-400 font-medium">
                            {conflictsCount} {conflictsCount === 1 ? 'розбіжність' : conflictsCount < 5 ? 'розбіжності' : 'розбіжностей'}
                          </span>
                          <span>•</span>
                          <span className="font-mono text-slate-500">ID: {person.personId}</span>
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-2">
                      {onSelectPerson && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectPerson(person.personId);
                            if (onClose) onClose();
                          }}
                          className="px-2.5 py-1 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Знайти та відкрити картку цієї особи в родовідному дереві"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Знайти в дереві</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => togglePersonExpand(person.personId)}
                        className="p-1 text-slate-400 hover:text-white rounded cursor-pointer transition-colors"
                        title={isExpanded ? 'Згорнути поля' : 'Розгорнути поля'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Conflicted Fields Breakdown */}
                  {isExpanded && (
                    <div className="p-3.5 space-y-3">
                      {person.conflicts.map((c, cIdx) => (
                        <div
                          key={cIdx}
                          className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg space-y-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                              {getFieldIcon(c.fieldKey)}
                              {c.label}
                            </span>
                            {renderResolutionBadge(c.chosenResolution)}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                            {/* Existing value in tree */}
                            <div className="p-2 bg-slate-950 border border-slate-800 rounded-md space-y-0.5">
                              <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">
                                Було в дереві:
                              </span>
                              <div className="text-slate-300 font-sans break-words whitespace-pre-wrap">
                                {c.existingValue || <span className="text-slate-500 italic">не вказано</span>}
                              </div>
                            </div>

                            {/* Incoming value from file */}
                            <div className="p-2 bg-slate-950 border border-slate-800 rounded-md space-y-0.5">
                              <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">
                                Було у файлі імпорту:
                              </span>
                              <div className="text-slate-300 font-sans break-words whitespace-pre-wrap">
                                {c.incomingValue || <span className="text-slate-500 italic">не вказано</span>}
                              </div>
                            </div>
                          </div>

                          {/* Final saved value */}
                          <div className="p-2 bg-emerald-950/30 border border-emerald-900/40 rounded-md text-[11px] flex items-start gap-2">
                            <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-emerald-300">
                                Підсумок у дереві після злиття:{' '}
                              </span>
                              <span className="text-emerald-100 font-medium whitespace-pre-wrap break-words">
                                {c.finalValue}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
