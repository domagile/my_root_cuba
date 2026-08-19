/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, User, Edit3, Plus, Calendar, MapPin, Briefcase, FileText, Heart, Shield, Users, Tag, Award, BookOpen } from 'lucide-react';
import { useGenealogy } from '../../context/GenealogyContext';
import { getThemeConfig } from '../../utils/theme';
import { Person } from '../../types';

interface PersonDetailModalProps {
  personId: string;
  onClose: () => void;
  onEdit: (person: Person) => void;
  onOpenAddRelation: (type: 'father' | 'mother' | 'child' | 'spouse' | 'sibling', targetPersonId: string) => void;
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
  personId,
  onClose,
  onEdit,
  onOpenAddRelation
}) => {
  const { persons, themePalette, setSelectedPersonId } = useGenealogy();
  const theme = getThemeConfig(themePalette);

  const person = persons.find((p) => p.id === personId);
  if (!person) return null;

  const father = persons.find((p) => p.id === person.fatherId);
  const mother = persons.find((p) => p.id === person.motherId);
  const spouses = persons.filter((p) => person.spouseIds?.includes(p.id) || p.spouseIds?.includes(person.id));
  const children = persons.filter((p) => p.fatherId === person.id || p.motherId === person.id || person.childrenIds?.includes(p.id));

  const given = person.name?.given || person.firstName || '';
  const surname = person.name?.surname || person.lastName || '';
  const patronymic = person.name?.patronymic || person.patronymic || '';
  const maidenName = person.name?.maidenName || person.maidenName || '';
  const prefix = person.name?.prefix || person.prefix || '';
  const avatar = person.avatarUrl || person.avatar || person.photoUrl;
  const estate = person.estateOrSocialStatus || person.estate || person.socialStatus;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl p-6 md:p-8 space-y-6 relative scrollbar-thin`}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-5">
          <div className="flex items-center gap-4">
            {avatar ? (
              <img
                src={avatar}
                alt={given}
                className="w-16 h-16 rounded-2xl object-cover border border-[#B88E3E]/40 shadow-sm"
              />
            ) : (
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${
                  person.gender === 'female' || person.gender === 'F'
                    ? 'bg-rose-500/15 text-rose-600'
                    : 'bg-blue-500/15 text-blue-600'
                }`}
              >
                {given[0] || surname[0] || 'П'}
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#B88E3E]/20 text-[#B88E3E]">
                  {person.gender === 'female' || person.gender === 'F' ? 'Жінка' : 'Чоловік'}
                </span>
                {prefix && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-500 border border-amber-500/30">
                    {prefix}
                  </span>
                )}
                {estate && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    {estate}
                  </span>
                )}
                {person.confession && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400">
                    {person.confession}
                  </span>
                )}
              </div>
              <h2 className={`text-xl font-extrabold ${theme.cardTitle} mt-1`}>
                {surname} {given} {patronymic}
                {maidenName ? ` (до шлюбу ${maidenName})` : ''}
              </h2>
              <p className="text-[11px] text-neutral-400 font-mono">ID: {person.id}</p>
            </div>
          </div>

          <button
            onClick={() => onEdit(person)}
            className="px-4 py-2 bg-[#B88E3E] hover:bg-[#A37B30] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            <span>Редагувати</span>
          </button>
        </div>

        {/* Biographic Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-1">
            <span className="text-xs text-neutral-400 flex items-center gap-1.5 font-medium">
              <Calendar className="w-4 h-4 text-[#B88E3E]" />
              Народження
            </span>
            <div className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
              {person.birthDate || person.birthYear || 'Дата невідома'}
            </div>
            {person.birthPlace && (
              <div className="text-xs text-neutral-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{person.birthPlace}</span>
              </div>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-1">
            <span className="text-xs text-neutral-400 flex items-center gap-1.5 font-medium">
              <Calendar className="w-4 h-4 text-rose-500" />
              Смерть
            </span>
            <div className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
              {person.isLiving ? 'Нині живий / жива' : (person.deathDate || person.deathYear || 'Невідомо')}
            </div>
            {person.deathPlace && !person.isLiving && (
              <div className="text-xs text-neutral-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{person.deathPlace}</span>
              </div>
            )}
          </div>
        </div>

        {/* Occupation, Military Rank, Estate */}
        {(person.occupation || person.militaryRank || estate || person.confession) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-800 text-xs">
            {person.occupation && (
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#B88E3E] shrink-0" />
                <div>
                  <span className="text-neutral-400 block text-[10px]">Професія / Посада:</span>
                  <span className="font-medium text-neutral-200">{person.occupation}</span>
                </div>
              </div>
            )}
            {person.militaryRank && (
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="text-neutral-400 block text-[10px]">Військовий чин / звання:</span>
                  <span className="font-medium text-neutral-200">{person.militaryRank}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {person.tags && person.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-neutral-400 mr-1" />
            {person.tags.map((tag, idx) => (
              <span
                key={idx}
                className="text-[11px] px-2.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-full border border-neutral-200 dark:border-neutral-700"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Biography */}
        {person.bio && (
          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-[#B88E3E]" />
              Життєпис / Біографія
            </span>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50 dark:bg-neutral-800/40 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700/60">
              {person.bio}
            </p>
          </div>
        )}

        {/* Family ties */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${theme.cardTitle} flex items-center gap-1.5`}>
              <Users className="w-4 h-4 text-[#B88E3E]" />
              <span>Родинні зв'язки</span>
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onOpenAddRelation('father', person.id)}
                className="text-[11px] px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-[#B88E3E] hover:text-white rounded-lg text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
              >
                + Батько
              </button>
              <button
                onClick={() => onOpenAddRelation('mother', person.id)}
                className="text-[11px] px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-[#B88E3E] hover:text-white rounded-lg text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
              >
                + Мати
              </button>
              <button
                onClick={() => onOpenAddRelation('child', person.id)}
                className="text-[11px] px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-[#B88E3E] hover:text-white rounded-lg text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
              >
                + Дитина
              </button>
              <button
                onClick={() => onOpenAddRelation('spouse', person.id)}
                className="text-[11px] px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-[#B88E3E] hover:text-white rounded-lg text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
              >
                + Подружжя
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Parents */}
            <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-1">
              <span className="text-[11px] text-neutral-400 font-medium">Батьки:</span>
              <div className="text-xs space-y-1">
                <div>
                  Батько:{' '}
                  {father ? (
                    <span
                      onClick={() => setSelectedPersonId(father.id)}
                      className="font-semibold text-[#B88E3E] cursor-pointer hover:underline"
                    >
                      {father.name?.surname || father.lastName} {father.name?.given || father.firstName}
                    </span>
                  ) : (
                    <span className="text-neutral-400">не вказано</span>
                  )}
                </div>
                <div>
                  Мати:{' '}
                  {mother ? (
                    <span
                      onClick={() => setSelectedPersonId(mother.id)}
                      className="font-semibold text-[#B88E3E] cursor-pointer hover:underline"
                    >
                      {mother.name?.surname || mother.lastName} {mother.name?.given || mother.firstName}
                    </span>
                  ) : (
                    <span className="text-neutral-400">не вказано</span>
                  )}
                </div>
              </div>
            </div>

            {/* Spouses & Children */}
            <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-1">
              <span className="text-[11px] text-neutral-400 font-medium">Діти ({children.length}) та Подружжя:</span>
              <div className="text-xs space-y-1">
                {spouses.length > 0 && (
                  <div>
                    Шлюб:{' '}
                    {spouses.map((s) => (
                      <span
                        key={s.id}
                        onClick={() => setSelectedPersonId(s.id)}
                        className="font-semibold text-rose-500 mr-2 cursor-pointer hover:underline"
                      >
                        {s.name?.surname || s.lastName} {s.name?.given || s.firstName}
                      </span>
                    ))}
                  </div>
                )}
                {children.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {children.map((c) => (
                      <span
                        key={c.id}
                        onClick={() => setSelectedPersonId(c.id)}
                        className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 cursor-pointer hover:text-[#B88E3E]"
                      >
                        {c.name?.given || c.firstName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {person.notes && (
          <div className="space-y-1.5 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              Дослідницькі та архівні примітки
            </span>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50 dark:bg-neutral-800/40 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700/60">
              {typeof person.notes === 'string' ? person.notes : JSON.stringify(person.notes)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
