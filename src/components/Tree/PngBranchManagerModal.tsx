import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  Image as ImageIcon,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  GitBranch,
  TreeDeciduous,
  Layers,
  Palette,
  Eye,
  ArrowRight,
  UserPlus,
  RefreshCw,
  FileCheck,
  Zap,
  HelpCircle
} from 'lucide-react';
import { useGenealogy } from '../../context/GenealogyContext';
import { useGenealogyStore } from '../../stores/useGenealogyStore';
import { getThemeConfig } from '../../utils/theme';
import {
  exportGenealogyTreeToPng,
  extractBranchFromPngFile,
  mergeBranchIntoDatabase,
  ExtractedBranchPerson,
  ExtractedBranchResult
} from '../../utils/pngGenealogy';
import { GenealogyDatabase, Person } from '../../rodovid/types/genealogy';

interface PngBranchManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'export' | 'import';
}

export const PngBranchManagerModal: React.FC<PngBranchManagerModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'export'
}) => {
  const {
    persons,
    families,
    sources,
    events,
    selectedPersonId,
    setSelectedPersonId,
    themePalette
  } = useGenealogy();

  const theme = getThemeConfig(themePalette);

  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialTab);

  // --- Export State ---
  const [exportTheme, setExportTheme] = useState<'parchment' | 'dark' | 'emerald' | 'white'>('parchment');
  const [exportScale, setExportScale] = useState<1 | 2 | 3>(2);
  const [exportLayoutType, setExportLayoutType] = useState<'ancestors' | 'descendants'>('ancestors');
  const [exportGenerations, setExportGenerations] = useState<number>(5);
  const [embedPayload, setEmbedPayload] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // --- Import State ---
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [extractedResult, setExtractedResult] = useState<ExtractedBranchResult | null>(null);

  // Branch Connection Controls
  const [connectionType, setConnectionType] = useState<'standalone' | 'attach_as_parent' | 'attach_as_child' | 'attach_as_spouse' | 'merge_matching'>('attach_as_parent');
  const [targetExistingPersonId, setTargetExistingPersonId] = useState<string>(selectedPersonId || persons[0]?.id || '');
  const [branchAnchorTempId, setBranchAnchorTempId] = useState<string>('');
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const activePerson = persons.find((p) => p.id === selectedPersonId) || persons[0];

  // Database snapshot for exporter
  const databaseSnapshot: GenealogyDatabase = {
    metadata: {
      title: 'Родовід родини',
      lastModified: new Date().toISOString()
    },
    rootPersonId: activePerson?.id || 'p1',
    persons: persons.reduce((acc, p) => {
      acc[p.id] = {
        ...p,
        name: { given: p.firstName, surname: p.lastName, patronymic: p.patronymic },
        gender: p.gender === 'male' || p.gender === 'M' ? 'M' : 'F'
      };
      return acc;
    }, {} as Record<string, any>),
    families: families || {},
    sources: sources || {},
    events: events || {},
    lastModified: new Date().toISOString()
  };

  // Trigger PNG Export
  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccessMsg(null);

    try {
      const result = await exportGenealogyTreeToPng(databaseSnapshot, activePerson?.id || persons[0]?.id, {
        theme: exportTheme,
        scaleFactor: exportScale,
        layoutType: exportLayoutType,
        generations: exportGenerations,
        embedDigitalPayload: embedPayload
      });

      if (result.success) {
        setExportSuccessMsg(`Файл ${result.fileName} успішно згенеровано та завантажено!`);
      } else {
        alert(result.error || 'Помилка експорту PNG');
      }
    } catch (err: any) {
      alert(err.message || 'Невідома помилка');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle File Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setFilePreviewUrl(URL.createObjectURL(file));
    setAnalysisError(null);
    setExtractedResult(null);
    setImportSuccessMsg(null);

    await processPngFile(file);
  };

  const processPngFile = async (file: File) => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const result = await extractBranchFromPngFile(file, persons as any);
      setExtractedResult(result);
      if (result.persons.length > 0) {
        setBranchAnchorTempId(result.persons[0].tempId);
      }
    } catch (err: any) {
      setAnalysisError(err.message || 'Не вдалося прочитати або розпізнати PNG файл');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Execute Merge
  const handleConfirmMerge = () => {
    if (!extractedResult || extractedResult.persons.length === 0) return;

    try {
      const { newPersonsList, addedCount, mergedCount } = mergeBranchIntoDatabase(
        persons as any,
        extractedResult.persons,
        {
          connectionType,
          targetExistingPersonId: targetExistingPersonId || undefined,
          branchAnchorTempId: branchAnchorTempId || undefined
        }
      );

      // Save to context and Cloud Firestore
      useGenealogyStore.getState().setPersons(newPersonsList);

      setImportSuccessMsg(
        `Успішно додано ${addedCount} нових осіб${mergedCount > 0 ? ` та об'єднано ${mergedCount} спільних персон` : ''}! Гілка приєднана до вашого дерева.`
      );

      // Select anchor person
      if (newPersonsList.length > persons.length) {
        const lastAdded = newPersonsList[newPersonsList.length - 1];
        setSelectedPersonId(lastAdded.id);
      }
    } catch (err: any) {
      setAnalysisError(`Помилка об'єднання: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-3xl max-w-3xl w-full ${theme.cardTitle} shadow-2xl overflow-hidden flex flex-col max-h-[92vh]`}>
        
        {/* Modal Header */}
        <div className={`p-5 md:px-7 border-b ${theme.cardBorder} flex items-center justify-between bg-black/5 dark:bg-white/5`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#B88E3E]/20 text-[#B88E3E] flex items-center justify-center font-bold">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Розумний експорт та імпорт гілок PNG</h2>
              <p className="text-xs opacity-75">Експортуйте дерево у високій якості та додавайте інші гілки з фото чи схем</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className={`flex border-b ${theme.cardBorder} px-5 md:px-7 gap-4 bg-black/5 dark:bg-white/5`}>
          <button
            onClick={() => setActiveTab('export')}
            className={`py-3 text-xs md:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'border-[#B88E3E] text-[#B88E3E]'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Експорт дерева в PNG</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`py-3 text-xs md:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'border-[#B88E3E] text-[#B88E3E]'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Імпорт та додавання гілки з PNG</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30">
              AI Vision
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 md:p-7 overflow-y-auto flex-1 space-y-6">
          
          {/* --- TAB 1: EXPORT PNG --- */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              {/* Active Root Persona Badge */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#B88E3E] text-white flex items-center justify-center font-bold">
                    {activePerson?.firstName?.charAt(0) || 'Р'}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#B88E3E] tracking-wider">Фокусна персона гілки</span>
                    <h4 className="font-bold text-sm">
                      {activePerson?.firstName} {activePerson?.lastName} {activePerson?.patronymic ? `(${activePerson.patronymic})` : ''}
                    </h4>
                    <p className="text-xs opacity-75">{persons.length} осіб доступно в базі роду</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  Готово до друку
                </span>
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* 1. Theme Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#B88E3E] flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5" />
                    <span>Стиль оформлення фону</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'parchment', name: 'М\'який пергамент', bg: '#f4ede2', border: '#d6c7b2', text: '#292524' },
                      { id: 'dark', name: 'Темний оксамит', bg: '#090d16', border: '#334155', text: '#f8fafc' },
                      { id: 'emerald', name: 'Смарагдовий ліс', bg: '#041712', border: '#0f483b', text: '#ecfdf5' },
                      { id: 'white', name: 'Класичний білий', bg: '#ffffff', border: '#cbd5e1', text: '#0f172a' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setExportTheme(t.id as any)}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          exportTheme === t.id
                            ? 'ring-2 ring-[#B88E3E] border-[#B88E3E] shadow-md'
                            : 'border-neutral-700 hover:border-neutral-500'
                        }`}
                        style={{ backgroundColor: t.bg }}
                      >
                        <span className="text-xs font-bold" style={{ color: t.text }}>{t.name}</span>
                        {exportTheme === t.id && <CheckCircle2 className="w-3.5 h-3.5 text-[#B88E3E]" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Scale / Resolution */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#B88E3E] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Роздільна здатність зображення</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { scale: 1, label: '1x Стандарт', desc: 'Для соцмереж' },
                      { scale: 2, label: '2x Ultra-HD', desc: 'Рекомендовано' },
                      { scale: 3, label: '3x Друк', desc: 'Для плакатів' }
                    ].map((s) => (
                      <button
                        key={s.scale}
                        type="button"
                        onClick={() => setExportScale(s.scale as any)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          exportScale === s.scale
                            ? 'bg-[#B88E3E]/20 border-[#B88E3E] text-[#B88E3E] font-bold'
                            : 'border-neutral-700/60 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div className="text-xs font-bold">{s.label}</div>
                        <div className="text-[10px] opacity-75">{s.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Layout Direction */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#B88E3E] flex items-center gap-1.5">
                    <TreeDeciduous className="w-3.5 h-3.5" />
                    <span>Охоплення гілок</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportLayoutType('ancestors')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        exportLayoutType === 'ancestors'
                          ? 'bg-[#B88E3E]/20 border-[#B88E3E] text-[#B88E3E] font-bold'
                          : 'border-neutral-700/60 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="text-xs font-bold">Висхідне дерево (Предки)</div>
                      <div className="text-[10px] opacity-75">Батьки, дідусі, прадідусі</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportLayoutType('descendants')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        exportLayoutType === 'descendants'
                          ? 'bg-[#B88E3E]/20 border-[#B88E3E] text-[#B88E3E] font-bold'
                          : 'border-neutral-700/60 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="text-xs font-bold">Нисхідне дерево (Нащадки)</div>
                      <div className="text-[10px] opacity-75">Діти, онуки, правнуки</div>
                    </button>
                  </div>
                </div>

                {/* 4. Number of Generations */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#B88E3E] flex items-center justify-between">
                    <span>Глибина поколінь: {exportGenerations}</span>
                    <span className="text-[10px] opacity-75">До 8 поколінь</span>
                  </label>
                  <input
                    type="range"
                    min={2}
                    max={8}
                    step={1}
                    value={exportGenerations}
                    onChange={(e) => setExportGenerations(parseInt(e.target.value, 10))}
                    className="w-full accent-[#B88E3E] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] opacity-60">
                    <span>2 покоління</span>
                    <span>5 поколінь (оптимально)</span>
                    <span>8 поколінь</span>
                  </div>
                </div>

              </div>

              {/* Smart PNG Lossless Checkbox */}
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="embedPayload"
                  checked={embedPayload}
                  onChange={(e) => setEmbedPayload(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="embedPayload" className="text-xs cursor-pointer space-y-1">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Вбудувати цифрові метадані родоводу в PNG (Smart PNG)</span>
                  </span>
                  <p className="text-neutral-300 opacity-90 leading-relaxed">
                    Збережений файл буде звичайним красивим фото для перегляду та друку, але якщо перетягнути його назад у цей додаток — вся структура осіб та зв'язків відновиться миттєво з 100% точністю без втрати дат чи приміток.
                  </p>
                </label>
              </div>

              {exportSuccessMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{exportSuccessMsg}</span>
                </div>
              )}

              {/* Download Action Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-neutral-700 text-xs font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleExport}
                  className={`px-6 py-2.5 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} text-xs font-bold flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer`}
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Генерація зображення високої якості...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Завантажити метричне дерево (.png)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* --- TAB 2: IMPORT / ADD BRANCH FROM PNG --- */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              
              {/* File Upload Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all ${
                  uploadedFile
                    ? 'border-[#B88E3E] bg-[#B88E3E]/5'
                    : 'border-neutral-700 hover:border-[#B88E3E]/60 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="max-w-md mx-auto space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-[#B88E3E]/20 text-[#B88E3E] mx-auto flex items-center justify-center">
                    {uploadedFile ? <FileCheck className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                  </div>
                  <h4 className="font-bold text-sm">
                    {uploadedFile ? uploadedFile.name : 'Натисніть або перетягніть сюди файл PNG гілки'}
                  </h4>
                  <p className="text-xs opacity-75">
                    Підтримуються як <strong>Smart PNG</strong> (експортовані з додатку), так і <strong>будь-які фотографії накреслених дерев, схеми чи скріншоти</strong>.
                  </p>
                </div>
              </div>

              {/* Analysis Loading State */}
              {isAnalyzing && (
                <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#B88E3E]" />
                  <div className="font-bold text-sm">Штучний інтелект аналізує графічну структуру дерева...</div>
                  <p className="text-xs opacity-75 max-w-lg mx-auto">
                    Розпізнаються вузли осіб, стрілки поколінь, родинні зв’язки та метричні дати з зображення.
                  </p>
                </div>
              )}

              {/* Analysis Error */}
              {analysisError && (
                <div className="p-4 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Помилка аналізу:</strong> {analysisError}
                  </div>
                </div>
              )}

              {/* Success Result & Interactive Branch Connection */}
              {extractedResult && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  
                  {/* Summary Banner & Image Preview */}
                  <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {filePreviewUrl && (
                        <div className="w-14 h-14 rounded-xl border border-emerald-500/30 overflow-hidden shrink-0 bg-black/40">
                          <img src={filePreviewUrl} alt="Схема гілки" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {extractedResult.sourceType === 'smart_png_payload' ? '✓ Smart PNG (Lossless)' : '✨ AI Розпізнавання'}
                          </span>
                          <h4 className="font-bold text-sm text-emerald-300">{extractedResult.branchTitle}</h4>
                        </div>
                        <p className="text-xs text-neutral-300">{extractedResult.summary}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-900/60 text-emerald-300 shrink-0">
                      {extractedResult.persons.length} осіб
                    </span>
                  </div>

                  {/* List of Detected Persons with Edit / Add / Remove Capability */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#B88E3E]">
                        Виявлені персони у новій гілці:
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const newTempId = `t_${Date.now()}`;
                          const newPerson: ExtractedBranchPerson = {
                            tempId: newTempId,
                            firstName: 'Нова',
                            lastName: extractedResult.persons[0]?.lastName || 'Особа',
                            gender: 'M',
                            birthYear: '',
                            birthPlace: '',
                            notes: 'Додано вручну'
                          };
                          setExtractedResult({
                            ...extractedResult,
                            persons: [...extractedResult.persons, newPerson]
                          });
                        }}
                        className="text-[11px] font-bold text-[#B88E3E] hover:text-[#d4a74e] flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>+ Додати особу до гілки</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                      {extractedResult.persons.map((p, idx) => (
                        <div
                          key={p.tempId}
                          className="p-2.5 rounded-xl border border-neutral-700/60 bg-black/10 dark:bg-white/5 flex items-center justify-between gap-2 group hover:border-[#B88E3E]/60 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => {
                                const newGender = p.gender === 'M' ? 'F' : p.gender === 'F' ? 'U' : 'M';
                                const updated = [...extractedResult.persons];
                                updated[idx] = { ...p, gender: newGender };
                                setExtractedResult({ ...extractedResult, persons: updated });
                              }}
                              title="Змінити стать"
                              className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0 cursor-pointer ${
                                p.gender === 'M' ? 'bg-blue-600' : p.gender === 'F' ? 'bg-rose-600' : 'bg-neutral-600'
                              }`}
                            >
                              {p.gender}
                            </button>

                            <div className="truncate flex-1">
                              <input
                                type="text"
                                value={`${p.lastName || ''} ${p.firstName || ''} ${p.patronymic || ''}`.trim()}
                                onChange={(e) => {
                                  const parts = e.target.value.split(' ');
                                  const updated = [...extractedResult.persons];
                                  updated[idx] = {
                                    ...p,
                                    lastName: parts[0] || '',
                                    firstName: parts[1] || '',
                                    patronymic: parts.slice(2).join(' ')
                                  };
                                  setExtractedResult({ ...extractedResult, persons: updated });
                                }}
                                className="w-full bg-transparent font-bold text-xs focus:outline-none focus:bg-white/10 rounded px-1 py-0.5"
                                placeholder="Прізвище Ім'я По батькові"
                              />
                              <div className="text-[10px] opacity-75 truncate flex items-center gap-1.5 px-1">
                                <span>{p.birthYear ? `нар. ${p.birthYear}` : 'рік не вказано'}</span>
                                {p.birthPlace && <span>• {p.birthPlace}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {p.matchedExistingPersonId && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Збіг
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const filtered = extractedResult.persons.filter((_, i) => i !== idx);
                                setExtractedResult({ ...extractedResult, persons: filtered });
                              }}
                              className="p-1 text-neutral-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              title="Видалити особу"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Branch Connection Strategy */}
                  <div className="p-4 rounded-2xl border border-[#B88E3E]/40 bg-[#B88E3E]/5 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#B88E3E] uppercase tracking-wider">
                      <GitBranch className="w-4 h-4" />
                      <span>Як приєднати цю гілку до вашого дерева?</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        { id: 'attach_as_parent', title: 'Як батьківську лінію (Предки)', desc: 'Зробити персону з гілки батьком/матір\'ю' },
                        { id: 'attach_as_child', title: 'Як лінію нащадків (Діти)', desc: 'Зробити персону з гілки дитиною обраної особи' },
                        { id: 'attach_as_spouse', title: 'Як подружню гілку (Свати/Шлюб)', desc: 'Приєднати як дружину/чоловіка' },
                        { id: 'standalone', title: 'Окрема автономна гілка', desc: 'Зберегти у дереві для подальшого зв\'язування' },
                      ].map((strat) => (
                        <button
                          key={strat.id}
                          type="button"
                          onClick={() => setConnectionType(strat.id as any)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            connectionType === strat.id
                              ? 'border-[#B88E3E] bg-[#B88E3E]/20 ring-1 ring-[#B88E3E]'
                              : 'border-neutral-700/60 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <div className="font-bold text-xs text-[#B88E3E]">{strat.title}</div>
                          <div className="text-[10px] opacity-75 mt-0.5">{strat.desc}</div>
                        </button>
                      ))}
                    </div>

                    {/* Target and Anchor Selectors */}
                    {connectionType !== 'standalone' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold opacity-80">
                            Особа у вашому дереві (Точка прив'язки):
                          </label>
                          <select
                            value={targetExistingPersonId}
                            onChange={(e) => setTargetExistingPersonId(e.target.value)}
                            className={`w-full p-2 rounded-xl text-xs ${theme.inputBg} border ${theme.inputBorder} ${theme.inputText} focus:outline-none focus:border-[#B88E3E]`}
                          >
                            {persons.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.lastName} {p.firstName} {p.birthYear ? `(${p.birthYear})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold opacity-80">
                            Особа з нової гілки (Хто приєднується):
                          </label>
                          <select
                            value={branchAnchorTempId}
                            onChange={(e) => setBranchAnchorTempId(e.target.value)}
                            className={`w-full p-2 rounded-xl text-xs ${theme.inputBg} border ${theme.inputBorder} ${theme.inputText} focus:outline-none focus:border-[#B88E3E]`}
                          >
                            {extractedResult.persons.map((p) => (
                              <option key={p.tempId} value={p.tempId}>
                                {p.lastName} {p.firstName} {p.birthYear ? `(${p.birthYear})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Confirmation Button */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setExtractedResult(null);
                        setUploadedFile(null);
                      }}
                      className="px-4 py-2 rounded-xl border border-neutral-700 text-xs font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      Вибрати інший файл
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmMerge}
                      className={`px-6 py-2.5 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} text-xs font-bold flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer`}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Приєднати {extractedResult.persons.length} осіб до мого родоводу</span>
                    </button>
                  </div>

                </div>
              )}

              {/* Import Success Message */}
              {importSuccessMsg && (
                <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{importSuccessMsg}</span>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={onClose}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                    >
                      Перейти до перегляду дерева
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
