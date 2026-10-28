/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Layers, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { CustomFieldItem } from '../../../types';

interface CustomFieldsSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  customFields: CustomFieldItem[];
  onChange: (fields: CustomFieldItem[]) => void;
  theme: any;
}

export const CustomFieldsSection: React.FC<CustomFieldsSectionProps> = ({
  isOpen,
  onToggle,
  customFields,
  onChange,
  theme
}) => {
  const [showAddCustomField, setShowAddCustomField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldValue, setNewFieldValue] = useState('');

  const handleAddCustomField = () => {
    if (!newFieldLabel.trim()) return;
    const newField: CustomFieldItem = {
      id: `cf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      label: newFieldLabel.trim(),
      type: newFieldType,
      value: newFieldValue.trim()
    };
    onChange([...customFields, newField]);
    setNewFieldLabel('');
    setNewFieldValue('');
    setShowAddCustomField(false);
  };

  const handleRemoveCustomField = (id: string) => {
    onChange(customFields.filter((f) => f.id !== id));
  };

  return (
    <div id="sec-custom-fields" className={`rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isOpen ? 'bg-[#B88E3E] text-white' : 'bg-black/5 dark:bg-white/5 text-neutral-500'}`}>
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Власні поля</h3>
            <p className={`text-xs ${theme.textMuted}`}>Користувацькі атрибути та архівні параметри</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isOpen && (
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium hidden sm:inline-block">
              {customFields.length > 0 ? `${customFields.length} полів` : '0 полів'}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#B88E3E]' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="p-4 sm:p-5 pt-2 space-y-4 border-t border-black/5 dark:border-white/5">
          <div className="space-y-3.5 text-xs">
            {/* Notice banner */}
            <div className="p-3.5 rounded-xl border border-black/10 dark:border-white/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-neutral-800 dark:text-neutral-200 text-xs">
                    Користувацькі атрибути та параметри
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Створюйте власні поля довільних типів (номер ревізької душі, назва маєтку, земельний наділ тощо).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddCustomField(!showAddCustomField)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 border border-emerald-500/30 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showAddCustomField ? 'Скасувати додавання' : '+ Додати власне поле'}</span>
                </button>
              </div>

              {/* Add Custom Field Form */}
              {showAddCustomField && (
                <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-3 animate-in fade-in duration-150">
                  <p className="text-[11px] text-neutral-500 italic">
                    Нове поле буде доступне в усіх записах цього розділу.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wide">
                        Назва поля
                      </label>
                      <input
                        type="text"
                        value={newFieldLabel}
                        onChange={(e) => setNewFieldLabel(e.target.value)}
                        placeholder="Наприклад: Назва маєтку"
                        className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wide">
                        Тип поля
                      </label>
                      <select
                        value={newFieldType}
                        onChange={(e) => setNewFieldType(e.target.value)}
                        className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs focus:outline-none focus:ring-2 focus:ring-[#B88E3E]`}
                      >
                        <option value="text">Короткий текст</option>
                        <option value="longtext">Довгий текст</option>
                        <option value="number">Число</option>
                        <option value="year">Рік</option>
                        <option value="date">Дата</option>
                        <option value="time">Час</option>
                        <option value="approx_date">Приблизна дата або період</option>
                        <option value="place">Місце</option>
                        <option value="list">Список</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wide">
                      Значення поля
                    </label>
                    {newFieldType === 'longtext' ? (
                      <textarea
                        rows={2}
                        value={newFieldValue}
                        onChange={(e) => setNewFieldValue(e.target.value)}
                        placeholder="Введіть значення..."
                        className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                      />
                    ) : (
                      <input
                        type={newFieldType === 'number' ? 'number' : 'text'}
                        value={newFieldValue}
                        onChange={(e) => setNewFieldValue(e.target.value)}
                        placeholder="Введіть значення поля..."
                        className={`w-full p-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                      />
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddCustomField(false)}
                      className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-700"
                    >
                      Скасувати
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCustomField}
                      className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    >
                      Зберегти власне поле
                    </button>
                  </div>
                </div>
              )}

              {/* List of Custom Fields */}
              {customFields.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {customFields.map((field) => (
                    <div
                      key={field.id}
                      className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className="font-bold text-neutral-700 dark:text-neutral-300 shrink-0">
                          {field.label}:
                        </span>
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => {
                            const val = e.target.value;
                            onChange(
                              customFields.map((f) => (f.id === field.id ? { ...f, value: val } : f))
                            );
                          }}
                          className={`flex-1 p-1.5 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                        />
                        {field.type && (
                          <span className="text-[10px] text-neutral-400 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 shrink-0">
                            {field.type}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomField(field.id)}
                        className="text-neutral-400 hover:text-rose-500 p-1 cursor-pointer shrink-0"
                        title="Видалити поле"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-neutral-400 italic">Власних полів ще немає.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
