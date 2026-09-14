import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Check, RotateCcw, Sparkles, Image as ImageIcon, ZoomIn, Move } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { TreeOfLifeEmblem } from './TreeOfLifeEmblem';

interface EmblemManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmblemManagerModal: React.FC<EmblemManagerModalProps> = ({ isOpen, onClose }) => {
  const customEmblemImage = useUIStore((s) => s.customEmblemImage);
  const setCustomEmblemImage = useUIStore((s) => s.setCustomEmblemImage);

  const [rawImage, setRawImage] = useState<string | null>(null);
  const [removeBg, setRemoveBg] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1.28); // Default zoom slightly inwards to exclude outer bail
  const [offsetY, setOffsetY] = useState<number>(14); // Offset down slightly to focus on circular medallion
  const [offsetX, setOffsetX] = useState<number>(0);
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setRawImage(null);
      setProcessedPreview(null);
    }
  }, [isOpen]);

  // Process image whenever rawImage, removeBg, zoom, or offset changes
  useEffect(() => {
    if (!rawImage) {
      setProcessedPreview(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current || document.createElement('canvas');
      const size = 400;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, size, size);

      // We want a circular emblem. Let's create a circular clip path
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Draw the image scaled and translated
      // Default: the medallion is usually centered horizontally, but lower than center due to the bail
      const scale = (size / Math.min(img.width, img.height)) * zoom;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = (size - drawW) / 2 + offsetX * (size / 100);
      const dy = (size - drawH) / 2 + offsetY * (size / 100);

      ctx.drawImage(img, dx, dy, drawW, drawH);
      ctx.restore();

      // Optional background removal (make pure white/off-white transparent)
      if (removeBg) {
        const imgData = ctx.getImageData(0, 0, size, size);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a === 0) continue;

          // If pixel is white or near-white background (> 235 brightness and low saturation)
          const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
          const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));

          if (brightness > 230 && maxDiff < 20) {
            // Smooth alpha falloff for antialiasing
            const fade = Math.max(0, Math.min(1, (255 - brightness) / 25));
            data[i + 3] = Math.round(a * fade);
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }

      setProcessedPreview(canvas.toDataURL('image/png'));
    };
    img.src = rawImage;
  }, [rawImage, removeBg, zoom, offsetY, offsetX]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setRawImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApply = () => {
    if (processedPreview) {
      setCustomEmblemImage(processedPreview);
      onClose();
    }
  };

  const handleResetToDefault = () => {
    setCustomEmblemImage(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#1A1D24] border border-[#2E3542] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2E3542] flex items-center justify-between bg-[#15181F]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-neutral-100">Емблема родоводу: Дерево Життя</h3>
              <p className="text-xs text-neutral-400">Завантажте ваш оригінальний малюнок зі знімка</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Live Preview Area */}
          <div className="flex flex-col items-center justify-center p-6 bg-[#111317] border border-[#2E3542] rounded-xl relative">
            <div className="w-32 h-32 rounded-full border-2 border-dashed border-amber-500/40 p-1 flex items-center justify-center bg-[#1A1D24] shadow-inner relative overflow-hidden">
              {processedPreview ? (
                <img
                  src={processedPreview}
                  alt="Оброблена емблема"
                  className="w-full h-full object-contain rounded-full drop-shadow-md"
                />
              ) : customEmblemImage ? (
                <img
                  src={customEmblemImage}
                  alt="Поточна емблема"
                  className="w-full h-full object-contain rounded-full drop-shadow-md"
                />
              ) : (
                <TreeOfLifeEmblem className="w-full h-full" />
              )}
            </div>

            <span className="text-xs text-neutral-400 mt-3 font-medium">
              {rawImage
                ? 'Попередній перегляд вашої емблеми'
                : customEmblemImage
                ? 'Ваше завантажене зображення встановлено'
                : 'Поточне векторне дерево'}
            </span>
          </div>

          {/* Upload Button */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              type="button"
              className="w-full py-2.5 px-4 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99]"
            >
              <Upload className="w-4 h-4" />
              <span>{rawImage ? 'Обрати інший файл малюнка' : 'Завантажити ваш малюнок (image.png)'}</span>
            </button>
            <p className="text-[11px] text-neutral-400 text-center mt-1.5">
              Підтримуються формати PNG, JPG або WEBP прямо з вашого пристрою
            </p>
          </div>

          {/* Adjustments (visible when an image is loaded) */}
          {rawImage && (
            <div className="space-y-3 p-3.5 bg-[#14161B] rounded-xl border border-[#2E3542] text-xs">
              <div className="flex items-center justify-between text-neutral-300 font-medium pb-1 border-b border-[#242933]">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Налаштування кадрування
                </span>
                <span className="text-[10px] text-amber-400/80">Оберіть дерево в колі</span>
              </div>

              {/* Transparent background toggle */}
              <label className="flex items-center justify-between cursor-pointer py-1">
                <span className="text-neutral-300">Прозорий фон (прибрати білий)</span>
                <input
                  type="checkbox"
                  checked={removeBg}
                  onChange={(e) => setRemoveBg(e.target.checked)}
                  className="rounded border-[#3E4554] text-amber-500 focus:ring-amber-500 bg-neutral-800"
                />
              </label>

              {/* Zoom control */}
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400">
                  <span className="flex items-center gap-1"><ZoomIn className="w-3 h-3" /> Масштаб (кадрування)</span>
                  <span>{Math.round(zoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="2.0"
                  step="0.02"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Vertical center offset (to cut out bail at top) */}
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400">
                  <span className="flex items-center gap-1"><Move className="w-3 h-3" /> Зсув вертикально (центр дерева)</span>
                  <span>{offsetY}%</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={offsetY}
                  onChange={(e) => setOffsetY(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#2E3542] bg-[#15181F] flex items-center justify-between gap-3">
          {customEmblemImage ? (
            <button
              onClick={handleResetToDefault}
              type="button"
              className="py-2 px-3 text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Скинути малюнок</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              type="button"
              className="py-2 px-3.5 text-xs text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors font-medium"
            >
              Скасувати
            </button>
            {rawImage && (
              <button
                onClick={handleApply}
                type="button"
                className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-md"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Застосувати малюнок</span>
              </button>
            )}
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
