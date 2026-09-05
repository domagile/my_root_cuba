import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Compass, 
  FileText, 
  Inbox, 
  CalendarDays, 
  CheckSquare, 
  Bookmark, 
  Lightbulb, 
  Users, 
  Plus, 
  Sparkles, 
  HardDrive, 
  CheckCircle2, 
  FileSearch,
  Bot,
  Trash2,
  Edit2,
  X,
  AlertTriangle,
  Filter,
  Check,
  Building2,
  Clock,
  ExternalLink,
  ShieldAlert,
  Info,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Gauge,
  Zap,
  Database,
  RefreshCw,
  FileSpreadsheet,
  Upload
} from 'lucide-react';
import { useGenealogy } from '../context/GenealogyContext';
import { 
  MetricRecord, 
  GenealogyDocument, 
  ArchiveRequest, 
  YearMatrixEntry, 
  GenealogyTask, 
  GenealogyFinding, 
  GenealogyHypothesis,
  ImportedMetricRow,
  Person
} from '../types';
import { getThemeConfig } from '../utils/theme';
import { ConfirmDeleteModal } from './common/ConfirmDeleteModal';
import { DetectiveNotesView } from './Research/DetectiveNotesView';

// ==========================================
// 1. RESEARCH & DETECTIVE NOTES VIEW (Google Keep Style)
// ==========================================
export const ResearchView: React.FC = () => {
  return <DetectiveNotesView />;
};

// ==========================================
// 2. DOCUMENTS VIEW (Документи та Google Диск)
// ==========================================
export const DocumentsView: React.FC = () => {
  const { documents, addDocument, updateDocument, deleteDocument, themePalette, googleDriveEmail, setGoogleDriveEmail } = useGenealogy();
  const theme = getThemeConfig(themePalette);
  
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [inputDriveEmail, setInputDriveEmail] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<GenealogyDocument | null>(null);
  const [docToDelete, setDocToDelete] = useState<GenealogyDocument | null>(null);
  const [isDisconnectDriveConfirmOpen, setIsDisconnectDriveConfirmOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState('Архівна довідка');
  const [archiveRef, setArchiveRef] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const openAdd = () => {
    setEditingDoc(null);
    setTitle('');
    setType('Архівна довідка');
    setArchiveRef('ДАПО');
    setTagsInput('Документ, Полтава');
    setIsModalOpen(true);
  };

  const openEdit = (doc: GenealogyDocument) => {
    setEditingDoc(doc);
    setTitle(doc.title);
    setType(doc.type);
    setArchiveRef(doc.archiveRef || '');
    setTagsInput(doc.tags.join(', '));
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

    if (editingDoc) {
      updateDocument({ ...editingDoc, title, type, archiveRef, tags });
    } else {
      addDocument({ id: `doc-${Date.now()}`, title, type, archiveRef, tags, createdAt: new Date().toISOString() });
    }
    setIsModalOpen(false);
  };

  const handleOpenDriveModal = () => {
    setInputDriveEmail(googleDriveEmail || '');
    setIsDriveModalOpen(true);
  };

  const handleSaveDriveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputDriveEmail.trim() || !inputDriveEmail.includes('@')) {
      alert('Будь ласка, введіть діючу адреси пошти Google.');
      return;
    }
    setIsDriveSyncing(true);
    setIsDriveModalOpen(false);
    setTimeout(() => {
      setGoogleDriveEmail(inputDriveEmail.trim());
      setIsDriveSyncing(false);
    }, 1000);
  };

  const handleDisconnectDrive = () => {
    setGoogleDriveEmail(null);
  };

  return (
    <div className={`flex-1 p-4 sm:p-6 md:p-8 ${theme.appBg} overflow-y-auto overflow-x-auto space-y-6 ${theme.cardTitle} transition-colors duration-300`}>
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between border-b ${theme.cardBorder} pb-4 gap-4`}>
        <div>
          <h2 className={`text-xl font-bold ${theme.cardTitle} flex items-center gap-2`}>
            <FileText className="w-6 h-6 text-[#B88E3E]" />
            <span>Архівні документи та Google Диск</span>
          </h2>
          <p className={`text-xs ${theme.cardSubtext} mt-1`}>
            Збереження оригінальних сканів, свідоцтв та архівних довідок з підключенням персонального Google Drive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {googleDriveEmail ? (
            <div className="flex items-center gap-2">
              <button 
                onClick={handleOpenDriveModal}
                disabled={isDriveSyncing}
                className={`px-3.5 py-2 font-semibold rounded-xl text-xs flex items-center gap-2 border ${theme.cardBorder} ${theme.cardBg} ${theme.cardTitle} hover:border-[#B88E3E] transition-all`}
              >
                <HardDrive className="w-4 h-4 text-[#B88E3E]" />
                <span>
                  {isDriveSyncing ? 'Синхронізація...' : `Google Диск: ${googleDriveEmail}`}
                </span>
              </button>
              <button 
                type="button"
                onClick={() => setIsDisconnectDriveConfirmOpen(true)}
                className="p-2 text-rose-500 hover:text-rose-700 bg-rose-500/10 rounded-xl text-xs font-semibold cursor-pointer"
                title="Відключити Google Диск"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleOpenDriveModal}
              disabled={isDriveSyncing}
              className={`px-3.5 py-2 font-semibold rounded-xl text-xs flex items-center gap-2 border border-[#B88E3E]/50 ${theme.accentBtn} ${theme.accentBtnText} shadow-sm transition-all`}
            >
              <HardDrive className="w-4 h-4" />
              <span>{isDriveSyncing ? 'Підключення...' : 'Підключити Google Диск'}</span>
            </button>
          )}

          <button 
            onClick={openAdd}
            className={`px-3.5 py-2 ${theme.badgeBg} ${theme.badgeText} border ${theme.cardBorder} font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs`}
          >
            <Plus className="w-4 h-4" />
            <span>Додати документ</span>
          </button>
        </div>
      </div>

      {googleDriveEmail && (
        <div className={`p-3.5 rounded-xl border ${theme.cardBorder} ${theme.cardBg} flex items-center justify-between text-xs`}>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>
              Синхронізацію з Google Drive для акаунту <strong className="font-semibold">{googleDriveEmail}</strong> активовано.
            </span>
          </span>
          <span className={`text-[10px] ${theme.badgeBg} ${theme.badgeText} px-2 py-0.5 rounded font-mono`}>
            Сховище: 2.4 GB доступно
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map(doc => (
          <div key={doc.id} className="p-4 bg-[#0A2621] border border-[#18453B] rounded-2xl space-y-3 hover:border-[#E2C382] transition-colors relative group">
            <div className="flex items-start justify-between">
              <div className="p-2 bg-[#133A31] text-[#E2C382] rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[#8BAAA1] font-mono mr-1">{doc.uploadDate}</span>
                <button onClick={() => openEdit(doc)} className="p-1 text-[#8BAAA1] hover:text-[#E2C382]">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button 
                  type="button"
                  onClick={() => { setDocToDelete(doc); }} 
                  className="p-1 text-[#8BAAA1] hover:text-rose-400 cursor-pointer"
                  title="Видалити"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-xs text-[#F0E6D2] line-clamp-2">{doc.title}</h4>
              <p className="text-[11px] text-[#8BAAA1] mt-1">{doc.archiveRef || doc.type}</p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[#143B33]">
              {doc.tags.map((t, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-[#123830] text-[#E2C382] rounded text-[10px]">
                  #{t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A2621] border border-[#18453B] rounded-2xl w-full max-w-md p-6 space-y-4 text-[#E6DEC8]">
            <div className="flex items-center justify-between border-b border-[#18453B] pb-3">
              <h3 className="text-base font-bold text-[#F5EEDC]">{editingDoc ? 'Редагувати документ' : 'Додати документ'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#8BAAA1] hover:text-[#F5EEDC]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#8BAAA1] mb-1">Назва документа</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="напр. Свідоцтво про народження"
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                  required
                />
              </div>

              <div>
                <label className="block text-[#8BAAA1] mb-1">Тип / Категорія</label>
                <input 
                  type="text" 
                  value={type} 
                  onChange={e => setType(e.target.value)}
                  placeholder="Архівна довідка, Сканована метрика..."
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                />
              </div>

              <div>
                <label className="block text-[#8BAAA1] mb-1">Архівна шифра / Джерело</label>
                <input 
                  type="text" 
                  value={archiveRef} 
                  onChange={e => setArchiveRef(e.target.value)}
                  placeholder="напр. ДАПО, Ф.1011, Спр.412"
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                />
              </div>

              <div>
                <label className="block text-[#8BAAA1] mb-1">Теги (через кому)</label>
                <input 
                  type="text" 
                  value={tagsInput} 
                  onChange={e => setTagsInput(e.target.value)}
                  placeholder="Метрика, 1901, Коваленко"
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#18453B]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-[#133A31] text-[#8BAAA1] rounded-xl">Скасувати</button>
                <button type="submit" className="px-4 py-2 bg-[#E2C382] text-[#0A2621] font-bold rounded-xl">Зберегти</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Drive Account Email Modal */}
      {isDriveModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 rounded-2xl border ${theme.cardBorder} ${theme.cardBg} w-full max-w-md space-y-4 shadow-xl`}>
            <div className={`flex items-center justify-between border-b ${theme.cardBorder} pb-3`}>
              <h3 className={`text-base font-bold ${theme.cardTitle} flex items-center gap-2`}>
                <HardDrive className="w-5 h-5 text-[#B88E3E]" />
                <span>Підключення Google Диск</span>
              </h3>
              <button onClick={() => setIsDriveModalOpen(false)} className={`p-1 ${theme.cardSubtext} hover:${theme.cardTitle}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDriveEmail} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium ${theme.cardTitle} mb-1.5`}>
                  Введіть електронну пошту акаунту Google:
                </label>
                <input 
                  type="email" 
                  value={inputDriveEmail} 
                  onChange={e => setInputDriveEmail(e.target.value)} 
                  placeholder="user@gmail.com"
                  className={`w-full ${theme.inputBg} border ${theme.inputBorder} ${theme.inputText} rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#B88E3E]`}
                  required
                  autoFocus
                />
                <p className={`text-[11px] ${theme.cardSubtext} mt-1.5`}>
                  Вкажіть пошту Google, куди будуть резервуватися скановані документи та фотографії.
                </p>
              </div>

              <div className={`flex items-center justify-end gap-2 pt-3 border-t ${theme.cardBorder}`}>
                <button 
                  type="button" 
                  onClick={() => setIsDriveModalOpen(false)} 
                  className={`px-4 py-2 rounded-xl border ${theme.cardBorder} ${theme.cardSubtext} text-xs font-semibold`}
                >
                  Скасувати
                </button>
                <button 
                  type="submit" 
                  className={`px-4 py-2 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} text-xs font-bold shadow-xs`}
                >
                  Підключити Диск
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Document */}
      {docToDelete && (
        <ConfirmDeleteModal
          isOpen={!!docToDelete}
          title="Видалення документа"
          itemName={docToDelete.title}
          itemType="документ"
          message={`Ви дійсно бажаєте видалити документ «${docToDelete.title}»?`}
          onConfirm={() => {
            if (docToDelete) {
              deleteDocument(docToDelete.id);
              setDocToDelete(null);
            }
          }}
          onClose={() => setDocToDelete(null)}
          isPermanent={true}
        />
      )}

      {/* Confirmation Modal for Disconnecting Google Drive */}
      {isDisconnectDriveConfirmOpen && (
        <ConfirmDeleteModal
          isOpen={isDisconnectDriveConfirmOpen}
          title="Відключення Google Диск"
          message={`Ви дійсно бажаєте відключити акаунт Google Диск (${googleDriveEmail})?`}
          confirmText="Відключити"
          onConfirm={() => {
            handleDisconnectDrive();
            setIsDisconnectDriveConfirmOpen(false);
          }}
          onClose={() => setIsDisconnectDriveConfirmOpen(false)}
        />
      )}
    </div>
  );
};

// ==========================================
// 3. ARCHIVE REQUESTS VIEW (Запити)
// ==========================================
export const RequestsView: React.FC = () => {
  const { requests, addRequest, updateRequest, deleteRequest, themePalette } = useGenealogy();
  const theme = getThemeConfig(themePalette);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<ArchiveRequest | null>(null);
  const [requestToDelete, setRequestToDelete] = useState<ArchiveRequest | null>(null);

  const [title, setTitle] = useState('');
  const [archiveName, setArchiveName] = useState('');
  const [dateSent, setDateSent] = useState('');
  const [status, setStatus] = useState<ArchiveRequest['status']>('sent');
  const [notes, setNotes] = useState('');

  const openAdd = () => {
    setEditingReq(null);
    setTitle('');
    setArchiveName('Державний архів Полтавської області (ДАПО)');
    setDateSent(new Date().toISOString().split('T')[0]);
    setStatus('sent');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEdit = (req: ArchiveRequest) => {
    setEditingReq(req);
    setTitle(req.title);
    setArchiveName(req.archiveName);
    setDateSent(req.dateSent);
    setStatus(req.status);
    setNotes(req.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingReq) {
      updateRequest({ ...editingReq, title, archiveName, dateSent, status, notes });
    } else {
      addRequest({
        id: `req-${Date.now()}`,
        title,
        archiveName,
        requestSubject: title,
        targetPersonOrFamily: title,
        sentDate: dateSent,
        dateSent,
        status,
        notes
      });
    }
    setIsModalOpen(false);
  };

  const getStatusBadge = (st: ArchiveRequest['status']) => {
    switch (st) {
      case 'received':
        return <span className="px-2.5 py-1 bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 rounded-lg text-xs font-mono">Отримано відповідь ✓</span>;
      case 'processing':
        return <span className="px-2.5 py-1 bg-amber-950/60 border border-amber-800/50 text-amber-300 rounded-lg text-xs font-mono">В обробці архіву</span>;
      case 'sent':
        return <span className="px-2.5 py-1 bg-blue-950/60 border border-blue-800/50 text-blue-300 rounded-lg text-xs font-mono">Надіслано</span>;
      case 'rejected':
        return <span className="px-2.5 py-1 bg-rose-950/60 border border-rose-800/50 text-rose-300 rounded-lg text-xs font-mono">Відмова / Лакуна</span>;
    }
  };

  return (
    <div className={`flex-1 p-4 sm:p-6 md:p-8 ${theme.appBg} overflow-y-auto overflow-x-auto space-y-6 ${theme.cardTitle} transition-colors duration-300`}>
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between border-b ${theme.cardBorder} pb-4 gap-4`}>
        <div>
          <h2 className={`text-xl font-bold ${theme.cardTitle} flex items-center gap-2`}>
            <Inbox className="w-6 h-6 text-[#B88E3E]" />
            <span>Архівні запити</span>
          </h2>
          <p className={`text-xs ${theme.cardSubtext} mt-1`}>
            Облік надісланих офіційних запитів до державних архівів (ДАПО, ЦДІАК, ДАКО) та стан виконання.
          </p>
        </div>

        <button 
          onClick={openAdd}
          className="px-4 py-2 bg-[#E2C382] hover:bg-[#D4B572] text-[#0A2621] font-bold rounded-xl text-xs flex items-center gap-2 shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Створити новий запит</span>
        </button>
      </div>

      <div className="space-y-3">
        {requests.map(r => (
          <div key={r.id} className="p-4 bg-[#0A2621] border border-[#18453B] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#E2C382]/50 transition-colors">
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-[#F0E6D2]">{r.title}</h4>
              <p className="text-xs text-[#8BAAA1]">{r.archiveName} • Надіслано: {r.dateSent}</p>
              {r.notes && <p className="text-xs text-[#C8DCD5] italic pt-1">«{r.notes}»</p>}
            </div>

            <div className="flex items-center gap-3 self-end md:self-center">
              {getStatusBadge(r.status)}
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(r)} className="p-1.5 text-[#8BAAA1] hover:text-[#E2C382] bg-[#133A31] rounded-lg">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button 
                  type="button"
                  onClick={() => { setRequestToDelete(r); }} 
                  className="p-1.5 text-[#8BAAA1] hover:text-rose-400 bg-[#133A31] rounded-lg cursor-pointer"
                  title="Видалити"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A2621] border border-[#18453B] rounded-2xl w-full max-w-md p-6 space-y-4 text-[#E6DEC8]">
            <div className="flex items-center justify-between border-b border-[#18453B] pb-3">
              <h3 className="text-base font-bold text-[#F5EEDC]">{editingReq ? 'Редагувати запит' : 'Створити запит'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#8BAAA1] hover:text-[#F5EEDC]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#8BAAA1] mb-1">Тема / Мета запиту</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="Запит про метрики..."
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                  required
                />
              </div>

              <div>
                <label className="block text-[#8BAAA1] mb-1">Назва архіву</label>
                <input 
                  type="text" 
                  value={archiveName} 
                  onChange={e => setArchiveName(e.target.value)} 
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8BAAA1] mb-1">Дата відправки</label>
                  <input 
                    type="date" 
                    value={dateSent} 
                    onChange={e => setDateSent(e.target.value)}
                    className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                  />
                </div>
                <div>
                  <label className="block text-[#8BAAA1] mb-1">Статус</label>
                  <select 
                    value={status} 
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                  >
                    <option value="sent">Надіслано</option>
                    <option value="processing">В обробці</option>
                    <option value="received">Отримано</option>
                    <option value="rejected">Відмова</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#8BAAA1] mb-1">Примітки / Нотатки</label>
                <textarea 
                  rows={2} 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl p-3 text-[#F5EEDC]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#18453B]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-[#133A31] text-[#8BAAA1] rounded-xl">Скасувати</button>
                <button type="submit" className="px-4 py-2 bg-[#E2C382] text-[#0A2621] font-bold rounded-xl">Зберегти</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Archive Request */}
      {requestToDelete && (
        <ConfirmDeleteModal
          isOpen={!!requestToDelete}
          title="Видалення архівного запиту"
          itemName={requestToDelete.title}
          itemType="архівний запит"
          message={`Ви дійсно бажаєте видалити запит «${requestToDelete.title}» (${requestToDelete.archiveName})?`}
          onConfirm={() => {
            if (requestToDelete) {
              deleteRequest(requestToDelete.id);
              setRequestToDelete(null);
            }
          }}
          onClose={() => setRequestToDelete(null)}
          isPermanent={true}
        />
      )}
    </div>
  );
};

// ==========================================
// 4. YEAR MATRIX VIEW (Матриця років роду)
// ==========================================
export const YearMatrixView: React.FC = () => {
  const { matrixEntries, rangeAnalyses, addMatrixEntry, updateMatrixEntry, deleteMatrixEntry, addRangeAnalysis, deleteRangeAnalysis, themePalette } = useGenealogy();
  const theme = getThemeConfig(themePalette);

  const [selectedLocation, setSelectedLocation] = useState<string>('всі');
  const [selectedDocType, setSelectedDocType] = useState<string>('всі');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<YearMatrixEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<YearMatrixEntry | null>(null);
  const [rangeToDelete, setRangeToDelete] = useState<{ id: string; name: string } | null>(null);

  const [year, setYear] = useState<number>(1900);
  const [location, setLocation] = useState('с. Чернечий Яр');
  const [docType, setDocType] = useState<YearMatrixEntry['docType']>('народження');
  const [status, setStatus] = useState<YearMatrixEntry['status']>('checked');
  const [researchTitle, setResearchTitle] = useState('');
  const [archiveRef, setArchiveRef] = useState('');
  const [notes, setNotes] = useState('');

  // Range modal
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
  const [rName, setRName] = useState('');
  const [rYearFrom, setRYearFrom] = useState(1890);
  const [rYearTo, setRYearTo] = useState(1915);
  const [rLoc, setRLoc] = useState('с. Чернечий Яр');
  const [rDocType, setRDocType] = useState('Метричні книги');

  const openAddEntry = () => {
    setEditingEntry(null);
    setYear(1900);
    setLocation('с. Чернечий Яр');
    setDocType('народження');
    setStatus('checked');
    setResearchTitle('');
    setArchiveRef('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditEntry = (m: YearMatrixEntry) => {
    setEditingEntry(m);
    setYear(m.year);
    setLocation(m.location);
    setDocType(m.docType);
    setStatus(m.status);
    setResearchTitle(m.researchTitle || '');
    setArchiveRef(m.archiveRef || '');
    setNotes(m.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEntry) {
      updateMatrixEntry(editingEntry.id, { year, location, docType, status, researchTitle, archiveRef, notes });
    } else {
      addMatrixEntry({ year, location, docType, status, researchTitle, archiveRef, notes });
    }
    setIsModalOpen(false);
  };

  const handleSaveRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rName) return;
    addRangeAnalysis({ researchName: rName, yearFrom: rYearFrom, yearTo: rYearTo, location: rLoc, docType: rDocType });
    setIsRangeModalOpen(false);
  };

  // Unique locations & doc types
  const locations = Array.from(new Set(matrixEntries.map(e => e.location)));
  
  const filteredEntries = matrixEntries.filter(m => {
    if (selectedLocation !== 'всі' && m.location !== selectedLocation) return false;
    if (selectedDocType !== 'всі' && m.docType !== selectedDocType) return false;
    return true;
  }).sort((a, b) => b.year - a.year);

  // Statistics
  const totalEntries = matrixEntries.length;
  const checkedCount = matrixEntries.filter(e => e.status === 'checked').length;
  const gapCount = matrixEntries.filter(e => e.status === 'gap').length;
  const coveragePercent = totalEntries > 0 ? Math.round((checkedCount / totalEntries) * 100) : 0;

  return (
    <div className={`flex-1 p-4 sm:p-6 md:p-8 ${theme.appBg} overflow-y-auto overflow-x-auto space-y-6 ${theme.cardTitle} transition-colors duration-300`}>
      {/* Header */}
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between border-b ${theme.cardBorder} pb-4 gap-4`}>
        <div>
          <h2 className={`text-xl font-bold ${theme.cardTitle} flex items-center gap-2`}>
            <CalendarDays className="w-6 h-6 text-[#B88E3E]" />
            <span>Інтерактивна матриця років та лакун</span>
          </h2>
          <p className={`text-xs ${theme.cardSubtext} mt-1`}>
            Карта збереженості джерел за населеними пунктами. Дозволяє виявляти білі плями та спланувати пошук у фондах.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setIsRangeModalOpen(true)}
            className="px-3.5 py-2 bg-[#133A31] hover:bg-[#1C4E43] text-[#E2C382] border border-[#1F5448] font-semibold rounded-xl text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-[#E2C382]" />
            <span>Додати часовий діапазон</span>
          </button>

          <button 
            onClick={openAddEntry}
            className="px-3.5 py-2 bg-[#E2C382] hover:bg-[#D4B572] text-[#0A2621] font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Запис матриці</span>
          </button>
        </div>
      </div>

      {/* Stats Widget */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-[#0A2621] border border-[#18453B] rounded-2xl flex flex-col justify-between">
          <span className="text-[11px] text-[#8BAAA1]">Всього років у матриці</span>
          <span className="text-2xl font-bold text-[#F5EEDC] font-mono mt-2">{totalEntries}</span>
        </div>
        <div className="p-4 bg-[#0A2621] border border-[#18453B] rounded-2xl flex flex-col justify-between">
          <span className="text-[11px] text-[#8BAAA1]">Опрацьовано джерел</span>
          <span className="text-2xl font-bold text-[#54C086] font-mono mt-2">{checkedCount}</span>
        </div>
        <div className="p-4 bg-[#0A2621] border border-[#18453B] rounded-2xl flex flex-col justify-between">
          <span className="text-[11px] text-[#8BAAA1]">Виявлені лакуни (втрати)</span>
          <span className="text-2xl font-bold text-rose-400 font-mono mt-2">{gapCount}</span>
        </div>
        <div className="p-4 bg-[#0A2621] border border-[#18453B] rounded-2xl flex flex-col justify-between">
          <span className="text-[11px] text-[#8BAAA1]">Покриття дослідження</span>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-2xl font-bold text-[#E2C382] font-mono">{coveragePercent}%</span>
            <div className="w-16 bg-[#133A31] h-2 rounded-full overflow-hidden">
              <div className="bg-[#E2C382] h-full" style={{ width: `${coveragePercent}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Range Analyses */}
      {rangeAnalyses.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-mono uppercase tracking-wider text-[#8BAAA1]">Часові діапазони досліджень</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {rangeAnalyses.map(r => (
              <div key={r.id} className="p-3.5 bg-[#0A2621] border border-[#18453B] rounded-xl flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-semibold text-[#F0E6D2]">{r.researchName}</h4>
                  <p className="text-[11px] text-[#8BAAA1]">{r.location} • {r.docType}</p>
                  <span className="text-[10px] font-mono text-[#E2C382] mt-1 block">{r.yearFrom} – {r.yearTo} рр.</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setRangeToDelete({ id: r.id, name: r.researchName })} 
                  className="p-1 text-[#8BAAA1] hover:text-rose-400 cursor-pointer"
                  title="Видалити діапазон"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-[#0A2621] p-3 rounded-2xl border border-[#18453B] text-xs">
        <span className="flex items-center gap-1 text-[#8BAAA1] font-mono">
          <Filter className="w-3.5 h-3.5 text-[#E2C382]" /> Фільтр:
        </span>
        
        <div className="flex items-center gap-2">
          <span className="text-[#8BAAA1]">Населений пункт:</span>
          <select 
            value={selectedLocation} 
            onChange={e => setSelectedLocation(e.target.value)}
            className="bg-[#071C17] border border-[#16443B] rounded-lg px-2.5 py-1 text-[#F5EEDC]"
          >
            <option value="всі">Усі населені пункти</option>
            {locations.map((loc, idx) => <option key={idx} value={loc}>{loc}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#8BAAA1]">Тип документа:</span>
          <select 
            value={selectedDocType} 
            onChange={e => setSelectedDocType(e.target.value)}
            className="bg-[#071C17] border border-[#16443B] rounded-lg px-2.5 py-1 text-[#F5EEDC]"
          >
            <option value="всі">Усі типи</option>
            <option value="народження">Народження</option>
            <option value="шлюб">Шлюб</option>
            <option value="смерть">Смерть</option>
            <option value="сповідні">Сповідні відомості</option>
            <option value="ревізія">Ревізькі казки</option>
          </select>
        </div>
      </div>

      {/* Visual Timeline Cards / Matrix Table */}
      <div className="bg-[#0A2621] border border-[#18453B] rounded-2xl p-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs text-[#C8DCD5]">
          <thead className="bg-[#08201B] text-[#E2C382] uppercase font-mono text-[10px]">
            <tr>
              <th className="p-3">Рік</th>
              <th className="p-3">Населений пункт</th>
              <th className="p-3">Тип документа</th>
              <th className="p-3">Статус збереженості</th>
              <th className="p-3">Архівне посилання / Коментар</th>
              <th className="p-3 text-right">Дії</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#153E35]">
            {filteredEntries.map(m => (
              <tr key={m.id} className="hover:bg-[#113830] transition-colors">
                <td className="p-3 font-mono font-bold text-[#E2C382] text-sm">{m.year}</td>
                <td className="p-3 font-medium text-[#F0E6D2]">{m.location}</td>
                <td className="p-3 capitalize">{m.docType}</td>
                <td className="p-3">
                  {m.status === 'checked' && (
                    <span className="px-2.5 py-1 bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 rounded-lg text-[11px] flex items-center gap-1 w-fit">
                      <CheckCircle2 className="w-3 h-3" /> Опрацьовано
                    </span>
                  )}
                  {m.status === 'gap' && (
                    <span className="px-2.5 py-1 bg-rose-950/60 text-rose-300 border border-rose-800/40 rounded-lg text-[11px] flex items-center gap-1 w-fit">
                      <ShieldAlert className="w-3 h-3" /> Лакуна (втрачено)
                    </span>
                  )}
                  {m.status === 'unprocessed' && (
                    <span className="px-2.5 py-1 bg-amber-950/60 text-amber-300 border border-amber-800/40 rounded-lg text-[11px] flex items-center gap-1 w-fit">
                      <Clock className="w-3 h-3" /> В черзі
                    </span>
                  )}
                  {m.status === 'archived' && (
                    <span className="px-2.5 py-1 bg-blue-950/60 text-blue-300 border border-blue-800/40 rounded-lg text-[11px] flex items-center gap-1 w-fit">
                      <Building2 className="w-3 h-3" /> В архіві
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <div className="text-xs text-[#F0E6D2] font-semibold">{m.researchTitle || m.archiveRef || '—'}</div>
                  {m.notes && <div className="text-[11px] text-[#8BAAA1] italic">{m.notes}</div>}
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEditEntry(m)} className="p-1.5 text-[#8BAAA1] hover:text-[#E2C382] bg-[#133A31] rounded-lg">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setEntryToDelete(m); }} 
                      className="p-1.5 text-[#8BAAA1] hover:text-rose-400 bg-[#133A31] rounded-lg cursor-pointer"
                      title="Видалити"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Add/Edit Entry */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A2621] border border-[#18453B] rounded-2xl w-full max-w-md p-6 space-y-4 text-[#E6DEC8]">
            <div className="flex items-center justify-between border-b border-[#18453B] pb-3">
              <h3 className="text-base font-bold text-[#F5EEDC]">{editingEntry ? 'Редагувати рік' : 'Додати рік у матрицю'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#8BAAA1] hover:text-[#F5EEDC]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8BAAA1] mb-1">Рік</label>
                  <input 
                    type="number" 
                    value={year} 
                    onChange={e => setYear(Number(e.target.value))} 
                    className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#8BAAA1] mb-1">Тип документа</label>
                  <select 
                    value={docType} 
                    onChange={e => setDocType(e.target.value as any)}
                    className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                  >
                    <option value="народження">Народження</option>
                    <option value="шлюб">Шлюб</option>
                    <option value="смерть">Смерть</option>
                    <option value="сповідні">Сповідні відомості</option>
                    <option value="ревізія">Ревізька казка</option>
                    <option value="інше">Інше</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#8BAAA1] mb-1">Населений пункт / Село</label>
                <input 
                  type="text" 
                  value={location} 
                  onChange={e => setLocation(e.target.value)}
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                  required
                />
              </div>

              <div>
                <label className="block text-[#8BAAA1] mb-1">Статус збереженості</label>
                <select 
                  value={status} 
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                >
                  <option value="checked">Опрацьовано повністю</option>
                  <option value="gap">Лакуна (втрачено / відсутнє)</option>
                  <option value="unprocessed">Не перевірено / В черзі</option>
                  <option value="archived">В архіві (очікує виклику)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#8BAAA1] mb-1">Архівний шифр / Дослідження</label>
                <input 
                  type="text" 
                  value={archiveRef} 
                  onChange={e => setArchiveRef(e.target.value)}
                  placeholder="ДАПО Ф.1011, Спр.412"
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                />
              </div>

              <div>
                <label className="block text-[#8BAAA1] mb-1">Примітки / Коментарі</label>
                <textarea 
                  rows={2} 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)}
                  placeholder="напр. Метричний зошит втрачено під час пожежі 1917 р."
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl p-3 text-[#F5EEDC]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#18453B]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-[#133A31] text-[#8BAAA1] rounded-xl">Скасувати</button>
                <button type="submit" className="px-4 py-2 bg-[#E2C382] text-[#0A2621] font-bold rounded-xl">Зберегти</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Range */}
      {isRangeModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A2621] border border-[#18453B] rounded-2xl w-full max-w-md p-6 space-y-4 text-[#E6DEC8]">
            <div className="flex items-center justify-between border-b border-[#18453B] pb-3">
              <h3 className="text-base font-bold text-[#F5EEDC]">Додати часовий діапазон</h3>
              <button onClick={() => setIsRangeModalOpen(false)} className="text-[#8BAAA1] hover:text-[#F5EEDC]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRange} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#8BAAA1] mb-1">Назва напрямку</label>
                <input 
                  type="text" 
                  value={rName} 
                  onChange={e => setRName(e.target.value)} 
                  placeholder="напр. Покровська церква 1890-1915"
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8BAAA1] mb-1">З року</label>
                  <input type="number" value={rYearFrom} onChange={e => setRYearFrom(Number(e.target.value))} className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]" />
                </div>
                <div>
                  <label className="block text-[#8BAAA1] mb-1">По рік</label>
                  <input type="number" value={rYearTo} onChange={e => setRYearTo(Number(e.target.value))} className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]" />
                </div>
              </div>

              <div>
                <label className="block text-[#8BAAA1] mb-1">Населений пункт</label>
                <input type="text" value={rLoc} onChange={e => setRLoc(e.target.value)} className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]" />
              </div>

              <div>
                <label className="block text-[#8BAAA1] mb-1">Тип джерела</label>
                <input type="text" value={rDocType} onChange={e => setRDocType(e.target.value)} className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#18453B]">
                <button type="button" onClick={() => setIsRangeModalOpen(false)} className="px-4 py-2 bg-[#133A31] text-[#8BAAA1] rounded-xl">Скасувати</button>
                <button type="submit" className="px-4 py-2 bg-[#E2C382] text-[#0A2621] font-bold rounded-xl">Створити</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Matrix Entry */}
      {entryToDelete && (
        <ConfirmDeleteModal
          isOpen={!!entryToDelete}
          title="Видалення запису матриці"
          itemName={`${entryToDelete.year} р. (${entryToDelete.location})`}
          itemType="запис матриці"
          message={`Ви дійсно бажаєте видалити запис матриці для ${entryToDelete.year} року (${entryToDelete.location}, ${entryToDelete.docType})?`}
          onConfirm={() => {
            if (entryToDelete) {
              deleteMatrixEntry(entryToDelete.id);
              setEntryToDelete(null);
            }
          }}
          onClose={() => setEntryToDelete(null)}
          isPermanent={true}
        />
      )}

      {/* Delete Confirmation Modal for Range Analysis */}
      {rangeToDelete && (
        <ConfirmDeleteModal
          isOpen={!!rangeToDelete}
          title="Видалення діапазону досліджень"
          itemName={rangeToDelete.name}
          itemType="діапазон досліджень"
          message={`Ви дійсно бажаєте видалити діапазон «${rangeToDelete.name}»?`}
          onConfirm={() => {
            if (rangeToDelete) {
              deleteRangeAnalysis(rangeToDelete.id);
              setRangeToDelete(null);
            }
          }}
          onClose={() => setRangeToDelete(null)}
          isPermanent={true}
        />
      )}
    </div>
  );
};

// ==========================================
// 5. NOTES VIEW (Замітки)
// ==========================================
export const TasksView: React.FC = () => {
  const { tasks, addTask, updateTask, deleteTask, themePalette } = useGenealogy();
  const theme = getThemeConfig(themePalette);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<GenealogyTask | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<GenealogyTask | null>(null);

  const [title, setTitle] = useState('');
  const [archiveName, setArchiveName] = useState('');
  const [personName, setPersonName] = useState('');
  const [priority, setPriority] = useState<GenealogyTask['priority']>('medium');
  const [status, setStatus] = useState<GenealogyTask['status']>('todo');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');

  const openAdd = () => {
    setEditingTask(null);
    setTitle('');
    setArchiveName('ДАПО');
    setPersonName('');
    setPriority('medium');
    setStatus('todo');
    setDueDate('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEdit = (t: GenealogyTask) => {
    setEditingTask(t);
    setTitle(t.title);
    setArchiveName(t.archiveName || '');
    setPersonName(t.personName || '');
    setPriority(t.priority);
    setStatus(t.status);
    setDueDate(t.dueDate || '');
    setDescription(t.description);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingTask) {
      updateTask(editingTask.id, { title, archiveName, personName, priority, status, dueDate, description });
    } else {
      addTask({ title, archiveName, personName, priority, status, dueDate, description });
    }
    setIsModalOpen(false);
  };

  return (
    <div className={`flex-1 p-4 sm:p-6 md:p-8 ${theme.appBg} overflow-y-auto overflow-x-auto space-y-6 ${theme.cardTitle} transition-colors duration-300`}>
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between border-b ${theme.cardBorder} pb-4 gap-4`}>
        <div>
          <h2 className={`text-xl font-bold ${theme.cardTitle} flex items-center gap-2`}>
            <CheckSquare className="w-6 h-6 text-[#B88E3E]" />
            <span>Генеалогічні замітки та плани</span>
          </h2>
          <p className={`text-xs ${theme.cardSubtext} mt-1`}>
            Нотатки для пошуків у державних архівах, перевірка джерел та спогади родичів.
          </p>
        </div>

        <button 
          onClick={openAdd}
          className="px-4 py-2 bg-[#E2C382] hover:bg-[#D4B572] text-[#0A2621] font-bold rounded-xl text-xs flex items-center gap-2 shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Нова замітка</span>
        </button>
      </div>

      <div className="space-y-3">
        {tasks.map(t => (
          <div key={t.id} className="p-4 bg-[#0A2621] border border-[#18453B] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#E2C382]/50 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => updateTask({ ...t, status: t.status === 'completed' || t.status === 'done' ? 'todo' : 'done' })}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    (t.status === 'completed' || t.status === 'done') ? 'bg-[#54C086] border-[#54C086] text-[#0A2621]' : 'border-[#18453B]'
                  }`}
                >
                  {(t.status === 'completed' || t.status === 'done') && <Check className="w-3 h-3 stroke-[3]" />}
                </button>
                <h4 className={`font-semibold text-sm ${(t.status === 'completed' || t.status === 'done') ? 'line-through text-[#8BAAA1]' : 'text-[#F0E6D2]'}`}>
                  {t.title}
                </h4>
              </div>

              <p className="text-xs text-[#8BAAA1] pl-6">{t.description}</p>
              
              <div className="pl-6 flex items-center gap-2 text-[10px] pt-1">
                {t.archiveName && (
                  <span className="text-[#E2C382] bg-[#123830] px-2 py-0.5 rounded border border-[#1C4D42]">
                    {t.archiveName}
                  </span>
                )}
                {t.personName && (
                  <span className="text-[#8BAAA1] bg-[#133A31] px-2 py-0.5 rounded">
                    {t.personName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-center">
              <span className={`px-2.5 py-1 rounded text-xs font-mono ${
                t.priority === 'high' ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
              }`}>
                {t.priority === 'high' ? 'ВАЖЛИВО' : 'ЗВИЧАЙНО'}
              </span>

              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(t)} className="p-1.5 text-[#8BAAA1] hover:text-[#E2C382] bg-[#133A31] rounded-lg">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button 
                  type="button"
                  onClick={() => { deleteTask(t.id); }} 
                  className="p-1.5 text-[#8BAAA1] hover:text-rose-400 bg-[#133A31] rounded-lg cursor-pointer"
                  title="Видалити"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A2621] border border-[#18453B] rounded-2xl w-full max-w-md p-6 space-y-4 text-[#E6DEC8]">
            <div className="flex items-center justify-between border-b border-[#18453B] pb-3">
              <h3 className="text-base font-bold text-[#F5EEDC]">{editingTask ? 'Редагувати замітку' : 'Створити замітку'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#8BAAA1] hover:text-[#F5EEDC]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#8BAAA1] mb-1">Заголовок замітки</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="напр. Перевірити сповідний розпис..."
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                  required
                />
              </div>

              <div>
                <label className="block text-[#8BAAA1] mb-1">Детальний текст / Опис</label>
                <textarea 
                  rows={2} 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl p-3 text-[#F5EEDC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8BAAA1] mb-1">Архів / Фонд</label>
                  <input type="text" value={archiveName} onChange={e => setArchiveName(e.target.value)} className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]" />
                </div>
                <div>
                  <label className="block text-[#8BAAA1] mb-1">Особа</label>
                  <input type="text" value={personName} onChange={e => setPersonName(e.target.value)} className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8BAAA1] mb-1">Пріоритет</label>
                  <select value={priority} onChange={e => setPriority(e.target.value as any)} className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]">
                    <option value="low">Низький</option>
                    <option value="medium">Середній</option>
                    <option value="high">Високий</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#8BAAA1] mb-1">Статус</label>
                  <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]">
                    <option value="todo">До виконання</option>
                    <option value="in_progress">В процесі</option>
                    <option value="completed">Виконано</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#18453B]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-[#133A31] text-[#8BAAA1] rounded-xl">Скасувати</button>
                <button type="submit" className="px-4 py-2 bg-[#E2C382] text-[#0A2621] font-bold rounded-xl">Зберегти</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 6. FINDINGS VIEW (Знахідки)
// ==========================================
export const FindingsView: React.FC = () => {
  const { findings, addFinding, updateFinding, deleteFinding, themePalette } = useGenealogy();
  const theme = getThemeConfig(themePalette);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFinding, setEditingFinding] = useState<GenealogyFinding | null>(null);

  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [summary, setSummary] = useState('');
  const [relevanceScore, setRelevanceScore] = useState<GenealogyFinding['relevanceScore']>('high');

  const openAdd = () => {
    setEditingFinding(null);
    setTitle('');
    setSource('ЦДІАК / ДАПО');
    setSummary('');
    setRelevanceScore('high');
    setIsModalOpen(true);
  };

  const openEdit = (f: GenealogyFinding) => {
    setEditingFinding(f);
    setTitle(f.title);
    setSource(f.source);
    setSummary(f.summary);
    setRelevanceScore(f.relevanceScore);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingFinding) {
      updateFinding({
        ...editingFinding,
        title,
        source,
        summary,
        relevanceScore: typeof relevanceScore === 'number' ? relevanceScore : 85
      });
    } else {
      addFinding({
        id: `finding-${Date.now()}`,
        title,
        source,
        summary,
        confidence: 'probable',
        linkedPersonIds: [],
        personIds: [],
        relevanceScore: typeof relevanceScore === 'number' ? relevanceScore : 85
      });
    }
    setIsModalOpen(false);
  };

  return (
    <div className={`flex-1 p-4 sm:p-6 md:p-8 ${theme.appBg} overflow-y-auto overflow-x-auto space-y-6 ${theme.cardTitle} transition-colors duration-300`}>
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between border-b ${theme.cardBorder} pb-4 gap-4`}>
        <div>
          <h2 className={`text-xl font-bold ${theme.cardTitle} flex items-center gap-2`}>
            <Bookmark className="w-6 h-6 text-[#B88E3E]" />
            <span>Знахідки та відкриття</span>
          </h2>
          <p className={`text-xs ${theme.cardSubtext} mt-1`}>
            Важливі витяги з архівних справ, нові віднайдені гілки та підтвердження зв&apos;язків.
          </p>
        </div>

        <button 
          onClick={openAdd}
          className="px-4 py-2 bg-[#E2C382] hover:bg-[#D4B572] text-[#0A2621] font-bold rounded-xl text-xs flex items-center gap-2 shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Нова знахідка</span>
        </button>
      </div>

      <div className="space-y-3">
        {findings.map(f => (
          <div key={f.id} className="p-4 bg-[#0A2621] border border-[#18453B] rounded-2xl space-y-2 hover:border-[#E2C382]/50 transition-colors">
            <div className="flex items-start justify-between">
              <h4 className="font-semibold text-sm text-[#F0E6D2]">{f.title}</h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#8BAAA1] font-mono">{f.dateFound}</span>
                <button onClick={() => openEdit(f)} className="p-1 text-[#8BAAA1] hover:text-[#E2C382]">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button 
                  type="button"
                  onClick={() => { deleteFinding(f.id); }} 
                  className="p-1 text-[#8BAAA1] hover:text-rose-400 cursor-pointer"
                  title="Видалити"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-xs text-[#94B2A9]">{f.summary}</p>
            <span className="text-[11px] text-[#E2C382] italic block">Джерело: {f.source}</span>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A2621] border border-[#18453B] rounded-2xl w-full max-w-md p-6 space-y-4 text-[#E6DEC8]">
            <div className="flex items-center justify-between border-b border-[#18453B] pb-3">
              <h3 className="text-base font-bold text-[#F5EEDC]">{editingFinding ? 'Редагувати знахідку' : 'Додати знахідку'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#8BAAA1] hover:text-[#F5EEDC]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#8BAAA1] mb-1">Заголовок знахідки</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="напр. Знайдено шлюб 1898 р."
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                  required
                />
              </div>

              <div>
                <label className="block text-[#8BAAA1] mb-1">Джерело / Архівний шифр</label>
                <input 
                  type="text" 
                  value={source} 
                  onChange={e => setSource(e.target.value)} 
                  placeholder="ЦДІАК Ф.127 Оп.1012"
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl px-3 py-2 text-[#F5EEDC]"
                />
              </div>

              <div>
                <label className="block text-[#8BAAA1] mb-1">Короткий зміст / Опис</label>
                <textarea 
                  rows={3} 
                  value={summary} 
                  onChange={e => setSummary(e.target.value)} 
                  className="w-full bg-[#071C17] border border-[#16443B] rounded-xl p-3 text-[#F5EEDC]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#18453B]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-[#133A31] text-[#8BAAA1] rounded-xl">Скасувати</button>
                <button type="submit" className="px-4 py-2 bg-[#E2C382] text-[#0A2621] font-bold rounded-xl">Зберегти</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 7. HYPOTHESES VIEW (Підозри, AI Пошук Родинних Зв'язків & Хрещені)
// ==========================================
export { HypothesesView } from './Hypotheses/HypothesesView';

// ==========================================
// 8. PERSONS LIST VIEW (Список осіб)
// ==========================================
export { PersonsListView } from './PersonsListView';

