/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Users, Heart, UserPlus, Check, Sparkles } from 'lucide-react';
import { Person, Gender } from '../../types';
import { generateUkrainianPatronymic, adaptUkrainianSurnameForGender } from '../../utils/ukrainianNameUtils';

interface FamilyQuickAddModalProps {
  childPerson: Person;
  onClose: () => void;
  onSaveParents: (father: Partial<Person>, mother: Partial<Person>) => void;
  theme: any;
  isDark: boolean;
}

export const FamilyQuickAddModal: React.FC<FamilyQuickAddModalProps> = ({
  childPerson,
  onClose,
  onSaveParents,
  theme,
  isDark
}) => {
  const childSurname = childPerson.name?.surname || childPerson.lastName || '';
  const childPatronymic = childPerson.name?.patronymic || childPerson.patronymic || '';

  // Guess father's first name from child's patronymic if possible
  let initialFatherName = '';
  if (childPatronymic) {
    initialFatherName = childPatronymic
      .replace(/(ович|евич|івна|евна)$/i, '')
      .trim();
  }

  // Father form state
  const [fatherFirstName, setFatherFirstName] = useState(initialFatherName);
  const [fatherLastName, setFatherLastName] = useState(childSurname);
  const [fatherBirthYear, setFatherBirthYear] = useState('');
  const [fatherIsLiving, setFatherIsLiving] = useState(false);

  // Mother form state
  const [motherFirstName, setMotherFirstName] = useState('');
  const [motherMaidenName, setMotherMaidenName] = useState('');
  const [motherBirthYear, setMotherBirthYear] = useState('');
  const [motherIsLiving, setMotherIsLiving] = useState(false);

  // Shared context
  const [sharedPlace, setSharedPlace] = useState(childPerson.birthPlace || childPerson.residencePlace || '');

  const handleSave = () => {
    if (!fatherFirstName.trim() && !motherFirstName.trim()) {
      alert('Будь ласка, вкажіть ім\'я хоча б одного з батьків.');
      return;
    }

    const fatherData: Partial<Person> = {
      firstName: fatherFirstName.trim(),
      lastName: (fatherLastName || childSurname).trim(),
      gender: 'male',
      birthYear: fatherBirthYear ? parseInt(fatherBirthYear, 10) : undefined,
      isLiving: fatherIsLiving,
      birthPlace: sharedPlace.trim() || undefined,
      residencePlace: sharedPlace.trim() || undefined
    };

    const motherSurname = motherMaidenName.trim()
      ? motherMaidenName.trim()
      : adaptUkrainianSurnameForGender(fatherLastName || childSurname, 'female');

    const motherData: Partial<Person> = {
      firstName: motherFirstName.trim(),
      lastName: motherSurname,
      maidenName: motherMaidenName.trim() || undefined,
      gender: 'female',
      birthYear: motherBirthYear ? parseInt(motherBirthYear, 10) : undefined,
      isLiving: motherIsLiving,
      birthPlace: sharedPlace.trim() || undefined,
      residencePlace: sharedPlace.trim() || undefined
    };

    onSaveParents(fatherData, motherData);
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`w-full max-w-2xl rounded-2xl border ${theme.cardBorder} ${theme.cardBg} shadow-2xl overflow-hidden animate-in fade-in duration-200`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${theme.cardBorder} flex items-center justify-between`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-base font-bold ${theme.textPrimary}`}>
                Пакетне додавання батьків
              </h2>
              <p className={`text-xs ${theme.textMuted}`}>
                Для дитини: {childPerson.name?.given || childPerson.firstName} {childPerson.name?.surname || childPerson.lastName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: Two columns (Father & Mother) */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Father Box */}
            <div className={`p-4 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} space-y-3`}>
              <div className="flex items-center gap-2 text-sky-500 font-bold text-xs uppercase tracking-wider">
                <span>👨 Батько</span>
              </div>

              <div>
                <label className={`block text-xs font-semibold ${theme.textMuted} mb-1`}>Ім&apos;я</label>
                <input
                  type="text"
                  value={fatherFirstName}
                  onChange={(e) => setFatherFirstName(e.target.value)}
                  placeholder="напр. Василь"
                  className={`w-full px-3 py-1.5 text-xs rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold ${theme.textMuted} mb-1`}>Прізвище</label>
                <input
                  type="text"
                  value={fatherLastName}
                  onChange={(e) => setFatherLastName(e.target.value)}
                  placeholder="напр. Петренко"
                  className={`w-full px-3 py-1.5 text-xs rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block text-xs font-semibold ${theme.textMuted} mb-1`}>Рік нар.</label>
                  <input
                    type="text"
                    value={fatherBirthYear}
                    onChange={(e) => setFatherBirthYear(e.target.value)}
                    placeholder="напр. 1880"
                    className={`w-full px-3 py-1.5 text-xs rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold ${theme.textMuted} mb-1`}>Статус</label>
                  <select
                    value={fatherIsLiving ? 'living' : 'deceased'}
                    onChange={(e) => setFatherIsLiving(e.target.value === 'living')}
                    className={`w-full px-2 py-1.5 text-xs rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
                  >
                    <option value="deceased">Спочилий</option>
                    <option value="living">Нині живий</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Mother Box */}
            <div className={`p-4 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} space-y-3`}>
              <div className="flex items-center gap-2 text-rose-500 font-bold text-xs uppercase tracking-wider">
                <span>👩 Мати</span>
              </div>

              <div>
                <label className={`block text-xs font-semibold ${theme.textMuted} mb-1`}>Ім&apos;я</label>
                <input
                  type="text"
                  value={motherFirstName}
                  onChange={(e) => setMotherFirstName(e.target.value)}
                  placeholder="напр. Марія"
                  className={`w-full px-3 py-1.5 text-xs rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold ${theme.textMuted} mb-1`}>Дівоче прізвище</label>
                <input
                  type="text"
                  value={motherMaidenName}
                  onChange={(e) => setMotherMaidenName(e.target.value)}
                  placeholder="напр. Ковальчук (якщо відомо)"
                  className={`w-full px-3 py-1.5 text-xs rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block text-xs font-semibold ${theme.textMuted} mb-1`}>Рік нар.</label>
                  <input
                    type="text"
                    value={motherBirthYear}
                    onChange={(e) => setMotherBirthYear(e.target.value)}
                    placeholder="напр. 1885"
                    className={`w-full px-3 py-1.5 text-xs rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold ${theme.textMuted} mb-1`}>Статус</label>
                  <select
                    value={motherIsLiving ? 'living' : 'deceased'}
                    onChange={(e) => setMotherIsLiving(e.target.value === 'living')}
                    className={`w-full px-2 py-1.5 text-xs rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
                  >
                    <option value="deceased">Спочила</option>
                    <option value="living">Нині жива</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Shared Context */}
          <div>
            <label className={`block text-xs font-semibold ${theme.textMuted} mb-1`}>
              Спільний населений пункт родини (село / повіт)
            </label>
            <input
              type="text"
              value={sharedPlace}
              onChange={(e) => setSharedPlace(e.target.value)}
              placeholder="напр. с. Мошни, Черкаський повіт"
              className={`w-full px-3 py-1.5 text-xs rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${theme.cardBorder} flex items-center justify-between bg-black/10`}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Створити обох батьків та зв&apos;язати сім&apos;ю</span>
          </button>
        </div>
      </div>
    </div>
  );
};
