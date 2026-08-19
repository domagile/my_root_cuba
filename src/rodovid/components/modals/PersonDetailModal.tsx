/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  X,
  User,
  Calendar,
  MapPin,
  Heart,
  GitFork,
  Compass,
  Edit2,
  Trash2,
  Briefcase,
  Award,
  BookOpen,
  Tag,
  Shield
} from 'lucide-react';
import { GenealogyDatabase, Person } from '../../types/genealogy';
import { getFullName } from '../../utils/relationship';

interface PersonDetailModalProps {
  database: GenealogyDatabase;
  personId: string | null;
  onClose: () => void;
  onSelectPerson: (id: string) => void;
  onEditPerson: (id: string) => void;
  onDeletePerson: (id: string) => void;
  onChangeRoot: (id: string) => void;
  onOpenKinshipWith: (id: string) => void;
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
  database,
  personId,
  onClose,
  onSelectPerson,
  onEditPerson,
  onDeletePerson,
  onChangeRoot,
  onOpenKinshipWith
}) => {
  if (!personId) return null;
  const person = database.persons[personId];
  if (!person) return null;

  const isMale = person.gender === 'male' || person.gender === 'M';
  const isFemale = person.gender === 'female' || person.gender === 'F';

  // Parents
  const parentFamily = person.parentFamilyId ? database.families[person.parentFamilyId] : null;
  const father = parentFamily?.husbandId
    ? database.persons[parentFamily.husbandId]
    : person.fatherId
    ? database.persons[person.fatherId]
    : null;
  const mother = parentFamily?.wifeId
    ? database.persons[parentFamily.wifeId]
    : person.motherId
    ? database.persons[person.motherId]
    : null;

  // Spouses & Families
  const spouseFamilyIds = person.spouseFamilyIds || [];
  const spouseFamilies = spouseFamilyIds
    .map((id) => database.families[id])
    .filter(Boolean);

  const estate = person.estateOrSocialStatus || person.estate || person.socialStatus;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header Profile */}
        <div className="p-6 bg-slate-950/60 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-center gap-4">
            {person.avatarUrl || person.avatar || person.photoUrl ? (
              <img
                src={person.avatarUrl || person.avatar || person.photoUrl}
                alt={getFullName(person)}
                className="w-16 h-16 rounded-xl object-cover border border-slate-700 shadow-md"
              />
            ) : (
              <div
                className={`w-16 h-16 rounded-xl flex items-center justify-center border ${
                  isMale
                    ? 'bg-blue-950/60 border-blue-800 text-blue-300'
                    : isFemale
                    ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                <User className="w-8 h-8" />
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-slate-800 text-emerald-400 rounded">
                  {person.id}
                </span>
                {person.name?.prefix && (
                  <span className="text-[10px] font-serif px-2 py-0.5 bg-amber-950/60 text-amber-300 border border-amber-800/60 rounded">
                    {person.name.prefix}
                  </span>
                )}
                {estate && (
                  <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                    {estate}
                  </span>
                )}
                {person.confession && (
                  <span className="text-[10px] px-2 py-0.5 bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 rounded">
                    {person.confession}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-white mt-1">{getFullName(person)}</h2>
              {(person.name?.maidenName || person.maidenName) && (
                <p className="text-xs text-slate-400">
                  Дівоче прізвище: {person.name?.maidenName || person.maidenName}
                </p>
              )}
              <div className="flex items-center gap-2 text-xs text-slate-300 font-mono mt-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {person.birthDate || person.birthYear || '?'} —{' '}
                  {person.isLiving ? 'донині' : person.deathDate || person.deathYear || '?'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Toolbar */}
        <div className="px-6 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onChangeRoot(person.id);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <GitFork className="w-3.5 h-3.5 text-emerald-400" />
              <span>Зробити коренем дерева</span>
            </button>
            <button
              onClick={() => {
                onOpenKinshipWith(person.id);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Розрахувати спорідненість</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEditPerson(person.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Редагувати</span>
            </button>
            <button
              onClick={() => {
                if (confirm(`Видалити особу ${getFullName(person)}?`)) {
                  onDeletePerson(person.id);
                  onClose();
                }
              }}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Видалити особу"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {/* Status & Attributes */}
          {(person.occupation || person.militaryRank || estate || person.confession) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              {person.occupation && (
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">Рід занять / Фах:</span>
                    <span className="font-medium text-slate-200">{person.occupation}</span>
                  </div>
                </div>
              )}
              {estate && (
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">Стан / Соціальний статус:</span>
                    <span className="font-medium text-slate-200">{estate}</span>
                  </div>
                </div>
              )}
              {person.militaryRank && (
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">Військовий чин / Звання:</span>
                    <span className="font-medium text-slate-200">{person.militaryRank}</span>
                  </div>
                </div>
              )}
              {person.confession && (
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">Віросповідання / Конфесія:</span>
                    <span className="font-medium text-slate-200">{person.confession}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custom Fields */}
          {person.customFields && (
            Array.isArray(person.customFields) ? (
              person.customFields.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Додаткові відомості:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {person.customFields.map((cf, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                        <span className="text-slate-400 text-[10px] block">{cf.label || cf.key || 'Поле'}:</span>
                        <span className="font-medium text-slate-200">{cf.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              Object.keys(person.customFields).length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Додаткові відомості:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(person.customFields).map(([k, v], idx) => (
                      <div key={idx} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                        <span className="text-slate-400 text-[10px] block">{k}:</span>
                        <span className="font-medium text-slate-200">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )
          )}

          {/* Tags */}
          {person.tags && person.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400 mr-1" />
              {person.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[11px] px-2.5 py-0.5 bg-slate-800 text-slate-300 rounded-full border border-slate-700"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Biography */}
          {person.bio && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Життєпис / Біографічна довідка:
              </span>
              <p className="text-xs text-slate-300 bg-slate-950 p-3.5 rounded-xl border border-slate-800 leading-relaxed">
                {person.bio}
              </p>
            </div>
          )}

          {/* Parents Section */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Батьки:
            </span>
            <div className="grid grid-cols-2 gap-3">
              {/* Father */}
              <div
                onClick={() => father && onSelectPerson(father.id)}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                  father
                    ? 'bg-slate-950 border-blue-900/40 hover:border-blue-700'
                    : 'bg-slate-950/50 border-dashed border-slate-800 text-slate-500'
                }`}
              >
                <span className="text-[10px] text-blue-400 font-semibold block mb-0.5">Батько</span>
                {father ? (
                  <div>
                    <div className="font-semibold text-slate-200 truncate">
                      {getFullName(father)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {father.birthYear || '?'} — {father.deathYear || '?'}
                    </div>
                  </div>
                ) : (
                  <span className="italic">Не вказаний</span>
                )}
              </div>

              {/* Mother */}
              <div
                onClick={() => mother && onSelectPerson(mother.id)}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                  mother
                    ? 'bg-slate-950 border-rose-900/40 hover:border-rose-700'
                    : 'bg-slate-950/50 border-dashed border-slate-800 text-slate-500'
                }`}
              >
                <span className="text-[10px] text-rose-400 font-semibold block mb-0.5">Мати</span>
                {mother ? (
                  <div>
                    <div className="font-semibold text-slate-200 truncate">
                      {getFullName(mother)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {mother.birthYear || '?'} — {mother.deathYear || '?'}
                    </div>
                  </div>
                ) : (
                  <span className="italic">Не вказана</span>
                )}
              </div>
            </div>
          </div>

          {/* Spouses and Children */}
          {spouseFamilies.length > 0 && (
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Сім'ї та діти:
              </span>

              {spouseFamilies.map((fam) => {
                const spouseId = fam.husbandId === person.id ? fam.wifeId : fam.husbandId;
                const spouse = spouseId ? database.persons[spouseId] : null;

                return (
                  <div
                    key={fam.id}
                    className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <Heart className="w-3.5 h-3.5 text-rose-400" />
                        <span className="text-slate-400">Чоловік / Дружина:</span>
                        {spouse ? (
                          <button
                            onClick={() => onSelectPerson(spouse.id)}
                            className="font-semibold text-slate-200 hover:text-emerald-400 cursor-pointer"
                          >
                            {getFullName(spouse)}
                          </button>
                        ) : (
                          <span className="italic text-slate-500">Не вказано</span>
                        )}
                      </div>

                      {fam.marriageDate && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          Шлюб: {fam.marriageDate}
                        </span>
                      )}
                    </div>

                    {/* Children */}
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1.5">
                        Діти ({fam.children?.length || 0}):
                      </span>
                      {(!fam.children || fam.children.length === 0) ? (
                        <span className="text-[11px] text-slate-500 italic">Дітей немає</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {fam.children.map((c) => {
                            const child = database.persons[c.personId];
                            if (!child) return null;
                            return (
                              <button
                                key={child.id}
                                onClick={() => onSelectPerson(child.id)}
                                className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-emerald-500 rounded text-xs text-slate-200 transition-colors cursor-pointer"
                              >
                                {getFullName(child)}{' '}
                                {child.birthYear && (
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    ({child.birthYear})
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Life events */}
          {person.events && person.events.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Події життя ({person.events.length}):
              </span>
              <div className="space-y-2">
                {person.events.map((ev, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-400 font-mono">
                        {ev.date || (ev.year ? `${ev.year} р.` : 'Дата не вказана')}
                      </span>
                      <span className="text-slate-300 font-medium">{ev.type}</span>
                    </div>
                    {ev.description && <p className="text-slate-300">{ev.description}</p>}
                    {ev.placeName && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        <span>{ev.placeName}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {person.notes && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Архівні примітки та джерела:
              </span>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed">
                {typeof person.notes === 'string'
                  ? person.notes
                  : Array.isArray(person.notes)
                  ? person.notes.join('\n')
                  : JSON.stringify(person.notes)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
