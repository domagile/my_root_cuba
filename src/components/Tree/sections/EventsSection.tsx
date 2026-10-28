/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Calendar, ChevronDown, Plus, AlertTriangle, Trash2 } from 'lucide-react';
import { PersonLifeEventItem } from '../../../types';
import { validateLifeEventDate } from '../../../utils/dateValidation';

interface EventsSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  lifeEvents: PersonLifeEventItem[];
  onChangeLifeEvents: (events: PersonLifeEventItem[]) => void;
  birthDate: string;
  deathDate: string;
  isLiving: boolean;
  hasFutureLifeEvents?: boolean;
  isReadOnly?: boolean;
  theme: any;
}

export const EventsSection: React.FC<EventsSectionProps> = ({
  isOpen,
  onToggle,
  lifeEvents,
  onChangeLifeEvents,
  birthDate,
  deathDate,
  isLiving,
  hasFutureLifeEvents = false,
  isReadOnly = false,
  theme
}) => {
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<PersonLifeEventItem>>({
    type: 'baptism',
    title: '',
    date: '',
    place: '',
    description: '',
    source: ''
  });

  const newEventValidation = validateLifeEventDate(newEvent.date, birthDate, deathDate, isLiving);

  const getEventTypeName = (type?: string) => {
    switch (type) {
      case 'birth':
        return 'Народження';
      case 'baptism':
        return 'Хрещення';
      case 'marriage':
        return 'Шлюб';
      case 'revision':
        return 'Ревізька казка / Перепис';
      case 'confession':
        return 'Сповідний розпис';
      case 'residence':
        return 'Проживання / Переїзд';
      case 'military':
        return 'Військова служба';
      case 'education':
        return 'Освіта';
      case 'award':
        return 'Нагорода / Відзнака';
      case 'emigration':
        return 'Еміграція / Переселення';
      case 'death':
        return 'Смерть';
      case 'burial':
        return 'Поховання';
      default:
        return 'Подія';
    }
  };

  const handleAddLifeEvent = () => {
    if (!newEvent.title && !newEvent.type) return;
    if (newEventValidation.isFuture) {
      alert(`Неможливо додати подію: ${newEventValidation.message || 'дата події вказує на майбутній час'}.`);
      return;
    }
    const item: PersonLifeEventItem = {
      id: `evt-${Date.now()}`,
      ...newEvent,
      type: newEvent.type || 'other',
      title: newEvent.title || getEventTypeName(newEvent.type)
    };
    onChangeLifeEvents([...lifeEvents, item]);
    setNewEvent({
      type: 'baptism',
      title: '',
      date: '',
      place: '',
      description: '',
      source: ''
    });
    setShowAddEventForm(false);
  };

  const handleRemoveLifeEvent = (id?: string) => {
    onChangeLifeEvents(lifeEvents.filter((evt) => evt.id !== id));
  };

  return (
    <div id="sec-events" className={`rounded-2xl border ${theme.borderSubtle} bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isOpen ? 'bg-[#B88E3E] text-white' : 'bg-black/5 dark:bg-white/5 text-neutral-500'}`}>
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className={`text-sm font-bold ${theme.textPrimary}`}>Події та факти</h3>
            <p className={`text-xs ${theme.textMuted}`}>Додаткові життєві події, переписи, ревізії, служба</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasFutureLifeEvents && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-bold border border-rose-500/30 animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              <span>Майбутня дата</span>
            </span>
          )}
          {!isOpen && (
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium hidden sm:inline-block">
              {lifeEvents.length > 0 ? `${lifeEvents.length} подій` : '0 подій'}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#B88E3E]' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="p-4 sm:p-5 pt-2 space-y-4 border-t border-black/5 dark:border-white/5">
          <div className="space-y-3.5 text-xs">
            <div className="p-4 rounded-xl border border-black/10 dark:border-white/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-neutral-800 dark:text-neutral-200 text-xs">
                    Інші життєві події та факти
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Хрещення, переписи, ревізії, сповідні розписи, військова служба, освіта, поховання та інші події. Для однієї особи можна додати декілька подій одного типу.
                  </p>
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setShowAddEventForm(!showAddEventForm)}
                    className="px-3 py-1.5 rounded-xl bg-[#B88E3E]/15 hover:bg-[#B88E3E]/25 text-[#B88E3E] font-bold text-xs flex items-center gap-1.5 border border-[#B88E3E]/30 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showAddEventForm ? 'Скасувати' : '+ Додати подію'}</span>
                  </button>
                )}
              </div>

              {showAddEventForm && !isReadOnly && (
                <div className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-3 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="font-bold block text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">
                        Тип події:
                      </label>
                      <select
                        value={newEvent.type}
                        onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as any })}
                        className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                      >
                        <option value="baptism">Хрещення</option>
                        <option value="revision">Ревізька казка / Перепис</option>
                        <option value="confession">Сповідний розпис</option>
                        <option value="marriage">Шлюб / Вінчання</option>
                        <option value="military">Військова служба / Призов</option>
                        <option value="education">Освіта / Навчання</option>
                        <option value="award">Нагорода / Відзнака</option>
                        <option value="residence">Зміна місця проживання</option>
                        <option value="emigration">Еміграція / Переселення</option>
                        <option value="death">Смерть</option>
                        <option value="burial">Поховання</option>
                        <option value="other">Інша подія</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold block text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">
                        Назва або заголовок:
                      </label>
                      <input
                        type="text"
                        value={newEvent.title || ''}
                        onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                        placeholder="напр. Ревізія 1858 року"
                        className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="font-bold block text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">
                        Дата або рік:
                      </label>
                      <input
                        type="text"
                        value={newEvent.date || ''}
                        onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                        placeholder="1858 або 15.04.1858"
                        className={`w-full p-2 rounded-lg border text-xs transition-colors ${
                          newEventValidation.isFuture
                            ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 ring-1 ring-rose-500'
                            : `${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`
                        }`}
                      />
                      {newEventValidation.message && (
                        <div className={`flex items-start gap-1 mt-1 text-[11px] font-semibold ${
                          newEventValidation.isFuture ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                          <span>{newEventValidation.message}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="font-bold block text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">
                        Місце події:
                      </label>
                      <input
                        type="text"
                        value={newEvent.place || ''}
                        onChange={(e) => setNewEvent({ ...newEvent, place: e.target.value })}
                        placeholder="с. Моринці, Київська губернія"
                        className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold block text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">
                      Опис, витяг та джерело:
                    </label>
                    <textarea
                      rows={2}
                      value={newEvent.description || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                      placeholder="Деталі запису, склад сім'ї, джерело..."
                      className={`w-full p-2 rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} text-xs`}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddEventForm(false)}
                      className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-700"
                    >
                      Скасувати
                    </button>
                    <button
                      type="button"
                      onClick={handleAddLifeEvent}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#B88E3E] text-white hover:bg-[#a07a32] cursor-pointer"
                    >
                      Зберегти подію
                    </button>
                  </div>
                </div>
              )}

              {lifeEvents.length > 0 ? (
                <div className="space-y-2">
                  {lifeEvents.map((evt, idx) => {
                    const evtValidation = validateLifeEventDate(evt.date, birthDate, deathDate, isLiving);
                    const isInvalid = evtValidation.isFuture;
                    const hasWarning = !isInvalid && Boolean(evtValidation.isBeforeBirth || evtValidation.isAfterDeath);

                    return (
                      <div
                        key={evt.id || idx}
                        className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs transition-all ${
                          isInvalid
                            ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800'
                            : hasWarning
                            ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300/60 dark:border-amber-800/40'
                            : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-[#B88E3E]/15 text-[#B88E3E] font-bold text-[10px]">
                              {getEventTypeName(evt.type)}
                            </span>
                            <span className="font-bold text-neutral-800 dark:text-neutral-200">{evt.title}</span>
                            {evt.date && (
                              <span className={`font-medium ${isInvalid ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-neutral-500'}`}>
                                ({evt.date})
                              </span>
                            )}
                            {isInvalid && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>У майбутньому</span>
                              </span>
                            )}
                            {hasWarning && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>{evtValidation.message}</span>
                              </span>
                            )}
                          </div>
                          {evt.place && <div className="text-neutral-500 text-[11px]">📍 {evt.place}</div>}
                          {evt.description && <div className="text-neutral-600 dark:text-neutral-400 text-[11px] mt-1">{evt.description}</div>}
                          {isInvalid && evtValidation.message && (
                            <div className="text-rose-600 dark:text-rose-400 text-[11px] font-semibold mt-1">
                              ⚠️ {evtValidation.message}
                            </div>
                          )}
                        </div>

                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLifeEvent(evt.id)}
                            className="text-neutral-400 hover:text-rose-500 p-1 cursor-pointer shrink-0"
                            title="Видалити подію"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-neutral-400 italic">Додаткових подій поки немає.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
