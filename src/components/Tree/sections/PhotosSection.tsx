/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Camera, ChevronDown, Check, Trash2 } from 'lucide-react';

interface PhotosSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  photosList: string[];
  onChangePhotosList: (photos: string[]) => void;
  avatarUrl: string;
  onChangeAvatarUrl: (url: string) => void;
  isReadOnly?: boolean;
  theme: any;
}

export const PhotosSection: React.FC<PhotosSectionProps> = ({
  isOpen,
  onToggle,
  photosList,
  onChangePhotosList,
  avatarUrl,
  onChangeAvatarUrl,
  isReadOnly = false,
  theme
}) => {
  const [showPhotoUrlInput, setShowPhotoUrlInput] = useState(false);
  const [newPhotoUrlInput, setNewPhotoUrlInput] = useState('');

  const handleAddPhotoUrl = () => {
    if (!newPhotoUrlInput.trim()) return;
    const url = newPhotoUrlInput.trim();
    if (!avatarUrl) {
      onChangeAvatarUrl(url);
    }
    onChangePhotosList(Array.from(new Set([...photosList, url])));
    setNewPhotoUrlInput('');
    setShowPhotoUrlInput(false);
  };

  return (
    <div id="sec-photos" className={`rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isOpen ? 'bg-[#B88E3E] text-white' : 'bg-black/5 dark:bg-white/5 text-neutral-500'}`}>
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Фотографії</h3>
            <p className={`text-xs ${theme.textMuted}`}>Світлини особи, вибір головного зображення та аватар</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isOpen && (
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium hidden sm:inline-block">
              {photosList.length > 0 ? `${photosList.length} фото` : (avatarUrl ? 'Є аватар' : 'Без фото')}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#B88E3E]' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="p-4 sm:p-5 pt-2 space-y-4 border-t border-black/5 dark:border-white/5">
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl border border-black/10 dark:border-white/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-neutral-800 dark:text-neutral-200 text-xs">
                    Фотографії особи
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Зображення зберігаються у Google Drive / GitHub / хмарному сховищі; у картці залишаються посилання та метадані.
                  </p>
                </div>

                {!isReadOnly && (
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => alert('Сховище GitHub активовано')}
                      className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-black/5 text-xs font-semibold cursor-pointer"
                    >
                      Підключити сховище
                    </button>
                    <button
                      type="button"
                      onClick={() => alert('Оберіть фото з Google Диска')}
                      className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-black/5 text-xs font-semibold cursor-pointer"
                    >
                      Обрати з Google Drive
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPhotoUrlInput(!showPhotoUrlInput)}
                      className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-black/5 text-xs font-semibold cursor-pointer"
                    >
                      Зовнішнє посилання
                    </button>
                  </div>
                )}
              </div>

              {showPhotoUrlInput && !isReadOnly && (
                <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex gap-2 animate-in fade-in duration-150">
                  <input
                    type="url"
                    value={newPhotoUrlInput}
                    onChange={(e) => setNewPhotoUrlInput(e.target.value)}
                    placeholder="https://images.unsplash.com/... або пряме посилання на фото"
                    className={`flex-1 p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                  />
                  <button
                    type="button"
                    onClick={handleAddPhotoUrl}
                    className="px-3 py-2 rounded-lg bg-[#B88E3E] text-white font-bold text-xs shrink-0 cursor-pointer"
                  >
                    Додати фото
                  </button>
                </div>
              )}

              {/* Photo Gallery Grid */}
              {photosList.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
                  {photosList.map((photo, idx) => {
                    const isMainAvatar = avatarUrl === photo;
                    return (
                      <div
                        key={idx}
                        className={`relative rounded-xl overflow-hidden border-2 aspect-square group shadow-xs ${
                          isMainAvatar ? 'border-[#B88E3E] ring-2 ring-[#B88E3E]/30' : 'border-neutral-200 dark:border-neutral-700'
                        }`}
                      >
                        <img src={photo} alt="Person" className="w-full h-full object-cover" />
                        {isMainAvatar && (
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-[#B88E3E] text-white text-[9px] font-bold">
                            Головне
                          </div>
                        )}
                        {!isReadOnly && (
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                            {!isMainAvatar && (
                              <button
                                type="button"
                                onClick={() => onChangeAvatarUrl(photo)}
                                className="p-1 rounded-md bg-emerald-600 text-white text-[10px] hover:bg-emerald-700 cursor-pointer"
                                title="Зробити аватаром"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                onChangePhotosList(photosList.filter((p) => p !== photo));
                                if (avatarUrl === photo) onChangeAvatarUrl('');
                              }}
                              className="p-1 rounded-md bg-rose-600 text-white text-[10px] hover:bg-rose-700 cursor-pointer"
                              title="Видалити"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 text-center text-neutral-400 text-xs">
                  Файлів поки немає. Скористайтеся кнопками вище для завантаження світлин.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
