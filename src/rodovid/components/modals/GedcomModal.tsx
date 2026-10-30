import React, { useState } from 'react';
import {
  X,
  Upload,
  Download,
  FileCode,
  CheckCircle2,
  RefreshCw,
  FolderOpen,
  Sparkles,
  TreeDeciduous,
  History,
  ArrowRight
} from 'lucide-react';
import { GenealogyDatabase } from '../../types/genealogy';
import { parseGedcom, exportToGedcom } from '../../utils/gedcom';
import { parseGedcomAsync } from '../../../workers/workerBridge';
import { GedcomMergeModal } from './GedcomMergeModal';
import { ImportHistoryView } from './ImportHistoryView';
import { useGenealogyStore } from '../../../stores/useGenealogyStore';
import { MergeResult } from '../../utils/mergeDatabase';

interface GedcomModalProps {
  database: GenealogyDatabase;
  onClose: () => void;
  onImportDatabase: (newDb: GenealogyDatabase) => void;
  initialTab?: 'import' | 'export' | 'history';
  onSelectPerson?: (personId: string) => void;
}

export const GedcomModal: React.FC<GedcomModalProps> = ({
  database,
  onClose,
  onImportDatabase,
  initialTab = 'import',
  onSelectPerson
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'history'>(initialTab);
  const [pastedGedcom, setPastedGedcom] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [pendingMerge, setPendingMerge] = useState<{
    incomingDb: GenealogyDatabase;
    fileName?: string;
  } | null>(null);

  const importHistory = useGenealogyStore((state) => state.importHistory || []);

  // File Upload handler with background Web Worker
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsParsing(true);
        setParseProgress(0);
        setImportStatus(null);
        const text = event.target?.result as string;
        let parsedDb: GenealogyDatabase;
        if (file.name.endsWith('.json')) {
          parsedDb = JSON.parse(text);
          setParseProgress(100);
        } else {
          parsedDb = await parseGedcomAsync(text, (percent) => setParseProgress(percent));
        }

        const personCount = Object.keys(parsedDb.persons || {}).length;
        if (personCount === 0) {
          setImportStatus('Файл не містить записів осіб (INDI).');
          setIsParsing(false);
          return;
        }

        setIsParsing(false);
        // Open merge & branch filter modal to allow conflict resolution and ancestor exclusion
        setPendingMerge({ incomingDb: parsedDb, fileName: file.name });
      } catch (err: any) {
        setIsParsing(false);
        setImportStatus(`Помилка під час читання файлу: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleImportPasted = async () => {
    if (!pastedGedcom.trim() || isParsing) return;
    try {
      setIsParsing(true);
      setParseProgress(0);
      setImportStatus(null);
      const parsedDb = await parseGedcomAsync(pastedGedcom, (percent) => setParseProgress(percent));
      const personCount = Object.keys(parsedDb.persons || {}).length;
      if (personCount === 0) {
        setImportStatus('Введений текст не містить записів осіб (INDI).');
        setIsParsing(false);
        return;
      }

      setIsParsing(false);
      // Open merge & branch filter modal to allow conflict resolution and ancestor exclusion
      setPendingMerge({ incomingDb: parsedDb, fileName: 'Вставлений текст GEDCOM' });
    } catch (err: any) {
      setIsParsing(false);
      setImportStatus(`Помилка під час парсингу: ${err.message}`);
    }
  };

  // Download GEDCOM file
  const handleDownloadGedcom = () => {
    const gedcomContent = exportToGedcom(database);
    const blob = new Blob([gedcomContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Gramps_Family_Tree_${new Date().toISOString().slice(0, 10)}.ged`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download JSON backup
  const handleDownloadJson = () => {
    const jsonContent = JSON.stringify(database, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Gramps_Database_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className={`bg-slate-900 border border-slate-800 rounded-2xl w-full shadow-2xl overflow-hidden my-8 transition-all duration-200 animate-in fade-in zoom-in-95 ${
        activeTab === 'history' ? 'max-w-4xl' : 'max-w-xl'
      }`}>
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              Імпорт / Експорт GEDCOM та резервні копії
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-5 gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('import')}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'import'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Імпорт (.ged / .json)
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'export'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Експорт бази
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Історія імпорту</span>
            {importHistory.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'history'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {importHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto scrollbar-thin">
          {importStatus && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{importStatus}</span>
              </div>
              {importHistory.length > 0 && activeTab !== 'history' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="text-xs font-semibold text-emerald-300 hover:text-white underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Переглянути звіт в історії імпорту</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <ImportHistoryView
              onSelectPerson={onSelectPerson}
              onClose={onClose}
              onOpenImport={() => setActiveTab('import')}
              isInsideModal={true}
            />
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* Web Worker parsing progress indicator */}
              {isParsing && (
                <div className="p-4 bg-emerald-950/70 border border-emerald-700/80 rounded-xl space-y-2 shadow-inner">
                  <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Обробка GEDCOM у фоновому потоці (Web Worker)...</span>
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">{parseProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-emerald-800/60">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-150"
                      style={{ width: `${Math.max(5, parseProgress)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Парсинг виконується в окремому потоці Web Worker — інтерфейс залишається повністю плавним (60 FPS).
                  </p>
                </div>
              )}

              {/* File upload drag drop box */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Завантажте файл GEDCOM (.ged) або резервну копію JSON:
                </label>
                <label className={`flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl cursor-pointer bg-slate-950/60 hover:bg-slate-950 transition-colors ${isParsing ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload className="w-8 h-8 text-emerald-400 mb-2" />
                  <span className="text-xs font-medium text-slate-200">
                    Оберіть файл .ged або .json на комп'ютері
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">
                    Підтримуються експорти з Gramps, MyHeritage, Дерево Життя, FamilySearch
                  </span>
                  <input
                    type="file"
                    accept=".ged,.gedcom,.json"
                    onChange={handleFileUpload}
                    disabled={isParsing}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Paste GEDCOM text directly */}
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Або вставте текст GEDCOM вручну:
                </label>
                <textarea
                  rows={4}
                  value={pastedGedcom}
                  onChange={(e) => setPastedGedcom(e.target.value)}
                  disabled={isParsing}
                  placeholder="0 HEAD&#10;1 SOUR GRAMPS...&#10;0 @I1@ INDI&#10;1 NAME Іван /Іванов/..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleImportPasted}
                  disabled={!pastedGedcom.trim() || isParsing}
                  className="mt-2 w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isParsing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isParsing ? `Обробка (${parseProgress}%)...` : 'Розпізнати та імпортувати'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Ви можете зберегти своє дерево у стандартному форматі GEDCOM 5.5.1 (для відкриття у
                десктопному Gramps або мобільних додатках) або у вигляді повного JSON-файлу для
                резервного копіювання.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleDownloadGedcom}
                  className="p-4 bg-slate-950 border border-slate-800 hover:border-emerald-500 rounded-xl text-left transition-colors space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white group-hover:text-emerald-400">
                      Завантажити GEDCOM (.ged)
                    </span>
                    <Download className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Міжнародний стандарт 5.5.1. Відкривається у Gramps Desktop, MyHeritage, Дерево Життя.
                  </p>
                </button>

                <button
                  onClick={handleDownloadJson}
                  className="p-4 bg-slate-950 border border-slate-800 hover:border-emerald-500 rounded-xl text-left transition-colors space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white group-hover:text-emerald-400">
                      Завантажити JSON Backup
                    </span>
                    <Download className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Повна база з усіма архівними цитатами, фотографіями, нотатками та координатами місць.
                  </p>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Smart Merge Modal */}
      {pendingMerge && (
        <GedcomMergeModal
          currentDatabase={database}
          incomingDatabase={pendingMerge.incomingDb}
          fileName={pendingMerge.fileName}
          onClose={() => setPendingMerge(null)}
          onApplyMerge={(result: MergeResult) => {
            useGenealogyStore.getState().mergeGenealogyDatabase(pendingMerge.incomingDb, result, {
              fileName: pendingMerge.fileName
            });
            const conflictMsg = result.conflictsResolvedCount > 0 ? `, вирішено ${result.conflictsResolvedCount} розбіжностей` : '';
            setImportStatus(
              `Успішно об'єднано: знайдено ${result.matchedCount} спільних осіб${conflictMsg}, додано ${result.newPersonsCount} нових родичів!`
            );
            setPendingMerge(null);
            setPastedGedcom('');
          }}
          onApplyReplace={(incomingDb) => {
            useGenealogyStore.getState().loadGenealogyDatabase(incomingDb, {
              fileName: pendingMerge.fileName
            });
            if (onImportDatabase) {
              onImportDatabase(incomingDb);
            }
            setImportStatus(
              `Успішно замінено дерево: завантажено ${Object.keys(incomingDb.persons || {}).length} осіб.`
            );
            setPendingMerge(null);
            setPastedGedcom('');
          }}
        />
      )}
    </div>
  );
};
