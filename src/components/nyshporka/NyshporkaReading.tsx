import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Upload, 
  FileText, 
  UserPlus, 
  Check, 
  RefreshCw, 
  Layers, 
  ShieldCheck, 
  Eye, 
  Building2,
  AlertCircle,
  Copy,
  Save,
  RotateCcw,
  BookOpen,
  Send,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { useGenealogyStore } from '../../stores/useGenealogyStore';
import { persistLocalData, idbGet } from '../../utils/indexedDbStorage';

interface NyshporkaReadingProps {
  theme: any;
}

interface ScanAiNoteState {
  notes: string;
  isAiGenerated: boolean;
  lastUpdated?: string;
  model?: string;
}

const DEFAULT_SCAN_AI_NOTES: Record<string, string> = {
  '0001': `📌 Тип документа: Титул судової та розпорядчої консисторської справи (1821–1822 рр.).
👤 Ключові особи: Григорій Долищинський (посвячуваний у дякони), священницький син.
📍 Географія: с. Липовеньке, Балтський повіт, Подільська губернія.
💡 Генеалогічний висновок: Документ засвідчує спадковий священницький стан роду Долищинських та початок служіння Григорія в парафії села Липовеньке; підтверджує належність до духовного стану та право на парафіяльне служіння.`,
  '0012': `📌 Тип документа: Свідоцтво про шлюб / шлюбний обшук (1822 р.).
👤 Ключові особи: Дякон Григорій Долищинський та дівиця Олена Виробинська (донька священика Стефана Виробинського).
📍 Географія: церква Різдва Богородиці, с. Липовеньке, Балтський повіт.
💡 Генеалогічний висновок: Прямий шлюбний союз двох духовних родин — Долищинських та Виробинських. Фіксує точну дату вінчання та підтверджує батька нареченої, що є ключовим ланцюгом для поєднання двох родових гілок.`,
  '0015': `📌 Тип документа: Резолюція Подільської духовної консисторії (серпень 1822 р.).
👤 Ключові особи: Дякон Григорій Долищинський, архієпископ Подільський і Брацлавський Ксенофонт.
📍 Географія: м. Кам'янець-Подільський — с. Липовеньке.
💡 Генеалогічний висновок: Остаточне юридичне затвердження Григорія Долищинського на посаді штатного дякона з призначенням парафіяльного утримання та офіційне завершення справи про рукоположення.`
};

export const NyshporkaReading: React.FC<NyshporkaReadingProps> = ({ theme }) => {
  const [selectedSample, setSelectedSample] = useState<string>('0012');
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [scriptType, setScriptType] = useState<string>('early_cursive');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingNote, setIsGeneratingNote] = useState<boolean>(false);
  const [result, setResult] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'transcription' | 'modern' | 'entities' | 'lines'>('summary');
  
  // Local persistence for notes per scan ID
  const [scanNotes, setScanNotes] = useState<Record<string, ScanAiNoteState>>(() => {
    try {
      const saved = localStorage.getItem('nyshporka_reading_scan_ai_notes_v1');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not read cached scan notes:', e);
    }
    // Initial defaults
    const initial: Record<string, ScanAiNoteState> = {};
    for (const [key, text] of Object.entries(DEFAULT_SCAN_AI_NOTES)) {
      initial[key] = {
        notes: text,
        isAiGenerated: true,
        lastUpdated: 'Автоматично сформовано ШІ',
        model: 'gemini-3.8-flash'
      };
    }
    return initial;
  });

  // Hydrate scanNotes from IndexedDB if available
  useEffect(() => {
    let isMounted = true;
    idbGet<Record<string, ScanAiNoteState>>('nyshporka_reading_scan_ai_notes_v1').then((saved) => {
      if (isMounted && saved && typeof saved === 'object') {
        setScanNotes(prev => ({ ...prev, ...saved }));
      }
    }).catch((err) => {
      console.warn('Failed to load scan notes from IndexedDB:', err);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const [copiedNote, setCopiedNote] = useState<boolean>(false);
  const [savedNoteFeedback, setSavedNoteFeedback] = useState<boolean>(false);
  const [selectedPersonToAttach, setSelectedPersonToAttach] = useState<string>('');
  const [showAttachSuccess, setShowAttachSuccess] = useState<boolean>(false);

  const addPerson = useGenealogyStore(s => s.addPerson);
  const persons = useGenealogyStore(s => s.persons);
  const updatePerson = useGenealogyStore(s => s.updatePerson);

  const sampleImages: Record<string, { label: string; url: string; context: string }> = {
    '0001': {
      label: 'ДАХмО 315-1-159 (Титул справи, 1821 р.)',
      url: '/nyshporka/frames/0001.jpg',
      context: 'Справа про рукоположення дякона Григорія Долищинського у с. Липовеньке Балтського повіту 1821-1822 рр.'
    },
    '0012': {
      label: 'ДАХмО 315-1-159 (Шлюбний запис, 1822 р.)',
      url: '/nyshporka/frames/0012.jpg',
      context: 'Свідоцтво про шлюб дякона Григорія Долищинського з дівицею Оленою Виробинською, дочкою священика Стефана Виробинського с. Липовеньке'
    },
    '0015': {
      label: 'ДАХмО 315-1-159 (Консисторська виписка, 1822 р.)',
      url: '/nyshporka/frames/0015.jpg',
      context: 'Резолюція Подільської духовної консисторії щодо затвердження на парафію'
    }
  };

  const currentScanId = customImage ? 'custom_scan' : selectedSample;
  const currentScanLabel = customImage 
    ? 'Завантажений користувацький скан' 
    : sampleImages[selectedSample]?.label || 'Архівний скан';
  const currentScanContext = customImage 
    ? 'Користувацький скан метричної книги або ревізії XVIII-XIX ст.' 
    : sampleImages[selectedSample]?.context || '';

  // Get or initialize active note
  const currentNoteData = scanNotes[currentScanId] || {
    notes: DEFAULT_SCAN_AI_NOTES[currentScanId] || `📌 Тип документа: Архівний рукописний запис XVIII–XIX ст.\n👤 Ключові особи: ${currentScanContext || 'Особи, зазначені у документі'}.\n📍 Географія: Подільська губернія / Правобережна Україна.\n💡 Генеалогічний висновок: Натисніть «Згенерувати ШІ-висновок», щоб отримати автоматичний аналіз змісту запису.`,
    isAiGenerated: true,
    lastUpdated: 'Очікує генерації',
    model: 'gemini-3.8-flash'
  };

  // Helper to persist scan notes to IndexedDB and mirrored storage
  const updateScanNoteState = (scanId: string, newNoteData: Partial<ScanAiNoteState>) => {
    setScanNotes(prev => {
      const updatedItem: ScanAiNoteState = {
        ...(prev[scanId] || {
          notes: '',
          isAiGenerated: true,
          lastUpdated: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
        }),
        ...newNoteData
      };
      const updatedAll = { ...prev, [scanId]: updatedItem };
      persistLocalData('nyshporka_reading_scan_ai_notes_v1', updatedAll);
      return updatedAll;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setCustomImage(base64);
      setResult(null);
      // If no custom note exists yet, initialize a placeholder
      if (!scanNotes['custom_scan']) {
        updateScanNoteState('custom_scan', {
          notes: `📌 Тип документа: Завантажений архівний скан скоропису.\n👤 Ключові особи: Запис очікує палеографічного аналізу.\n📍 Географія: Територія України (XVIII-XIX ст.).\n💡 Генеалогічний висновок: Натисніть «Згенерувати ШІ-висновок» або «Запустити ШІ-розпізнавання», щоб система підготувала короткий висновок про зміст запису.`,
          isAiGenerated: true,
          lastUpdated: 'Щойно завантажено'
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Generate / Regenerate AI Note specifically for current scan
  const handleGenerateAiNote = async () => {
    setIsGeneratingNote(true);
    try {
      const payload: any = {
        scanId: currentScanId,
        label: currentScanLabel,
        context: currentScanContext,
        transcription: result?.pysarText || result?.modernUkrainian || '',
      };

      if (customImage) {
        payload.imageBase64 = customImage;
      }

      const res = await fetch('/api/nyshporka/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.aiNotes || data.summary) {
        const text = data.aiNotes || data.summary;
        updateScanNoteState(currentScanId, {
          notes: text,
          isAiGenerated: true,
          lastUpdated: `Згенеровано ${new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`,
          model: data.source || 'gemini-3.8-flash'
        });
      }
    } catch (err) {
      console.error('Failed to generate AI note:', err);
    } finally {
      setIsGeneratingNote(false);
    }
  };

  // Full HTR recognition
  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const activeSample = sampleImages[selectedSample];
      const payload: any = {
        targetEngine: 'pysar',
        documentContext: customImage 
          ? 'Користувацький скан метричної книги або ревізії XVIII-XIX ст.'
          : activeSample.context
      };

      if (customImage) {
        payload.imageBase64 = customImage;
      }

      const res = await fetch('/api/nyshporka/htr-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setResult(data);

      // Automatically update the AI notes field with the returned summary if available
      if (data.aiNotes || data.summary) {
        const noteText = data.aiNotes || data.summary;
        updateScanNoteState(currentScanId, {
          notes: noteText,
          isAiGenerated: true,
          lastUpdated: `Оновлено після повного розпізнавання (${new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })})`,
          model: data.source || 'gemini-3.8-flash'
        });
      }
      setActiveTab('summary');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyNote = () => {
    navigator.clipboard.writeText(currentNoteData.notes);
    setCopiedNote(true);
    setTimeout(() => setCopiedNote(false), 2000);
  };

  const handleManualNoteChange = (newVal: string) => {
    updateScanNoteState(currentScanId, {
      notes: newVal,
      isAiGenerated: false,
      lastUpdated: `Відредаговано ${new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`
    });
  };

  const handleSaveNote = () => {
    setSavedNoteFeedback(true);
    setTimeout(() => setSavedNoteFeedback(false), 2000);
  };

  const handleResetToDefaultAi = () => {
    const defaultNote = DEFAULT_SCAN_AI_NOTES[currentScanId];
    if (defaultNote) {
      updateScanNoteState(currentScanId, {
        notes: defaultNote,
        isAiGenerated: true,
        lastUpdated: 'Відновлено стандартний ШІ-висновок'
      });
    } else {
      handleGenerateAiNote();
    }
  };

  const handleAttachToPerson = () => {
    if (!selectedPersonToAttach) return;
    const target = persons.find(p => p.id === selectedPersonToAttach);
    if (!target) return;

    const citation = `\n\n[Архівний висновок Нишпорки зі скану «${currentScanLabel}»]:\n${currentNoteData.notes}`;
    const newNotes = target.notes ? `${target.notes}${citation}` : citation.trim();

    updatePerson({
      ...target,
      notes: newNotes
    });

    setShowAttachSuccess(true);
    setTimeout(() => setShowAttachSuccess(false), 3000);
  };

  const handleAddPerson = (entity: any) => {
    const parts = (entity.name || '').split(' ');
    const lastName = parts[0] || 'Невідомий';
    const firstName = parts[1] || 'Предко';
    const patronymic = parts[2] || '';

    addPerson({
      id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      firstName,
      lastName,
      patronymic,
      gender: 'M',
      birthYear: parseInt(entity.year) || 1800,
      birthPlace: entity.place || 'Подільська губернія',
      notes: `Виявлено рушієм скоропису Нишпорка (HTR). Стан: ${entity.status || ''}. Роль: ${entity.role || ''}.\nВисновок по документу:\n${currentNoteData.notes}`,
      isLiving: false,
      researchStatus: 'confirmed'
    });

    alert(`Особу «${entity.name}» додано до Родоводу з прив'язкою ШІ-нотатки скану!`);
  };

  const currentPreviewUrl = customImage || sampleImages[selectedSample]?.url;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className={`text-xl font-bold ${theme.cardTitle} flex items-center gap-2`}>
            <Sparkles className="w-5 h-5 text-amber-500" />
            ШІ-розпізнавання скоропису (HTR Reading Lab)
          </h2>
          <p className={`text-xs ${theme.cardSubtext} mt-0.5`}>
            Палеографічний аналіз рукописів XVIII–XIX ст., автоматичні ШІ-нотатки та витяг родовідних зв'язків
          </p>
        </div>

        {/* Global info pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 font-medium self-start md:self-auto">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span>ШІ-нотатки активовано для кожного скану</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input, Preview & Dedicated Scan AI Notes Field */}
        <div className={`lg:col-span-6 p-5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-4`}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-xs flex items-center justify-center font-bold">1</span>
              Вибір скану для читання
            </h3>
            <span className="text-[11px] text-neutral-400 font-medium">
              Архівні кадри & власні файли
            </span>
          </div>

          {/* Sample Selectors */}
          <div className="space-y-2">
            <label className="text-xs text-neutral-500 block">
              Виберіть автентичний скан зі справи або завантажте власний:
            </label>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(sampleImages).map(([key, sample]) => {
                const isSelected = selectedSample === key && !customImage;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedSample(key);
                      setCustomImage(null);
                      setResult(null);
                    }}
                    className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500 text-neutral-900 dark:text-neutral-100 font-medium ring-1 ring-amber-500 shadow-xs'
                        : 'bg-neutral-50 dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-xs">{sample.label}</div>
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold shrink-0">
                        <Sparkles className="w-2.5 h-2.5" />
                        ШІ-висновок
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                      {sample.context}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upload Box */}
          <div className="pt-1">
            <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-amber-500 rounded-xl cursor-pointer bg-neutral-50 dark:bg-neutral-900/20 transition-colors">
              <Upload className="w-5 h-5 text-amber-500 mb-1" />
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                Завантажити свій скан архіву
              </span>
              <span className="text-[10px] text-neutral-400">
                JPEG, PNG, WebP (метрична книга, ревізія, сповідка, актовий запис)
              </span>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </label>
            {customImage && (
              <div className="flex items-center justify-between mt-1 px-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <span>✓ Власний файл завантажено</span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomImage(null);
                    setSelectedSample('0012');
                  }}
                  className="text-neutral-400 hover:text-neutral-600 underline cursor-pointer"
                >
                  Повернутися до зразків
                </button>
              </div>
            )}
          </div>

          {/* Script Type selector */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Тип скорописного почерку (HTR Profile):
            </label>
            <select
              value={scriptType}
              onChange={(e) => setScriptType(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
            >
              <option value="early_cursive">Східнослов’янський скоропис кінця XVIII — початку XIX ст.</option>
              <option value="clerical_cursive">Канцелярський скоропис середини XIX ст.</option>
              <option value="semi_uncial">Півустав церковнослов’янських метричних книг</option>
            </select>
          </div>

          {/* Image Preview Thumbnail */}
          <div className="h-44 bg-neutral-950 rounded-xl overflow-hidden flex items-center justify-center border border-neutral-200 dark:border-neutral-800 relative group">
            <img 
              src={currentPreviewUrl} 
              alt="Скан рукопису" 
              className="h-full w-full object-contain p-2"
            />
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] text-neutral-300 font-mono">
              Скан: {currentScanId}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* USER REQUIREMENT: Field for automatic AI-notes to EACH scan with summary */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/5 via-neutral-100/40 to-amber-500/10 dark:from-amber-500/10 dark:via-neutral-900/40 dark:to-neutral-900/60 border border-amber-500/30 dark:border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h4 className="font-bold text-xs text-neutral-900 dark:text-neutral-100">
                  Автоматичні ШІ-нотатки до скану
                </h4>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  {currentNoteData.isAiGenerated ? 'Пропозиція ШІ' : 'Відредаговано'}
                </span>
                {currentNoteData.lastUpdated && (
                  <span className="hidden sm:inline text-[10px] text-neutral-400">
                    {currentNoteData.lastUpdated}
                  </span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-snug">
              Система аналізує зміст обраного скану та формує лаконічний висновок: тип актового запису, ключові персони, населений пункт та значення для вашого родоводу.
            </p>

            {/* Editable note textarea */}
            <div className="relative">
              <textarea
                value={currentNoteData.notes}
                onChange={(e) => handleManualNoteChange(e.target.value)}
                rows={5}
                placeholder="Тут формується автоматична ШІ-нотатка до скану..."
                className="w-full text-xs font-sans leading-relaxed p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-y"
              />
            </div>

            {/* AI Notes Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Generate / Regenerate button */}
                <button
                  type="button"
                  onClick={handleGenerateAiNote}
                  disabled={isGeneratingNote || isLoading}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Оновити короткий висновок ШІ про зміст запису"
                >
                  <RefreshCw className={`w-3 h-3 ${isGeneratingNote ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingNote ? 'Аналіз...' : 'ШІ-висновок'}</span>
                </button>

                {/* Reset to AI default */}
                <button
                  type="button"
                  onClick={handleResetToDefaultAi}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                  title="Скинути до стандартної пропозиції ШІ"
                >
                  <RotateCcw className="w-3 h-3 text-neutral-400" />
                  <span>Скинути</span>
                </button>

                {/* Copy note */}
                <button
                  type="button"
                  onClick={handleCopyNote}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                >
                  {copiedNote ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-neutral-400" />}
                  <span>{copiedNote ? 'Скопійовано' : 'Копіювати'}</span>
                </button>

                {/* Save confirmation */}
                <button
                  type="button"
                  onClick={handleSaveNote}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                >
                  {savedNoteFeedback ? <Check className="w-3 h-3 text-emerald-500" /> : <Save className="w-3 h-3 text-neutral-400" />}
                  <span>{savedNoteFeedback ? 'Збережено!' : 'Зберегти'}</span>
                </button>
              </div>

              {/* Quick Attach to person in tree */}
              {persons.length > 0 && (
                <div className="flex items-center gap-1.5 w-full sm:w-auto pt-1 sm:pt-0">
                  <select
                    value={selectedPersonToAttach}
                    onChange={(e) => setSelectedPersonToAttach(e.target.value)}
                    className="text-[11px] p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 max-w-[140px]"
                  >
                    <option value="">Прикріпити до...</option>
                    {persons.slice(0, 15).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.lastName} {p.firstName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAttachToPerson}
                    disabled={!selectedPersonToAttach}
                    className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40 transition-colors cursor-pointer font-semibold text-[11px] flex items-center gap-1 shrink-0"
                    title="Прикріпити нотатку до картки персони в дереві"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>В Родовід</span>
                  </button>
                </div>
              )}
            </div>

            {showAttachSuccess && (
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 bg-emerald-500/10 p-2 rounded-lg">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>ШІ-нотатку успішно прикріплено до обраної особи в родинному дереві!</span>
              </div>
            )}
          </div>

          {/* Run full recognition button */}
          <button
            type="button"
            onClick={handleRunAnalysis}
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Розпізнавання скоропису палеографічним ШІ...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Запустити повне ШІ-розпізнавання скоропису</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Results & AI Conclusions */}
        <div className={`lg:col-span-6 p-5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm flex flex-col space-y-4`}>
          <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-xs flex items-center justify-center font-bold">2</span>
              <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-500" />
                Результати палеографічного аналізу
              </h3>
            </div>
            {result?.source && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold">
                {result.source}
              </span>
            )}
          </div>

          {/* Tab navigation */}
          <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 pb-2 text-xs font-semibold overflow-x-auto select-none">
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'summary'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>ШІ-висновок</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('transcription')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'transcription'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              Автентичний скоропис
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('modern')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'modern'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              Сучасний переклад
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('entities')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'entities'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              Знайдені особи ({result?.entities?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lines')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'lines'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              Рядки ({result?.lines?.length || 0})
            </button>
          </div>

          {/* VIEW: Tab 1 - AI Summary & Conclusion */}
          {activeTab === 'summary' && (
            <div className="space-y-4 flex-1">
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Короткий висновок ШІ про зміст запису:
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400">
                    {currentScanLabel}
                  </span>
                </div>

                <div className="p-3.5 rounded-lg bg-white/80 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 text-xs leading-relaxed text-neutral-900 dark:text-neutral-100 whitespace-pre-line font-medium select-text">
                  {currentNoteData.notes}
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px] text-neutral-500">
                  <span>Модель: {currentNoteData.model || 'Gemini 3.8 Flash (HTR)'}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyNote}
                      className="hover:text-amber-600 underline cursor-pointer"
                    >
                      Скопіювати висновок
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={handleGenerateAiNote}
                      disabled={isGeneratingNote}
                      className="hover:text-amber-600 underline cursor-pointer"
                    >
                      Згенерувати заново
                    </button>
                  </div>
                </div>
              </div>

              {/* Extra genealogical context box */}
              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  <Info className="w-3.5 h-3.5 text-amber-500" />
                  <span>Палеографічні примітки та джерелознавчі деталі:</span>
                </div>
                <div className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-normal space-y-1">
                  <p>• <strong>Джерело:</strong> {currentScanLabel}</p>
                  <p>• <strong>Почерк:</strong> {scriptType === 'early_cursive' ? 'Східнослов’янський скоропис кінця XVIII — початку XIX ст.' : scriptType === 'clerical_cursive' ? 'Канцелярський скоропис XIX ст.' : 'Півустав церковних книг'}</p>
                  <p>• <strong>Збереження нотатки:</strong> Нотатка автоматично синхронізується з локальним сховищем для цього скану і зберігається при перемиканні між кадрами.</p>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Tab 2 - Authentic Transcription */}
          {activeTab === 'transcription' && (
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 max-h-[380px] overflow-y-auto space-y-3 flex-1">
              {result ? (
                <>
                  <div className="font-serif text-xs leading-relaxed whitespace-pre-line text-neutral-900 dark:text-neutral-100 select-text">
                    {result.pysarText || result.transcription || 'Текст розпізнано успішно.'}
                  </div>
                  {result.diakText && result.diakText !== result.pysarText && (
                    <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3">
                      <span className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                        Церковний варіант читання (Diak):
                      </span>
                      <div className="font-serif text-xs leading-relaxed whitespace-pre-line text-neutral-600 dark:text-neutral-400">
                        {result.diakText}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-10 text-neutral-400 text-xs space-y-2">
                  <FileText className="w-6 h-6 mx-auto opacity-40" />
                  <p>Натисніть кнопку «Запустити повне ШІ-розпізнавання скоропису», щоб згенерувати повний автентичний текст.</p>
                </div>
              )}
            </div>
          )}

          {/* VIEW: Tab 3 - Modern Translation */}
          {activeTab === 'modern' && (
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 max-h-[380px] overflow-y-auto font-sans text-xs leading-relaxed text-neutral-800 dark:text-neutral-200 select-text flex-1">
              {result ? (
                result.modernUkrainian || 'Переклад відсутній'
              ) : (
                <div className="text-center py-10 text-neutral-400 text-xs space-y-2">
                  <BookOpen className="w-6 h-6 mx-auto opacity-40" />
                  <p>Переклад сучасною мовою з'явиться після запуску розпізнавання.</p>
                </div>
              )}
            </div>
          )}

          {/* VIEW: Tab 4 - Entities */}
          {activeTab === 'entities' && (
            <div className="space-y-2 max-h-[380px] overflow-y-auto flex-1">
              {result?.entities && result.entities.length > 0 ? (
                result.entities.map((ent: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-neutral-900 dark:text-neutral-100">
                        {ent.name}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {ent.role} · {ent.status} · {ent.place} ({ent.year} р.)
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddPerson(ent)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition-colors cursor-pointer shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      В Родовід
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-neutral-400 text-xs space-y-2">
                  <UserPlus className="w-6 h-6 mx-auto opacity-40" />
                  <p>Особи з документу будуть структуровані після запуску розпізнавання скоропису.</p>
                </div>
              )}
            </div>
          )}

          {/* VIEW: Tab 5 - Lines */}
          {activeTab === 'lines' && (
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto flex-1">
              {result?.lines && result.lines.length > 0 ? (
                result.lines.map((l: string, idx: number) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 text-xs font-serif flex items-start gap-2"
                  >
                    <span className="font-mono text-[10px] text-neutral-400 w-5 shrink-0 select-none">
                      {idx + 1}.
                    </span>
                    <span className="text-neutral-800 dark:text-neutral-200">{l}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-neutral-400 text-xs space-y-2">
                  <Layers className="w-6 h-6 mx-auto opacity-40" />
                  <p>Розбивка на фізичні рядки документу з'явиться після запуску розпізнавання.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
