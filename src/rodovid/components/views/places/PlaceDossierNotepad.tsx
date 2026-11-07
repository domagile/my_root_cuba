/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileText, 
  Save, 
  Check, 
  History, 
  ExternalLink, 
  BookOpen, 
  List, 
  ListChecks, 
  Quote, 
  Calendar, 
  Sparkles, 
  Layers, 
  Trash2,
  Copy,
  Search,
  Link,
  Eye,
  Edit3,
  Globe,
  GitBranch,
  Github,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { PlaceDossier } from '../../../../types';
import { ThemeConfig } from '../../../../utils/theme';
import { extractLinksFromText, renderLinkifiedText } from '../../../../utils/linkUtils';
import { 
  getGitHubConfig, 
  savePlaceDossierToGitHub 
} from '../../../../services/githubService';

interface PlaceDossierNotepadProps {
  placeName: string;
  dossier: PlaceDossier | undefined;
  onSave: (updated: PlaceDossier) => void;
  theme: ThemeConfig;
  isDark: boolean;
}

export const PlaceDossierNotepad: React.FC<PlaceDossierNotepadProps> = ({
  placeName,
  dossier,
  onSave,
  theme,
  isDark
}) => {
  // Initialize content combining notes or historyText if available
  const initialText = useMemo(() => {
    if (dossier?.notes && dossier?.historyText) {
      if (dossier.notes.includes(dossier.historyText)) return dossier.notes;
      if (dossier.historyText.includes(dossier.notes)) return dossier.historyText;
      return `${dossier.historyText}\n\n---\n## Додаткові нотатки:\n${dossier.notes}`;
    }
    return dossier?.notes || dossier?.historyText || '';
  }, [dossier]);

  const [content, setContent] = useState(initialText);
  const [savedNotice, setSavedNotice] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Link Insertion Dialog state
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // GitHub Sync state
  const [gitHubStatus, setGitHubStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
    htmlUrl?: string;
  }>({ loading: false });

  const gitConfig = useMemo(() => getGitHubConfig(), []);

  // Sync state when dossier or placeName changes
  useEffect(() => {
    setContent(initialText);
    setGitHubStatus({ loading: false });
  }, [initialText, placeName]);

  // Extract all clickable links found inside free-form text
  const extractedLinks = useMemo(() => {
    return extractLinksFromText(content);
  }, [content]);

  const handleSave = async (syncToGitHub: boolean = true) => {
    const trimmed = content.trim();
    const updated: PlaceDossier = {
      id: dossier?.id || placeName.trim(),
      placeName: dossier?.placeName || placeName.trim(),
      settlementType: dossier?.settlementType,
      foundedYear: dossier?.foundedYear,
      historicalName: dossier?.historicalName,
      district: dossier?.district,
      parishChurch: dossier?.parishChurch,
      historyText: trimmed || undefined,
      notes: trimmed || undefined,
      sourceLinks: dossier?.sourceLinks || [],
      updatedAt: new Date().toISOString()
    };

    onSave(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);

    // Save to GitHub if configured or requested
    if (syncToGitHub && gitConfig.isConfigured) {
      setGitHubStatus({ loading: true });
      try {
        const ghRes = await savePlaceDossierToGitHub(placeName, updated, gitConfig);
        if (ghRes.success) {
          setGitHubStatus({
            loading: false,
            success: true,
            message: `Синхронізовано з GitHub: ${ghRes.path}`,
            htmlUrl: ghRes.htmlUrl
          });
        } else {
          setGitHubStatus({
            loading: false,
            success: false,
            message: ghRes.error || 'Помилка вивантаження на GitHub'
          });
        }
      } catch (err: any) {
        setGitHubStatus({
          loading: false,
          success: false,
          message: err.message || 'Помилка мережі GitHub'
        });
      }
    }
  };

  const handleManualGitHubSync = () => {
    handleSave(true);
  };

  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => (prev ? prev + '\n\n' + textToInsert : textToInsert));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = content.substring(0, start);
    const after = content.substring(end);
    const nextContent = before + textToInsert + after;
    setContent(nextContent);

    setTimeout(() => {
      textarea.focus();
      const nextCursorPos = start + textToInsert.length;
      textarea.setSelectionRange(nextCursorPos, nextCursorPos);
    }, 0);
  };

  const handleInsertCustomLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkUrl.trim()) return;

    let cleanUrl = newLinkUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const title = newLinkTitle.trim() || cleanUrl;
    const mdLink = `[${title}](${cleanUrl})`;
    insertTextAtCursor(` ${mdLink} `);

    setNewLinkTitle('');
    setNewLinkUrl('');
    setIsLinkDialogOpen(false);
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2000);
    });
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lineCount = content ? content.split('\n').length : 0;

  const wikiSearchUrl = `https://uk.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(placeName)}`;
  const imsuSearchUrl = `https://www.google.com/search?q=${encodeURIComponent('Історія міст і сіл Української РСР ' + placeName)}`;
  const fsSearchUrl = `https://www.familysearch.org/search/catalog/results?count=20&query=%2Bplace%3A%22${encodeURIComponent(placeName)}%22`;

  return (
    <div className="flex-1 flex flex-col h-full space-y-4">
      {/* Header / Research Bar */}
      <div className={`p-3 md:p-4 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} flex flex-wrap items-center justify-between gap-3 shadow-xs`}>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className={`font-bold text-xs md:text-sm ${theme.textPrimary} flex items-center gap-2`}>
              <span>Блокнот: «{placeName}»</span>
              <span className={`text-[10px] font-normal px-2 py-0.5 rounded-full ${isDark ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60' : 'bg-amber-100 text-amber-900 border border-amber-300'}`}>
                Вільний формат
              </span>
            </h3>
            <p className={`text-[11px] ${theme.textMuted}`}>
              Пишіть вільно: літопис, клікабельні лінки на FamilySearch, справи ЦДІАК, парафії, поміщики, спогади
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher: Edit vs Preview with Clickable Links */}
          <div className={`flex items-center p-0.5 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle}`}>
            <button
              type="button"
              onClick={() => setMode('edit')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                mode === 'edit'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : `${theme.textSecondary} hover:${theme.textPrimary}`
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Редагувати</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                mode === 'preview'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : `${theme.textSecondary} hover:${theme.textPrimary}`
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Перегляд лінків ({extractedLinks.length})</span>
            </button>
          </div>

          {/* GitHub Sync Button */}
          <button
            type="button"
            onClick={handleManualGitHubSync}
            disabled={gitHubStatus.loading}
            title={gitConfig.isConfigured ? 'Зберегти блокнот у GitHub репозиторій' : 'GitHub не підключено (налаштуйте токен)'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              gitConfig.isConfigured
                ? `${theme.surfaceBg} border-neutral-300 dark:border-neutral-700 hover:border-amber-500 ${theme.textPrimary}`
                : `${theme.surfaceBg} border-dashed border-amber-500/50 text-amber-600 dark:text-amber-400 opacity-90`
            }`}
          >
            {gitHubStatus.loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                <span>GitHub...</span>
              </>
            ) : (
              <>
                <Github className="w-3.5 h-3.5 text-amber-500" />
                <span>{gitConfig.isConfigured ? 'Зберегти в GitHub' : 'GitHub (налаштувати)'}</span>
              </>
            )}
          </button>

          {/* Copy Button */}
          {content && (
            <button
              type="button"
              onClick={handleCopyAll}
              title="Скопіювати весь текст блокнота"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 ${theme.textSecondary} hover:${theme.textPrimary} transition-colors cursor-pointer`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedNotice ? 'Скопійовано!' : 'Копіювати'}</span>
            </button>
          )}

          {/* Save Button */}
          <button
            type="button"
            onClick={() => handleSave(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-colors cursor-pointer"
          >
            {savedNotice ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Збережено!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Зберегти блокнот</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* GitHub Sync Status Banner if active */}
      {gitHubStatus.message && (
        <div className={`px-4 py-2 rounded-xl text-xs flex items-center justify-between gap-3 ${
          gitHubStatus.success 
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
        }`}>
          <div className="flex items-center gap-2">
            <Github className="w-4 h-4 shrink-0" />
            <span>{gitHubStatus.message}</span>
          </div>
          {gitHubStatus.htmlUrl && (
            <a
              href={gitHubStatus.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline font-semibold text-xs hover:opacity-80"
            >
              <span>Відкрити файл на GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Formatting Tools & Quick Clickable Links Inserter */}
      <div className={`p-2.5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} flex flex-wrap items-center justify-between gap-2 text-xs shadow-xs`}>
        {/* Formatting buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsLinkDialogOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Вставити клікабельне посилання на метричну книгу або архівний опис"
          >
            <Link className="w-3.5 h-3.5" />
            <span>+ Вставити клікабельну лінку</span>
          </button>

          <span className={`text-[11px] font-semibold ${theme.textMuted} mx-1 hidden sm:inline`}>|</span>

          <button
            type="button"
            onClick={() => insertTextAtCursor('## ')}
            title="Додати заголовок"
            className={`px-2 py-1 rounded-lg ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 font-bold ${theme.textPrimary}`}
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => insertTextAtCursor('### ')}
            title="Додати підзаголовок"
            className={`px-2 py-1 rounded-lg ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 font-semibold ${theme.textPrimary}`}
          >
            H3
          </button>
          <button
            type="button"
            onClick={() => insertTextAtCursor('- ')}
            title="Список"
            className={`px-2 py-1 rounded-lg ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 flex items-center gap-1 ${theme.textPrimary}`}
          >
            <List className="w-3 h-3" />
            <span>Список</span>
          </button>
          <button
            type="button"
            onClick={() => insertTextAtCursor('[ ] ')}
            title="Чекліст / завдання"
            className={`px-2 py-1 rounded-lg ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 flex items-center gap-1 ${theme.textPrimary}`}
          >
            <ListChecks className="w-3 h-3" />
            <span>Чекліст</span>
          </button>
          <button
            type="button"
            onClick={() => insertTextAtCursor('> ')}
            title="Цитата з архівного документу"
            className={`px-2 py-1 rounded-lg ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 flex items-center gap-1 ${theme.textPrimary}`}
          >
            <Quote className="w-3 h-3" />
            <span>Цитата</span>
          </button>
        </div>

        {/* Quick Clickable Metric Templates */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[11px] font-semibold ${theme.textMuted} mr-1 hidden sm:inline`}>
            Шаблони джерел:
          </span>
          <button
            type="button"
            onClick={() => insertTextAtCursor(`\n- [Метричні книги ${placeName} на FamilySearch](https://www.familysearch.org/search/catalog/results?query=%2Bplace%3A%22${encodeURIComponent(placeName)}%22)\n`)}
            className={`text-[11px] px-2.5 py-1 rounded-lg ${theme.surfaceBg} border border-blue-500/30 hover:border-blue-500 text-blue-600 dark:text-blue-400 font-medium`}
          >
            + Лінк FamilySearch
          </button>
          <button
            type="button"
            onClick={() => insertTextAtCursor(`\n- [ЦДІАК географічний покажчик парафій](https://cdiak.archives.gov.ua/baza_geog_pok/)\n`)}
            className={`text-[11px] px-2.5 py-1 rounded-lg ${theme.surfaceBg} border border-emerald-500/30 hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 font-medium`}
          >
            + Лінк ЦДІАК
          </button>
          <button
            type="button"
            onClick={() => insertTextAtCursor(`\n- [Історія села ${placeName} у Вікіпедії](${wikiSearchUrl})\n`)}
            className={`text-[11px] px-2.5 py-1 rounded-lg ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 text-amber-600 dark:text-amber-400 font-medium`}
          >
            + Лінк Вікіпедія
          </button>
        </div>
      </div>

      {/* Main Notepad Writing / Reading Canvas */}
      <div className={`flex-1 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} p-4 md:p-6 flex flex-col shadow-xs min-h-[440px]`}>
        {mode === 'edit' ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Записуйте сюди будь-яку інформацію та вставляйте лінки про ${placeName || 'це село чи місто'}:\n\nНаприклад:\n- Метричні книги на FamilySearch: https://www.familysearch.org/...\n- Сповідні розписи ЦДІАК ф. 127: https://cdiak.archives.gov.ua/...\n- Або у форматі [Метрика 1895 р.](https://familysearch.org/...)\n- Стара назва села, приписна парафія та священники\n- Поміщики, ревізії, спогади старожилів...`}
            className={`flex-1 w-full p-4 rounded-xl text-xs md:text-sm font-sans leading-relaxed resize-none focus:outline-hidden ${theme.surfaceBg} border ${theme.borderSubtle} focus:border-amber-500 ${theme.textPrimary} transition-all`}
          />
        ) : (
          <div className={`flex-1 w-full p-4 rounded-xl overflow-y-auto ${theme.surfaceBg} border ${theme.borderSubtle}`}>
            {content.trim() ? (
              renderLinkifiedText(content, isDark)
            ) : (
              <p className={`text-xs ${theme.textMuted} italic`}>
                Блокнот порожній. Перемкніться в режим «Редагувати», щоб записати інформацію та лінки.
              </p>
            )}
          </div>
        )}

        {/* Clickable links tray extracted from text */}
        {extractedLinks.length > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                <span>Знайдені клікабельні лінки на метрики та архіви ({extractedLinks.length}):</span>
              </span>
              <span className="text-[10px] text-neutral-400">
                Натисніть на посилання, щоб відкрити документ
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {extractedLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${theme.cardBg} border ${theme.borderSubtle} hover:border-amber-500 text-blue-600 dark:text-blue-400 hover:text-amber-500 transition-all shadow-xs`}
                >
                  <Globe className="w-3 h-3 text-amber-500 shrink-0" />
                  <span className="max-w-[200px] truncate">{link.title}</span>
                  <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Footer toolbar: status, counts, research links */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 text-[11px] mt-2">
          <div className="flex items-center gap-3 text-neutral-400">
            <span>Слів: <strong className={theme.textPrimary}>{wordCount}</strong></span>
            <span>•</span>
            <span>Рядків: <strong className={theme.textPrimary}>{lineCount}</strong></span>
            <span>•</span>
            <span>Лінки: <strong className="text-amber-500">{extractedLinks.length}</strong></span>
            {dossier?.updatedAt && (
              <>
                <span className="hidden md:inline">•</span>
                <span className="hidden md:inline">
                  Оновлено: {new Date(dossier.updatedAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            )}
          </div>

          {/* Quick research search helpers */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] uppercase font-semibold ${theme.textMuted}`}>
              Швидкий пошук:
            </span>
            <a
              href={wikiSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 ${theme.textPrimary} transition-colors`}
            >
              <span>Вікіпедія</span>
              <ExternalLink className="w-2.5 h-2.5 text-amber-500" />
            </a>
            <a
              href={imsuSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 ${theme.textPrimary} transition-colors`}
            >
              <span>Історія сіл УРСР</span>
              <ExternalLink className="w-2.5 h-2.5 text-amber-500" />
            </a>
            <a
              href={fsSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 ${theme.textPrimary} transition-colors`}
            >
              <span>FamilySearch</span>
              <ExternalLink className="w-2.5 h-2.5 text-amber-500" />
            </a>
          </div>
        </div>
      </div>

      {/* Insert Link Dialog Modal */}
      {isLinkDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-2xl border ${theme.cardBorder} ${theme.cardBg} p-5 space-y-4 shadow-2xl`}>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4 text-blue-500" />
                <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textPrimary}`}>
                  Вставити клікабельне посилання
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkDialogOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 text-xs p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInsertCustomLink} className="space-y-3">
              <div>
                <label className={`block text-xs font-medium ${theme.textMuted} mb-1`}>
                  Назва посилання (що буде написано в тексті)
                </label>
                <input
                  type="text"
                  placeholder="напр. Метрична книга 1895 р. (FamilySearch)"
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} focus:border-blue-500 focus:outline-hidden ${theme.textPrimary}`}
                  autoFocus
                />
              </div>

              <div>
                <label className={`block text-xs font-medium ${theme.textMuted} mb-1`}>
                  URL-адреса <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://familysearch.org/... або cdiak.archives.gov.ua"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} focus:border-blue-500 focus:outline-hidden ${theme.textPrimary}`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsLinkDialogOpen(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${theme.borderSubtle} ${theme.textMuted}`}
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={!newLinkUrl.trim()}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  Вставити лінку в блокнот
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
