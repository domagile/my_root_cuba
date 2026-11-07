/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Archive,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Loader2,
  HardDrive,
  FolderTree,
  FileText,
  Image as ImageIcon,
  Check,
  ChevronRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useGenealogyStore } from '../../stores/useGenealogyStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemeConfig } from '../../utils/theme';
import { getGitHubConfig } from '../../services/githubService';
import {
  detectUnmigratedScans,
  executeScanMigrationToGitHub,
  formatBytes,
  ScanItemToMigrate,
  MigrationProgress,
  MigrationResult
} from '../../services/scanMigrationService';

interface ScanMigrationModalProps {
  onClose: () => void;
}

export const ScanMigrationModal: React.FC<ScanMigrationModalProps> = ({ onClose }) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const persons = useGenealogyStore((s) => s.persons);
  const githubConfig = getGitHubConfig();

  const [report, setReport] = useState(() => detectUnmigratedScans(persons));
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStartMigration = async () => {
    if (!githubConfig.isConfigured) {
      setErrorMsg('GitHub не налаштовано. Будь ласка, вкажіть репозиторій та токен у Налаштуваннях.');
      return;
    }

    if (report.items.length === 0) {
      setErrorMsg('У базі немає важких Base64 сканів або фотографій для міграції.');
      return;
    }

    setIsRunning(true);
    setErrorMsg(null);
    setResult(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await executeScanMigrationToGitHub(
        [...report.items],
        githubConfig,
        (p) => {
          setProgress(p);
        },
        abortController.signal
      );

      setResult(res);
      // Re-scan persons to refresh unmigrated count
      const updatedPersons = useGenealogyStore.getState().persons;
      setReport(detectUnmigratedScans(updatedPersons));
    } catch (err: any) {
      setErrorMsg(`Помилка під час міграції: ${err.message || String(err)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleStopMigration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const githubRepoUrl = githubConfig.owner && githubConfig.repo
    ? `https://github.com/${githubConfig.owner}/${githubConfig.repo}/tree/${githubConfig.branch || 'main'}/${githubConfig.baseFolder || 'archive'}`
    : null;

  return (
    <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className={`relative w-full max-w-2xl rounded-2xl border ${theme.cardBorder} ${theme.cardBg} shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}>
        {/* Header */}
        <div className={`px-5 py-4 border-b ${theme.cardBorder} flex items-center justify-between gap-3 bg-gradient-to-r from-purple-500/10 via-transparent to-amber-500/10`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-neutral-900 dark:text-white flex items-center gap-2">
                <span>Пакетна міграція сканів у GitHub</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300">
                  1-клік
                </span>
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Автоматичне перенесення важких фото і метрик у версіований архів репозиторію
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* GitHub status banner */}
          {!githubConfig.isConfigured ? (
            <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">GitHub репозиторій ще не налаштовано.</span>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  Перейдіть у вкладку «Налаштування» (Розподілене сховище) та вкажіть ваш GitHub токен і репозиторій для збереження сканів.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-900 dark:text-purple-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span className="truncate">
                  Цільовий репозиторій: <strong>{githubConfig.owner}/{githubConfig.repo}</strong> (гілка {githubConfig.branch || 'main'})
                </span>
              </div>
              {githubRepoUrl && (
                <a
                  href={githubRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-purple-600 dark:text-purple-400 hover:underline shrink-0"
                >
                  <span>Відкрити</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">Знайдено в базі</span>
              <strong className="text-base text-neutral-900 dark:text-white font-mono">
                {report.totalItems} файлів
              </strong>
            </div>

            <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">Об'єм Base64 пам'яті</span>
              <strong className="text-base text-amber-600 dark:text-amber-400 font-mono">
                {formatBytes(report.totalSizeBytes)}
              </strong>
            </div>

            <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">Звільниться пам'яті</span>
              <strong className="text-base text-emerald-600 dark:text-emerald-400 font-mono">
                ≈ {formatBytes(result ? result.bytesFreed : report.totalSizeBytes)}
              </strong>
            </div>
          </div>

          {/* Target Folder Hierarchy Explanation */}
          <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-black/5 dark:bg-white/5 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-neutral-800 dark:text-neutral-200">
              <FolderTree className="w-4 h-4 text-purple-600" />
              <span>Структура розкладання у репозиторії:</span>
            </div>
            <code className="block p-2 rounded-lg bg-neutral-900 text-purple-300 font-mono text-[11px] break-all select-all">
              {githubConfig.baseFolder || 'archive'} / [Рід] / [Покоління_XX] / [ПІБ_Особи] / [Назва_скану.jpg]
            </code>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-normal">
              Після перенесення скани замінюються швидкими посиланнями на GitHub, а важкі дані видаляються з локальної пам'яті та Firestore.
            </p>
          </div>

          {/* Progress Bar (if running or completed) */}
          {progress && (
            <div className="space-y-2 p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 truncate">
                  {isRunning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  )}
                  <span className="truncate">{progress.currentTitle}</span>
                </span>
                <span className="font-mono text-purple-700 dark:text-purple-300 shrink-0">
                  {progress.current} / {progress.total} ({progress.percent}%)
                </span>
              </div>

              <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-emerald-500 transition-all duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-500">
                <span>Звільнено: {formatBytes(progress.bytesFreed)}</span>
                {progress.failedCount > 0 && (
                  <span className="text-rose-500">Помилок: {progress.failedCount}</span>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Result */}
          {result && (
            <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Міграцію завершено успішно!</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Перенесено {result.migratedCount} файлів у GitHub. Звільнено {formatBytes(result.bytesFreed)} пам'яті.
              </p>
            </div>
          )}

          {/* List of files preview */}
          <div className="space-y-2">
            <span className="font-bold text-neutral-700 dark:text-neutral-300 block">
              Список файлів для міграції ({report.items.length}):
            </span>

            {report.items.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800 text-center text-neutral-400">
                <Check className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
                <span>Всі скани та фото вже перенесені в GitHub або мають зовнішні URL!</span>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {report.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/40 dark:bg-neutral-900/40 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.itemType === 'photo' || item.itemType === 'avatar' ? (
                        <ImageIcon className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      )}
                      <div className="truncate">
                        <span className="font-bold text-neutral-800 dark:text-neutral-200 mr-1.5">
                          {item.personName}:
                        </span>
                        <span className="text-neutral-500 truncate">{item.title}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-neutral-400">{formatBytes(item.sizeBytes)}</span>
                      {item.status === 'completed' ? (
                        <span className="text-emerald-500 font-bold flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Перенесено
                        </span>
                      ) : item.status === 'uploading' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                      ) : item.status === 'failed' ? (
                        <span className="text-rose-500 font-bold">Помилка</span>
                      ) : (
                        <span className="text-neutral-400">Очікує</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className={`px-5 py-3.5 border-t ${theme.cardBorder} flex items-center justify-between gap-3 bg-neutral-50 dark:bg-neutral-900/60`}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            Закрити
          </button>

          <div className="flex items-center gap-2">
            {isRunning ? (
              <button
                type="button"
                onClick={handleStopMigration}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Зупинити
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartMigration}
                disabled={report.items.length === 0 || !githubConfig.isConfigured}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Розпочати міграцію в GitHub ({report.items.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
