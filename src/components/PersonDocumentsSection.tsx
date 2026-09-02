/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  ExternalLink,
  Eye,
  Lock,
  Archive,
  Layers,
  Upload,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  FolderTree,
  Sparkles,
  Info,
  Calendar,
  X,
  Baby,
  Users,
  ArrowUpRight
} from 'lucide-react';
import { Person, PersonDocumentItem, ThemePalette } from '../types';
import { getThemeConfig } from '../utils/theme';
import {
  getGitHubConfig,
  generatePersonArchivePath,
  uploadFileToGitHub,
  parseDocumentViewerUrl
} from '../services/githubService';
import { DocumentLightboxModal } from './common/DocumentLightboxModal';
import { useGenealogy } from '../context/GenealogyContext';
import { isPersonMale, isPersonFemale } from '../utils/genderUtils';
import { getFullName } from '../rodovid/utils/relationship';

export interface EnrichedDocumentItem extends PersonDocumentItem {
  isFromChild?: boolean;
  childId?: string;
  childName?: string;
  childBirthYear?: number | string;
  relationLabel?: string;
}

interface PersonDocumentsSectionProps {
  person: Person;
  onUpdatePerson: (updatedPerson: Person) => void;
  isReadOnly?: boolean;
  themePalette?: ThemePalette;
  isDark?: boolean;
}

export const PersonDocumentsSection: React.FC<PersonDocumentsSectionProps> = ({
  person,
  onUpdatePerson,
  isReadOnly = false,
  themePalette,
  isDark = false
}) => {
  const theme = getThemeConfig(themePalette);
  const githubConfig = getGitHubConfig();
  const { persons, families, metricRecords, setSelectedPersonId } = useGenealogy();

  const [activeModal, setActiveModal] = useState<'add' | null>(null);
  const [viewingDoc, setViewingDoc] = useState<EnrichedDocumentItem | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'own' | 'children'>('all');

  // Form State
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>(githubConfig.isConfigured ? 'file' : 'link');
  const [selectedFile, setSelectedFile] = useState<{ file: File; base64: string; name: string } | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docType, setDocType] = useState<string>('metric');
  const [docYear, setDocYear] = useState<string>(person.birthYear ? String(person.birthYear) : '');
  const [docArchiveRef, setDocArchiveRef] = useState('');
  const [docPage, setDocPage] = useState('');
  const [docNotes, setDocNotes] = useState('');

  // Uploading status
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // 1. Own Documents of the person
  const ownDocuments: EnrichedDocumentItem[] = useMemo(() => {
    const list: EnrichedDocumentItem[] = (person.documents || []).map((d) => ({
      ...d,
      isFromChild: false
    }));

    // Also include photos if they are not already in documents
    if (person.photos && person.photos.length > 0) {
      person.photos.forEach((photoUrl, idx) => {
        if (!list.some((d) => d.url === photoUrl)) {
          const parsed = parseDocumentViewerUrl(photoUrl);
          list.push({
            id: `legacy-photo-${idx}`,
            title: `Світлина ${idx + 1}`,
            url: photoUrl,
            type: 'photo',
            storageType: parsed.type === 'gdrive' ? 'gdrive' : parsed.type === 'github' ? 'github' : 'firestore',
            year: person.birthYear,
            isFromChild: false
          });
        }
      });
    }

    return list;
  }, [person.documents, person.photos, person.birthYear]);

  // 2. Discover children of this person
  const children = useMemo(() => {
    if (!persons || persons.length === 0) return [];
    const list: Person[] = [];
    const seenIds = new Set<string>();

    persons.forEach((p) => {
      if (p.id === person.id) return;
      const isDirectChild =
        p.fatherId === person.id ||
        p.motherId === person.id ||
        (Array.isArray(person.childrenIds) && person.childrenIds.includes(p.id));

      // Check families if any
      const isFamilyChild = Object.values(families || {}).some((f: any) => {
        if (!f) return false;
        const isParent = f.husbandId === person.id || f.wifeId === person.id;
        return isParent && Array.isArray(f.childrenIds) && f.childrenIds.includes(p.id);
      });

      if ((isDirectChild || isFamilyChild) && !seenIds.has(p.id)) {
        seenIds.add(p.id);
        list.push(p);
      }
    });

    return list;
  }, [persons, families, person.id, person.childrenIds]);

  // 3. Aggregate all documents and metric scans of children
  const childrenDocuments: EnrichedDocumentItem[] = useMemo(() => {
    const list: EnrichedDocumentItem[] = [];
    const seenUrls = new Set<string>();

    // Mark own URLs so we avoid duplicate entries if already attached directly
    ownDocuments.forEach((d) => {
      if (d.url) seenUrls.add(d.url);
    });

    children.forEach((child) => {
      const childName = getFullName(child);
      const isMale = isPersonMale(child, { persons: persons.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}), families: families || {} } as any);
      const isFemale = isPersonFemale(child, { persons: persons.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}), families: families || {} } as any);
      const relationLabel = isMale ? 'Син' : isFemale ? 'Донька' : 'Дитина';
      const birthYear = child.birthYear || (child.birthDate ? String(child.birthDate).match(/\b(1\d{3}|20\d{2})\b/)?.[1] : undefined);

      // A) child.documents
      if (child.documents && Array.isArray(child.documents)) {
        child.documents.forEach((doc, idx) => {
          if (doc.url && !seenUrls.has(doc.url)) {
            seenUrls.add(doc.url);
            list.push({
              ...doc,
              id: doc.id || `child-${child.id}-doc-${idx}`,
              isFromChild: true,
              childId: child.id,
              childName,
              childBirthYear: birthYear,
              relationLabel
            });
          }
        });
      }

      // B) child.photos
      if (child.photos && Array.isArray(child.photos)) {
        child.photos.forEach((photoUrl, idx) => {
          if (photoUrl && !seenUrls.has(photoUrl)) {
            seenUrls.add(photoUrl);
            const parsed = parseDocumentViewerUrl(photoUrl);
            list.push({
              id: `child-${child.id}-photo-${idx}`,
              title: `Світлина (${relationLabel}: ${childName})`,
              url: photoUrl,
              type: 'photo',
              storageType: parsed.type === 'gdrive' ? 'gdrive' : parsed.type === 'github' ? 'github' : 'firestore',
              year: birthYear,
              isFromChild: true,
              childId: child.id,
              childName,
              childBirthYear: birthYear,
              relationLabel
            });
          }
        });
      }

      // C) metric records referencing the child
      if (metricRecords && Array.isArray(metricRecords)) {
        metricRecords.forEach((m) => {
          const isLinked = m.indexedPersons?.some(
            (ip) => ip.linkedPersonId === child.id || 
                    (ip.name && ip.name.toLowerCase().includes((child.lastName || '').toLowerCase()) && ip.name.toLowerCase().includes((child.firstName || '').toLowerCase()))
          );
          if (isLinked && m.documentScanUrl && !seenUrls.has(m.documentScanUrl)) {
            seenUrls.add(m.documentScanUrl);
            list.push({
              id: `metric-rec-${m.id}`,
              title: m.title || `Метричний запис (${relationLabel}: ${childName})`,
              url: m.documentScanUrl,
              type: 'metric',
              storageType: 'external',
              year: m.year,
              archiveRef: `${m.archive || ''} Ф. ${m.fund || ''}, оп. ${m.inventory || ''}, спр. ${m.caseNumber || ''}`.trim(),
              page: m.page,
              notes: m.transcription || m.notes,
              isFromChild: true,
              childId: child.id,
              childName,
              childBirthYear: birthYear,
              relationLabel
            });
          }
        });
      }
    });

    return list;
  }, [children, ownDocuments, metricRecords, persons, families]);

  // Combined documents according to active filter
  const displayedDocuments: EnrichedDocumentItem[] = useMemo(() => {
    if (filterTab === 'own') return ownDocuments;
    if (filterTab === 'children') return childrenDocuments;
    return [...ownDocuments, ...childrenDocuments];
  }, [filterTab, ownDocuments, childrenDocuments]);

  const totalDocumentsCount = ownDocuments.length + childrenDocuments.length;

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedFile({
        file,
        base64,
        name: file.name
      });
      if (!docTitle) {
        // Humanize default title from filename without extension
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_\-]/g, ' ');
        setDocTitle(cleanName);
      }
    };
    reader.readAsDataURL(file);
  };

  // 1-Click Upload to GitHub
  const handleUploadToGitHub = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadStatusMsg({ text: 'Відправка файлу у ваш GitHub репозиторій...' });

    const archivePath = generatePersonArchivePath(person, selectedFile.name, githubConfig.baseFolder || 'archive');

    const res = await uploadFileToGitHub({
      config: githubConfig,
      path: archivePath,
      fileBase64: selectedFile.base64,
      commitMessage: `Додано архівний документ: ${docTitle || selectedFile.name} для особи ${person.id}`
    });

    if (res.success && res.rawUrl) {
      const newDoc: PersonDocumentItem = {
        id: `doc-${Date.now()}`,
        title: docTitle.trim() || selectedFile.name,
        url: res.rawUrl,
        type: docType,
        storageType: 'github',
        githubPath: res.path,
        year: docYear.trim() || undefined,
        archiveRef: docArchiveRef.trim() || undefined,
        page: docPage.trim() || undefined,
        notes: docNotes.trim() || undefined,
        createdAt: new Date().toISOString()
      };

      const updatedDocs = [...(person.documents || []), newDoc];
      onUpdatePerson({
        ...person,
        documents: updatedDocs
      });

      setIsUploading(false);
      setUploadStatusMsg({ text: 'Файл успішно завантажено в GitHub та прив\'язано до картки!' });
      setTimeout(() => {
        resetForm();
        setActiveModal(null);
      }, 1000);
    } else {
      setIsUploading(false);
      setUploadStatusMsg({ text: res.error || 'Помилка завантаження на GitHub', isError: true });
    }
  };

  // Save directly to Firestore (Base64)
  const handleSaveToFirestore = () => {
    if (!selectedFile) return;

    const newDoc: PersonDocumentItem = {
      id: `doc-${Date.now()}`,
      title: docTitle.trim() || selectedFile.name,
      url: selectedFile.base64,
      type: docType,
      storageType: 'firestore',
      year: docYear.trim() || undefined,
      archiveRef: docArchiveRef.trim() || undefined,
      page: docPage.trim() || undefined,
      notes: docNotes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    const updatedDocs = [...(person.documents || []), newDoc];
    onUpdatePerson({
      ...person,
      documents: updatedDocs
    });

    resetForm();
    setActiveModal(null);
  };

  // Save by Link (Google Drive / GitHub / Web)
  const handleSaveByLink = () => {
    if (!docUrl.trim()) return;

    const parsed = parseDocumentViewerUrl(docUrl.trim());
    const storageType = parsed.type === 'gdrive' ? 'gdrive' : parsed.type === 'github' ? 'github' : 'external';

    const newDoc: PersonDocumentItem = {
      id: `doc-${Date.now()}`,
      title: docTitle.trim() || (storageType === 'gdrive' ? 'Документ Google Drive' : 'Архівний документ'),
      url: docUrl.trim(),
      type: docType,
      storageType,
      year: docYear.trim() || undefined,
      archiveRef: docArchiveRef.trim() || undefined,
      page: docPage.trim() || undefined,
      notes: docNotes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    const updatedDocs = [...(person.documents || []), newDoc];
    onUpdatePerson({
      ...person,
      documents: updatedDocs
    });

    resetForm();
    setActiveModal(null);
  };

  const handleDeleteDocument = (docId: string) => {
    const updatedDocs = (person.documents || []).filter((d) => d.id !== docId);
    onUpdatePerson({
      ...person,
      documents: updatedDocs
    });
  };

  const resetForm = () => {
    setSelectedFile(null);
    setDocTitle('');
    setDocUrl('');
    setDocType('metric');
    setDocYear(person.birthYear ? String(person.birthYear) : '');
    setDocArchiveRef('');
    setDocPage('');
    setDocNotes('');
    setUploadStatusMsg(null);
  };

  const getStorageBadge = (storageType?: string, url?: string) => {
    const effectiveType = storageType || (url?.includes('drive.google.com') ? 'gdrive' : url?.includes('github') ? 'github' : 'external');
    if (effectiveType === 'gdrive') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
          <Lock className="w-2.5 h-2.5" /> Google Drive
        </span>
      );
    }
    if (effectiveType === 'github') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25">
          <Archive className="w-2.5 h-2.5" /> GitHub Архів
        </span>
      );
    }
    if (effectiveType === 'firestore') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25">
          <Layers className="w-2.5 h-2.5" /> База даних
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-500/15 text-neutral-600 dark:text-neutral-400 border border-neutral-500/25">
        <FileText className="w-2.5 h-2.5" /> Документ
      </span>
    );
  };

  return (
    <div className={`p-4 ${theme.surfaceBg} rounded-2xl border ${theme.borderSubtle} space-y-3`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#B88E3E]" />
          <span className={`text-[11px] font-bold ${theme.textMuted} uppercase tracking-wider block`}>
            Архівні документи, скани та фото ({totalDocumentsCount}):
          </span>
        </div>

        {!isReadOnly && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setActiveModal('add');
            }}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 text-[#B88E3E] bg-[#B88E3E]/10 hover:bg-[#B88E3E]/20 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Прикріпити скан / фото</span>
          </button>
        )}
      </div>

      {/* Filter Tabs if children documents exist */}
      {childrenDocuments.length > 0 && (
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              filterTab === 'all'
                ? 'bg-[#B88E3E] text-white shadow-xs'
                : `${theme.textSecondary} hover:${theme.textPrimary}`
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Всі документи ({totalDocumentsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('own')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              filterTab === 'own'
                ? 'bg-[#B88E3E] text-white shadow-xs'
                : `${theme.textSecondary} hover:${theme.textPrimary}`
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Особисті ({ownDocuments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('children')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              filterTab === 'children'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <Baby className="w-3.5 h-3.5" />
            <span>Метрики дітей ({childrenDocuments.length})</span>
          </button>
        </div>
      )}

      {/* Children Metric Notice Banner */}
      {childrenDocuments.length > 0 && (
        <div className="p-2.5 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200 text-[11px] flex items-start gap-2">
          <Baby className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Скани метрик дітей батьків:</strong> Автоматично знайдено та відображено{' '}
            <strong>{childrenDocuments.length}</strong> архівних метричних записів/сканів у дітей ({children.length} дітей у родинному зв'язку).
          </div>
        </div>
      )}

      {/* Advice banner */}
      <div className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
        person.isLiving
          ? 'bg-blue-500/10 border-blue-500/20 text-blue-800 dark:text-blue-300'
          : 'bg-purple-500/10 border-purple-500/20 text-purple-800 dark:text-purple-300'
      }`}>
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-current" />
        <div className="leading-relaxed">
          {person.isLiving ? (
            <span>
              <strong>Жива особа:</strong> Рекомендовано зберігати документи на <strong>Google Drive</strong> для максимальної приватності та конфіденційності.
            </span>
          ) : (
            <span>
              <strong>Померлий предок:</strong> Рекомендовано зберігати метричні скани у <strong>GitHub-архіві</strong> з автоматичною структурою «[Прізвище]/[Покоління]/[Особа]».
            </span>
          )}
        </div>
      </div>

      {/* Documents Grid / List */}
      {displayedDocuments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {displayedDocuments.map((doc) => {
            const parsed = parseDocumentViewerUrl(doc.url);
            return (
              <div
                key={doc.id}
                className={`p-3 rounded-xl ${theme.cardBg} border ${
                  doc.isFromChild ? 'border-amber-500/40 dark:border-amber-500/30 bg-amber-500/5' : theme.cardBorder
                } flex items-start justify-between gap-2.5 group hover:border-[#B88E3E]/60 transition-all shadow-xs`}
              >
                <div
                  onClick={() => setViewingDoc(doc)}
                  className="flex items-start gap-2.5 min-w-0 flex-1 cursor-pointer"
                >
                  {/* Thumbnail / Icon */}
                  <div className="w-12 h-12 rounded-lg bg-black/5 dark:bg-white/5 border overflow-hidden shrink-0 flex items-center justify-center relative">
                    {parsed.type === 'image' || (parsed.type === 'gdrive' && doc.url.includes('uc?export=view')) ? (
                      <img
                        src={parsed.displayUrl}
                        alt={doc.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileText className={`w-6 h-6 ${doc.isFromChild ? 'text-amber-600 dark:text-amber-400' : 'text-[#B88E3E]'}`} />
                    )}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-1 min-w-0 flex-1">
                    {/* Child Attribution Badge if from child */}
                    {doc.isFromChild && (
                      <div className="flex items-center gap-1">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                          <Baby className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                          <span>{doc.relationLabel}: {doc.childName}</span>
                          {doc.childBirthYear ? <span className="opacity-80">({doc.childBirthYear} р.)</span> : null}
                        </span>
                      </div>
                    )}

                    <h4 className={`text-xs font-bold ${theme.textPrimary} truncate group-hover:text-[#B88E3E] transition-colors`}>
                      {doc.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {getStorageBadge(doc.storageType, doc.url)}
                      {doc.year && (
                        <span className={`text-[10px] font-mono ${theme.textMuted}`}>
                          {doc.year} р.
                        </span>
                      )}
                    </div>
                    {doc.archiveRef && (
                      <p className={`text-[10px] ${theme.textSecondary} truncate`}>
                        {doc.archiveRef}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-end justify-between gap-2 shrink-0 self-stretch">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setViewingDoc(doc)}
                      className="p-1 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                      title="Переглянути скан"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {!doc.isFromChild && !isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 opacity-70 group-hover:opacity-100 cursor-pointer"
                        title="Від'єднати документ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Navigation button to child if from child */}
                  {doc.isFromChild && doc.childId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (doc.childId) setSelectedPersonId(doc.childId);
                      }}
                      className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                      title="Відкрити картку дитини"
                    >
                      <span>Картка</span>
                      <ArrowUpRight className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`p-4 rounded-xl border border-dashed ${theme.borderSubtle} text-center space-y-1.5`}>
          <p className={`text-xs ${theme.textMuted} italic`}>
            {filterTab === 'children'
              ? 'У дітей цієї особи ще не завантажено метричних сканів чи документів.'
              : filterTab === 'own'
              ? 'Особистих документів поки не завантажено.'
              : 'До цієї особи та її дітей ще не прикріплено архівних сканів чи фотографій.'}
          </p>
        </div>
      )}

      {/* ADD DOCUMENT MODAL */}
      {activeModal === 'add' && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]`}>
            {/* Header */}
            <div className={`p-4 border-b ${theme.borderSubtle} flex items-center justify-between ${isDark ? 'bg-slate-900/90' : 'bg-neutral-50'}`}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#B88E3E]/10 text-[#B88E3E] flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${theme.textPrimary}`}>
                    Прикріпити архівний документ або фото
                  </h3>
                  <p className={`text-[11px] ${theme.textMuted}`}>
                    Для: <strong className="text-emerald-600 dark:text-emerald-400">{person.lastName || ''} {person.firstName || ''}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveModal(null)}
                className={`p-1.5 rounded-lg ${theme.textMuted} hover:${theme.textPrimary}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="p-3 border-b border-black/10 dark:border-white/10 flex gap-2">
              <button
                type="button"
                onClick={() => setUploadMode('file')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  uploadMode === 'file'
                    ? 'bg-[#B88E3E] text-white shadow-xs'
                    : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 text-neutral-600 dark:text-neutral-300'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Завантажити файл (GitHub / Хмара)</span>
              </button>

              <button
                type="button"
                onClick={() => setUploadMode('link')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  uploadMode === 'link'
                    ? 'bg-[#B88E3E] text-white shadow-xs'
                    : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 text-neutral-600 dark:text-neutral-300'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Посилання (Google Drive / GitHub)</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
              {uploadMode === 'file' ? (
                <div className="space-y-3">
                  {/* File Input */}
                  <div className="p-4 rounded-xl border-2 border-dashed border-[#B88E3E]/40 hover:border-[#B88E3E] text-center space-y-2 bg-black/5 dark:bg-white/5 transition-colors">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      id="doc-file-upload"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="doc-file-upload"
                      className="cursor-pointer block space-y-1.5"
                    >
                      <Upload className="w-8 h-8 text-[#B88E3E] mx-auto" />
                      <div className="font-bold text-neutral-700 dark:text-neutral-200">
                        {selectedFile ? selectedFile.name : 'Натисніть для вибору скану або фото'}
                      </div>
                      <p className="text-[10px] text-neutral-500">
                        Підтримуються JPG, PNG, WEBP, PDF
                      </p>
                    </label>
                  </div>

                  {/* GitHub Path Preview */}
                  {selectedFile && (
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-900 dark:text-purple-300 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[11px]">
                        <Archive className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>Структура збереження в GitHub репозиторії:</span>
                      </div>
                      <code className="text-[10px] block break-all font-mono bg-purple-950/20 p-1.5 rounded border border-purple-500/20">
                        {generatePersonArchivePath(person, selectedFile.name, githubConfig.baseFolder || 'archive')}
                      </code>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="font-bold block text-neutral-700 dark:text-neutral-300">
                    Посилання на файл (Google Drive або GitHub):
                  </label>
                  <input
                    type="url"
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/... або https://github.com/..."
                    className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.cardBg} ${theme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  />
                  <p className="text-[10px] text-neutral-500">
                    💡 <em>Підказка:</em> Вставте посилання на Google Диск або репозиторій GitHub — система автоматично налаштує вбудований перегляд.
                  </p>
                </div>
              )}

              {/* Common Metadata Fields */}
              <div className="space-y-3 pt-1 border-t border-black/10 dark:border-white/10">
                <div>
                  <label className="font-bold block text-neutral-700 dark:text-neutral-300 mb-1">
                    Назва документа / опис:
                  </label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="Наприклад: Метричний запис про народження (1895)"
                    className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.cardBg} ${theme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold block text-neutral-700 dark:text-neutral-300 mb-1">
                      Тип документа:
                    </label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.cardBg} ${theme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    >
                      <option value="metric">Метрична книга (Народження/Шлюб/Смерть)</option>
                      <option value="revision">Ревізька казка / Перепис</option>
                      <option value="confession">Сповідний розпис</option>
                      <option value="photo">Світлина / Портрет</option>
                      <option value="passport">Паспорт / Довідка</option>
                      <option value="military">Військовий квиток / Справа</option>
                      <option value="certificate">Свідоцтво / Грамота</option>
                      <option value="other">Інше архівне джерело</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold block text-neutral-700 dark:text-neutral-300 mb-1">
                      Рік складання:
                    </label>
                    <input
                      type="text"
                      value={docYear}
                      onChange={(e) => setDocYear(e.target.value)}
                      placeholder="1895"
                      className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.cardBg} ${theme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold block text-neutral-700 dark:text-neutral-300 mb-1">
                      Архівний шифр (Фонд, Опис, Справа):
                    </label>
                    <input
                      type="text"
                      value={docArchiveRef}
                      onChange={(e) => setDocArchiveRef(e.target.value)}
                      placeholder="ДАХО, Ф. 40, оп. 1, спр. 120"
                      className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.cardBg} ${theme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>

                  <div>
                    <label className="font-bold block text-neutral-700 dark:text-neutral-300 mb-1">
                      Аркуш / Сторінка:
                    </label>
                    <input
                      type="text"
                      value={docPage}
                      onChange={(e) => setDocPage(e.target.value)}
                      placeholder="арк. 14 зв."
                      className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.cardBg} ${theme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold block text-neutral-700 dark:text-neutral-300 mb-1">
                    Примітки та розшифровка тексту:
                  </label>
                  <textarea
                    value={docNotes}
                    onChange={(e) => setDocNotes(e.target.value)}
                    rows={2}
                    placeholder="Введіть витяг або розшифровку запису..."
                    className={`w-full p-2.5 rounded-xl border ${theme.borderSubtle} ${theme.cardBg} ${theme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                  />
                </div>
              </div>

              {uploadStatusMsg && (
                <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  uploadStatusMsg.isError
                    ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                }`}>
                  {uploadStatusMsg.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span>{uploadStatusMsg.text}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className={`p-4 border-t ${theme.borderSubtle} flex flex-wrap items-center justify-end gap-2 ${isDark ? 'bg-slate-900/90' : 'bg-neutral-50'}`}>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isUploading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                Скасувати
              </button>

              {uploadMode === 'file' ? (
                <>
                  {githubConfig.isConfigured ? (
                    <button
                      type="button"
                      onClick={handleUploadToGitHub}
                      disabled={!selectedFile || isUploading}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>{isUploading ? 'Відправка в GitHub...' : '🚀 Відправити в GitHub (1 клік)'}</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleSaveToFirestore}
                    disabled={!selectedFile || isUploading}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#B88E3E] hover:bg-[#a07a32] text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Зберегти в Firestore</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveByLink}
                  disabled={!docUrl.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#B88E3E] hover:bg-[#a07a32] text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Прикріпити посилання</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {viewingDoc && (
        <DocumentLightboxModal
          document={viewingDoc}
          personName={
            viewingDoc.isFromChild && viewingDoc.childName
              ? `${viewingDoc.childName} (${viewingDoc.relationLabel})`
              : `${person.lastName || ''} ${person.firstName || ''}`
          }
          onClose={() => setViewingDoc(null)}
        />
      )}
    </div>
  );
};

