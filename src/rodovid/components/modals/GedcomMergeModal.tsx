import React, { useState, useMemo } from 'react';
import {
  X,
  GitMerge,
  Replace,
  Download,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  UserCheck,
  UserPlus,
  Users,
  CheckCircle2,
  Sparkles,
  Info,
  MapPin,
  Calendar,
  Briefcase,
  FileText,
  User,
  Heart,
  ArrowRight,
  SlidersHorizontal,
  Search,
  Check,
  RotateCcw,
  Scissors,
  UserX,
  GitFork,
  Trash2
} from 'lucide-react';
import { GenealogyDatabase, Person } from '../../types/genealogy';
import {
  analyzeMerge,
  executeMerge,
  filterDatabaseExcludingBranches,
  getPersonAncestorsIds,
  MergeAnalysis,
  MergeResult,
  ConflictFieldKey,
  ConflictResolutionChoice,
  ConflictResolutions,
  FieldConflict,
  PersonConflictRecord
} from '../../utils/mergeDatabase';
import { downloadGedcom } from '../../utils/gedcom';

interface GedcomMergeModalProps {
  currentDatabase: GenealogyDatabase;
  incomingDatabase: GenealogyDatabase;
  fileName?: string;
  onClose: () => void;
  onApplyMerge: (result: MergeResult) => void;
  onApplyReplace: (database: GenealogyDatabase) => void;
}

export const GedcomMergeModal: React.FC<GedcomMergeModalProps> = ({
  currentDatabase,
  incomingDatabase,
  fileName,
  onClose,
  onApplyMerge,
  onApplyReplace
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'conflicts' | 'branches'>('overview');
  const [showDetails, setShowDetails] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'places' | 'dates' | 'names' | 'other'>('all');

  // Branch exclusion state: IDs in incomingDatabase whose ancestors should NOT be imported
  const [excludeAncestorsOf, setExcludeAncestorsOf] = useState<string[]>([]);
  // Individual persons in incomingDatabase that should be completely omitted
  const [excludeIndividuals, setExcludeIndividuals] = useState<string[]>([]);
  const [branchSearch, setBranchSearch] = useState('');

  // Detect special preset persons (like Новік Анатолій and Сергій Кочанов) in the incoming database
  const detectedBranchPresets = useMemo(() => {
    const list: {
      person: Person;
      label: string;
      ancestorsCount: number;
      ancestorsNames: string[];
    }[] = [];
    const persons = incomingDatabase.persons || {};

    for (const p of Object.values(persons)) {
      const fullName = `${p.lastName || ''} ${p.firstName || ''} ${p.patronymic || ''} ${p.name?.surname || ''} ${p.name?.given || ''}`.toLowerCase();

      const isNovikAnatoliy =
        (fullName.includes('новік') || fullName.includes('новик') || fullName.includes('novik')) &&
        (fullName.includes('анатол') || fullName.includes('anatol'));
      const isKochanovSerhiy =
        (fullName.includes('кочанов') || fullName.includes('кочан') || fullName.includes('kochan')) &&
        (fullName.includes('серг') || fullName.includes('serh') || fullName.includes('serg'));

      if (isNovikAnatoliy || isKochanovSerhiy) {
        const ancIds = getPersonAncestorsIds(p.id, persons);
        const ancNames = Array.from(ancIds)
          .slice(0, 6)
          .map((id) => {
            const anc = persons[id];
            return anc ? `${anc.lastName || ''} ${anc.firstName || ''}`.trim() : id;
          });
        list.push({
          person: p,
          label: isNovikAnatoliy ? 'Анатолій Новік' : 'Сергій Кочанов',
          ancestorsCount: ancIds.size,
          ancestorsNames: ancNames
        });
      }
    }
    return list;
  }, [incomingDatabase]);

  // Compute filtered incoming database excluding requested branches and individuals
  const { filteredDb: effectiveIncomingDb, excludedPersonIds, severedPersonIds } = useMemo(() => {
    return filterDatabaseExcludingBranches(
      incomingDatabase,
      excludeAncestorsOf,
      excludeIndividuals
    );
  }, [incomingDatabase, excludeAncestorsOf, excludeIndividuals]);

  // Perform pre-merge analysis against the filtered incoming database
  const analysis: MergeAnalysis = useMemo(() => {
    return analyzeMerge(currentDatabase, effectiveIncomingDb);
  }, [currentDatabase, effectiveIncomingDb]);

  // Initial conflict resolutions state: default all to 'keep_existing' (safest option)
  const [resolutions, setResolutions] = useState<ConflictResolutions>(() => {
    const initial: ConflictResolutions = {};
    analysis.conflicts.forEach((p) => {
      initial[p.personId] = {} as any;
      p.conflicts.forEach((c) => {
        initial[p.personId][c.fieldKey] = 'keep_existing';
      });
    });
    return initial;
  });

  const existingCount = Object.keys(currentDatabase.persons || {}).length;
  const rawIncomingCount = Object.keys(incomingDatabase.persons || {}).length;
  const incomingCount = Object.keys(effectiveIncomingDb.persons || {}).length;
  const matchedCount = analysis.matchedPersons.length;
  const newPersonsCount = analysis.newPersons.length;
  const totalConflictsCount = analysis.totalConflictsCount;
  const personsWithConflictsCount = analysis.conflicts.length;

  // Set single field resolution
  const handleSetResolution = (
    personId: string,
    fieldKey: ConflictFieldKey,
    choice: ConflictResolutionChoice
  ) => {
    setResolutions((prev) => ({
      ...prev,
      [personId]: {
        ...(prev[personId] || {}),
        [fieldKey]: choice
      }
    }));
  };

  // Bulk set resolution for a specific person
  const handleSetPersonAllResolutions = (
    person: PersonConflictRecord,
    choice: ConflictResolutionChoice
  ) => {
    setResolutions((prev) => {
      const nextPersonMap: Record<string, ConflictResolutionChoice> = { ...(prev[person.personId] || {}) };
      person.conflicts.forEach((c) => {
        nextPersonMap[c.fieldKey] = choice;
      });
      return {
        ...prev,
        [person.personId]: nextPersonMap
      };
    });
  };

  // Global bulk set resolution for all conflicts
  const handleSetAllResolutions = (choice: ConflictResolutionChoice) => {
    setResolutions(() => {
      const next: ConflictResolutions = {};
      analysis.conflicts.forEach((p) => {
        next[p.personId] = {} as any;
        p.conflicts.forEach((c) => {
          next[p.personId][c.fieldKey] = choice;
        });
      });
      return next;
    });
  };

  // Calculate resolution stats
  const resolutionStats = useMemo(() => {
    let keepCount = 0;
    let takeCount = 0;
    let combineCount = 0;

    analysis.conflicts.forEach((p) => {
      p.conflicts.forEach((c) => {
        const choice = resolutions[p.personId]?.[c.fieldKey] || 'keep_existing';
        if (choice === 'keep_existing') keepCount++;
        else if (choice === 'take_incoming') takeCount++;
        else if (choice === 'combine') combineCount++;
      });
    });

    return { keepCount, takeCount, combineCount };
  }, [analysis.conflicts, resolutions]);

  // Filtered conflicts list
  const filteredConflicts = useMemo(() => {
    return analysis.conflicts
      .map((p) => {
        const matchesSearch =
          !searchQuery.trim() ||
          p.personName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
          p.conflicts.some(
            (c) =>
              c.label.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
              c.existingValue.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
              c.incomingValue.toLowerCase().includes(searchQuery.toLowerCase().trim())
          );

        if (!matchesSearch) return null;

        const filteredList = p.conflicts.filter((c) => {
          if (categoryFilter === 'all') return true;
          if (categoryFilter === 'places') return c.fieldKey.toLowerCase().includes('place');
          if (categoryFilter === 'dates') return c.fieldKey.toLowerCase().includes('date') || c.fieldKey.toLowerCase().includes('year');
          if (categoryFilter === 'names') return c.category === 'names' || c.category === 'parents';
          if (categoryFilter === 'other') return c.fieldKey === 'occupation' || c.fieldKey === 'residencePlace' || c.fieldKey === 'notes';
          return true;
        });

        if (filteredList.length === 0) return null;

        return {
          ...p,
          conflicts: filteredList
        };
      })
      .filter(Boolean) as PersonConflictRecord[];
  }, [analysis.conflicts, searchQuery, categoryFilter]);

  const handleMergeClick = () => {
    const result = executeMerge(currentDatabase, effectiveIncomingDb, analysis, resolutions);
    onApplyMerge(result);
  };

  const handleReplaceClick = () => {
    onApplyReplace(effectiveIncomingDb);
  };

  const handleDownloadBackup = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadGedcom(currentDatabase, `backup_before_import_${dateStr}.ged`);
  };

  const getFieldIcon = (fieldKey: ConflictFieldKey) => {
    if (fieldKey.includes('Place')) return <MapPin className="w-3.5 h-3.5 text-rose-400" />;
    if (fieldKey.includes('Date') || fieldKey.includes('Year')) return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
    if (fieldKey === 'occupation') return <Briefcase className="w-3.5 h-3.5 text-sky-400" />;
    if (fieldKey === 'notes') return <FileText className="w-3.5 h-3.5 text-purple-400" />;
    if (fieldKey === 'deathReason') return <Heart className="w-3.5 h-3.5 text-red-400" />;
    return <User className="w-3.5 h-3.5 text-emerald-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-4 sm:my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                Імпорт та об'єднання родинного дерева
              </h2>
              <p className="text-[11px] text-slate-400">
                {fileName ? `Файл: ${fileName}` : 'Нові дані GEDCOM'} • у поточному дереві{' '}
                <strong className="text-slate-200">{existingCount} осіб</strong>
                {excludedPersonIds.length > 0 && (
                  <span className="ml-2 text-rose-400 font-semibold">
                    (відсічено {excludedPersonIds.length} предків)
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 pt-3 border-b border-slate-800 bg-slate-950/40 flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'overview'
                ? 'border-amber-500 text-white bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Огляд та статистика</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('branches')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'branches'
                ? 'border-amber-500 text-white bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Фільтр гілок та предків</span>
            {excludedPersonIds.length > 0 ? (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                -{excludedPersonIds.length}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-400 font-medium">
                0
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('conflicts')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'conflicts'
                ? 'border-amber-500 text-white bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Вирішення розбіжностей</span>
            {totalConflictsCount > 0 ? (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                {totalConflictsCount}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-400 font-medium">
                0
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto scrollbar-thin flex-1 text-slate-300">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-lg font-extrabold text-emerald-400">{matchedCount}</div>
                    <div className="text-[11px] font-medium text-emerald-300/80 leading-tight">
                      Спільних осіб (збігів)
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-800/50 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 shrink-0">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-lg font-extrabold text-sky-400">{newPersonsCount}</div>
                    <div className="text-[11px] font-medium text-sky-300/80 leading-tight">
                      Нових родичів та предків
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-slate-700/50 text-slate-300 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-lg font-extrabold text-slate-200">
                      {incomingCount}
                      {rawIncomingCount !== incomingCount && (
                        <span className="text-xs text-rose-400 font-normal ml-1.5">
                          (було {rawIncomingCount})
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-medium text-slate-400 leading-tight">
                      Буде імпортовано осіб
                    </div>
                  </div>
                </div>
              </div>

              {/* Branch exclusion banner & quick controls */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-200">
                      Відсікання небажаних предків перед імпортом
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('branches')}
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <span>Усі гілки та пошук</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {detectedBranchPresets.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {detectedBranchPresets.map((preset, idx) => {
                      const isExcluded = excludeAncestorsOf.includes(preset.person.id);
                      return (
                        <button
                          key={`preset_top_${preset.person.id}_${idx}`}
                          type="button"
                          onClick={() => {
                            setExcludeAncestorsOf((prev) =>
                              isExcluded ? prev.filter((id) => id !== preset.person.id) : [...prev, preset.person.id]
                            );
                          }}
                          className={`p-3 rounded-lg border text-left text-xs transition-all flex items-center justify-between gap-3 cursor-pointer ${
                            isExcluded
                              ? 'bg-rose-950/40 border-rose-500/80 text-rose-200 shadow-sm ring-1 ring-rose-500/30'
                              : 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                          }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="font-bold flex items-center gap-1.5 truncate">
                              <UserX className={`w-3.5 h-3.5 shrink-0 ${isExcluded ? 'text-rose-400' : 'text-slate-400'}`} />
                              <span className="truncate">{preset.label}</span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {isExcluded
                                ? `✓ Відсічено ${preset.ancestorsCount} предків`
                                : `Відсікти предків (${preset.ancestorsCount} осіб)`}
                            </div>
                          </div>

                          <div
                            className={`px-2 py-1 rounded text-[10px] font-bold shrink-0 transition-colors ${
                              isExcluded
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                            }`}
                          >
                            {isExcluded ? 'Відсічено ✓' : 'Відсікти'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Ви можете обрати будь-яку особу у файлі, щоб не додавати її предків до дерева.</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('branches')}
                      className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                    >
                      Налаштувати фільтри
                    </button>
                  </div>
                )}

                {excludedPersonIds.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/50 flex items-center justify-between text-[11px] text-rose-300">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>
                        Фільтр активний: <strong>{excludedPersonIds.length} осіб</strong> не будуть додані до дерева.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setExcludeAncestorsOf([]);
                        setExcludeIndividuals([]);
                      }}
                      className="text-rose-400 hover:text-rose-200 underline text-[10px] font-medium cursor-pointer"
                    >
                      Скинути фільтри
                    </button>
                  </div>
                )}
              </div>

              {/* Conflict Notification Banner if conflicts exist */}
              {totalConflictsCount > 0 ? (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 border border-amber-600/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-amber-200 flex items-center gap-2">
                        <span>Виявлено {totalConflictsCount} розбіжностей у даних</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {personsWithConflictsCount} {personsWithConflictsCount === 1 ? 'особа' : 'осіб'}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-300/80 mt-1 max-w-xl leading-relaxed">
                        У спільних родичів відрізняються окремі поля (наприклад, місце народження, дата смерті або професія).
                        Ви можете точно обрати, які значення зберегти для кожного поля.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('conflicts')}
                    className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-md shadow-amber-950/50 cursor-pointer"
                  >
                    <span>Переглянути розбіжності</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-center gap-3 text-xs text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>
                    Розбіжностей у полях не виявлено. Всі порожні поля будуть збагачені даними з файлу автоматично!
                  </span>
                </div>
              )}

              {/* Explanation Banner */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-200">
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Правила розумного об'єднання:</span>
                </div>
                <ul className="text-slate-400 text-[11px] space-y-1.5 pl-6 list-disc marker:text-amber-500">
                  <li>
                    <strong className="text-slate-200">Жодна особа не втрачається:</strong> всі ваші внесені родичі та зв'язки залишаються збереженими.
                  </li>
                  <li>
                    <strong className="text-slate-200">Збагачення порожніх полів:</strong> якщо в картці не було дати чи місця, вони автоматично заповнюються з файлу.
                  </li>
                  <li>
                    <strong className="text-slate-200">Вирішення конфліктів:</strong> якщо значення різняться (наприклад, різні міста народження), ви особисто обираєте потрібне.
                  </li>
                  <li>
                    <strong className="text-slate-200">Підв'язка нових гілок:</strong> родичі, яких не було в базі, додаються як нові картки зі збереженням родинних зв'язків.
                  </li>
                </ul>
              </div>

              {/* Matched Details Accordion */}
              {matchedCount > 0 && (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                  <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>Попередній перегляд знайдених збігів ({matchedCount} осіб)</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <span>{showDetails ? 'Сховати' : 'Показати'}</span>
                      {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {showDetails && (
                    <div className="p-3 border-t border-slate-800 space-y-2 max-h-56 overflow-y-auto scrollbar-thin text-xs">
                      {analysis.matchedPersons.map((m, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between font-medium">
                            <span className="text-slate-200 font-semibold">
                              {m.existingPerson.lastName} {m.existingPerson.firstName}{' '}
                              {m.existingPerson.patronymic || ''}
                              {m.existingPerson.birthYear ? ` (${m.existingPerson.birthYear})` : ''}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
                              Збіг
                            </span>
                          </div>
                          <div className="text-slate-400 text-[10px]">{m.matchReason}</div>
                          {m.enrichedFields.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              <span className="text-[10px] text-amber-300 font-medium">Буде доповнено:</span>
                              {m.enrichedFields.map((f, fIdx) => (
                                <span
                                  key={fIdx}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20"
                                >
                                  +{f}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONFLICT RESOLUTION */}
          {activeTab === 'conflicts' && (
            <div className="space-y-4">
              {totalConflictsCount === 0 ? (
                <div className="py-12 px-4 text-center space-y-3 bg-slate-950/40 rounded-xl border border-slate-800">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Розбіжностей у даних не виявлено!</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    Усі спільні особи мають ідентичні значення або інформацію, яка безконфліктно доповнює ваше родинне дерево.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('overview')}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
                  >
                    Повернутися до огляду
                  </button>
                </div>
              ) : (
                <>
                  {/* Top Toolbar */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">Швидкі дії для всіх {totalConflictsCount} розбіжностей:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSetAllResolutions('keep_existing')}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Залишити поточні значення з дерева для всіх полів"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Залишити все поточне</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAllResolutions('take_incoming')}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900/60 border border-sky-700/60 text-sky-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Взяти нові значення з файлу імпорту для всіх полів"
                        >
                          <Check className="w-3 h-3" />
                          <span>Прийняти все з файлу</span>
                        </button>
                      </div>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-800/80">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Пошук особи або значення..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                        {(['all', 'places', 'dates', 'names', 'other'] as const).map((cat) => {
                          const labels: Record<string, string> = {
                            all: 'Всі',
                            places: 'Місця',
                            dates: 'Дати',
                            names: 'ПІБ',
                            other: 'Інше'
                          };
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setCategoryFilter(cat)}
                              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                                categoryFilter === cat
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                              }`}
                            >
                              {labels[cat]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Summary of decisions */}
                  <div className="flex items-center justify-between text-[11px] px-1 text-slate-400">
                    <div>
                      Збережено поточних: <strong className="text-emerald-400">{resolutionStats.keepCount}</strong> •
                      З файлу обрано: <strong className="text-sky-400">{resolutionStats.takeCount}</strong>
                      {resolutionStats.combineCount > 0 && (
                        <span> • Об'єднано нотаток: <strong className="text-purple-400">{resolutionStats.combineCount}</strong></span>
                      )}
                    </div>
                    <div>
                      Показано осіб: <strong className="text-slate-200">{filteredConflicts.length}</strong> з {analysis.conflicts.length}
                    </div>
                  </div>

                  {/* Conflict Person Cards */}
                  <div className="space-y-4">
                    {filteredConflicts.map((personRecord) => (
                      <div
                        key={personRecord.personId}
                        className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden"
                      >
                        {/* Person Header */}
                        <div className="px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-[10px]">
                              {personRecord.personName.slice(0, 1)}
                            </div>
                            <span className="text-xs font-bold text-white">
                              {personRecord.personName}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/20">
                              {personRecord.conflicts.length}{' '}
                              {personRecord.conflicts.length === 1 ? 'розбіжність' : 'розбіжності'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-slate-500 text-[10px] mr-1">Для цієї особи:</span>
                            <button
                              type="button"
                              onClick={() => handleSetPersonAllResolutions(personRecord, 'keep_existing')}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] transition-colors cursor-pointer"
                            >
                              Всі поточні
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetPersonAllResolutions(personRecord, 'take_incoming')}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-sky-200 text-[10px] transition-colors cursor-pointer"
                            >
                              Всі з файлу
                            </button>
                          </div>
                        </div>

                        {/* Conflicting Fields List */}
                        <div className="p-3 space-y-3">
                          {personRecord.conflicts.map((conflict) => {
                            const currentChoice =
                              resolutions[personRecord.personId]?.[conflict.fieldKey] || 'keep_existing';

                            return (
                              <div
                                key={conflict.fieldKey}
                                className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2"
                              >
                                {/* Field Label Bar */}
                                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                                  {getFieldIcon(conflict.fieldKey)}
                                  <span>{conflict.label}</span>
                                </div>

                                {/* Comparison Options Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  {/* Option A: Current in Tree */}
                                  <div
                                    onClick={() =>
                                      handleSetResolution(personRecord.personId, conflict.fieldKey, 'keep_existing')
                                    }
                                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                                      currentChoice === 'keep_existing'
                                        ? 'bg-emerald-950/40 border-emerald-600/80 shadow-sm ring-1 ring-emerald-500/30'
                                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 opacity-75 hover:opacity-100'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="font-semibold text-emerald-400">
                                        Поточне в дереві
                                      </span>
                                      <div
                                        className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                                          currentChoice === 'keep_existing'
                                            ? 'bg-emerald-500 text-slate-950 font-bold'
                                            : 'border border-slate-700'
                                        }`}
                                      >
                                        {currentChoice === 'keep_existing' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                      </div>
                                    </div>
                                    <div className="font-medium text-slate-200 break-words line-clamp-3">
                                      {conflict.existingValue}
                                    </div>
                                  </div>

                                  {/* Option B: Incoming from File */}
                                  <div
                                    onClick={() =>
                                      handleSetResolution(personRecord.personId, conflict.fieldKey, 'take_incoming')
                                    }
                                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                                      currentChoice === 'take_incoming'
                                        ? 'bg-sky-950/40 border-sky-600/80 shadow-sm ring-1 ring-sky-500/30'
                                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 opacity-75 hover:opacity-100'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="font-semibold text-sky-400">
                                        З файлу імпорту
                                      </span>
                                      <div
                                        className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                                          currentChoice === 'take_incoming'
                                            ? 'bg-sky-500 text-slate-950 font-bold'
                                            : 'border border-slate-700'
                                        }`}
                                      >
                                        {currentChoice === 'take_incoming' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                      </div>
                                    </div>
                                    <div className="font-medium text-slate-200 break-words line-clamp-3">
                                      {conflict.incomingValue}
                                    </div>
                                  </div>
                                </div>

                                {/* Option C: For Notes - Combine Both Texts */}
                                {conflict.fieldKey === 'notes' && (
                                  <div className="pt-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSetResolution(personRecord.personId, conflict.fieldKey, 'combine')
                                      }
                                      className={`w-full px-3 py-1.5 rounded-lg border text-left text-[11px] font-medium transition-all flex items-center justify-between cursor-pointer ${
                                        currentChoice === 'combine'
                                          ? 'bg-purple-950/40 border-purple-500/80 text-purple-200 ring-1 ring-purple-500/30'
                                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5 text-purple-400" />
                                        <span>Об'єднати обидва тексти (дописати новий текст до існуючого)</span>
                                      </div>
                                      <div
                                        className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                                          currentChoice === 'combine'
                                            ? 'bg-purple-500 text-slate-950 font-bold'
                                            : 'border border-slate-700'
                                        }`}
                                      >
                                        {currentChoice === 'combine' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                      </div>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: BRANCHES & ANCESTORS FILTER */}
          {activeTab === 'branches' && (
            <div className="space-y-4">
              {/* Informative Banner */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2.5 text-slate-200 text-xs font-bold">
                  <Scissors className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Відсікання небажаних предків під час імпорту</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Якщо ви не бажаєте додавати до свого родинного дерева предків певної людини (наприклад, Новіка Анатолія чи Сергія Кочанова),
                  ви можете відсікти їх тут одним кліком. Сама особа залишиться у дереві, але її зв'язок із батьками буде розірвано, а всі її прямі предки (батьки, дідусі, прадіди тощо) з імпортованого файлу не будуть додані.
                </p>
              </div>

              {/* Presets: Recommended / Detected Persons */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <UserX className="w-3.5 h-3.5 text-amber-400" />
                    <span>Швидкі перемикачі для запитаних осіб:</span>
                  </h3>
                  {excludeAncestorsOf.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExcludeAncestorsOf([])}
                      className="text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Очистити виключення предків
                    </button>
                  )}
                </div>

                {detectedBranchPresets.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {detectedBranchPresets.map((preset, idx) => {
                      const isAncestorsExcluded = excludeAncestorsOf.includes(preset.person.id);
                      return (
                        <div
                          key={`preset_btm_${preset.person.id}_${idx}`}
                          className={`p-3.5 rounded-xl border transition-all space-y-3 ${
                            isAncestorsExcluded
                              ? 'bg-rose-950/30 border-rose-500/70 shadow-md ring-1 ring-rose-500/30'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                                <span>{preset.label}</span>
                                {isAncestorsExcluded && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                                    Предки відсічені
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {preset.person.birthDate || preset.person.birthYear || 'Рік не вказано'}
                                {preset.person.deathDate || preset.person.deathYear
                                  ? ` – ${preset.person.deathDate || preset.person.deathYear}`
                                  : ''}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-extrabold text-amber-400">
                                {preset.ancestorsCount}
                              </span>
                              <div className="text-[10px] text-slate-500">предків у файлі</div>
                            </div>
                          </div>

                          {preset.ancestorsNames.length > 0 && (
                            <div className="text-[10px] text-slate-400 bg-slate-900/80 p-2 rounded-lg border border-slate-850 space-y-1">
                              <div className="text-slate-500 font-medium">Знайдені предки у файлі:</div>
                              <div className="flex flex-wrap gap-1">
                                {preset.ancestorsNames.map((name, idx) => (
                                  <span
                                    key={idx}
                                    className={`px-1.5 py-0.5 rounded ${
                                      isAncestorsExcluded
                                        ? 'bg-rose-950/60 text-rose-300/80 line-through'
                                        : 'bg-slate-800 text-slate-300'
                                    }`}
                                  >
                                    {name}
                                  </span>
                                ))}
                                {preset.ancestorsCount > preset.ancestorsNames.length && (
                                  <span className="text-slate-500 self-center">
                                    +{preset.ancestorsCount - preset.ancestorsNames.length} ще
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setExcludeAncestorsOf((prev) =>
                                  isAncestorsExcluded
                                    ? prev.filter((id) => id !== preset.person.id)
                                    : [...prev, preset.person.id]
                                );
                              }}
                              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                isAncestorsExcluded
                                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm'
                                  : 'bg-slate-800 hover:bg-rose-950/60 hover:text-rose-200 hover:border-rose-700/60 border border-slate-700 text-slate-200'
                              }`}
                            >
                              <Scissors className="w-3.5 h-3.5" />
                              <span>
                                {isAncestorsExcluded
                                  ? `Предків відсічено (-${preset.ancestorsCount}) ✓`
                                  : `Не імпортувати предків (-${preset.ancestorsCount})`}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-400">
                    У поточному файлі імпорту автоматично не виявлено осіб з іменами «Новік Анатолій» або «Сергій Кочанов». Ви можете знайти будь-яку особу вручну через пошук нижче.
                  </div>
                )}
              </div>

              {/* Custom Search in Incoming Database */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <Search className="w-3.5 h-3.5 text-amber-400" />
                    <span>Пошук будь-якої іншої особи для відсікання предків</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    У файлі {rawIncomingCount} осіб
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    placeholder="Введіть прізвище або ім'я особи з файлу імпорту..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-750 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/70"
                  />
                </div>

                {branchSearch.trim().length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin pt-1">
                    {Object.values(incomingDatabase.persons || {})
                      .filter((p) => {
                        const nameStr = `${p.lastName || ''} ${p.firstName || ''} ${p.patronymic || ''} ${p.name?.surname || ''} ${p.name?.given || ''}`.toLowerCase();
                        return nameStr.includes(branchSearch.toLowerCase().trim());
                      })
                      .slice(0, 15)
                      .map((p, idx) => {
                        const isAncestorsExcluded = excludeAncestorsOf.includes(p.id);
                        const isPersonExcluded = excludeIndividuals.includes(p.id);
                        const ancIds = getPersonAncestorsIds(p.id, incomingDatabase.persons || {});
                        const fullName = `${p.lastName || ''} ${p.firstName || ''} ${p.patronymic || ''}`.trim() || 'Без імені';

                        return (
                          <div
                            key={`inc_p_${p.id}_${idx}`}
                            className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                                <span>{fullName}</span>
                                {isAncestorsExcluded && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                                    Предки відсічені
                                  </span>
                                )}
                                {isPersonExcluded && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-900/50 text-rose-400">
                                    Виключено
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {p.birthDate || p.birthYear || '—'} – {p.deathDate || p.deathYear || '—'} • Прямих предків у файлі: {ancIds.size}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={ancIds.size === 0}
                                onClick={() => {
                                  setExcludeAncestorsOf((prev) =>
                                    isAncestorsExcluded ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                                  );
                                }}
                                className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                                  ancIds.size === 0
                                    ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500'
                                    : isAncestorsExcluded
                                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                    : 'bg-slate-800 hover:bg-rose-950/60 hover:text-rose-200 border border-slate-700 text-slate-300'
                                }`}
                              >
                                <Scissors className="w-3 h-3" />
                                <span>
                                  {isAncestorsExcluded
                                    ? `Предків відсічено (-${ancIds.size})`
                                    : `Відсікти предків (${ancIds.size})`}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setExcludeIndividuals((prev) =>
                                    isPersonExcluded ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                                  );
                                }}
                                className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                                  isPersonExcluded
                                    ? 'bg-rose-800 text-white'
                                    : 'bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border border-slate-700'
                                }`}
                                title="Повністю не імпортувати цю людину"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>{isPersonExcluded ? 'Пропущено' : 'Пропустити'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Exclusions Summary */}
              {excludedPersonIds.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>
                        Загалом буде відсіяно {excludedPersonIds.length} осіб із файлу імпорту
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setExcludeAncestorsOf([]);
                        setExcludeIndividuals([]);
                      }}
                      className="text-[11px] text-rose-300 hover:text-white underline cursor-pointer"
                    >
                      Скасувати всі виключення
                    </button>
                  </div>

                  <p className="text-[11px] text-rose-200/70 leading-relaxed">
                    Ці особи не будуть додані ані при об'єднанні, ані при повній заміні дерева. Батьківські зв'язки осіб на межі відсікання безпечно очищено.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Warning before replacement */}
          {showReplaceConfirm && (
            <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5 text-rose-300 text-xs">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Увага! Повне заміщення видалить поточне дерево</div>
                  <div className="text-[11px] text-rose-300/80 mt-1">
                    Всі поточні {existingCount} осіб будуть стерті та замінені вмістом файлу. Рекомендуємо спочатку зберегти резервну копію.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Зберегти резервну копію (.ged)</span>
                </button>
                <button
                  type="button"
                  onClick={handleReplaceClick}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Так, замінити повністю
                </button>
                <button
                  type="button"
                  onClick={() => setShowReplaceConfirm(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Скасувати
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          {!showReplaceConfirm ? (
            <button
              type="button"
              onClick={() => setShowReplaceConfirm(true)}
              className="text-xs text-slate-400 hover:text-rose-300 flex items-center gap-1.5 transition-colors cursor-pointer order-2 sm:order-1"
            >
              <Replace className="w-3.5 h-3.5" />
              <span>Повна заміна замість об'єднання</span>
            </button>
          ) : (
            <div className="order-2 sm:order-1" />
          )}

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end order-1 sm:order-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Скасувати
            </button>

            <button
              type="button"
              onClick={handleMergeClick}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <GitMerge className="w-4 h-4" />
              <span>
                {totalConflictsCount > 0
                  ? `Застосувати та об'єднати дерево`
                  : `Об'єднати з поточним деревом`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
