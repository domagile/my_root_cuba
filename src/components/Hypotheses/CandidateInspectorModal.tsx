/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CandidateTreeNode } from '../../types/sheetsAnalysis';
import { Person, GodparentItem } from '../../types';
import {
  X,
  Sparkles,
  CheckCircle2,
  Users,
  FileText,
  MapPin,
  Calendar,
  ShieldAlert,
  ArrowRight,
  BookmarkPlus
} from 'lucide-react';

interface CandidateInspectorModalProps {
  node: CandidateTreeNode | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmAddPerson: (newPerson: Person) => void;
  onLinkToExistingPerson: (candidateNode: CandidateTreeNode, existingPersonId: string) => void;
  treePersons: Person[];
  theme: any;
}

export const CandidateInspectorModal: React.FC<CandidateInspectorModalProps> = ({
  node,
  isOpen,
  onClose,
  onConfirmAddPerson,
  onLinkToExistingPerson,
  treePersons,
  theme
}) => {
  if (!isOpen || !node) return null;

  const [firstName, setFirstName] = useState(node.firstName || '');
  const [lastName, setLastName] = useState(node.lastName || '');
  const [patronymic, setPatronymic] = useState(node.patronymic || '');
  const [gender, setGender] = useState<Person['gender']>(node.gender);
  const [birthYear, setBirthYear] = useState<string>(node.estimatedBirthYear ? String(node.estimatedBirthYear) : '');
  const [birthPlace, setBirthPlace] = useState(node.place || '');
  const [socialStatus, setSocialStatus] = useState(node.socialStatus || 'Козак');
  const [selectedParentId, setSelectedParentId] = useState<string>(node.matchedMainPersonId || '');
  const [researchStatus, setResearchStatus] = useState<'confirmed' | 'hypothetical' | 'needs_verification'>('hypothetical');
  const [copyGodparents, setCopyGodparents] = useState(true);

  const handleSaveToTree = (e: React.FormEvent) => {
    e.preventDefault();

    // Build godparents array
    const godparentsList: GodparentItem[] = [];
    if (copyGodparents && node.godparentDetails) {
      node.godparentDetails.forEach(gp => {
        godparentsList.push({
          id: `gp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: gp.name,
          role: gp.role,
          notes: `Знайдено на листі «${gp.sheet}» ${gp.year ? `(${gp.year} р.)` : ''}`
        });
      });
    }

    const citationText = node.citations.map(c => `[Лист: ${c.sheet} ${c.year ? `(${c.year} р.)` : ''}]: ${c.excerpt}`).join('\n');

    const newPerson: Person = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      patronymic: patronymic.trim() || undefined,
      name: {
        given: firstName.trim(),
        surname: lastName.trim(),
        patronymic: patronymic.trim() || undefined
      },
      gender,
      birthYear: birthYear ? Number(birthYear) : undefined,
      birthDate: birthYear ? `${birthYear}-01-01` : undefined,
      birthPlace: birthPlace.trim() || undefined,
      socialStatus: socialStatus.trim() || undefined,
      estateOrSocialStatus: socialStatus.trim() || undefined,
      researchStatus,
      godparents: godparentsList,
      notes: `Імпортовано з AI аналізу таблиць (Джерело: ${node.roleInSource}).\n${citationText}`,
      sourceCitations: node.citations.map(c => `${c.sheet}: ${c.excerpt}`)
    };

    onConfirmAddPerson(newPerson);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-3xl w-full max-w-2xl p-6 sm:p-8 space-y-6 shadow-2xl text-xs max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-start justify-between border-b border-black/10 pb-4">
          <div className="space-y-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#B88E3E]/20 text-[#E2C382] border border-[#B88E3E]/30 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Перевірка та імпорт кандидата в дерево
            </span>
            <h3 className={`text-lg font-bold ${theme.cardTitle}`}>
              {node.fullName}
            </h3>
            <p className={`text-xs ${theme.cardSubtext}`}>
              Джерело: {node.roleInSource}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form to confirm data before adding */}
        <form onSubmit={handleSaveToTree} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={`block font-semibold ${theme.cardSubtext} mb-1`}>Прізвище</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className={`w-full ${theme.inputBg} border ${theme.inputBorder} rounded-xl px-3 py-2 ${theme.inputText} font-bold`}
                required
              />
            </div>
            <div>
              <label className={`block font-semibold ${theme.cardSubtext} mb-1`}>Ім&apos;я</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className={`w-full ${theme.inputBg} border ${theme.inputBorder} rounded-xl px-3 py-2 ${theme.inputText} font-bold`}
                required
              />
            </div>
            <div>
              <label className={`block font-semibold ${theme.cardSubtext} mb-1`}>По батькові</label>
              <input
                type="text"
                value={patronymic}
                onChange={e => setPatronymic(e.target.value)}
                className={`w-full ${theme.inputBg} border ${theme.inputBorder} rounded-xl px-3 py-2 ${theme.inputText}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={`block font-semibold ${theme.cardSubtext} mb-1`}>Стать</label>
              <select
                value={gender}
                onChange={e => setGender(e.target.value as any)}
                className={`w-full ${theme.inputBg} border ${theme.inputBorder} rounded-xl px-3 py-2 ${theme.inputText}`}
              >
                <option value="male">Чоловіча</option>
                <option value="female">Жіноча</option>
              </select>
            </div>
            <div>
              <label className={`block font-semibold ${theme.cardSubtext} mb-1`}>Рік народження (орієнтовно)</label>
              <input
                type="number"
                value={birthYear}
                onChange={e => setBirthYear(e.target.value)}
                placeholder="напр. 1882"
                className={`w-full ${theme.inputBg} border ${theme.inputBorder} rounded-xl px-3 py-2 ${theme.inputText}`}
              />
            </div>
            <div>
              <label className={`block font-semibold ${theme.cardSubtext} mb-1`}>Село / Парафія</label>
              <input
                type="text"
                value={birthPlace}
                onChange={e => setBirthPlace(e.target.value)}
                placeholder="Чернечий Яр"
                className={`w-full ${theme.inputBg} border ${theme.inputBorder} rounded-xl px-3 py-2 ${theme.inputText}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`block font-semibold ${theme.cardSubtext} mb-1`}>Соціальний стан</label>
              <input
                type="text"
                value={socialStatus}
                onChange={e => setSocialStatus(e.target.value)}
                className={`w-full ${theme.inputBg} border ${theme.inputBorder} rounded-xl px-3 py-2 ${theme.inputText}`}
              />
            </div>
            <div>
              <label className={`block font-semibold ${theme.cardSubtext} mb-1`}>Статус верифікації в дереві</label>
              <select
                value={researchStatus}
                onChange={e => setResearchStatus(e.target.value as any)}
                className={`w-full ${theme.inputBg} border ${theme.inputBorder} rounded-xl px-3 py-2 ${theme.inputText}`}
              >
                <option value="hypothetical">Гіпотетично (потребує подальших розкопок)</option>
                <option value="confirmed">Підтверджено документами</option>
                <option value="needs_verification">На перевірці</option>
              </select>
            </div>
          </div>

          {/* Godparents Box */}
          {node.godparentDetails && node.godparentDetails.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#B88E3E]/10 border border-[#B88E3E]/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#E2C382] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Восприємники (Хрещені) для збереження:
                </span>
                <label className="flex items-center gap-1.5 text-[11px] text-[#E2C382] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyGodparents}
                    onChange={e => setCopyGodparents(e.target.checked)}
                    className="accent-[#B88E3E] rounded"
                  />
                  <span>Зберегти в анкету особи</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {node.godparentDetails.map((gp, idx) => (
                  <div key={idx} className="p-2 rounded-xl bg-black/20 border border-[#B88E3E]/20 text-[#F5EEDC]">
                    <strong>{gp.name}</strong> ({gp.role === 'godmother' ? 'хрещена мати' : 'хрещений батько'})
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-4 border-t border-black/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl ${theme.badgeBg} ${theme.badgeText} font-semibold transition-all cursor-pointer`}
            >
              Скасувати
            </button>

            <button
              type="submit"
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} font-bold shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Підтвердити та додати до родоводу</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
