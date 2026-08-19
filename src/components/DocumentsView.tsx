import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileText, 
  Plus, 
  Search, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Minus, 
  Trash2, 
  Edit2, 
  HardDrive, 
  Link as LinkIcon, 
  ExternalLink,
  Upload,
  CheckCircle2,
  Paperclip,
  FolderTree,
  Tag
} from 'lucide-react';
import { useGenealogy } from '../context/GenealogyContext';
import { GenealogyDocument, CustomField } from '../types';

export const DOCUMENT_TYPES = [
  'народження',
  'шлюби',
  'смерті',
  'метрична книга',
  'сповідний розпис',
  'ревізія',
  'перепис',
  'інвентар',
  'судова справа',
  'військовий документ',
  'інше'
] as const;

export const DOCUMENT_STATUSES = [
  'не почато',
  'в роботі',
  'переглянуто',
  'потрібно повторно перевірити',
  'недоступно'
] as const;

export const PRESET_CUSTOM_FIELDS = [
  'Слідчий',
  'Місце зберігання',
  'Номер протоколу',
  'Серійний номер',
  'Експертний висновок',
  'Дата вилучення'
] as const;

export const DocumentsView: React.FC = () => {
  const { 
    documents, 
    addDocument, 
    updateDocument, 
    deleteDocument, 
    googleDriveEmail, 
    setGoogleDriveEmail 
  } = useGenealogy();

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubdivision, setSelectedSubdivision] = useState('all');
  const [customSubdivisions, setCustomSubdivisions] = useState<string[]>([]);
  const [selectedResearch, setSelectedResearch] = useState('all');
  const [selectedArchive, setSelectedArchive] = useState('all');
  const [yearQuery, setYearQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<GenealogyDocument | null>(null);

  // Form Fields
  const [researchTitle, setResearchTitle] = useState("Без прив'язки");
  const [subdivision, setSubdivision] = useState('');
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<string>('народження');
  const [archive, setArchive] = useState('');
  const [fund, setFund] = useState('');
  const [inventory, setInventory] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [settlement, setSettlement] = useState('');
  const [documentLink, setDocumentLink] = useState('');
  const [pageCount, setPageCount] = useState('');
  const [lastViewedPage, setLastViewedPage] = useState('1');
  const [status, setStatus] = useState<string>('в роботі');
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [attachedScans, setAttachedScans] = useState<{ id: string; name: string; url: string; source: 'storage' | 'drive' | 'link' }[]>([]);

  // Unique lists for dropdown filters
  const availableSubdivisions = useMemo(() => {
    const list = documents.map(d => d.subdivision).filter(Boolean) as string[];
    const set = new Set([...list, ...customSubdivisions]);
    return Array.from(set);
  }, [documents, customSubdivisions]);

  const availableArchives = useMemo(() => {
    const list = documents.map(d => d.archive || d.archiveRef).filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [documents]);

  const availableResearches = useMemo(() => {
    const list = documents.map(d => d.researchTitle || d.researchId).filter(Boolean) as string[];
    const set = new Set(["Без прив'язки", "Aaaaa", ...list]);
    return Array.from(set);
  }, [documents]);

  // Filtered documents list
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // Search text query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = doc.title?.toLowerCase().includes(q);
        const matchesArchive = (doc.archive || doc.archiveRef || '').toLowerCase().includes(q);
        const matchesFund = (doc.fund || '').toLowerCase().includes(q);
        const matchesCase = (doc.caseNumber || '').toLowerCase().includes(q);
        const matchesSettlement = (doc.settlement || '').toLowerCase().includes(q);
        const matchesSubdiv = (doc.subdivision || '').toLowerCase().includes(q);
        const matchesCustom = Array.isArray(doc.customFields)
          ? doc.customFields.some(cf => (cf?.label || '').toLowerCase().includes(q) || (cf?.value || '').toLowerCase().includes(q))
          : false;

        if (!matchesTitle && !matchesArchive && !matchesFund && !matchesCase && !matchesSettlement && !matchesSubdiv && !matchesCustom) {
          return false;
        }
      }

      // Subdivision filter
      if (selectedSubdivision !== 'all') {
        const docSub = doc.subdivision || 'Без підрозділу';
        if (docSub !== selectedSubdivision) return false;
      }

      // Research filter
      if (selectedResearch !== 'all') {
        const docRes = doc.researchTitle || doc.researchId || "Без прив'язки";
        if (docRes !== selectedResearch) return false;
      }

      // Archive filter
      if (selectedArchive !== 'all') {
        const docArch = doc.archive || doc.archiveRef || '';
        if (docArch !== selectedArchive) return false;
      }

      // Year filter
      if (yearQuery.trim()) {
        const yr = yearQuery.trim();
        const docYearStr = String(doc.year || doc.yearFrom || '');
        if (!docYearStr.includes(yr)) return false;
      }

      // Type filter
      if (selectedType !== 'all' && doc.type !== selectedType) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && doc.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [documents, searchQuery, selectedSubdivision, selectedResearch, selectedArchive, yearQuery, selectedType, selectedStatus]);

  // Pagination calculation
  const totalItems = filteredDocuments.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  
  const paginatedDocs = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredDocuments.slice(start, start + pageSize);
  }, [filteredDocuments, safePage, pageSize]);

  // Handle Export Excel
  const handleExportExcel = () => {
    const dataToExport = filteredDocuments.map((doc, idx) => ({
      '№': idx + 1,
      'Назва речового доказу': doc.title,
      'Підрозділ': doc.subdivision || '—',
      'Тип': doc.type,
      'Статус': doc.status || 'не почато',
      'Рік від': doc.yearFrom || doc.year || '—',
      'Рік до': doc.yearTo || '—',
      'Архів': doc.archive || doc.archiveRef || '—',
      'Фонд': doc.fund || '—',
      'Опис': doc.inventory || '—',
      'Справа': doc.caseNumber || '—',
      'Населений пункт': doc.settlement || '—',
      'Остання переглянута сторінка': doc.lastViewedPage || '—',
      'Кількість сторінок': doc.pageCount || '—',
      'Посилання': doc.documentLink || doc.driveUrl || '—',
      'Власні поля': Array.isArray(doc.customFields) ? doc.customFields.map(f => `${f.label}: ${f.value}`).join('; ') : '—',
      'Нотатки': doc.notes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Речові докази');
    XLSX.writeFile(workbook, `Reiestr_Rechovykh_Dokaziv_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Open Modal
  const openAddModal = () => {
    setEditingDoc(null);
    setResearchTitle("Без прив'язки");
    setSubdivision(selectedSubdivision !== 'all' ? selectedSubdivision : '');
    setTitle('');
    setDocType('народження');
    setArchive('');
    setFund('');
    setInventory('');
    setCaseNumber('');
    setYearFrom('');
    setYearTo('');
    setSettlement('');
    setDocumentLink('');
    setPageCount('');
    setLastViewedPage('1');
    setStatus('не почато');
    setNotes('');
    setCustomFields([]);
    setAttachedScans([]);
    setIsModalOpen(true);
  };

  const openEditModal = (doc: GenealogyDocument) => {
    setEditingDoc(doc);
    setResearchTitle(doc.researchTitle || doc.researchId || "Без прив'язки");
    setSubdivision(doc.subdivision || '');
    setTitle(doc.title);
    setDocType(doc.type || 'народження');
    setArchive(doc.archive || doc.archiveRef || '');
    setFund(doc.fund || '');
    setInventory(doc.inventory || '');
    setCaseNumber(doc.caseNumber || '');
    setYearFrom(doc.yearFrom ? String(doc.yearFrom) : doc.year ? String(doc.year) : '');
    setYearTo(doc.yearTo ? String(doc.yearTo) : '');
    setSettlement(doc.settlement || '');
    setDocumentLink(doc.documentLink || doc.driveUrl || '');
    setPageCount(doc.pageCount ? String(doc.pageCount) : '');
    setLastViewedPage(doc.lastViewedPage ? String(doc.lastViewedPage) : '1');
    setStatus(doc.status || 'в роботі');
    setNotes(doc.notes || '');
    setCustomFields(doc.customFields || []);
    setAttachedScans(doc.scans || []);
    setIsModalOpen(true);
  };

  // Save Document
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const docPayload: Omit<GenealogyDocument, 'id' | 'uploadDate'> = {
      title: title.trim(),
      type: docType,
      researchTitle,
      subdivision: subdivision.trim(),
      archive,
      archiveRef: archive,
      fund,
      inventory,
      caseNumber,
      yearFrom,
      yearTo,
      year: yearFrom || '—',
      settlement,
      documentLink,
      driveUrl: documentLink,
      pageCount,
      lastViewedPage,
      status,
      notes,
      customFields,
      scans: attachedScans,
      tags: [docType, archive, subdivision].filter(Boolean) as string[]
    };

    if (editingDoc) {
      updateDocument({ ...docPayload, id: editingDoc.id });
    } else {
      addDocument({ ...docPayload, id: `doc_${Date.now()}` });
    }

    setIsModalOpen(false);
  };

  // Add Custom Field
  const handleAddCustomField = (defaultLabel: string = '') => {
    setCustomFields(prev => [
      ...prev,
      { id: `cf_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, label: defaultLabel || 'Нове поле', value: '' }
    ]);
  };

  const handleUpdateCustomField = (id: string, label: string, value: string) => {
    setCustomFields(prev => prev.map(cf => cf.id === id ? { ...cf, label, value } : cf));
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields(prev => prev.filter(cf => cf.id !== id));
  };

  // Add Scan/Link simulation
  const handleAddExternalLink = () => {
    const url = prompt('Введіть посилання на речовий доказ (Google Drive, Вікітека, електронний архів):');
    if (url && url.trim()) {
      setAttachedScans(prev => [
        ...prev,
        {
          id: `scan_${Date.now()}`,
          name: url.length > 35 ? url.substring(0, 35) + '...' : url,
          url: url.trim(),
          source: url.includes('drive.google.com') ? 'drive' : 'link'
        }
      ]);
    }
  };

  // Status Badge Styling Helper - Clean Charcoal Theme
  const getStatusBadgeClass = (st?: string) => {
    switch (st) {
      case 'в роботі':
        return 'bg-[#1E293B] text-[#93C5FD] border border-[#334155]';
      case 'переглянуто':
        return 'bg-[#14532D]/40 text-[#86EFAC] border border-[#166534]';
      case 'потрібно повторно перевірити':
        return 'bg-[#78350F]/40 text-[#FDE047] border border-[#92400E]';
      case 'недоступно':
        return 'bg-[#881337]/40 text-[#FCA5A5] border border-[#9F1239]';
      case 'не почато':
      default:
        return 'bg-[#262626] text-[#A3A3A3] border border-[#404040]';
    }
  };

  return (
    <div className="flex-1 bg-[#121212] text-[#E5E5E5] p-6 md:p-8 overflow-y-auto space-y-6 font-sans">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#262626] pb-5">
        <div>
          <h1 className="text-3xl font-serif font-bold text-[#F5F5F5] tracking-tight">Речові докази</h1>
          <p className="text-sm text-[#A3A3A3] mt-1 font-medium">
            Реєстр джерел, речових доказів, підрозділи, прогрес перегляду та точне місце зупинки.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-[#262626] hover:bg-[#333333] text-[#E5E5E5] border border-[#404040] font-semibold rounded-xl text-xs flex items-center gap-2 transition-all shadow-xs"
          >
            <span>Експорт Excel</span>
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-[#B88E3E] hover:bg-[#A37B30] text-[#0F0F0F] font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>+ Додати речовий доказ</span>
          </button>
        </div>
      </div>

      {/* 2. Subdivision Sub-tabs Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-2.5 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none min-w-max">
          <span className="text-[10px] font-bold text-[#8C8C8C] uppercase tracking-wider px-2 flex items-center gap-1.5 shrink-0">
            <FolderTree className="w-3.5 h-3.5 text-[#B88E3E]" />
            ПІДРОЗДІЛИ:
          </span>

          <button
            onClick={() => setSelectedSubdivision('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              selectedSubdivision === 'all'
                ? 'bg-[#B88E3E] text-[#0F0F0F] shadow-sm'
                : 'bg-[#121212] text-[#A3A3A3] hover:text-[#E5E5E5] border border-[#333333] hover:bg-[#262626]'
            }`}
          >
            <span>Усі підрозділи</span>
            <span className={`px-1.5 py-0.2 text-[10px] font-mono rounded ${
              selectedSubdivision === 'all' ? 'bg-[#0F0F0F]/20 text-[#0F0F0F]' : 'bg-[#262626] text-[#8C8C8C]'
            }`}>
              {documents.length}
            </span>
          </button>

          {availableSubdivisions.map((sub) => {
            const count = documents.filter(d => d.subdivision === sub).length;
            const isActive = selectedSubdivision === sub;
            return (
              <button
                key={sub}
                onClick={() => setSelectedSubdivision(sub)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#B88E3E] text-[#0F0F0F] shadow-sm'
                    : 'bg-[#121212] text-[#A3A3A3] hover:text-[#E5E5E5] border border-[#333333] hover:bg-[#262626]'
                }`}
              >
                <span>{sub}</span>
                <span className={`px-1.5 py-0.2 text-[10px] font-mono rounded ${
                  isActive ? 'bg-[#0F0F0F]/20 text-[#0F0F0F]' : 'bg-[#262626] text-[#8C8C8C]'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => {
            const name = prompt('Введіть назву нового підрозділу:');
            if (name && name.trim()) {
              const trimmed = name.trim();
              setCustomSubdivisions(prev => Array.from(new Set([...prev, trimmed])));
              setSelectedSubdivision(trimmed);
            }
          }}
          className="px-3 py-1.5 bg-[#262626] hover:bg-[#333333] text-[#E5E5E5] border border-[#404040] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-[#B88E3E]" />
          <span>+ Створити підрозділ</span>
        </button>
      </div>

      {/* 3. Compact Filter / Search Card */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 shadow-md">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 items-end">
          {/* ПОШУК */}
          <div>
            <label className="block text-[10px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1">
              ПОШУК
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Пошук..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] placeholder-[#666666] rounded-lg pl-8 pr-2.5 py-1.5 text-xs focus:outline-none focus:border-[#B88E3E]"
              />
              <Search className="w-3.5 h-3.5 text-[#666666] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* ДОСЛІДЖЕННЯ */}
          <div>
            <label className="block text-[10px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1">
              ДОСЛІДЖЕННЯ
            </label>
            <select
              value={selectedResearch}
              onChange={(e) => setSelectedResearch(e.target.value)}
              className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#B88E3E] cursor-pointer truncate"
            >
              <option value="all">Усі дослідження</option>
              {availableResearches.map((r, i) => (
                <option key={i} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* АРХІВ */}
          <div>
            <label className="block text-[10px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1">
              АРХІВ
            </label>
            <select
              value={selectedArchive}
              onChange={(e) => setSelectedArchive(e.target.value)}
              className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#B88E3E] cursor-pointer truncate"
            >
              <option value="all">Усі архіви</option>
              {availableArchives.map((a, i) => (
                <option key={i} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* РІК */}
          <div>
            <label className="block text-[10px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1">
              РІК
            </label>
            <input
              type="text"
              placeholder="Будь-який"
              value={yearQuery}
              onChange={(e) => setYearQuery(e.target.value)}
              className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] placeholder-[#666666] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#B88E3E]"
            />
          </div>

          {/* ТИП ДОКУМЕНТА */}
          <div>
            <label className="block text-[10px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1">
              ТИП ДОКУМЕНТА
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#B88E3E] cursor-pointer truncate"
            >
              <option value="all">Усі типи</option>
              {DOCUMENT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* СТАТУС */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-bold text-[#8C8C8C] uppercase tracking-wider">
                СТАТУС
              </label>
              <span className="text-[10px] text-[#737373] font-mono">
                {filteredDocuments.length}/{documents.length}
              </span>
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#B88E3E] cursor-pointer truncate"
            >
              <option value="all">Усі статуси</option>
              {DOCUMENT_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Table Container & Top Pagination */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden shadow-xl">
        {/* Pagination Bar Top */}
        <div className="px-5 py-3 border-b border-[#2A2A2A] flex items-center justify-between text-xs text-[#8C8C8C]">
          <span>
            Показано {totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, totalItems)} з {totalItems}
          </span>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase text-[10px] tracking-wider text-[#737373]">НА СТОРІНЦІ</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#121212] border border-[#333333] text-[#E5E5E5] rounded-lg px-2.5 py-1 text-xs focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={safePage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 rounded-lg bg-[#121212] border border-[#333333] hover:bg-[#262626] disabled:opacity-30 text-[#E5E5E5]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2.5 py-1 bg-[#B88E3E] text-[#0F0F0F] rounded-lg font-bold text-xs">
                {safePage}
              </span>
              <button
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-1.5 rounded-lg bg-[#121212] border border-[#333333] hover:bg-[#262626] disabled:opacity-30 text-[#E5E5E5]"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Documents Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#2A2A2A] bg-[#141414]">
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">РЕЧОВИЙ ДОКАЗ</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">ПІДРОЗДІЛ</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">РІК</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">АРХІВ</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">ТИП</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">НАСЕЛЕНИЙ ПУНКТ</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">ВЛАСНІ ПОЛЯ</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">СТАТУС</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">ДІЇ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {paginatedDocs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#737373]">
                    Не знайдено речових доказів за обраними фільтрами.
                  </td>
                </tr>
              ) : (
                paginatedDocs.map(doc => (
                  <tr key={doc.id} className="hover:bg-[#222222] transition-colors">
                    <td className="py-3.5 px-4 font-medium text-[#F5F5F5]">
                      <button
                        onClick={() => openEditModal(doc)}
                        className="hover:text-[#B88E3E] text-left underline decoration-[#404040] underline-offset-4"
                      >
                        {doc.title}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-[#A3A3A3]">
                      {doc.subdivision ? (
                        <span className="px-2 py-0.5 bg-[#262626] border border-[#3A3A3A] text-[#D4D4D4] rounded-md text-[11px] font-medium flex items-center gap-1 w-fit">
                          <FolderTree className="w-3 h-3 text-[#B88E3E]" />
                          {doc.subdivision}
                        </span>
                      ) : (
                        <span className="text-[#525252]">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[#A3A3A3]">
                      {doc.yearFrom || doc.year || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-[#A3A3A3]">
                      {doc.archive || doc.archiveRef || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-[#E5E5E5]">
                      {doc.type}
                    </td>
                    <td className="py-3.5 px-4 text-[#A3A3A3]">
                      {doc.settlement || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-[#A3A3A3]">
                      {Array.isArray(doc.customFields) && doc.customFields.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {doc.customFields.map((cf, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-[#1C1C1C] border border-[#333333] text-[#A3A3A3] rounded text-[10px]">
                              <strong className="text-[#D4D4D4]">{cf.label}:</strong> {cf.value}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#525252]">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium inline-block ${getStatusBadgeClass(doc.status)}`}>
                        {doc.status || 'не почато'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(doc)}
                          className="px-2.5 py-1 bg-[#121212] hover:bg-[#262626] border border-[#333333] text-[#E5E5E5] rounded-md text-[11px] font-medium"
                        >
                          Редагувати
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Видалити цей речовий доказ?')) {
                              deleteDocument(doc.id);
                            }
                          }}
                          className="p-1 text-[#737373] hover:text-rose-400"
                          title="Видалити"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar Bottom */}
        <div className="px-5 py-3 border-t border-[#2A2A2A] flex items-center justify-between text-xs text-[#8C8C8C]">
          <span>
            Показано {totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, totalItems)} з {totalItems}
          </span>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase text-[10px] tracking-wider text-[#737373]">НА СТОРІНЦІ</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#121212] border border-[#333333] text-[#E5E5E5] rounded-lg px-2.5 py-1 text-xs focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={safePage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 rounded-lg bg-[#121212] border border-[#333333] hover:bg-[#262626] disabled:opacity-30 text-[#E5E5E5]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2.5 py-1 bg-[#B88E3E] text-[#0F0F0F] rounded-lg font-bold text-xs">
                {safePage}
              </span>
              <button
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-1.5 rounded-lg bg-[#121212] border border-[#333333] hover:bg-[#262626] disabled:opacity-30 text-[#E5E5E5]"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Modal "Додати речовий доказ" / "Редагувати речовий доказ" */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-2xl w-full max-w-2xl my-8 overflow-hidden shadow-2xl text-[#E5E5E5] flex flex-col max-h-[90vh]">
            {/* Window Bar */}
            <div className="px-6 py-4 border-b border-[#2A2A2A] flex items-center justify-between bg-[#141414] shrink-0">
              <h2 className="text-xl font-serif font-bold text-[#F5F5F5]">
                {editingDoc ? 'Редагувати речовий доказ' : 'Додати речовий доказ'}
              </h2>
              <div className="flex items-center gap-3 text-[#A3A3A3]">
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="hover:text-[#F5F5F5] p-1"
                  title="Згорнути"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="hover:text-[#F5F5F5] p-1"
                  title="Закрити"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Grid 2 Cols: ДОСЛІДЖЕННЯ & ПІДРОЗДІЛ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1.5">
                    ДОСЛІДЖЕННЯ
                  </label>
                  <select
                    value={researchTitle}
                    onChange={(e) => setResearchTitle(e.target.value)}
                    className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                  >
                    <option value="Без прив'язки">Без прив'язки</option>
                    <option value="Aaaaa">Aaaaa</option>
                    {availableResearches.filter(r => r !== "Без прив'язки" && r !== "Aaaaa").map((r, i) => (
                      <option key={i} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1.5">
                    ПІДРОЗДІЛ / ГРУПА
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="subdivision-list"
                      placeholder="Введіть назву підрозділу..."
                      value={subdivision}
                      onChange={(e) => setSubdivision(e.target.value)}
                      className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] placeholder-[#666666] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                    />
                    <datalist id="subdivision-list">
                      {availableSubdivisions.map((s, idx) => (
                        <option key={idx} value={s} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* НАЗВА РЕЧОВОГО ДОКАЗУ * */}
              <div>
                <label className="block text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1.5">
                  НАЗВА РЕЧОВОГО ДОКАЗУ *
                </label>
                <input
                  type="text"
                  required
                  placeholder="напр. Метрична книга Покровської церкви або Годинник вилучений №4"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] placeholder-[#666666] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                />
              </div>

              {/* Grid 2 Cols: ТИП ДОКУМЕНТА & АРХІВ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1.5">
                    ТИП ДОКУМЕНТА
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                  >
                    {DOCUMENT_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1.5">
                    АРХІВ
                  </label>
                  <input
                    type="text"
                    placeholder="напр. ДАПО, ЦДІАК"
                    value={archive}
                    onChange={(e) => setArchive(e.target.value)}
                    className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] placeholder-[#666666] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                  />
                </div>
              </div>

              {/* Grid 2 Cols: ФОНД & ОПИС */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1.5">
                    ФОНД
                  </label>
                  <input
                    type="text"
                    placeholder="напр. Ф. 1011"
                    value={fund}
                    onChange={(e) => setFund(e.target.value)}
                    className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] placeholder-[#666666] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1.5">
                    ОПИС
                  </label>
                  <input
                    type="text"
                    placeholder="напр. Оп. 1"
                    value={inventory}
                    onChange={(e) => setInventory(e.target.value)}
                    className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] placeholder-[#666666] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                  />
                </div>
              </div>

              {/* Grid 2 Cols: СПРАВА & РІК ВІД */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1.5">
                    СПРАВА
                  </label>
                  <input
                    type="text"
                    placeholder="напр. Спр. 412"
                    value={caseNumber}
                    onChange={(e) => setCaseNumber(e.target.value)}
                    className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] placeholder-[#666666] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1.5">
                    РІК ВІД
                  </label>
                  <input
                    type="text"
                    placeholder="напр. 1900"
                    value={yearFrom}
                    onChange={(e) => setYearFrom(e.target.value)}
                    className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] placeholder-[#666666] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                  />
                </div>
              </div>

              {/* Grid 2 Cols: РІК ДО & НАСЕЛЕНИЙ ПУНКТ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1.5">
                    РІК ДО
                  </label>
                  <input
                    type="text"
                    placeholder="напр. 1905"
                    value={yearTo}
                    onChange={(e) => setYearTo(e.target.value)}
                    className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] placeholder-[#666666] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1.5">
                    НАСЕЛЕНИЙ ПУНКТ
                  </label>
                  <input
                    type="text"
                    placeholder="напр. с. Чернечий Яр"
                    value={settlement}
                    onChange={(e) => setSettlement(e.target.value)}
                    className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] placeholder-[#666666] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                  />
                </div>
              </div>

              {/* ПОСИЛАННЯ НА ДОКУМЕНТ */}
              <div>
                <label className="block text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1.5">
                  ПОСИЛАННЯ НА ДОКУМЕНТ / ДЖЕРЕЛО
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={documentLink}
                  onChange={(e) => setDocumentLink(e.target.value)}
                  className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] placeholder-[#666666] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                />
              </div>

              {/* Скан документа Card */}
              <div className="p-4 bg-[#141414] border border-[#2A2A2A] rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm text-[#F5F5F5]">Скан речового доказу</h3>
                    <p className="text-[11px] text-[#A3A3A3] mt-0.5 max-w-md">
                      Додайте скан, файл із хмарного сховища або посилання на зовнішнє джерело: Вікіджерела, електронний архів, бібліотеку чи інший сайт із документом.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5 w-full sm:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => alert('Сховище підключено до поточного акаунту.')}
                      className="px-3 py-1.5 bg-[#262626] hover:bg-[#333333] border border-[#404040] text-[#E5E5E5] rounded-lg text-xs font-semibold text-center"
                    >
                      Підключити сховище
                    </button>
                    <button
                      type="button"
                      onClick={() => alert(googleDriveEmail ? `Google Drive активовано: ${googleDriveEmail}` : 'Підключіть пошту Google в налаштуваннях.')}
                      className="px-3 py-1.5 bg-[#262626] hover:bg-[#333333] border border-[#404040] text-[#E5E5E5] rounded-lg text-xs font-semibold text-center"
                    >
                      Обрати з Google Drive
                    </button>
                    <button
                      type="button"
                      onClick={handleAddExternalLink}
                      className="px-3 py-1.5 bg-[#262626] hover:bg-[#333333] border border-[#404040] text-[#E5E5E5] rounded-lg text-xs font-semibold text-center"
                    >
                      Зовнішнє посилання
                    </button>
                  </div>
                </div>

                {/* File list dropzone */}
                <div className="border border-dashed border-[#333333] rounded-xl p-4 text-center text-xs text-[#737373] bg-[#0F0F0F]">
                  {attachedScans.length === 0 ? (
                    <span>Файлів поки немає.</span>
                  ) : (
                    <div className="space-y-2 text-left">
                      {attachedScans.map(scan => (
                        <div key={scan.id} className="flex items-center justify-between p-2 bg-[#1A1A1A] rounded-lg border border-[#333333] text-xs">
                          <span className="flex items-center gap-2 truncate text-[#E5E5E5]">
                            <Paperclip className="w-3.5 h-3.5 text-[#B88E3E]" />
                            {scan.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setAttachedScans(prev => prev.filter(s => s.id !== scan.id))}
                            className="text-rose-400 hover:text-rose-300 ml-2"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Grid 2 Cols: КІЛЬКІСТЬ СТОРІНОК & ОСТАННЯ ПЕРЕГЛЯНУТА СТОРІНКА */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1.5">
                    КІЛЬКІСТЬ СТОРІНОК / АРКУШІВ
                  </label>
                  <input
                    type="text"
                    placeholder="напр. 250"
                    value={pageCount}
                    onChange={(e) => setPageCount(e.target.value)}
                    className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] placeholder-[#666666] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1.5">
                    ОСТАННЯ ПЕРЕГЛЯНУТА СТОРІНКА
                  </label>
                  <input
                    type="text"
                    placeholder="1"
                    value={lastViewedPage}
                    onChange={(e) => setLastViewedPage(e.target.value)}
                    className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] placeholder-[#666666] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                  />
                </div>
              </div>

              {/* СТАТУС ПЕРЕГЛЯДУ */}
              <div>
                <label className="block text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1.5">
                  СТАТУС ПЕРЕГЛЯДУ
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                >
                  {DOCUMENT_STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* НОТАТКИ */}
              <div>
                <label className="block text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1.5">
                  НОТАТКИ
                </label>
                <textarea
                  rows={3}
                  placeholder="Додайте ваші спостереження, виписки або зауваження до речового доказу..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#121212] border border-[#333333] text-[#E5E5E5] placeholder-[#666666] rounded-xl p-3 text-xs focus:outline-none focus:border-[#B88E3E]"
                />
              </div>

              {/* Enhanced Custom Fields Section */}
              <div className="p-4 bg-[#141414] border border-[#2A2A2A] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#B88E3E]" />
                    ВЛАСНІ ПОЛЯ ТА ХАРАКТЕРИСТИКИ
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddCustomField()}
                    className="px-3 py-1 bg-[#262626] hover:bg-[#333333] border border-[#404040] text-[#E5E5E5] rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Додати власне поле
                  </button>
                </div>

                {/* Preset quick buttons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-[#737373] mr-1">Швидкі пресети:</span>
                  {PRESET_CUSTOM_FIELDS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddCustomField(preset)}
                      className="px-2 py-0.5 bg-[#1C1C1C] hover:bg-[#2A2A2A] border border-[#333333] text-[#A3A3A3] hover:text-[#E5E5E5] rounded text-[10px] transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>

                {/* Custom fields list */}
                {customFields.length === 0 ? (
                  <div className="text-center py-3 text-[11px] text-[#666666] italic border border-dashed border-[#2A2A2A] rounded-xl">
                    Власних полів ще не додано. Натисніть "+ Додати власне поле" або оберіть пресет вище.
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    {customFields.map((field) => (
                      <div key={field.id} className="flex items-center gap-2 bg-[#121212] p-2 rounded-xl border border-[#2A2A2A]">
                        <input
                          type="text"
                          placeholder="Назва поля (напр. Слідчий)"
                          value={field.label}
                          onChange={(e) => handleUpdateCustomField(field.id, e.target.value, field.value)}
                          className="w-1/3 bg-[#1A1A1A] border border-[#333333] text-[#E5E5E5] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                        />
                        <input
                          type="text"
                          placeholder="Значення (напр. капітан Коваль)"
                          value={field.value}
                          onChange={(e) => handleUpdateCustomField(field.id, field.label, e.target.value)}
                          className="flex-1 bg-[#1A1A1A] border border-[#333333] text-[#E5E5E5] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#B88E3E]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomField(field.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-[#262626]"
                          title="Видалити поле"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2A2A2A] shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#A3A3A3] hover:text-[#FFFFFF] transition-colors"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#B88E3E] hover:bg-[#A37B30] text-[#0F0F0F] font-bold rounded-xl text-xs shadow-md transition-all"
                >
                  Зберегти
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
