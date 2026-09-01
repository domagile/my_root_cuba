/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  ExternalLink,
  Download,
  RotateCcw,
  BookOpen,
  Calendar,
  FileText,
  Lock,
  Layers,
  Archive,
  Info
} from 'lucide-react';
import { parseDocumentViewerUrl } from '../../services/githubService';
import { PersonDocumentItem } from '../../types';

interface DocumentLightboxModalProps {
  document: PersonDocumentItem | {
    title: string;
    url: string;
    type?: string;
    storageType?: string;
    year?: string | number;
    archiveRef?: string;
    page?: string;
    notes?: string;
    githubPath?: string;
  };
  personName?: string;
  onClose: () => void;
}

export const DocumentLightboxModal: React.FC<DocumentLightboxModalProps> = ({
  document,
  personName,
  onClose
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMetadata, setShowMetadata] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const parsed = parseDocumentViewerUrl(document.url);

  // Reset transform
  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Keyboard navigation & zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setScale((s) => Math.min(s + 0.25, 5));
      if (e.key === '-' || e.key === '_') setScale((s) => Math.max(s - 0.25, 0.5));
      if (e.key === '0') handleReset();
      if (e.key === 'r' || e.key === 'R') setRotation((r) => (r + 90) % 360);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (e.deltaY < 0) {
      setScale((s) => Math.min(s + 0.15, 5));
    } else {
      setScale((s) => Math.max(s - 0.15, 0.5));
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (window.document.exitFullscreen) {
        window.document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  const storageBadge = () => {
    const storageType = document.storageType || (parsed.type === 'gdrive' ? 'gdrive' : parsed.type === 'github' ? 'github' : 'external');
    if (storageType === 'gdrive') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
          <Lock className="w-3 h-3 text-blue-400" /> Google Drive (Приватне)
        </span>
      );
    }
    if (storageType === 'github') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30">
          <Archive className="w-3 h-3 text-purple-400" /> GitHub Архів
        </span>
      );
    }
    if (storageType === 'firestore') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
          <Layers className="w-3 h-3 text-amber-400" /> База даних Firestore
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-neutral-500/20 text-neutral-300 border border-neutral-400/30">
        <FileText className="w-3 h-3" /> Зовнішній документ
      </span>
    );
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-70 bg-black/90 backdrop-blur-md flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-200"
    >
      {/* Top Header Bar */}
      <div className="p-3 sm:p-4 bg-black/60 border-b border-white/10 flex items-center justify-between gap-3 text-white shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#B88E3E] shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base truncate text-white">
                {document.title || 'Архівний документ'}
              </h3>
              {storageBadge()}
            </div>
            {personName && (
              <p className="text-xs text-neutral-400 truncate">
                Особа: <span className="text-neutral-200 font-semibold">{personName}</span>
                {document.year && ` • ${document.year} р.`}
              </p>
            )}
          </div>
        </div>

        {/* Toolbar buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className={`p-2 rounded-xl text-xs transition-colors ${showMetadata ? 'bg-white/20 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`}
            title="Інформація про документ"
          >
            <Info className="w-4 h-4" />
          </button>

          <a
            href={document.url}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Відкрити оригінал у новій вкладці"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Повноекранний режим"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 text-neutral-300 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer ml-1"
            title="Закрити (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-neutral-950/80 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        {parsed.type === 'gdrive' && !document.url.includes('googleusercontent.com') ? (
          <div className="w-full h-full p-2 sm:p-4 flex items-center justify-center">
            <iframe
              src={parsed.previewUrl}
              title={document.title || 'Google Drive Document'}
              className="w-full h-full max-w-5xl rounded-xl border border-white/20 shadow-2xl bg-black"
              allow="autoplay"
            />
          </div>
        ) : (
          <div
            className="transition-transform duration-75 origin-center flex items-center justify-center max-w-full max-h-full"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`
            }}
          >
            <img
              src={parsed.displayUrl}
              alt={document.title || 'Архівний скан'}
              className="max-w-[90vw] max-h-[75vh] object-contain rounded-lg shadow-2xl pointer-events-none select-none border border-white/10"
              onError={(e) => {
                // If direct image fails and it's Google Drive, fallback to preview iframe
                const target = e.target as HTMLImageElement;
                if (parsed.type === 'gdrive') {
                  target.style.display = 'none';
                }
              }}
            />
          </div>
        )}

        {/* Side Metadata Inspector Drawer */}
        {showMetadata && (
          <div className="absolute right-4 top-4 max-w-xs w-full bg-black/80 backdrop-blur-md border border-white/15 rounded-2xl p-4 text-white text-xs space-y-3 shadow-2xl animate-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="font-bold text-neutral-300">Архівні відомості</span>
              <button
                onClick={() => setShowMetadata(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-[11px]">
              <div>
                <span className="text-neutral-400 block">Назва:</span>
                <span className="font-semibold text-white">{document.title || '—'}</span>
              </div>

              {document.type && (
                <div>
                  <span className="text-neutral-400 block">Тип документа:</span>
                  <span className="capitalize text-amber-400">{document.type}</span>
                </div>
              )}

              {document.year && (
                <div>
                  <span className="text-neutral-400 block">Рік складання:</span>
                  <span className="font-mono text-emerald-400">{document.year}</span>
                </div>
              )}

              {document.archiveRef && (
                <div>
                  <span className="text-neutral-400 block">Архівний шифр:</span>
                  <span className="font-mono text-neutral-200 bg-white/10 px-2 py-0.5 rounded inline-block mt-0.5">
                    {document.archiveRef}
                  </span>
                </div>
              )}

              {document.page && (
                <div>
                  <span className="text-neutral-400 block">Аркуш / Сторінка:</span>
                  <span className="font-mono text-neutral-300">{document.page}</span>
                </div>
              )}

              {document.githubPath && (
                <div>
                  <span className="text-neutral-400 block">Шлях у GitHub репозиторії:</span>
                  <code className="text-[10px] text-purple-300 block break-all bg-purple-950/50 p-1 rounded border border-purple-800/40 mt-0.5">
                    {document.githubPath}
                  </code>
                </div>
              )}

              {document.notes && (
                <div>
                  <span className="text-neutral-400 block">Примітки / Розшифровка:</span>
                  <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap bg-white/5 p-2 rounded mt-0.5">
                    {document.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="p-3 sm:p-4 bg-black/60 border-t border-white/10 flex items-center justify-center gap-2 text-white shrink-0 z-10">
        <div className="flex items-center gap-1 sm:gap-2 bg-neutral-900/90 border border-white/15 px-3 py-1.5 rounded-2xl shadow-xl">
          <button
            onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
            className="p-2 rounded-xl hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
            title="Зменшити (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="font-mono text-xs px-2 text-neutral-300 min-w-14 text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={() => setScale((s) => Math.min(s + 0.25, 5))}
            className="p-2 rounded-xl hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
            title="Збільшити (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-white/20 mx-1" />

          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-2 rounded-xl hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
            title="Повернути на 90° (R)"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleReset}
            className="p-2 rounded-xl hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
            title="Скинути масштаб і орієнтацію (0)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
