import React, { useState, useRef, useEffect } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Layers, 
  FileText, 
  Sparkles, 
  Copy, 
  Check, 
  Eye, 
  Maximize2, 
  ChevronLeft, 
  ChevronRight,
  Upload,
  UserPlus,
  Sliders,
  RotateCw,
  Sun,
  Contrast,
  HelpCircle,
  Download,
  BookOpen
} from 'lucide-react';
import decodedData from '../../data/nyshporka/decoded_frames.json';
import { useGenealogyStore } from '../../stores/useGenealogyStore';
import { HtrEngineVoice, ImageFilters } from './types';
import { PaleoCheatSheet } from './PaleoCheatSheet';

interface NyshporkaViewerProps {
  theme: any;
  initialFrameId?: string;
  initialLineIdx?: number | null;
  onNavigateToReading?: () => void;
}

export const NyshporkaViewer: React.FC<NyshporkaViewerProps> = ({ 
  theme, 
  initialFrameId,
  initialLineIdx,
  onNavigateToReading 
}) => {
  const framesObj = (decodedData as any).frames || {};
  const frameIds = Object.keys(framesObj);
  
  const [currentFrameId, setCurrentFrameId] = useState<string>(initialFrameId || frameIds[0] || '0001');
  const [activeVoice, setActiveVoice] = useState<HtrEngineVoice>('pysar');
  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const [selectedLineIdx, setSelectedLineIdx] = useState<number | null>(initialLineIdx !== undefined ? initialLineIdx : null);
  const [zoom, setZoom] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [showFiltersPanel, setShowFiltersPanel] = useState<boolean>(false);
  const [isCheatSheetOpen, setIsCheatSheetOpen] = useState<boolean>(false);

  // Paleographic Image Filters
  const [filters, setFilters] = useState<ImageFilters>({
    brightness: 100,
    contrast: 100,
    invert: false,
    grayscale: false,
    rotation: 0
  });

  const addPerson = useGenealogyStore(s => s.addPerson);

  // Sync props when user selects another frame from Search or Gazetteer
  useEffect(() => {
    if (initialFrameId && framesObj[initialFrameId]) {
      setCurrentFrameId(initialFrameId);
    }
  }, [initialFrameId]);

  useEffect(() => {
    if (initialLineIdx !== undefined) {
      setSelectedLineIdx(initialLineIdx);
    }
  }, [initialLineIdx]);

  const currentFrame = framesObj[currentFrameId] || {
    id: currentFrameId,
    imageUrl: '/nyshporka/frames/0001.jpg',
    pysarText: '',
    diakText: '',
    skrybaText: '',
    boxes: [],
    size: [2000, 3000]
  };

  // Generate Latin/Polish Skryba transcription fallback if not present
  const skrybaFallback = currentFrame.pysarText
    ? currentFrame.pysarText
        .split('\n')
        .map((line: string) => {
          return line
            .replace(/Дело/g, 'Acta')
            .replace(/Подольская/g, 'Podoliensis')
            .replace(/духовная консисторія/g, 'Consistorium Spirituale')
            .replace(/Долищинскаго Григодія/g, 'Doliszczynski Gregorius')
            .replace(/с\. Линовенькаго/g, 'villa Lipowenkie')
            .replace(/Балискаго уда/g, 'districtus Balcensis')
            .replace(/ноября/g, 'Novembris')
            .replace(/августа/g, 'Augusti');
        })
        .join('\n')
    : '';

  const imageSrc = customImage || currentFrame.imageUrl;
  
  const currentText = activeVoice === 'diak' 
    ? currentFrame.diakText 
    : activeVoice === 'skryba' 
    ? (currentFrame.skrybaText || skrybaFallback)
    : currentFrame.pysarText;

  const lines = (currentText || '').split('\n').filter((l: string) => l.trim().length > 0);
  const diakLines = (currentFrame.diakText || '').split('\n').filter((l: string) => l.trim().length > 0);
  const skrybaLines = (currentFrame.skrybaText || skrybaFallback).split('\n').filter((l: string) => l.trim().length > 0);

  const handleCopy = () => {
    const citation = `[Джерело: ДАХмО 315-1-159, арк. ${currentFrameId}. Декодовано рушієм Нишпорка (HTR), голос: ${activeVoice}]\n\n` + currentText;
    navigator.clipboard.writeText(citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const citation = `====================================================
НИШПОРКА (NYSHPORKA HTR) · АРХІВНИЙ ДЕКОД
Архів: Державний архів Хмельницької області (ДАХмО)
Фонд: 315, Опис: 1, Справа: 159
Аркуш: ${currentFrameId}
Рушій: ${activeVoice}
====================================================

${currentText}
`;
    const blob = new Blob([citation], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dahmo-315-1-159-ark-${currentFrameId}-${activeVoice}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleNextFrame = () => {
    const idx = frameIds.indexOf(currentFrameId);
    if (idx < frameIds.length - 1) {
      setCurrentFrameId(frameIds[idx + 1]);
      setSelectedLineIdx(null);
      setAnalysisResult(null);
      setCustomImage(null);
    }
  };

  const handlePrevFrame = () => {
    const idx = frameIds.indexOf(currentFrameId);
    if (idx > 0) {
      setCurrentFrameId(frameIds[idx - 1]);
      setSelectedLineIdx(null);
      setAnalysisResult(null);
      setCustomImage(null);
    }
  };

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCustomImage(ev.target?.result as string);
      setSelectedLineIdx(null);
      setAnalysisResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerAI = async () => {
    setIsAnalyzing(true);
    try {
      const resp = await fetch('/api/nyshporka/htr-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentContext: `Архівна справа ДАХмО 315-1-159, аркуш ${currentFrameId}. Рукопис XIX ст. (скоропис).`
        })
      });
      const data = await resp.json();
      setAnalysisResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddEntityToTree = (entity: any) => {
    const parts = (entity.name || '').split(' ');
    const lastName = parts[0] || 'Долищинський';
    const firstName = parts[1] || 'Григорій';
    const patronymic = parts[2] || '';

    addPerson({
      id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      firstName,
      lastName,
      patronymic,
      gender: 'M',
      birthYear: parseInt(entity.year) || 1796,
      birthPlace: entity.place || 'с. Липовеньке, Балтський повіт',
      notes: `Знайдено рушієм Нишпорка в архівній справі ДАХмО 315-1-159. Соціальний стан: ${entity.status || 'Священнослужитель/дякон'}. ${entity.role || ''}`,
      isLiving: false,
      researchStatus: 'confirmed'
    });
    alert(`Особу «${entity.name}» успішно додано до вашого родинного дерева!`);
  };

  // Calculate CSS Filter style
  const filterStyle = `
    brightness(${filters.brightness}%) 
    contrast(${filters.contrast}%) 
    ${filters.invert ? 'invert(1) hue-rotate(180deg)' : ''} 
    ${filters.grayscale ? 'grayscale(1)' : ''}
  `.trim();

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className={`p-4 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} flex flex-wrap items-center justify-between gap-3 shadow-sm`}>
        {/* Frame Selection */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1 border border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={handlePrevFrame}
              disabled={frameIds.indexOf(currentFrameId) <= 0}
              className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 cursor-pointer"
              title="Попередній аркуш"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              {customImage ? 'Власний скан' : `Аркуш ${currentFrameId}`}
            </span>
            <button
              type="button"
              onClick={handleNextFrame}
              disabled={frameIds.indexOf(currentFrameId) >= frameIds.length - 1}
              className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 cursor-pointer"
              title="Наступний аркуш"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {frameIds.map((fId) => (
              <button
                key={fId}
                type="button"
                onClick={() => {
                  setCurrentFrameId(fId);
                  setCustomImage(null);
                  setSelectedLineIdx(null);
                  setAnalysisResult(null);
                }}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                  currentFrameId === fId && !customImage
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {fId === '0001' ? 'Титул (0001)' : fId === '0012' ? 'Шлюб (0012)' : 'Резолюція (0015)'}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5 text-amber-500" />
            <span>Завантажити свій скан</span>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleCustomUpload} 
              className="hidden" 
            />
          </label>
        </div>

        {/* Voice and View Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Voices Selector */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1 border border-neutral-200 dark:border-neutral-700 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveVoice('pysar')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeVoice === 'pysar'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
              title="PySar: кириличний скоропис канцелярій та метрик XVIII-XIX ст."
            >
              Писар (скоропис)
            </button>
            <button
              type="button"
              onClick={() => setActiveVoice('diak')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeVoice === 'diak'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
              title="Diak: уставні та півуставні церковнослов'янські тексти"
            >
              Дяк (устав)
            </button>
            <button
              type="button"
              onClick={() => setActiveVoice('skryba')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeVoice === 'skryba'
                  ? 'bg-purple-600 text-white font-bold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
              title="Skryba: латинка, польські нотаріальні та костельні акти"
            >
              Скриба (латинка)
            </button>
            <button
              type="button"
              onClick={() => setActiveVoice('diff')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeVoice === 'diff'
                  ? 'bg-sky-600 text-white font-bold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
              title="Порівняти два голоси (консенсус та розбіжності)"
            >
              Порівняння
            </button>
          </div>

          {/* Line Boxes Toggle */}
          <button
            type="button"
            onClick={() => setShowBoxes(!showBoxes)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
              showBoxes 
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400' 
                : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Рядки {showBoxes ? 'увімкнено' : 'вимкнено'}</span>
          </button>

          {/* Paleographic Image Filters Button */}
          <button
            type="button"
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
              showFiltersPanel || filters.invert || filters.grayscale || filters.contrast !== 100 || filters.rotation !== 0
                ? 'bg-purple-500/15 border-purple-500/40 text-purple-600 dark:text-purple-300'
                : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
            }`}
            title="Налаштувати фільтри скану"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Палеофільтри</span>
          </button>

          {/* Paleography Cheat Sheet Trigger */}
          <button
            type="button"
            onClick={() => setIsCheatSheetOpen(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:text-amber-500 flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Відкрити довідник скорописних літер та скорочень"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Шпаргалка</span>
          </button>
        </div>
      </div>

      {/* Expandable Image Filters Toolbar */}
      {showFiltersPanel && (
        <div className={`p-3 rounded-2xl ${theme.cardBg} border border-purple-500/30 shadow-sm flex flex-wrap items-center gap-4 text-xs`}>
          <span className="font-semibold text-purple-600 dark:text-purple-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5" />
            Фільтри пергаменту:
          </span>

          {/* Invert / Negative (reveals faded iron gall ink) */}
          <button
            type="button"
            onClick={() => setFilters(f => ({ ...f, invert: !f.invert }))}
            className={`px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-colors ${
              filters.invert 
                ? 'bg-purple-600 text-white border-purple-600' 
                : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            Негатив (біле на темному)
          </button>

          {/* Grayscale */}
          <button
            type="button"
            onClick={() => setFilters(f => ({ ...f, grayscale: !f.grayscale }))}
            className={`px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-colors ${
              filters.grayscale 
                ? 'bg-neutral-800 text-white border-neutral-800' 
                : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            Ч/Б (прибрати жовтизну)
          </button>

          {/* Contrast */}
          <div className="flex items-center gap-1.5">
            <Contrast className="w-3.5 h-3.5 text-neutral-400" />
            <span>Контраст:</span>
            <button
              type="button"
              onClick={() => setFilters(f => ({ ...f, contrast: f.contrast === 100 ? 140 : f.contrast === 140 ? 180 : 100 }))}
              className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 font-mono"
            >
              {filters.contrast}%
            </button>
          </div>

          {/* Rotate 90 deg */}
          <button
            type="button"
            onClick={() => setFilters(f => ({ ...f, rotation: (f.rotation + 90) % 360 }))}
            className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-1 cursor-pointer"
            title="Повернути на 90 градусів"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Поворот ({filters.rotation}°)</span>
          </button>

          {/* Reset Filters */}
          <button
            type="button"
            onClick={() => setFilters({ brightness: 100, contrast: 100, invert: false, grayscale: false, rotation: 0 })}
            className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline cursor-pointer ml-auto"
          >
            Скинути фільтри
          </button>
        </div>
      )}

      {/* Main Split Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[620px]">
        {/* Left Column: Interactive Image Stage */}
        <div className={`lg:col-span-7 p-4 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} flex flex-col shadow-sm relative overflow-hidden`}>
          {/* Zoom Toolbar */}
          <div className="absolute top-6 left-6 z-20 flex items-center gap-1 bg-slate-950/80 backdrop-blur-md text-white p-1 rounded-xl border border-white/10 shadow-lg">
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
              className="p-1.5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
              title="Збільшити"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
              className="p-1.5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
              title="Зменшити"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="p-1.5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
              title="Скинути масштаб"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <span className="px-2 text-[11px] font-mono font-medium">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="text-[11px] text-neutral-400 font-mono absolute top-6 right-6 z-20 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-white/10">
            {customImage ? 'Завантажене фото' : 'ДАХмО 315-1-159 (1821-1822)'}
          </div>

          {/* Canvas / Image Container */}
          <div className="flex-1 w-full h-full min-h-[520px] bg-neutral-950 rounded-xl overflow-auto flex items-center justify-center p-4 relative select-none">
            <div 
              className="relative transition-transform duration-150 origin-center"
              style={{ 
                transform: `scale(${zoom}) rotate(${filters.rotation}deg)`,
                filter: filterStyle
              }}
            >
              <img 
                src={imageSrc} 
                alt="Архівний скан" 
                className="max-h-[600px] w-auto object-contain rounded-md shadow-2xl pointer-events-none"
              />

              {/* Render Bounding Boxes on the Image */}
              {showBoxes && currentFrame.boxes && currentFrame.boxes.length > 0 && !customImage && (
                <div className="absolute inset-0 pointer-events-auto">
                  {currentFrame.boxes.map((box: [number, number, number, number], idx: number) => {
                    const [ymin, xmin, ymax, xmax] = box;
                    const imgW = currentFrame.size?.[0] || 2000;
                    const imgH = currentFrame.size?.[1] || 3000;

                    const topPct = (ymin / imgH) * 100;
                    const leftPct = (xmin / imgW) * 100;
                    const widthPct = ((xmax - xmin) / imgW) * 100;
                    const heightPct = ((ymax - ymin) / imgH) * 100;

                    const isSelected = selectedLineIdx === idx;

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedLineIdx(idx)}
                        className={`absolute cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-amber-500/35 border-amber-400 shadow-md ring-2 ring-amber-400/50 z-30'
                            : 'bg-amber-500/10 border-amber-400/40 hover:bg-amber-500/25 hover:border-amber-400 z-10'
                        }`}
                        style={{
                          top: `${topPct}%`,
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`
                        }}
                        title={`Рядок ${idx + 1}: ${lines[idx] || ''}`}
                      >
                        <span className="absolute -top-3.5 -left-1 text-[9px] font-mono px-1 rounded bg-amber-500 text-slate-950 font-bold opacity-0 hover:opacity-100 transition-opacity">
                          {idx + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Transcription & Entities */}
        <div className={`lg:col-span-5 p-5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} flex flex-col shadow-sm space-y-4`}>
          {/* Header of Text Box */}
          <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
            <div>
              <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                {activeVoice === 'pysar' 
                  ? 'Рушій PySar: скоропис' 
                  : activeVoice === 'diak' 
                  ? 'Рушій Diak: устав' 
                  : activeVoice === 'skryba'
                  ? 'Рушій Skryba: латинка'
                  : 'Порівняння голосів'}
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {lines.length} рядків розпізнано з архівного оригіналу
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="p-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Завантажити TXT з архівним шифром"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="p-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Копіювати текст з цитатою"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handleTriggerAI}
                disabled={isAnalyzing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isAnalyzing ? 'Аналізую...' : 'ШІ-розбір'}
              </button>
            </div>
          </div>

          {/* Lines List View */}
          <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2 pr-1">
            {lines.map((line: string, idx: number) => {
              const isSelected = selectedLineIdx === idx;
              const diakLine = diakLines[idx] || '';
              const isDiff = activeVoice === 'diff' && line !== diakLine;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedLineIdx(isSelected ? null : idx)}
                  className={`p-2.5 rounded-xl text-xs font-serif leading-relaxed border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 text-neutral-900 dark:text-neutral-100 ring-1 ring-amber-500'
                      : isDiff
                      ? 'bg-purple-500/10 border-purple-500/30 text-purple-900 dark:text-purple-200'
                      : 'bg-neutral-50 dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0 mt-0.5 select-none w-5">
                      {idx + 1}.
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="text-neutral-900 dark:text-neutral-100 font-medium">
                        {line}
                      </div>
                      {activeVoice === 'diff' && diakLine && (
                        <div className="text-[11px] text-purple-600 dark:text-purple-400 font-sans border-t border-purple-500/20 pt-1">
                          <span className="font-mono text-[9px] uppercase font-bold text-neutral-400 mr-1">Diak:</span>
                          {diakLine}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* AI Extraction Panel */}
          {analysisResult && (
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300">
                  <Sparkles className="w-4 h-4" />
                  Виявлені особи та факти з рукопису
                </div>
              </div>

              {analysisResult.modernUkrainian && (
                <div className="text-xs text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 leading-relaxed font-sans">
                  <span className="font-bold text-[10px] uppercase text-neutral-400 block mb-1">
                    Сучасний переклад:
                  </span>
                  {analysisResult.modernUkrainian}
                </div>
              )}

              {analysisResult.entities && analysisResult.entities.length > 0 && (
                <div className="space-y-2">
                  {analysisResult.entities.map((ent: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-bold text-neutral-900 dark:text-neutral-100">
                          {ent.name}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {ent.role} · {ent.status} · {ent.place} ({ent.year} р.)
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddEntityToTree(ent)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition-colors cursor-pointer shrink-0"
                        title="Додати до родоводу"
                      >
                        <UserPlus className="w-3 h-3" />
                        У Родовід
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Paleography Reference / Cheat Sheet Modal */}
      <PaleoCheatSheet
        theme={theme}
        isOpen={isCheatSheetOpen}
        onClose={() => setIsCheatSheetOpen(false)}
      />
    </div>
  );
};
