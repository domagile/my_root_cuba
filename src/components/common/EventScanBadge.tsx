/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  FileText,
  Eye,
  Plus,
  Trash2,
  ExternalLink,
  Upload,
  Link as LinkIcon,
  Check,
  X,
  Sparkles,
  BookOpen,
  Image as ImageIcon,
  FolderOpen
} from 'lucide-react';
import { Person, PersonDocumentItem } from '../../types';
import { DocumentLightboxModal } from './DocumentLightboxModal';
import { getGitHubConfig, uploadFileToGitHub, generatePersonArchivePath } from '../../services/githubService';

interface EventScanBadgeProps {
  person?: Person;
  personName?: string;
  eventType?: 'birth' | 'marriage' | 'death' | 'other';
  eventTitle?: string;
  eventLabel?: string;
  scanUrl?: string;
  scanTitle?: string;
  onAttachScan?: (url: string, title?: string) => void;
  onDetachScan?: () => void;
  personDocuments?: PersonDocumentItem[];
  isReadOnly?: boolean;
  className?: string;
}

export const EventScanBadge: React.FC<EventScanBadgeProps> = ({
  person,
  personName,
  eventType = 'other',
  eventTitle,
  eventLabel,
  scanUrl,
  scanTitle,
  onAttachScan,
  onDetachScan,
  personDocuments,
  isReadOnly = false,
  className = ''
}) => {
  const effectiveTitle = eventTitle || eventLabel || 'Подія';
  const resolvedPerson: Person = person || ({
    id: 'temp',
    firstName: personName || 'Особа',
    lastName: '',
    gender: 'M',
    isLiving: true
  } as Person);
  const availableDocs = personDocuments || resolvedPerson.documents || [];

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState<'upload' | 'existing' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default labels and colors per event type
  const eventConfig = {
    birth: {
      label: 'Метрика про народження',
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25',
      iconColor: 'text-emerald-500'
    },
    marriage: {
      label: 'Вінчальний запис',
      badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/25',
      iconColor: 'text-rose-500'
    },
    death: {
      label: 'Метрика про смерть',
      badgeClass: 'bg-stone-500/15 text-stone-700 dark:text-stone-300 border-stone-500/30 hover:bg-stone-500/25',
      iconColor: 'text-stone-500'
    },
    other: {
      label: 'Скан документа',
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25',
      iconColor: 'text-amber-500'
    }
  }[eventType];

  // Handle uploading a new scan
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAttachScan) return;

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async () => {
      const base64 = reader.result as string;
      const title = customTitle.trim() || `${eventConfig.label}: ${resolvedPerson.firstName || ''} ${resolvedPerson.lastName || ''}`.trim();

      const ghConfig = getGitHubConfig();
      if (ghConfig.isConfigured) {
        // Upload directly to GitHub structured archive!
        const safeFileName = `метрика_${eventType}_${Date.now()}.jpg`;
        const archivePath = generatePersonArchivePath(resolvedPerson, safeFileName, ghConfig.baseFolder || 'archive');

        const uploadRes = await uploadFileToGitHub({
          config: ghConfig,
          path: archivePath,
          fileBase64: base64,
          commitMessage: `[Метрика ${eventType}] ${title}`
        });

        if (uploadRes.success && uploadRes.rawUrl) {
          onAttachScan(uploadRes.rawUrl, title);
        } else {
          // Fallback to Base64
          onAttachScan(base64, title);
        }
      } else {
        // Fallback to Base64
        onAttachScan(base64, title);
      }

      setIsUploading(false);
      setIsPickerOpen(false);
      setCustomTitle('');
    };

    reader.readAsDataURL(file);
  };

  const handleAttachExisting = (doc: PersonDocumentItem) => {
    if (!onAttachScan) return;
    onAttachScan(doc.url, doc.title || eventConfig.label);
    setIsPickerOpen(false);
  };

  const handleAttachUrl = () => {
    if (!urlInput.trim() || !onAttachScan) return;
    onAttachScan(urlInput.trim(), customTitle.trim() || eventConfig.label);
    setIsPickerOpen(false);
    setUrlInput('');
    setCustomTitle('');
  };

  // If scan is present: display interactive 1-click badge
  if (scanUrl) {
    return (
      <>
        <div className={`inline-flex items-center gap-1.5 ${className}`}>
          <button
            type="button"
            onClick={() => setIsLightboxOpen(true)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs group ${eventConfig.badgeClass}`}
            title="Натисніть, щоб відкрити розворот метрики на весь екран"
          >
            <BookOpen className={`w-3.5 h-3.5 ${eventConfig.iconColor} group-hover:scale-110 transition-transform`} />
            <span className="font-bold">{scanTitle || 'Розворот метрики'}</span>
            <Eye className="w-3 h-3 opacity-70 group-hover:opacity-100" />
          </button>

          {!isReadOnly && onDetachScan && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDetachScan();
              }}
              className="p-1 rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Від'єднати скан від цієї події"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* 1-Click Lightbox Modal */}
        {isLightboxOpen && (
          <DocumentLightboxModal
            document={{
              title: scanTitle || `${eventConfig.label} (${effectiveTitle})`,
              url: scanUrl,
              type: 'metric'
            }}
            personName={`${resolvedPerson.lastName || ''} ${resolvedPerson.firstName || ''}`.trim()}
            onClose={() => setIsLightboxOpen(false)}
          />
        )}
      </>
    );
  }

  // If scan is NOT present: subtle attach button (if editor mode)
  if (isReadOnly || !onAttachScan) {
    return null;
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsPickerOpen(!isPickerOpen)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-dashed border-stone-300 dark:border-slate-700 hover:border-amber-500/60 hover:bg-amber-500/10 text-[11px] font-semibold text-neutral-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
        title={`Прикріпити скан метричного запису або першоджерела до події «${effectiveTitle}»`}
      >
        <Plus className="w-3 h-3 text-amber-500" />
        <span>Скан метрики</span>
      </button>

      {/* Attachment Popover Modal */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-70 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-3">
          <div className="w-full max-w-md bg-white dark:bg-[#1a1e24] border border-stone-300 dark:border-[#2d333b] rounded-2xl p-4 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-[#272c33]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-500" />
                <h4 className="font-bold text-xs text-neutral-900 dark:text-white">
                  Прикріпити скан: {effectiveTitle}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="text-slate-400 hover:text-neutral-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center p-0.5 rounded-xl bg-stone-100 dark:bg-black/30 border border-stone-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setUploadTab('upload')}
                className={`flex-1 py-1 rounded-lg font-bold transition-all ${
                  uploadTab === 'upload' ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs' : 'text-slate-500'
                }`}
              >
                Завантажити файл
              </button>

              {availableDocs && availableDocs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setUploadTab('existing')}
                  className={`flex-1 py-1 rounded-lg font-bold transition-all ${
                    uploadTab === 'existing' ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  З документів ({availableDocs.length})
                </button>
              )}

              <button
                type="button"
                onClick={() => setUploadTab('url')}
                className={`flex-1 py-1 rounded-lg font-bold transition-all ${
                  uploadTab === 'url' ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs' : 'text-slate-500'
                }`}
              >
                За посиланням
              </button>
            </div>

            {/* Tab: Upload File */}
            {uploadTab === 'upload' && (
              <div className="space-y-3 pt-1">
                <input
                  type="text"
                  placeholder="Підпис (напр. Метрична книга 1894, розворот 14-15)..."
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-300 dark:border-[#2d333b] bg-transparent focus:outline-none focus:ring-1 focus:ring-amber-500"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 rounded-xl border-2 border-dashed border-stone-300 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 bg-stone-50/50 dark:bg-black/20 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Upload className={`w-6 h-6 text-amber-500 ${isUploading ? 'animate-bounce' : ''}`} />
                  <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200">
                    {isUploading ? 'Завантаження скану...' : 'Натисніть або перетягніть скан метрики сюди'}
                  </span>
                  <span className="text-[10px] text-slate-400">Підтримуються JPG, PNG, WEBP</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {/* Tab: Pick from Existing Documents */}
            {uploadTab === 'existing' && (
              <div className="max-h-52 overflow-y-auto space-y-1.5 pt-1 custom-scrollbar">
                {availableDocs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => handleAttachExisting(doc)}
                    className="p-2.5 rounded-xl border border-stone-200 dark:border-slate-800 hover:border-amber-500 bg-stone-50/50 dark:bg-black/20 flex items-center justify-between gap-2 cursor-pointer transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="truncate">
                        <span className="font-bold block truncate">{doc.title}</span>
                        {doc.year && <span className="text-[10px] text-slate-400">{doc.year} рік</span>}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                      Обрати
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Enter Link */}
            {uploadTab === 'url' && (
              <div className="space-y-3 pt-1">
                <input
                  type="text"
                  placeholder="URL посилання на скан (GitHub, FamilySearch, Google Drive)..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-[#2d333b] bg-transparent focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
                <input
                  type="text"
                  placeholder="Підпис розвороту (необов'язково)..."
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-300 dark:border-[#2d333b] bg-transparent focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleAttachUrl}
                  disabled={!urlInput.trim()}
                  className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-40"
                >
                  Прикріпити посилання
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
