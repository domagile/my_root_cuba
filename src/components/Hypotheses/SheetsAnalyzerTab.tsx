/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SheetDataset, ExtractedMetricRecord, CandidateDraftTree } from '../../types/sheetsAnalysis';
import { Person } from '../../types';
import {
  parseWorkbookMultiSheets,
  extractRecordsFromSheets,
  getSampleMultiSheetData
} from '../../utils/sheetsParser';
import { buildCandidateDraftTree } from '../../utils/treeMatcher';
import {
  FileSpreadsheet,
  Upload,
  Sparkles,
  Link,
  Layers,
  Search,
  CheckCircle2,
  Users,
  AlertCircle,
  ArrowRight,
  Database,
  RefreshCw,
  Zap,
  Globe,
  Plus
} from 'lucide-react';

interface SheetsAnalyzerTabProps {
  treePersons: Person[];
  onTreeGenerated: (tree: CandidateDraftTree, records: ExtractedMetricRecord[]) => void;
  theme: any;
}

export const SheetsAnalyzerTab: React.FC<SheetsAnalyzerTabProps> = ({
  treePersons,
  onTreeGenerated,
  theme
}) => {
  const [datasets, setDatasets] = useState<SheetDataset[]>([]);
  const [selectedSheetNames, setSelectedSheetNames] = useState<string[]>([]);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [targetSurnamesInput, setTargetSurnamesInput] = useState('Коваленко, Шакало, Шевель');
  const [analysisProgress, setAnalysisProgress] = useState(0);

  // Extract distinct surnames from current tree as quick clickable suggestions
  const treeSurnames = useMemo(() => {
    const set = new Set<string>();
    treePersons.forEach(p => {
      const s = p.lastName || p.name?.surname;
      if (s && s.length >= 3) set.add(s);
    });
    return Array.from(set).slice(0, 8);
  }, [treePersons]);

  // Load sample dataset
  const handleLoadSample = () => {
    const sample = getSampleMultiSheetData();
    setDatasets(sample);
    setSelectedSheetNames(sample.map(s => s.sheetName));
  };

  // Handle Excel file upload (Multi-sheet)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const parsedSheets = parseWorkbookMultiSheets(bstr);
        if (parsedSheets.length === 0) {
          alert('Файл порожній або не містить валідних таблиць.');
          return;
        }
        setDatasets(parsedSheets);
        setSelectedSheetNames(parsedSheets.map(s => s.sheetName));
      } catch (err: any) {
        alert('Помилка при читанні Excel файлу: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Handle Google Sheets URL import
  const handleFetchGoogleSheetsUrl = async () => {
    if (!googleSheetsUrl.trim()) return;

    setIsLoadingUrl(true);
    try {
      // Extract spreadsheet ID from standard google sheets URL
      const match = googleSheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        throw new Error('Не знайдено ID таблиці в посиланні. Переконайтеся, що посилання має формат https://docs.google.com/spreadsheets/d/...');
      }

      const sheetId = match[1];
      // Try to fetch exported xlsx or tsv
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;

      const response = await fetch(exportUrl);
      if (!response.ok) {
        throw new Error('Не вдалося завантажити Google Таблицю. Переконайтеся, що доступ за посиланням відкрито («Усі, хто має посилання»).');
      }

      const arrayBuffer = await response.arrayBuffer();
      const parsedSheets = parseWorkbookMultiSheets(arrayBuffer);
      
      if (parsedSheets.length === 0) {
        throw new Error('Таблиця не містить аркушів з даними.');
      }

      setDatasets(parsedSheets);
      setSelectedSheetNames(parsedSheets.map(s => s.sheetName));
    } catch (err: any) {
      alert(`Помилка підключення до Google Sheets: ${err.message}\n\nПорада: Спробуйте зберегти файл як .xlsx та завантажити напряму через кнопку нижче.`);
    } finally {
      setIsLoadingUrl(false);
    }
  };

  // Trigger Multi-sheet AI & Genealogical Analysis
  const handleRunAnalysis = () => {
    if (datasets.length === 0) {
      alert('Будь ласка, завантажте Google Таблицю або оберіть демо-масив.');
      return;
    }

    const activeDatasets = datasets.filter(d => selectedSheetNames.includes(d.sheetName));
    if (activeDatasets.length === 0) {
      alert('Будь ласка, оберіть хоча б один лист для сканування.');
      return;
    }

    const targetSurnamesList = targetSurnamesInput
      .split(/[,;\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 1);

    setIsAnalyzing(true);
    setAnalysisProgress(15);

    setTimeout(() => {
      setAnalysisProgress(45);

      setTimeout(() => {
        setAnalysisProgress(80);

        try {
          // 1. Extract records with godparents
          const records = extractRecordsFromSheets(activeDatasets, targetSurnamesList);

          // 2. Cross-reference against current tree & build candidate tree
          const candidateTree = buildCandidateDraftTree(records, treePersons, targetSurnamesList);

          setAnalysisProgress(100);
          setTimeout(() => {
            setIsAnalyzing(false);
            onTreeGenerated(candidateTree, records);
          }, 300);

        } catch (err: any) {
          setIsAnalyzing(false);
          alert('Помилка під час аналізу: ' + err.message);
        }
      }, 500);
    }, 400);
  };

  const addSurnameTag = (surname: string) => {
    const list = targetSurnamesInput.split(',').map(s => s.trim()).filter(Boolean);
    if (!list.includes(surname)) {
      list.push(surname);
      setTargetSurnamesInput(list.join(', '));
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Source Selector */}
      <div className={`p-6 sm:p-8 rounded-3xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-6`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-black/10 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#B88E3E]/30 to-amber-500/20 text-[#B88E3E] border border-[#B88E3E]/40 flex items-center justify-center shrink-0 shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className={`text-base sm:text-lg font-bold ${theme.cardTitle}`}>
                Аналізатор Google Sheets & Мульти-Листовий Пошук Родоводу
              </h3>
              <p className={`text-xs ${theme.cardSubtext} mt-0.5`}>
                Скан усіх листів таблиці (Метрики, Шлюби, Ревізії, Сповідні), виявлення зв&apos;язків, аналіз <strong>хрещених (восприємників)</strong> та генерація чернеткового дерева.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1-Click Demo dataset */}
            <button
              onClick={handleLoadSample}
              className="px-3.5 py-2 bg-[#1B4A3E] hover:bg-[#235C4E] text-[#E2C382] border border-[#225C4D] font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              title="Завантажити тестовий масив метрик і ревізій с. Покровське"
            >
              <Zap className="w-4 h-4 text-[#E2C382]" />
              <span>Завантажити демо-масив (4 листи)</span>
            </button>

            {/* Excel Upload button */}
            <label className={`px-3.5 py-2 rounded-xl ${theme.badgeBg} ${theme.badgeText} border ${theme.cardBorder} font-bold text-xs flex items-center gap-2 cursor-pointer hover:opacity-90 transition-all shadow-xs`}>
              <Upload className="w-4 h-4" />
              <span>Завантажити Excel (.xlsx, .csv)</span>
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Google Sheets URL Field */}
        <div className="space-y-2">
          <label className={`block font-semibold text-xs ${theme.cardTitle} flex items-center gap-1.5`}>
            <Globe className="w-4 h-4 text-[#B88E3E]" />
            <span>Або вставте посилання на Google Таблицю:</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
              value={googleSheetsUrl}
              onChange={e => setGoogleSheetsUrl(e.target.value)}
              className={`flex-1 px-4 py-2.5 ${theme.inputBg} border ${theme.inputBorder} rounded-xl text-xs ${theme.inputText} placeholder-neutral-500 focus:outline-none`}
            />
            <button
              onClick={handleFetchGoogleSheetsUrl}
              disabled={isLoadingUrl || !googleSheetsUrl.trim()}
              className={`px-5 py-2.5 ${theme.accentBtn} ${theme.accentBtnText} font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer`}
            >
              {isLoadingUrl ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
              <span>{isLoadingUrl ? 'Зчитуємо листи...' : 'Підключити Таблицю'}</span>
            </button>
          </div>
          <p className="text-[11px] text-neutral-400">
            Переконайтеся, що доступ до таблиці встановлено на &quot;Усі, хто має посилання&quot; (Доступ для читання).
          </p>
        </div>

        {/* Target Surnames Filter */}
        <div className="space-y-2 pt-2 border-t border-black/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className={`block font-semibold text-xs ${theme.cardTitle} flex items-center gap-1.5`}>
              <Search className="w-4 h-4 text-[#B88E3E]" />
              <span>Цільові прізвища для пошуку (враховуються закінчення та родичі):</span>
            </label>

            {treeSurnames.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-[10px]">
                <span className="text-neutral-400">З вашого дерева:</span>
                {treeSurnames.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addSurnameTag(s)}
                    className="px-2 py-0.5 rounded-md bg-[#B88E3E]/10 hover:bg-[#B88E3E]/20 text-[#E2C382] border border-[#B88E3E]/30 cursor-pointer font-medium"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            type="text"
            value={targetSurnamesInput}
            onChange={e => setTargetSurnamesInput(e.target.value)}
            placeholder="Коваленко, Шакало, Шевель, Бондаренко..."
            className={`w-full px-4 py-2.5 ${theme.inputBg} border ${theme.inputBorder} rounded-xl text-xs ${theme.inputText} font-bold focus:outline-none`}
          />
          <p className="text-[11px] text-neutral-400">
            Алгоритм автоматично знаходить форми прізвищ (напр. <em>Коваленко ↔ Коваленкова ↔ Ковалиха ↔ Коваль</em>), а також осіб, де ці прізвища фігурують як <strong>батьки, подружжя або хрещені</strong>.
          </p>
        </div>
      </div>

      {/* 2. Detected Sheets List & Execution Box */}
      {datasets.length > 0 && (
        <div className={`p-6 sm:p-8 rounded-3xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-6 animate-fade-in`}>
          <div className="flex items-center justify-between border-b border-black/10 pb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#B88E3E]" />
              <h4 className={`font-bold text-sm ${theme.cardTitle}`}>
                Виявлені листи в документі ({datasets.length}):
              </h4>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setSelectedSheetNames(datasets.map(d => d.sheetName))}
                className="text-[#E2C382] hover:underline"
              >
                Вибрати всі
              </button>
              <span className="text-neutral-500">•</span>
              <button
                onClick={() => setSelectedSheetNames([])}
                className="text-neutral-400 hover:underline"
              >
                Зняти виділення
              </button>
            </div>
          </div>

          {/* Sheets Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {datasets.map(ds => {
              const isChecked = selectedSheetNames.includes(ds.sheetName);
              return (
                <div
                  key={ds.sheetName}
                  onClick={() => {
                    if (isChecked) {
                      setSelectedSheetNames(prev => prev.filter(n => n !== ds.sheetName));
                    } else {
                      setSelectedSheetNames(prev => [...prev, ds.sheetName]);
                    }
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    isChecked
                      ? 'bg-[#133A31] border-[#E2C382] shadow-sm'
                      : `${theme.inputBg} ${theme.cardBorder} opacity-70 hover:opacity-100`
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-xs text-[#F5EEDC] line-clamp-1">
                      {ds.sheetName}
                    </span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="accent-[#B88E3E] rounded mt-0.5"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#8BAAA1]">
                    <span>Рядків: {ds.rowCount}</span>
                    <span className="px-2 py-0.5 rounded bg-black/20 text-[#E2C382] font-mono uppercase text-[9px]">
                      {ds.detectedType}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress Bar while analyzing */}
          {isAnalyzing && (
            <div className="space-y-2 p-4 rounded-2xl bg-[#0A2621] border border-[#16443B]">
              <div className="flex items-center justify-between text-xs text-[#E2C382]">
                <span className="flex items-center gap-2 font-bold">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#E2C382]" />
                  <span>Штучний Інтелект аналізує зв&apos;язки та хрещених по всіх листах...</span>
                </span>
                <span className="font-mono">{analysisProgress}%</span>
              </div>
              <div className="w-full bg-[#123830] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#B88E3E] to-[#E2C382] h-full transition-all duration-300"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Launch Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-neutral-400">
              Обрано для аналізу: <strong className="text-[#E2C382]">{selectedSheetNames.length}</strong> з {datasets.length} листів
            </div>

            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || selectedSheetNames.length === 0}
              className={`w-full sm:w-auto px-8 py-3.5 ${theme.accentBtn} ${theme.accentBtnText} font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg hover:opacity-95 transition-all disabled:opacity-40 cursor-pointer`}
            >
              <Sparkles className="w-5 h-5 animate-pulse" />
              <span>Згенерувати AI Чернеткове Дерево та Знайти Хрещених</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
