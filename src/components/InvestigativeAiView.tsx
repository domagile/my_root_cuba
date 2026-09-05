import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  Upload, 
  FileSpreadsheet, 
  Search, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  ArrowRight, 
  Database, 
  UserCheck, 
  MapPin, 
  Calendar,
  Layers,
  Zap,
  RefreshCw,
  Image as ImageIcon,
  Link as LinkIcon,
  HardDrive,
  Github,
  Save,
  Trash2,
  FileCheck,
  Check,
  FolderPlus,
  HelpCircle,
  X,
  ExternalLink,
  ShieldCheck,
  Eye,
  FileUp,
  BookOpen,
  Activity,
  Award
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useGenealogy } from '../context/GenealogyContext';
import { ImportedMetricRow, RecordType } from '../types';
import { findBestPersonMatch, areSurnamesPhoneticallyRelated } from '../utils/ukrainianPhonetics';

export interface RecognizedMetricItem {
  id: string;
  sourceText: string;
  extractedPersonName: string;
  year: string;
  dateExact?: string;
  recordType: string;
  village: string;
  socialStatus?: string;
  parentsOrRelatives: string;
  originalTranscription?: string;
  matchedPersonId?: string;
  matchedPersonName?: string;
  confidence: number;
  linkReason: string;
  suggestedKinship?: string;
  savedStatus?: 'metric' | 'person' | 'document' | 'hypothesis';
}

export const InvestigativeAiView: React.FC = () => {
  const { 
    persons, 
    addPerson, 
    addHypothesis, 
    addMetricRecord, 
    addDocument, 
    metricRecords, 
    documents 
  } = useGenealogy();

  const [scanMode, setScanMode] = useState<'ocr' | 'excel'>('ocr');
  
  // Excel states
  const [importedRows, setImportedRows] = useState<ImportedMetricRow[]>([]);
  const [dragActiveExcel, setDragActiveExcel] = useState(false);

  // OCR / Scan / URL states
  const [ocrInputType, setOcrInputType] = useState<'file' | 'url' | 'text'>('file');
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanFilePreview, setScanFilePreview] = useState<string | null>(null);
  const [scanFileBase64, setScanFileBase64] = useState<string | null>(null);
  const [scanUrl, setScanUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [dragActiveOcr, setDragActiveOcr] = useState(false);

  // Save Format state
  const [targetFormat, setTargetFormat] = useState<'metric' | 'person' | 'document' | 'hypothesis'>('metric');
  const [metricRecordType, setMetricRecordType] = useState<RecordType>('birth');

  // AI Scan state & results
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<RecognizedMetricItem[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);

  // Helper to convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Parse Excel file logic
  const processExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json<any>(worksheet);

        const parsed: ImportedMetricRow[] = jsonRows.map((row, idx) => ({
          id: `metric-excel-${idx}-${Date.now()}`,
          year: row['Рік'] || row['Year'] || row['рік'] || row['Дата'] || '',
          type: row['Тип'] || row['Type'] || row['Запис'] || 'Метрика',
          personName: row['ПІБ'] || row['Особа'] || row['Name'] || row['Прізвище'] || row['Ім’я'] || '',
          relatives: row['Батьки'] || row['Родичі'] || row['Relatives'] || row['Свідки'] || '',
          churchOrPlace: row['Парафія'] || row['Місто'] || row['Place'] || row['Селище'] || row['Село'] || '',
          archiveRef: row['Архів'] || row['Фонд'] || row['Ref'] || '',
          notes: row['Замітки'] || row['Примітка'] || row['Нотатки'] || ''
        }));

        setImportedRows(parsed);
      } catch (err) {
        alert("Помилка обробки Excel файлу. Перевірте формат (.xlsx, .xls, .csv).");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processExcelFile(file);
  };

  const handleExcelDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActiveExcel(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processExcelFile(e.dataTransfer.files[0]);
    }
  };

  // OCR file selection logic
  const handleOcrFileSelect = async (file: File) => {
    setScanFile(file);
    setScanError(null);
    try {
      const base64 = await fileToBase64(file);
      setScanFileBase64(base64);
      if (file.type.startsWith('image/')) {
        setScanFilePreview(base64);
      } else {
        setScanFilePreview(null);
      }
    } catch (err) {
      console.error('File read error:', err);
    }
  };

  const handleOcrDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActiveOcr(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleOcrFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Quick preset loader for archival examples
  const loadExample = (type: 'birth' | 'confession' | 'revision') => {
    setOcrInputType('text');
    setScanFile(null);
    setScanFilePreview(null);
    setScanFileBase64(null);
    setScanUrl('');

    if (type === 'birth') {
      setMetricRecordType('birth');
      setPastedText('1894 года Октября 12 дня рожденъ, 15 крещенъ Димитрій. Родители: села Покровскаго козакъ Иванъ Васильевъ сынъ Шакало и законная жена его Марія Стефанова дочь, оба православнаго вѣроисповѣданія. Воспріемники (кумы): того же села козакъ Петръ Ивановъ Бондаренко и дѣвица Анна Андреева дочь Мельникова.');
    } else if (type === 'confession') {
      setMetricRecordType('confession');
      setPastedText('1845 года Сповідний розпис церкви Покрови Пресвятої Богородиці. Дворъ № 14. Козаки: Матвѣй Григорьевъ сынъ Коваленко 54 года, жена его Уліянія Никитина 50 летъ, дѣти ихъ: Симеонъ 22 года, жена его Агафія Павлова 20 летъ, дочь ихъ Параскева 1 годъ; братъ Матвѣя вдовый Корнилій 48 летъ.');
    } else {
      setMetricRecordType('revision');
      setPastedText('1858 года Апрѣля 10 дня Ревизская Сказка Полтавской губерніи села Покровскаго. Семья № 28. Иванъ Яковлевъ Бондарь (по прошлой 9-й ревизіи 42 года, умеръ въ 1855 г.), его сынъ Стефанъ (по 9-й ревизіи 18 летъ, нынѣ 26 летъ), Стефановъ сынъ Василій новорожденный (3 года). Стефана жена Меланія 24 года.');
    }
  };

  // Real Gemini Multimodal AI Analysis execution
  const runAiAnalysis = async () => {
    setIsScanning(true);
    setScanError(null);

    try {
      if (scanMode === 'excel' && importedRows.length > 0) {
        // Evaluate Excel rows against existing persons using Ukrainian Phonetics Engine & Levenshtein
        const results: RecognizedMetricItem[] = importedRows.map((row, idx) => {
          const matchResult = findBestPersonMatch(
            {
              personName: row.personName,
              village: row.churchOrPlace,
              year: row.year
            },
            persons
          );

          return {
            id: `scan-excel-${idx}-${Date.now()}`,
            sourceText: `Excel запис #${idx + 1}: ${row.personName}, ${row.type || 'метрика'}, ${row.year || ''} р.`,
            extractedPersonName: row.personName,
            year: String(row.year || '1890-ті'),
            dateExact: row.year ? `${row.year} р.` : undefined,
            recordType: row.type || 'Метрична книга',
            village: row.churchOrPlace || 'Селище не зазначено',
            parentsOrRelatives: row.relatives || 'Не зазначено',
            socialStatus: 'Запис метричної книги',
            matchedPersonId: matchResult.matchedPerson?.id,
            matchedPersonName: matchResult.matchedPerson 
              ? `${matchResult.matchedPerson.lastName} ${matchResult.matchedPerson.firstName} ${matchResult.matchedPerson.patronymic || ''}`.trim()
              : undefined,
            confidence: matchResult.confidence,
            linkReason: matchResult.reason,
            suggestedKinship: matchResult.matchedPerson ? 'Ймовірний родич / кандидат у дерево' : undefined
          };
        });

        setScanResults(results);
        setUsedModel('Український фонетичний алгоритм & Levenshtein');
      } else {
        // Real Server-Side Gemini Multimodal Call
        let textToSend = pastedText.trim();
        if (scanUrl.trim()) {
          textToSend += `\nПосилання на джерело: ${scanUrl.trim()}`;
        }

        const res = await fetch('/api/ai/analyze-metric', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: scanFileBase64,
            mimeType: scanFile?.type || 'image/jpeg',
            textContent: textToSend,
            recordTypeHint: metricRecordType,
            existingPersons: persons.map(p => ({
              id: p.id,
              firstName: p.firstName,
              lastName: p.lastName,
              patronymic: p.patronymic,
              birthDate: p.birthDate,
              birthPlace: p.birthPlace
            }))
          })
        });

        const data = await res.json();
        if (data.results && Array.isArray(data.results) && data.results.length > 0) {
          // Enrich server results with client-side phonetic fallback if needed
          const enrichedResults: RecognizedMetricItem[] = data.results.map((item: any, idx: number) => {
            let matchedName = item.matchedPersonName;
            let confidence = item.confidence || 85;
            let linkReason = item.linkReason || '';
            let matchedId = item.matchedPersonId;

            // If Gemini didn't find match, check with our local phonetic algorithm
            if (!matchedName && item.extractedPersonName) {
              const localMatch = findBestPersonMatch(
                {
                  personName: item.extractedPersonName,
                  village: item.village,
                  year: item.year
                },
                persons
              );
              if (localMatch.matchedPerson) {
                matchedName = `${localMatch.matchedPerson.lastName} ${localMatch.matchedPerson.firstName}`;
                matchedId = localMatch.matchedPerson.id;
                confidence = localMatch.confidence;
                linkReason = localMatch.reason;
              }
            }

            return {
              id: `res-${idx}-${Date.now()}`,
              sourceText: item.originalTranscription || textToSend || 'Скан-копія документа',
              extractedPersonName: item.extractedPersonName || 'Невідома особа',
              year: String(item.year || '1890'),
              dateExact: item.dateExact,
              recordType: item.recordType || 'Метричний запис',
              village: item.village || 'Парафія',
              socialStatus: item.socialStatus || 'Стан не вказано',
              parentsOrRelatives: item.parentsOrRelatives || 'Відомості відсутні',
              originalTranscription: item.originalTranscription,
              matchedPersonId: matchedId,
              matchedPersonName: matchedName,
              confidence: confidence,
              linkReason: linkReason || 'AI розпізнано та зіставлено з родоводом.',
              suggestedKinship: item.suggestedKinship
            };
          });

          setScanResults(enrichedResults);
          setUsedModel(data.source === 'gemini-3.7-flash' ? 'Gemini 3.7 Flash Multimodal' : 'Локальний аналізатор');
        } else {
          setScanError('Не вдалося витягти структуровані записи з наданого матеріалу. Спробуйте інше зображення або чіткіший текстовий витяг.');
        }
      }
    } catch (err: any) {
      console.error('AI Scan Error:', err);
      setScanError(`Помилка аналізу: ${err.message || 'Не вдалося виконати запит до сервера AI'}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Direct Batch Import Excel Rows into Database
  const batchImportExcelToMetrics = () => {
    if (importedRows.length === 0) return;

    importedRows.forEach((row) => {
      addMetricRecord({
        title: `${row.type || 'Метрика'}: ${row.personName || 'Запис'}`,
        archive: row.archiveRef || 'Державний Архів',
        fund: 'Ф. 1011',
        inventory: 'Оп. 1',
        caseNumber: 'Спр. ' + (Math.floor(Math.random() * 300) + 1),
        year: parseInt(String(row.year)) || 1890,
        recordType: 'birth',
        status: 'raw',
        notes: `Імпортовано з Excel. Селище: ${row.churchOrPlace || '—'}. Родичі: ${row.relatives || '—'}. ${row.notes || ''}`,
        indexedPersons: [
          {
            personName: row.personName || '—',
            role: 'subject',
            details: row.relatives
          }
        ]
      });
    });

    alert(`Успішно імпортовано ${importedRows.length} записів у хмарну базу метричних книг!`);
  };

  // Save specific result item based on chosen target format
  const handleSaveResult = (res: RecognizedMetricItem, saveType: 'metric' | 'person' | 'document' | 'hypothesis') => {
    if (saveType === 'metric') {
      addMetricRecord({
        title: `${res.recordType}: ${res.extractedPersonName}`,
        archive: 'Державний Архів',
        fund: 'Ф. 1011',
        inventory: 'Оп. 1',
        caseNumber: 'Спр. ' + (Math.floor(Math.random() * 500) + 1),
        year: parseInt(res.year) || 1895,
        recordType: metricRecordType,
        status: 'raw',
        notes: `Розпізнано AI. Точна дата: ${res.dateExact || res.year}. Стан: ${res.socialStatus || '—'}. Селище: ${res.village}. Родичі/куми: ${res.parentsOrRelatives}. ${res.originalTranscription ? `Транскрипція: "${res.originalTranscription}"` : ''}`,
        indexedPersons: [
          {
            personName: res.extractedPersonName,
            role: 'subject',
            details: `${res.socialStatus || ''}. ${res.linkReason}`
          }
        ]
      });
    } else if (saveType === 'person') {
      const parts = res.extractedPersonName.trim().split(/\s+/);
      const lastName = parts[0] || 'Невідомий';
      const firstName = parts[1] || 'Представитель';
      const patronymic = parts[2] || '';

      addPerson({
        id: `person-${Date.now()}`,
        name: {
          given: firstName,
          surname: lastName,
          patronymic
        },
        firstName,
        lastName,
        patronymic,
        gender: firstName.endsWith('а') || firstName.endsWith('я') ? 'female' : 'male',
        birthDate: res.year ? `${res.year}-01-01` : '',
        birthPlace: res.village,
        notes: `Створено через Gemini AI OCR (${res.recordType}, ${res.dateExact || res.year}). Стан: ${res.socialStatus || 'козацький/селянський'}. Відомості: ${res.parentsOrRelatives}`
      });
    } else if (saveType === 'document') {
      addDocument({
        id: `doc-${Date.now()}`,
        title: `Архівний витяг: ${res.extractedPersonName} (${res.year} р.)`,
        type: res.recordType,
        archiveRef: `Ф. 1011, Оп. 1, ${res.village}`,
        archive: 'Державний Архів',
        settlement: res.village,
        year: res.year,
        notes: `Розпізнаний скоропис: "${res.originalTranscription || res.sourceText}". Стан: ${res.socialStatus || '—'}. Відомості: ${res.parentsOrRelatives}`,
        tags: ['Gemini OCR', 'розпізнано скоропис', res.recordType],
        createdAt: new Date().toISOString()
      });
    } else if (saveType === 'hypothesis') {
      addHypothesis({
        id: `hypo-${Date.now()}`,
        title: `Гіпотеза спорідненості: ${res.extractedPersonName} (${res.village})`,
        description: `${res.linkReason}. ${res.suggestedKinship ? `Ймовірна роль: ${res.suggestedKinship}.` : ''} Джерело: ${res.recordType}, ${res.year} р.`,
        confidence: res.confidence,
        evidenceCount: 1,
        status: 'testing'
      });
    }

    setScanResults(prev => prev.map(item => item.id === res.id ? { ...item, savedStatus: saveType } : item));
  };

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 bg-[#0F0F0F] text-[#E5E5E5] overflow-y-auto overflow-x-auto space-y-6 transition-colors duration-300">
      
      {/* 1. TOP BANNER */}
      <div className="p-5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#B88E3E]/20 border border-[#B88E3E]/40 flex items-center justify-center text-[#B88E3E] shrink-0 shadow-inner">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#E5E5E5] flex items-center gap-2">
                Слідчий AI Аналіз Метрик & Мультимодальний OCR
              </h2>
              <p className="text-xs text-[#8C8C8C]">
                Розпізнавання старовинного скоропису, метричних книг, ревізій та автоматичний пошук спорідненості
              </p>
            </div>
          </div>
        </div>

        {/* Mode buttons & badge */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-md bg-[#262626] border border-[#333333] text-[11px] font-semibold text-[#B88E3E] flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-[#B88E3E]" />
            <span>Серверний Gemini 3.7 Flash + Фонетика</span>
          </span>

          <div className="flex items-center gap-1.5 bg-[#121212] border border-[#333333] p-1 rounded-lg">
            <button
              onClick={() => setScanMode('ocr')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                scanMode === 'ocr'
                  ? 'bg-[#B88E3E] text-[#0F0F0F] shadow-xs'
                  : 'text-[#A3A3A3] hover:text-[#E5E5E5]'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Скан / Текст / Скоропис</span>
            </button>

            <button
              onClick={() => setScanMode('excel')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                scanMode === 'excel'
                  ? 'bg-[#B88E3E] text-[#0F0F0F] shadow-xs'
                  : 'text-[#A3A3A3] hover:text-[#E5E5E5]'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Імпорт Excel / CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN INPUT CARD */}
      <div className="p-5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] shadow-md space-y-4">
        
        {scanMode === 'ocr' ? (
          /* SCAN / OCR / URL MODE */
          <div className="space-y-4">
            
            {/* Input source selector sub-tabs & Quick Presets */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#262626]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[#8C8C8C] uppercase tracking-wider">Джерело:</span>
                <div className="flex items-center gap-1 bg-[#121212] p-1 rounded-lg border border-[#333333]">
                  <button
                    onClick={() => setOcrInputType('file')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                      ocrInputType === 'file' ? 'bg-[#262626] text-[#E5E5E5] border border-[#404040]' : 'text-[#8C8C8C] hover:text-[#E5E5E5]'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-[#B88E3E]" />
                    <span>Скан-копія / Фото</span>
                  </button>

                  <button
                    onClick={() => setOcrInputType('text')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                      ocrInputType === 'text' ? 'bg-[#262626] text-[#E5E5E5] border border-[#404040]' : 'text-[#8C8C8C] hover:text-[#E5E5E5]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-[#B88E3E]" />
                    <span>Текст / Скоропис</span>
                  </button>

                  <button
                    onClick={() => setOcrInputType('url')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                      ocrInputType === 'url' ? 'bg-[#262626] text-[#E5E5E5] border border-[#404040]' : 'text-[#8C8C8C] hover:text-[#E5E5E5]'
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5 text-[#B88E3E]" />
                    <span>URL документа</span>
                  </button>
                </div>
              </div>

              {/* Format selection dropdown for saving */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-[#8C8C8C] uppercase tracking-wider">Тип запису:</span>
                <select
                  value={metricRecordType}
                  onChange={(e) => setMetricRecordType(e.target.value as RecordType)}
                  className="bg-[#121212] border border-[#333333] text-[#B88E3E] rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-[#B88E3E] cursor-pointer"
                >
                  <option value="birth">Народження / Хрещення</option>
                  <option value="marriage">Шлюб</option>
                  <option value="death">Смерть / Поховання</option>
                  <option value="confession">Сповідний розпис</option>
                  <option value="revision">Ревізька казка (Ревізія)</option>
                  <option value="other">Інший архівний акт</option>
                </select>
              </div>
            </div>

            {/* Quick Archival Samples Bar */}
            <div className="flex items-center gap-2 flex-wrap bg-[#121212] p-2.5 rounded-lg border border-[#262626]">
              <span className="text-[11px] font-bold text-[#8C8C8C] flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-[#B88E3E]" />
                <span>Зразки для тесту:</span>
              </span>
              <button
                type="button"
                onClick={() => loadExample('birth')}
                className="px-2.5 py-1 bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] hover:border-[#B88E3E] text-[11px] text-[#E5E5E5] rounded-md transition-all cursor-pointer"
              >
                📜 Метрика народження 1894 р.
              </button>
              <button
                type="button"
                onClick={() => loadExample('confession')}
                className="px-2.5 py-1 bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] hover:border-[#B88E3E] text-[11px] text-[#E5E5E5] rounded-md transition-all cursor-pointer"
              >
                ⛪ Сповідний розпис 1845 р.
              </button>
              <button
                type="button"
                onClick={() => loadExample('revision')}
                className="px-2.5 py-1 bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] hover:border-[#B88E3E] text-[11px] text-[#E5E5E5] rounded-md transition-all cursor-pointer"
              >
                📑 Ревізька казка 1858 р.
              </button>
            </div>

            {/* A. FILE UPLOAD DROPZONE */}
            {ocrInputType === 'file' && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActiveOcr(true); }}
                onDragLeave={() => setDragActiveOcr(false)}
                onDrop={handleOcrDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                  dragActiveOcr 
                    ? 'border-[#B88E3E] bg-[#B88E3E]/10' 
                    : 'border-[#333333] bg-[#121212] hover:border-[#404040]'
                }`}
              >
                {scanFile ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-[#1A1A1A] border border-[#333333] rounded-lg">
                    <div className="flex items-center gap-3 text-left">
                      {scanFilePreview ? (
                        <img src={scanFilePreview} alt="Scan preview" className="w-16 h-16 object-cover rounded-md border border-[#404040]" />
                      ) : (
                        <div className="w-14 h-14 bg-[#262626] rounded-md flex items-center justify-center text-[#B88E3E]">
                          <FileText className="w-7 h-7" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-[#E5E5E5]">{scanFile.name}</p>
                        <p className="text-[10px] text-[#8C8C8C]">{(scanFile.size / 1024).toFixed(1)} KB • Готово до передачі у нейромережу Gemini</p>
                      </div>
                    </div>

                    <button
                      onClick={() => { setScanFile(null); setScanFilePreview(null); setScanFileBase64(null); }}
                      className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-200 rounded-md text-xs font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Прибрати</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FileUp className="w-9 h-9 mx-auto text-[#B88E3E]" />
                    <div>
                      <p className="text-xs font-bold text-[#E5E5E5]">Перетягніть сюди скан-копію або фотографію архівного аркуша</p>
                      <p className="text-[11px] text-[#8C8C8C]">Підтримуються формати зображень (JPG, PNG, WEBP) та документів (PDF)</p>
                    </div>

                    <button
                      onClick={() => ocrFileInputRef.current?.click()}
                      className="mt-2 px-4 py-2 bg-[#262626] hover:bg-[#333333] border border-[#404040] text-[#E5E5E5] text-xs font-semibold rounded-lg transition-all cursor-pointer inline-flex items-center gap-2"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#B88E3E]" />
                      <span>Обрати файл з пристрою</span>
                    </button>
                    <input
                      ref={ocrFileInputRef}
                      type="file"
                      accept="image/*, .pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleOcrFileSelect(file);
                      }}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            )}

            {/* B. LINK / DRIVE / GITHUB INPUT */}
            {ocrInputType === 'url' && (
              <div className="space-y-2 bg-[#121212] p-4 rounded-xl border border-[#333333]">
                <label className="block text-xs font-bold text-[#8C8C8C]">
                  Посилання на скан або виписку (Google Drive, GitHub або архівний ресурс):
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      value={scanUrl}
                      onChange={(e) => setScanUrl(e.target.value)}
                      placeholder="https://drive.google.com/file/d/... або пряме посилання"
                      className="w-full pl-8 pr-3 py-2 bg-[#1A1A1A] border border-[#333333] rounded-lg text-xs text-[#E5E5E5] placeholder-[#666666] focus:outline-none focus:border-[#B88E3E]"
                    />
                    <LinkIcon className="w-3.5 h-3.5 text-[#B88E3E] absolute left-2.5 top-3" />
                  </div>
                  {scanUrl && (
                    <button
                      onClick={() => setScanUrl('')}
                      className="px-2.5 py-2 bg-[#262626] hover:bg-[#333333] border border-[#404040] text-[#E5E5E5] rounded-lg text-xs cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* C. PASTED TEXT INPUT */}
            {ocrInputType === 'text' && (
              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Вставте вичитаний фрагмент тексту старовинного скоропису або витяг із метричної книги (наприклад: 1894 года Октября 12 дня у козака Івана Шакала родился сынъ Димитрій...)"
                  className="w-full p-3 bg-[#121212] border border-[#333333] rounded-lg text-xs text-[#E5E5E5] placeholder-[#666666] focus:outline-none focus:border-[#B88E3E] font-mono leading-relaxed"
                />
              </div>
            )}

            {/* OCR RUN ACTION BUTTON */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-[#8C8C8C]">
                Формат запису: <strong className="text-[#B88E3E]">{metricRecordType === 'birth' ? 'Народження' : metricRecordType === 'marriage' ? 'Шлюб' : metricRecordType === 'death' ? 'Смерть' : metricRecordType === 'confession' ? 'Сповідний розпис' : 'Ревізія'}</strong>
              </span>

              <button
                onClick={runAiAnalysis}
                disabled={isScanning || (!scanFile && !scanUrl.trim() && !pastedText.trim())}
                className={`px-5 py-2.5 rounded-lg bg-[#B88E3E] hover:bg-[#A37B30] text-[#0F0F0F] font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
                  isScanning || (!scanFile && !scanUrl.trim() && !pastedText.trim()) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Обробка нейромережею...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Запустити Gemini OCR & Пошук родинних зв'язків</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* EXCEL IMPORT MODE */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-[#E5E5E5]">Завантаження метричного реєстру у форматі Excel / CSV</h3>
                <p className="text-xs text-[#8C8C8C]">
                  Підтримує колонки «ПІБ / Особа», «Рік», «Тип», «Селище / Парафія», «Батьки / Родичі», «Нотатки»
                </p>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-[#262626] hover:bg-[#333333] border border-[#404040] text-[#E5E5E5] font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
              >
                <Upload className="w-4 h-4 text-[#B88E3E]" />
                <span>Обрати Excel файл</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleExcelFileUpload}
                className="hidden"
              />
            </div>

            {/* Excel Drag & Drop Box */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActiveExcel(true); }}
              onDragLeave={() => setDragActiveExcel(false)}
              onDrop={handleExcelDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                dragActiveExcel ? 'border-[#B88E3E] bg-[#B88E3E]/10' : 'border-[#333333] bg-[#121212]'
              }`}
            >
              {importedRows.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs bg-[#1A1A1A] p-3 rounded-lg border border-[#333333]">
                    <span className="font-bold text-[#E5E5E5] flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-[#B88E3E]" />
                      Завантажено записів із таблиці: {importedRows.length}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={batchImportExcelToMetrics}
                        className="px-3 py-1.5 bg-[#262626] hover:bg-[#333333] border border-[#404040] text-[#E5E5E5] rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Database className="w-3.5 h-3.5 text-[#B88E3E]" />
                        <span>Імпортувати всі в Метрики</span>
                      </button>

                      <button
                        onClick={runAiAnalysis}
                        disabled={isScanning}
                        className="px-3.5 py-1.5 bg-[#B88E3E] hover:bg-[#A37B30] text-[#0F0F0F] rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Зіставити з родоводом</span>
                      </button>

                      <button
                        onClick={() => setImportedRows([])}
                        className="p-1.5 text-[#8C8C8C] hover:text-[#E5E5E5] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Excel Rows Preview Table */}
                  <div className="max-h-48 overflow-y-auto overflow-x-auto border border-[#2A2A2A] rounded-lg">
                    <table className="w-full min-w-[540px] text-left text-xs text-[#E5E5E5]">
                      <thead className="bg-[#121212] text-[#B88E3E] text-[10px] font-bold uppercase sticky top-0">
                        <tr>
                          <th className="p-2">#</th>
                          <th className="p-2">ПІБ / Особа</th>
                          <th className="p-2">Рік</th>
                          <th className="p-2">Тип</th>
                          <th className="p-2">Селище / Парафія</th>
                          <th className="p-2">Родичі</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#262626]">
                        {importedRows.slice(0, 100).map((row, i) => (
                          <tr key={i} className="hover:bg-[#262626]">
                            <td className="p-2 text-[#8C8C8C] font-mono">{i + 1}</td>
                            <td className="p-2 font-semibold">{row.personName || '—'}</td>
                            <td className="p-2 font-mono text-[#B88E3E]">{row.year || '—'}</td>
                            <td className="p-2">{row.type || '—'}</td>
                            <td className="p-2">{row.churchOrPlace || '—'}</td>
                            <td className="p-2 text-[#8C8C8C]">{row.relatives || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <FileSpreadsheet className="w-8 h-8 mx-auto text-[#B88E3E]" />
                  <p className="text-xs font-bold text-[#E5E5E5]">Перетягніть сюди файл Excel (.xlsx, .xls) або CSV</p>
                  <p className="text-[11px] text-[#8C8C8C]">Автоматичне розпізнавання колонок та пошук відповідників у дереві</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error alert if any */}
      {scanError && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{scanError}</span>
        </div>
      )}

      {/* 3. AI ANALYSIS & RECOGNITION RESULTS */}
      {isScanning ? (
        <div className="p-10 text-center bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] space-y-3 shadow-sm">
          <RefreshCw className="w-8 h-8 mx-auto text-[#B88E3E] animate-spin" />
          <p className="font-bold text-sm text-[#E5E5E5]">Мультимодальна нейромережа Gemini розшифровує скоропис та зіставляє родовід...</p>
          <p className="text-xs text-[#8C8C8C]">Палеографічний аналіз, нормалізація прізвищ за фонетикою та розрахунок дистанції Левенштейна</p>
        </div>
      ) : scanResults.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#E5E5E5] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Розпізнано та зіставлено записів ({scanResults.length}):</span>
            </h3>
            {usedModel && (
              <span className="text-[11px] font-semibold text-[#B88E3E] bg-[#1A1A1A] px-2.5 py-1 rounded-md border border-[#333333]">
                Рушій: {usedModel}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {scanResults.map((res) => (
              <div
                key={res.id}
                className="p-5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] shadow-md space-y-4 hover:border-[#B88E3E]/70 transition-all"
              >
                {/* Result header bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262626] pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      res.confidence >= 80 
                        ? 'bg-emerald-500 text-black font-bold' 
                        : res.confidence >= 60 
                        ? 'bg-[#B88E3E] text-black font-bold' 
                        : 'bg-amber-600/80 text-white'
                    }`}>
                      {res.confidence}% Схожість
                    </span>
                    <span className="text-xs font-bold text-[#E5E5E5]">{res.recordType}</span>
                    {res.dateExact ? (
                      <span className="text-xs font-mono text-[#B88E3E] bg-[#121212] px-2 py-0.5 rounded border border-[#333333]">
                        {res.dateExact}
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-[#B88E3E]">({res.year} р.)</span>
                    )}
                    {res.socialStatus && (
                      <span className="text-[11px] text-[#A3A3A3] bg-[#262626] px-2 py-0.5 rounded">
                        {res.socialStatus}
                      </span>
                    )}
                  </div>

                  {/* Action buttons for saving this specific record */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {res.savedStatus ? (
                      <span className="px-3 py-1 rounded-md bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Збережено ({res.savedStatus === 'metric' ? 'Метрика' : res.savedStatus === 'person' ? 'Фігурант' : res.savedStatus === 'document' ? 'Речовий доказ' : 'Гіпотеза'})</span>
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleSaveResult(res, 'metric')}
                          className="px-2.5 py-1 bg-[#262626] hover:bg-[#333333] text-[#E5E5E5] border border-[#404040] rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Database className="w-3.5 h-3.5 text-[#B88E3E]" />
                          <span>+ У метрики</span>
                        </button>

                        <button
                          onClick={() => handleSaveResult(res, 'person')}
                          className="px-2.5 py-1 bg-[#262626] hover:bg-[#333333] text-[#E5E5E5] border border-[#404040] rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-[#B88E3E]" />
                          <span>+ У дерево осіб</span>
                        </button>

                        <button
                          onClick={() => handleSaveResult(res, 'document')}
                          className="px-2.5 py-1 bg-[#262626] hover:bg-[#333333] text-[#E5E5E5] border border-[#404040] rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#B88E3E]" />
                          <span>+ У докази</span>
                        </button>

                        <button
                          onClick={() => handleSaveResult(res, 'hypothesis')}
                          className="px-2.5 py-1 bg-[#B88E3E] hover:bg-[#A37B30] text-[#0F0F0F] rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>+ У гіпотези</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Original Transcription display if available */}
                {res.originalTranscription && (
                  <div className="bg-[#121212] p-3 rounded-lg border border-[#262626] text-xs">
                    <span className="block text-[10px] font-bold text-[#8C8C8C] uppercase tracking-wider mb-1">
                      Оригінальна транскрипція (скоропис / першоджерело):
                    </span>
                    <p className="font-serif italic text-[#D4D4D4] leading-relaxed">
                      "{res.originalTranscription}"
                    </p>
                  </div>
                )}

                {/* Grid details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="space-y-1 bg-[#141414] p-3 rounded-lg border border-[#262626]">
                    <span className="block font-bold text-[10px] uppercase text-[#8C8C8C] tracking-wider">Головна особа запису</span>
                    <p className="font-bold text-sm text-[#E5E5E5]">{res.extractedPersonName}</p>
                    <p className="flex items-center gap-1 text-[#8C8C8C] text-[11px] pt-1">
                      <MapPin className="w-3 h-3 text-[#B88E3E] shrink-0" />
                      <span>{res.village}</span>
                    </p>
                  </div>

                  <div className="space-y-1 bg-[#141414] p-3 rounded-lg border border-[#262626]">
                    <span className="block font-bold text-[10px] uppercase text-[#8C8C8C] tracking-wider">Батьки / Куми / Свідки</span>
                    <p className="text-[#E5E5E5] leading-relaxed">{res.parentsOrRelatives}</p>
                  </div>

                  <div className="space-y-1 bg-[#141414] p-3 rounded-lg border border-[#333333]">
                    <span className="block font-bold text-[10px] uppercase text-[#B88E3E] tracking-wider">Зіставлення з родоводом</span>
                    <p className="font-bold text-[#E5E5E5]">
                      {res.matchedPersonName ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{res.matchedPersonName}</span>
                        </span>
                      ) : (
                        <span className="text-[#8C8C8C]">Кандидат на нову родинну гілку</span>
                      )}
                    </p>
                    <p className="text-[11px] text-[#A3A3A3] pt-1 leading-relaxed">{res.linkReason}</p>
                    {res.suggestedKinship && (
                      <span className="inline-block mt-1 text-[10px] font-semibold bg-[#B88E3E]/20 text-[#B88E3E] px-2 py-0.5 rounded">
                        {res.suggestedKinship}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
