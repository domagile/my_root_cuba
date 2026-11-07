/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  FileText,
  User,
  Calendar,
  MapPin,
  Check,
  Copy,
  Users,
  Award,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { Person, PersonDocumentItem } from '../../types';
import { useGenealogy } from '../../context/GenealogyContext';
import { transcribeMetricImageWithAI, RecognizedMetricItem } from '../../services/metricOcrService';

interface MetricOcrAssistantModalProps {
  imageUrl: string;
  documentTitle?: string;
  documentItem?: PersonDocumentItem;
  currentPerson?: Person;
  personName?: string;
  onClose: () => void;
  onApplyDataToPerson?: (extracted: {
    personId?: string;
    birthDate?: string;
    birthYear?: number;
    birthPlace?: string;
    estate?: string;
    notes?: string;
    transcription?: string;
    eventTarget?: 'birth' | 'marriage' | 'death' | 'other';
    scanUrl?: string;
  }) => void;
}

export const MetricOcrAssistantModal: React.FC<MetricOcrAssistantModalProps> = ({
  imageUrl,
  documentTitle,
  documentItem,
  currentPerson,
  personName,
  onClose,
  onApplyDataToPerson
}) => {
  const { persons, updatePerson } = useGenealogy();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RecognizedMetricItem[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'entities' | 'transcription' | 'diff'>('entities');
  const [appliedSuccessfully, setAppliedSuccessfully] = useState(false);
  const [copied, setCopied] = useState(false);

  // Selected target person to update
  const [targetPersonId, setTargetPersonId] = useState<string>(currentPerson?.id || '');

  // Run transcription automatically or manually
  const runOcr = async () => {
    setIsLoading(true);
    setError(null);
    setAppliedSuccessfully(false);

    try {
      const response = await transcribeMetricImageWithAI({
        imageUrl,
        recordTypeHint: documentItem?.eventTarget || documentItem?.type || 'metric',
        existingPersons: persons
      });

      if (response.success && response.results.length > 0) {
        setResults(response.results);
        setSelectedResultIndex(0);
        // If matched person identified, pick them if no current person
        if (!targetPersonId && response.results[0].matchedPersonId) {
          setTargetPersonId(response.results[0].matchedPersonId);
        }
      } else {
        setError(response.error || 'Не вдалося витягти структуровані дані з даного скану.');
      }
    } catch (err: any) {
      setError(err.message || 'Помилка звернення до ШІ-помічника.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runOcr();
  }, [imageUrl]);

  const currentResult: RecognizedMetricItem | undefined = results[selectedResultIndex];
  const targetPerson = persons.find((p) => p.id === targetPersonId) || currentPerson;

  // 1-Click apply to person card
  const handleApplyToPerson = () => {
    if (!currentResult) return;

    const personToUpdate = targetPerson;
    if (!personToUpdate) {
      setError('Оберіть особу в дереві для застосування знайдених даних.');
      return;
    }

    const yearNum = currentResult.year ? parseInt(currentResult.year.replace(/\D/g, ''), 10) : undefined;
    const isBirth = currentResult.recordType.toLowerCase().includes('народжен') || currentResult.recordType.toLowerCase().includes('birth');
    const isMarriage = currentResult.recordType.toLowerCase().includes('шлюб') || currentResult.recordType.toLowerCase().includes('marriage');
    const isDeath = currentResult.recordType.toLowerCase().includes('смерт') || currentResult.recordType.toLowerCase().includes('death');

    const eventTarget = isBirth ? 'birth' : isMarriage ? 'marriage' : isDeath ? 'death' : 'other';

    // Enrich notes with archive metric transcription
    const newNoteLine = `[ШІ-витяг з метрики (${currentResult.year || ''})]: ${currentResult.originalTranscription || currentResult.extractedPersonName}. Батьки/хрещені: ${currentResult.parentsOrRelatives || '—'}. Місце: ${currentResult.village || '—'}.`;
    const updatedNotes = personToUpdate.notes
      ? `${personToUpdate.notes}\n\n${newNoteLine}`
      : newNoteLine;

    // Build updated fields
    const updatedPerson: Person = {
      ...personToUpdate,
      notes: updatedNotes,
      estate: currentResult.socialStatus || personToUpdate.estate
    };

    if (isBirth) {
      if (!personToUpdate.birthDate && currentResult.dateExact) {
        updatedPerson.birthDate = currentResult.dateExact;
      }
      if (!personToUpdate.birthYear && yearNum && !isNaN(yearNum)) {
        updatedPerson.birthYear = yearNum;
      }
      if (!personToUpdate.birthPlace && currentResult.village) {
        updatedPerson.birthPlace = currentResult.village;
      }
      updatedPerson.birthScanUrl = imageUrl;
      updatedPerson.birthScanTitle = documentTitle || `Метричний запис про народження (${currentResult.year || ''})`;
    } else if (isMarriage) {
      if (!personToUpdate.marriageDate && currentResult.dateExact) {
        updatedPerson.marriageDate = currentResult.dateExact;
      }
      if (!personToUpdate.marriagePlace && currentResult.village) {
        updatedPerson.marriagePlace = currentResult.village;
      }
      updatedPerson.marriageScanUrl = imageUrl;
      updatedPerson.marriageScanTitle = documentTitle || `Метричний запис про шлюб (${currentResult.year || ''})`;
    } else if (isDeath) {
      if (!personToUpdate.deathDate && currentResult.dateExact) {
        updatedPerson.deathDate = currentResult.dateExact;
      }
      if (!personToUpdate.deathYear && yearNum && !isNaN(yearNum)) {
        updatedPerson.deathYear = yearNum;
      }
      if (!personToUpdate.deathPlace && currentResult.village) {
        updatedPerson.deathPlace = currentResult.village;
      }
      updatedPerson.deathScanUrl = imageUrl;
      updatedPerson.deathScanTitle = documentTitle || `Метричний запис про смерть (${currentResult.year || ''})`;
    }

    // Attach transcription to documentItem if available
    if (documentItem && updatedPerson.documents) {
      updatedPerson.documents = updatedPerson.documents.map((d) =>
        d.url === imageUrl || d.id === documentItem.id
          ? {
              ...d,
              transcription: currentResult.originalTranscription || d.transcription,
              eventTarget: eventTarget as any
            }
          : d
      );
    }

    updatePerson(updatedPerson);

    if (onApplyDataToPerson) {
      onApplyDataToPerson({
        personId: updatedPerson.id,
        birthDate: currentResult.dateExact,
        birthYear: yearNum,
        birthPlace: currentResult.village,
        estate: currentResult.socialStatus,
        notes: updatedNotes,
        transcription: currentResult.originalTranscription,
        eventTarget,
        scanUrl: imageUrl
      });
    }

    setAppliedSuccessfully(true);
  };

  const handleCopyTranscription = () => {
    if (!currentResult) return;
    const textToCopy = `[Метричний запис: ${currentResult.recordType}]\nОсоба: ${currentResult.extractedPersonName}\nДата: ${currentResult.dateExact || currentResult.year}\nМісце: ${currentResult.village}\nСтан: ${currentResult.socialStatus || '—'}\nБатьки/хрещені: ${currentResult.parentsOrRelatives}\n\nОригінальний текст:\n${currentResult.originalTranscription || '—'}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-80 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-700/60 rounded-3xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-neutral-950/90 border-b border-white/10 flex items-center justify-between gap-3 text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white truncate">
                  ШІ-помічник розшифровки метрик та скоропису
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Gemini Vision HTR
                </span>
              </div>
              <p className="text-xs text-neutral-400 truncate">
                {documentTitle || 'Архівний скан метричної книги або ревізії'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={runOcr}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Перезапустити розпізнавання"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Пересканувати</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 text-neutral-300 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Column: Image Scan View (5 cols) */}
          <div className="lg:col-span-5 bg-black/60 p-4 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-white/10 relative overflow-hidden group">
            <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-[11px] font-mono text-neutral-300 border border-white/10 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Архівний першоджерело</span>
            </div>

            <div className="w-full h-full flex items-center justify-center p-2 overflow-auto">
              <img
                src={imageUrl}
                alt="Архівний скан для OCR"
                className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl border border-white/10 transition-transform duration-200 group-hover:scale-[1.01]"
              />
            </div>

            <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between text-[11px] text-neutral-400 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
              <span>Палеографічний аналіз скоропису</span>
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                <span>Оригінал</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Right Column: OCR Results & Extraction (7 cols) */}
          <div className="lg:col-span-7 flex flex-col bg-neutral-900 overflow-hidden">
            {/* Target Person Selector Bar */}
            <div className="p-3.5 bg-neutral-950/60 border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-neutral-300">Прив'язати результат до особи:</span>
              </div>

              <select
                value={targetPersonId}
                onChange={(e) => setTargetPersonId(e.target.value)}
                className="bg-neutral-800 text-white text-xs rounded-xl px-3 py-1.5 border border-white/15 focus:outline-none focus:ring-2 focus:ring-amber-500 max-w-xs"
              >
                <option value="">-- Оберіть особу з родоводу --</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name?.surname || p.lastName || ''} {p.name?.given || p.firstName || ''} {p.birthYear ? `(${p.birthYear} р.)` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Content / Loading State */}
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
                  <Sparkles className="w-6 h-6 text-amber-400 absolute inset-0 m-auto animate-pulse" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h4 className="font-bold text-white text-base">Розшифровка скоропису та аналіз запису...</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    ШІ-палеограф розпізнає рукописний текст, нормалізує дореформені та церковнослов'янські літери, знаходить згадки батьків, хрещених та зіставляє з персонами вашого родоводу.
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <AlertCircle className="w-12 h-12 text-rose-500" />
                <h4 className="font-bold text-white text-sm">Не вдалося розпізнати запис</h4>
                <p className="text-xs text-rose-300 max-w-md">{error}</p>
                <button
                  onClick={runOcr}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all"
                >
                  Спробувати ще раз
                </button>
              </div>
            ) : currentResult ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Result Selector (if multiple entries found in 1 metric page) */}
                {results.length > 1 && (
                  <div className="p-2.5 bg-neutral-950/40 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto shrink-0">
                    <span className="text-[11px] font-bold text-neutral-400 px-2 shrink-0">
                      Знайдено записів ({results.length}):
                    </span>
                    {results.map((res, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedResultIndex(idx)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                          selectedResultIndex === idx
                            ? 'bg-amber-500 text-black font-bold'
                            : 'bg-white/5 text-neutral-300 hover:bg-white/10'
                        }`}
                      >
                        #{idx + 1} {res.extractedPersonName || 'Особа'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Subtabs: Entities vs Transcription */}
                <div className="p-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0 bg-neutral-950/20">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setActiveTab('entities')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'entities'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Ключові факти (Сутності)
                    </button>
                    <button
                      onClick={() => setActiveTab('transcription')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'transcription'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Транскрипція скоропису
                    </button>
                  </div>

                  <button
                    onClick={handleCopyTranscription}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Скопійовано' : 'Скопіювати'}</span>
                  </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Kinship & Match Banner */}
                  {currentResult.matchedPersonName && (
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="font-bold text-white">
                            Знайдено збіг у родинному дереві: {currentResult.matchedPersonName}
                          </strong>
                          <span className="px-2 py-0.2 rounded-full font-bold bg-emerald-500/20 text-emerald-300 text-[10px]">
                            {currentResult.confidence}% впевненості
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-300/80 leading-relaxed">
                          {currentResult.linkReason}
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'entities' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Person Card */}
                      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                          <User className="w-3 h-3 text-amber-400" /> Головна особа
                        </span>
                        <div className="font-bold text-white text-sm">
                          {currentResult.extractedPersonName || 'Не вказано'}
                        </div>
                        {currentResult.socialStatus && (
                          <div className="text-[11px] text-amber-300">
                            Стан: <span className="font-medium text-white">{currentResult.socialStatus}</span>
                          </div>
                        )}
                      </div>

                      {/* Date & Record Type */}
                      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-400" /> Тип запису та дата
                        </span>
                        <div className="font-bold text-white text-sm">
                          {currentResult.recordType}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono">
                          {currentResult.dateExact || `${currentResult.year} рік`}
                        </div>
                      </div>

                      {/* Geography */}
                      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1 sm:col-span-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-amber-400" /> Село, парафія, повіт
                        </span>
                        <div className="text-xs font-semibold text-neutral-200">
                          {currentResult.village || 'Не зазначено'}
                        </div>
                      </div>

                      {/* Parents / Relatives / Godparents */}
                      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1 sm:col-span-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                          <Users className="w-3 h-3 text-amber-400" /> Батьки, хрещені (куми), свідки
                        </span>
                        <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap">
                          {currentResult.parentsOrRelatives || 'Не виявлено додаткових родичів'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Transcription text */
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5" /> Автентичний витяг з метрики:
                          </span>
                        </div>
                        <p className="font-serif text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap bg-white/5 p-3 rounded-xl border border-white/5">
                          {currentResult.originalTranscription || 'Транскрипція першоджерела формується...'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Success notification after applying */}
                  {appliedSuccessfully && (
                    <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Дані успішно внесені до картки особи <strong>{targetPerson?.lastName} {targetPerson?.firstName}</strong>, а скан прикріплено до події!
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer Apply Bar */}
                <div className="p-4 bg-neutral-950/90 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <div className="text-xs text-neutral-400">
                    {targetPerson ? (
                      <span>
                        Застосувати до: <strong className="text-white">{targetPerson.lastName || ''} {targetPerson.firstName || ''}</strong>
                      </span>
                    ) : (
                      <span className="text-amber-400">Оберіть особу вгорі для прив'язки даних</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Закрити
                    </button>

                    <button
                      type="button"
                      onClick={handleApplyToPerson}
                      disabled={!targetPerson}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Застосувати до картки особи (1-клік)</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
