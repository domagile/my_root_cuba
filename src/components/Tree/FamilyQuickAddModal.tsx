/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Users,
  Check,
  AlertTriangle,
  AlertCircle,
  Info,
  ExternalLink,
  RotateCcw,
  UserCheck
} from 'lucide-react';
import { Person } from '../../types';
import { adaptUkrainianSurnameForGender } from '../../utils/ukrainianNameUtils';
import { extractYear } from '../../utils/treeAudit';
import { findDuplicatesForPerson, PersonDuplicateMatch } from '../../utils/duplicateDetector';
import { useGenealogy } from '../../context/GenealogyContext';

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
  theme
}) => {
  const { persons } = useGenealogy();

  const childSurname = childPerson.name?.surname || childPerson.lastName || '';
  const childPatronymic = childPerson.name?.patronymic || childPerson.patronymic || '';

  // Extract child birth year for chronological consistency checks
  const childBirthYear = useMemo<number | null>(() => {
    const raw =
      childPerson.birthYear ||
      extractYear(childPerson.birthDate) ||
      extractYear(childPerson.events?.find((e) => e.type === 'birth')?.date);
    if (!raw) return null;
    const num = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    return isNaN(num) ? null : num;
  }, [childPerson]);

  // Guess father's first name from child's patronymic if possible
  const initialFatherName = useMemo(() => {
    if (!childPatronymic) return '';
    return childPatronymic
      .replace(/(ович|евич|йович|івна|ївна|евна)$/i, '')
      .trim();
  }, [childPatronymic]);

  // Father form state
  const [fatherFirstName, setFatherFirstName] = useState(initialFatherName);
  const [fatherLastName, setFatherLastName] = useState(childSurname);
  const [fatherBirthYear, setFatherBirthYear] = useState('');
  const [fatherIsLiving, setFatherIsLiving] = useState(false);
  const [selectedExistingFather, setSelectedExistingFather] = useState<Person | null>(null);

  // Mother form state
  const [motherFirstName, setMotherFirstName] = useState('');
  const [motherMaidenName, setMotherMaidenName] = useState('');
  const [motherBirthYear, setMotherBirthYear] = useState('');
  const [motherIsLiving, setMotherIsLiving] = useState(false);
  const [selectedExistingMother, setSelectedExistingMother] = useState<Person | null>(null);

  // Shared context
  const [sharedPlace, setSharedPlace] = useState(
    childPerson.birthPlace || childPerson.residencePlace || ''
  );

  // State for showing confirmation dialog before saving when warnings are detected
  const [showWarningConfirmation, setShowWarningConfirmation] = useState(false);

  const currentYear = new Date().getFullYear();

  // Numerical years
  const parsedFatherYear = fatherBirthYear.trim() ? parseInt(fatherBirthYear, 10) : null;
  const parsedMotherYear = motherBirthYear.trim() ? parseInt(motherBirthYear, 10) : null;

  // Real-time duplicate detection for Father
  const fatherDuplicates: PersonDuplicateMatch[] = useMemo(() => {
    if (selectedExistingFather) return [];
    const fFirst = fatherFirstName.trim();
    const fLast = (fatherLastName || childSurname).trim();
    if (fFirst.length < 2 && fLast.length < 2) return [];

    const draftFather: Person = {
      id: '__draft_father__',
      name: { given: fFirst, surname: fLast },
      firstName: fFirst,
      lastName: fLast,
      gender: 'male',
      birthYear: parsedFatherYear && !isNaN(parsedFatherYear) ? parsedFatherYear : undefined
    };

    return findDuplicatesForPerson(draftFather, persons, childPerson.id, 50).slice(0, 2);
  }, [fatherFirstName, fatherLastName, childSurname, parsedFatherYear, persons, childPerson.id, selectedExistingFather]);

  // Real-time duplicate detection for Mother
  const motherDuplicates: PersonDuplicateMatch[] = useMemo(() => {
    if (selectedExistingMother) return [];
    const mFirst = motherFirstName.trim();
    const mLast = (motherMaidenName || fatherLastName || childSurname).trim();
    if (mFirst.length < 2 && mLast.length < 2) return [];

    const draftMother: Person = {
      id: '__draft_mother__',
      name: { given: mFirst, surname: mLast, maidenName: motherMaidenName.trim() || undefined },
      firstName: mFirst,
      lastName: mLast,
      maidenName: motherMaidenName.trim() || undefined,
      gender: 'female',
      birthYear: parsedMotherYear && !isNaN(parsedMotherYear) ? parsedMotherYear : undefined
    };

    return findDuplicatesForPerson(draftMother, persons, childPerson.id, 50).slice(0, 2);
  }, [motherFirstName, motherMaidenName, fatherLastName, childSurname, parsedMotherYear, persons, childPerson.id, selectedExistingMother]);

  // Chronological validations
  const chronologicalIssues = useMemo(() => {
    const issues: { severity: 'error' | 'warning'; text: string; category: 'father' | 'mother' | 'both' }[] = [];

    // Future year checks
    if (parsedFatherYear && !isNaN(parsedFatherYear) && parsedFatherYear > currentYear) {
      issues.push({
        severity: 'error',
        text: `Рік народження батька (${parsedFatherYear}) ще не настав (майбутній рік).`,
        category: 'father'
      });
    }
    if (parsedMotherYear && !isNaN(parsedMotherYear) && parsedMotherYear > currentYear) {
      issues.push({
        severity: 'error',
        text: `Рік народження матері (${parsedMotherYear}) ще не настав (майбутній рік).`,
        category: 'mother'
      });
    }

    // Historical sanity (< 800)
    if (parsedFatherYear && !isNaN(parsedFatherYear) && parsedFatherYear < 800) {
      issues.push({
        severity: 'warning',
        text: `Незвично ранній рік народження батька (${parsedFatherYear} р.) — перевірте на можливу одруківку.`,
        category: 'father'
      });
    }
    if (parsedMotherYear && !isNaN(parsedMotherYear) && parsedMotherYear < 800) {
      issues.push({
        severity: 'warning',
        text: `Незвично ранній рік народження матері (${parsedMotherYear} р.) — перевірте на можливу одруківку.`,
        category: 'mother'
      });
    }

    // Compared to Child
    if (childBirthYear) {
      // Father vs Child
      if (parsedFatherYear && !isNaN(parsedFatherYear)) {
        if (parsedFatherYear > childBirthYear) {
          issues.push({
            severity: 'error',
            text: `Батько народився пізніше за дитину (Батько: ${parsedFatherYear} р., Дитина: ${childBirthYear} р.).`,
            category: 'father'
          });
        } else if (parsedFatherYear === childBirthYear) {
          issues.push({
            severity: 'error',
            text: `Батько і дитина мають однаковий рік народження (${parsedFatherYear} р.).`,
            category: 'father'
          });
        } else {
          const fAgeAtBirth = childBirthYear - parsedFatherYear;
          if (fAgeAtBirth < 13) {
            issues.push({
              severity: 'warning',
              text: `Батькові було лише ${fAgeAtBirth} р. на момент народження дитини (мінімальний правдоподібний вік батьківства — від 13-14 років).`,
              category: 'father'
            });
          } else if (fAgeAtBirth > 85) {
            issues.push({
              severity: 'warning',
              text: `Батькові було понад ${fAgeAtBirth} р. на момент народження дитини (винятково поважний вік).`,
              category: 'father'
            });
          }
        }
      }

      // Mother vs Child
      if (parsedMotherYear && !isNaN(parsedMotherYear)) {
        if (parsedMotherYear > childBirthYear) {
          issues.push({
            severity: 'error',
            text: `Мати народилася пізніше за дитину (Мати: ${parsedMotherYear} р., Дитина: ${childBirthYear} р.).`,
            category: 'mother'
          });
        } else if (parsedMotherYear === childBirthYear) {
          issues.push({
            severity: 'error',
            text: `Мати і дитина мають однаковий рік народження (${parsedMotherYear} р.).`,
            category: 'mother'
          });
        } else {
          const mAgeAtBirth = childBirthYear - parsedMotherYear;
          if (mAgeAtBirth < 13) {
            issues.push({
              severity: 'warning',
              text: `Матері було лише ${mAgeAtBirth} р. на момент народження дитини (занадто юний вік).`,
              category: 'mother'
            });
          } else if (mAgeAtBirth > 55) {
            issues.push({
              severity: 'warning',
              text: `Матері було понад ${mAgeAtBirth} р. на момент пологів (біологічно вкрай малоймовірно після 50-55 років).`,
              category: 'mother'
            });
          }
        }
      }
    }

    // Between Father and Mother
    if (parsedFatherYear && parsedMotherYear && !isNaN(parsedFatherYear) && !isNaN(parsedMotherYear)) {
      const gap = Math.abs(parsedFatherYear - parsedMotherYear);
      if (gap > 45) {
        issues.push({
          severity: 'warning',
          text: `Незвично велика різниця у віці між батьком (${parsedFatherYear} р.) та матір'ю (${parsedMotherYear} р.) — ${gap} років.`,
          category: 'both'
        });
      }
    }

    // Living status sanity
    if (fatherIsLiving && parsedFatherYear && !isNaN(parsedFatherYear) && currentYear - parsedFatherYear > 115) {
      issues.push({
        severity: 'warning',
        text: `Батька позначено як «Нині живий», але його вік перевищує ${currentYear - parsedFatherYear} р.`,
        category: 'father'
      });
    }
    if (motherIsLiving && parsedMotherYear && !isNaN(parsedMotherYear) && currentYear - parsedMotherYear > 115) {
      issues.push({
        severity: 'warning',
        text: `Матір позначено як «Нині жива», але її вік перевищує ${currentYear - parsedMotherYear} р.`,
        category: 'mother'
      });
    }

    return issues;
  }, [parsedFatherYear, parsedMotherYear, childBirthYear, currentYear, fatherIsLiving, motherIsLiving]);

  const hasCriticalErrors = chronologicalIssues.some((i) => i.severity === 'error');
  const hasWarnings = chronologicalIssues.some((i) => i.severity === 'warning') || fatherDuplicates.length > 0 || motherDuplicates.length > 0;

  const executeSave = () => {
    const hasFather = Boolean(
      selectedExistingFather ||
      fatherFirstName.trim() ||
      fatherLastName.trim()
    );
    const hasMother = Boolean(
      selectedExistingMother ||
      motherFirstName.trim() ||
      motherMaidenName.trim()
    );

    if (!hasFather && !hasMother) {
      alert('Будь ласка, вкажіть ім\'я хоча б одного з батьків або виберіть існуючу особу.');
      return;
    }

    let fatherData: Partial<Person>;
    if (selectedExistingFather) {
      fatherData = {
        id: selectedExistingFather.id,
        firstName: selectedExistingFather.firstName,
        lastName: selectedExistingFather.lastName,
        gender: 'male',
        birthYear: selectedExistingFather.birthYear,
        isLiving: selectedExistingFather.isLiving
      };
    } else {
      fatherData = {
        firstName: fatherFirstName.trim(),
        lastName: (fatherLastName || childSurname).trim(),
        gender: 'male',
        birthYear: parsedFatherYear && !isNaN(parsedFatherYear) ? parsedFatherYear : undefined,
        isLiving: fatherIsLiving,
        birthPlace: sharedPlace.trim() || undefined,
        residencePlace: sharedPlace.trim() || undefined
      };
    }

    let motherData: Partial<Person>;
    if (selectedExistingMother) {
      motherData = {
        id: selectedExistingMother.id,
        firstName: selectedExistingMother.firstName,
        lastName: selectedExistingMother.lastName,
        maidenName: selectedExistingMother.maidenName,
        gender: 'female',
        birthYear: selectedExistingMother.birthYear,
        isLiving: selectedExistingMother.isLiving
      };
    } else {
      const motherSurname = motherMaidenName.trim()
        ? motherMaidenName.trim()
        : adaptUkrainianSurnameForGender(fatherLastName || childSurname, 'female');

      motherData = {
        firstName: motherFirstName.trim(),
        lastName: motherSurname,
        maidenName: motherMaidenName.trim() || undefined,
        gender: 'female',
        birthYear: parsedMotherYear && !isNaN(parsedMotherYear) ? parsedMotherYear : undefined,
        isLiving: motherIsLiving,
        birthPlace: sharedPlace.trim() || undefined,
        residencePlace: sharedPlace.trim() || undefined
      };
    }

    onSaveParents(fatherData, motherData);
  };

  const handlePreSaveClick = () => {
    if (!fatherFirstName.trim() && !motherFirstName.trim() && !selectedExistingFather && !selectedExistingMother) {
      alert('Будь ласка, вкажіть ім\'я хоча б одного з батьків.');
      return;
    }

    if (hasCriticalErrors) {
      // Critical error dialog
      setShowWarningConfirmation(true);
      return;
    }

    if (hasWarnings) {
      // Warning prompt dialog
      setShowWarningConfirmation(true);
      return;
    }

    executeSave();
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`w-full max-w-3xl rounded-2xl border ${theme.cardBorder} ${theme.cardBg} shadow-2xl overflow-hidden animate-in fade-in duration-200 flex flex-col max-h-[92vh]`}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b ${theme.cardBorder} flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-base font-bold ${theme.textPrimary}`}>
                Пакетне додавання батьків
              </h2>
              <p className={`text-xs ${theme.textMuted}`}>
                Дитина:{' '}
                <strong className={theme.textPrimary}>
                  {childPerson.name?.given || childPerson.firstName} {childPerson.name?.surname || childPerson.lastName}
                </strong>
                {childBirthYear ? ` (нар. ${childBirthYear} р.)` : ''}
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

        {/* Scrollable Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Top Info Badge */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Введіть дані обох батьків одночасно. Система автоматично перевірить логіку дат і наявність можливих дублікатів у родовідному дереві.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* ================= FATHER BOX ================= */}
            <div
              className={`p-4 rounded-xl border ${
                selectedExistingFather
                  ? 'border-emerald-500/50 bg-emerald-950/20'
                  : `${theme.borderSubtle} ${theme.surfaceBg}`
              } space-y-3 relative`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
                  <span>👨 Батько</span>
                </div>
                {selectedExistingFather && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                    <UserCheck className="w-3 h-3" />
                    <span>Обрано з бази</span>
                  </span>
                )}
              </div>

              {selectedExistingFather ? (
                <div className="p-3 rounded-lg bg-black/20 border border-emerald-500/30 space-y-2 text-xs">
                  <div className="font-semibold text-emerald-300">
                    {selectedExistingFather.name?.surname || selectedExistingFather.lastName}{' '}
                    {selectedExistingFather.name?.given || selectedExistingFather.firstName}
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    {selectedExistingFather.birthYear ? `Нар. ${selectedExistingFather.birthYear} р.` : 'Рік невідомий'}
                    {selectedExistingFather.birthPlace ? ` • ${selectedExistingFather.birthPlace}` : ''}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedExistingFather(null)}
                    className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 underline cursor-pointer pt-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Скасувати і створити нового батька</span>
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className={`block text-xs font-semibold ${theme.textMuted} mb-1`}>Ім&apos;я</label>
                    <input
                      type="text"
                      value={fatherFirstName}
                      onChange={(e) => setFatherFirstName(e.target.value)}
                      placeholder="напр. Василь"
                      className={`w-full px-3 py-1.5 text-xs rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-hidden focus:ring-1 focus:ring-sky-500`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold ${theme.textMuted} mb-1`}>Прізвище</label>
                    <input
                      type="text"
                      value={fatherLastName}
                      onChange={(e) => setFatherLastName(e.target.value)}
                      placeholder="напр. Петренко"
                      className={`w-full px-3 py-1.5 text-xs rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-hidden focus:ring-1 focus:ring-sky-500`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold ${theme.textMuted} mb-1`}>Рік нар.</label>
                    <input
                      type="text"
                      value={fatherBirthYear}
                      onChange={(e) => setFatherBirthYear(e.target.value)}
                      placeholder="напр. 1880"
                      className={`w-full px-3 py-1.5 text-xs rounded-lg border ${
                        chronologicalIssues.some((i) => i.category === 'father' && i.severity === 'error')
                          ? 'border-rose-500 focus:ring-rose-500'
                          : `${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:ring-sky-500`
                      }`}
                    />
                  </div>

                  {/* High-visibility Life Status Toggle for Father */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={`block text-xs font-semibold ${theme.textMuted}`}>
                        Статус життя батька
                      </label>
                      <span className="text-[10px] font-medium text-neutral-400">
                        За замовчуванням:{' '}
                        <strong className={fatherIsLiving ? 'text-emerald-400' : 'text-amber-400'}>
                          {fatherIsLiving ? 'Нині живий' : 'Спочилий'}
                        </strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFatherIsLiving(false)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-1 cursor-pointer border ${
                          !fatherIsLiving
                            ? 'bg-neutral-800 text-neutral-100 dark:bg-neutral-700 dark:text-white border-neutral-400 shadow-md ring-2 ring-neutral-400/20'
                            : 'bg-black/5 dark:bg-white/5 opacity-50 hover:opacity-85 text-neutral-400 border-neutral-600/30'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span>🕊️</span>
                          <span className="truncate">Спочилий</span>
                        </div>
                        {!fatherIsLiving && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-neutral-900 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-md font-bold shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Вибрано</span>
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setFatherIsLiving(true)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-1 cursor-pointer border ${
                          fatherIsLiving
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-md ring-2 ring-emerald-500/25'
                            : 'bg-black/5 dark:bg-white/5 opacity-50 hover:opacity-85 text-neutral-400 border-neutral-600/30'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span>🌿</span>
                          <span className="truncate">Нині живий</span>
                        </div>
                        {fatherIsLiving && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-700/90 text-white px-1.5 py-0.5 rounded-md font-bold shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Вибрано</span>
                          </span>
                        )}
                      </button>
                    </div>

                    <p className="mt-1 text-[10px] text-neutral-400">
                      {fatherIsLiving
                        ? '✓ Батька буде збережено зі статусом «Нині живий»'
                        : '✓ Батька буде збережено зі статусом «Спочилий» (історичний предок)'}
                    </p>
                  </div>

                  {/* Father Duplicate Warnings & Quick Link */}
                  {fatherDuplicates.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                      <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Можливий дублікат у дереві ({fatherDuplicates[0].confidence}% збіг)</span>
                      </div>
                      {fatherDuplicates.map((dup, idx) => (
                        <div
                          key={`f_dup_${dup.person.id}_${idx}`}
                          className="p-2 rounded-lg bg-black/20 border border-amber-500/20 text-xs flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-200 truncate">
                              {dup.person.name?.surname || dup.person.lastName}{' '}
                              {dup.person.name?.given || dup.person.firstName}
                            </p>
                            <p className="text-[10px] text-neutral-400">
                              {dup.person.birthYear ? `нар. ${dup.person.birthYear} р.` : 'рік невідомий'}
                              {dup.person.birthPlace ? ` • ${dup.person.birthPlace}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedExistingFather(dup.person)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] shrink-0 transition-colors cursor-pointer"
                          >
                            Використати
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ================= MOTHER BOX ================= */}
            <div
              className={`p-4 rounded-xl border ${
                selectedExistingMother
                  ? 'border-emerald-500/50 bg-emerald-950/20'
                  : `${theme.borderSubtle} ${theme.surfaceBg}`
              } space-y-3 relative`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                  <span>👩 Мати</span>
                </div>
                {selectedExistingMother && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                    <UserCheck className="w-3 h-3" />
                    <span>Обрано з бази</span>
                  </span>
                )}
              </div>

              {selectedExistingMother ? (
                <div className="p-3 rounded-lg bg-black/20 border border-emerald-500/30 space-y-2 text-xs">
                  <div className="font-semibold text-emerald-300">
                    {selectedExistingMother.name?.surname || selectedExistingMother.lastName}{' '}
                    {selectedExistingMother.name?.given || selectedExistingMother.firstName}
                    {selectedExistingMother.maidenName ? ` (з дому ${selectedExistingMother.maidenName})` : ''}
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    {selectedExistingMother.birthYear ? `Нар. ${selectedExistingMother.birthYear} р.` : 'Рік невідомий'}
                    {selectedExistingMother.birthPlace ? ` • ${selectedExistingMother.birthPlace}` : ''}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedExistingMother(null)}
                    className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 underline cursor-pointer pt-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Скасувати і створити нову матір</span>
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className={`block text-xs font-semibold ${theme.textMuted} mb-1`}>Ім&apos;я</label>
                    <input
                      type="text"
                      value={motherFirstName}
                      onChange={(e) => setMotherFirstName(e.target.value)}
                      placeholder="напр. Марія"
                      className={`w-full px-3 py-1.5 text-xs rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-hidden focus:ring-1 focus:ring-rose-500`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold ${theme.textMuted} mb-1`}>Дівоче прізвище</label>
                    <input
                      type="text"
                      value={motherMaidenName}
                      onChange={(e) => setMotherMaidenName(e.target.value)}
                      placeholder="напр. Ковальчук (якщо відомо)"
                      className={`w-full px-3 py-1.5 text-xs rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-hidden focus:ring-1 focus:ring-rose-500`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold ${theme.textMuted} mb-1`}>Рік нар.</label>
                    <input
                      type="text"
                      value={motherBirthYear}
                      onChange={(e) => setMotherBirthYear(e.target.value)}
                      placeholder="напр. 1885"
                      className={`w-full px-3 py-1.5 text-xs rounded-lg border ${
                        chronologicalIssues.some((i) => i.category === 'mother' && i.severity === 'error')
                          ? 'border-rose-500 focus:ring-rose-500'
                          : `${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:ring-rose-500`
                      }`}
                    />
                  </div>

                  {/* High-visibility Life Status Toggle for Mother */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={`block text-xs font-semibold ${theme.textMuted}`}>
                        Статус життя матері
                      </label>
                      <span className="text-[10px] font-medium text-neutral-400">
                        За замовчуванням:{' '}
                        <strong className={motherIsLiving ? 'text-emerald-400' : 'text-amber-400'}>
                          {motherIsLiving ? 'Нині жива' : 'Спочила'}
                        </strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMotherIsLiving(false)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-1 cursor-pointer border ${
                          !motherIsLiving
                            ? 'bg-neutral-800 text-neutral-100 dark:bg-neutral-700 dark:text-white border-neutral-400 shadow-md ring-2 ring-neutral-400/20'
                            : 'bg-black/5 dark:bg-white/5 opacity-50 hover:opacity-85 text-neutral-400 border-neutral-600/30'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span>🕊️</span>
                          <span className="truncate">Спочила</span>
                        </div>
                        {!motherIsLiving && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-neutral-900 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-md font-bold shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Вибрано</span>
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setMotherIsLiving(true)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-1 cursor-pointer border ${
                          motherIsLiving
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-md ring-2 ring-emerald-500/25'
                            : 'bg-black/5 dark:bg-white/5 opacity-50 hover:opacity-85 text-neutral-400 border-neutral-600/30'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span>🌿</span>
                          <span className="truncate">Нині жива</span>
                        </div>
                        {motherIsLiving && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-700/90 text-white px-1.5 py-0.5 rounded-md font-bold shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Вибрано</span>
                          </span>
                        )}
                      </button>
                    </div>

                    <p className="mt-1 text-[10px] text-neutral-400">
                      {motherIsLiving
                        ? '✓ Матір буде збережено зі статусом «Нині жива»'
                        : '✓ Матір буде збережено зі статусом «Спочила» (історичний предок)'}
                    </p>
                  </div>

                  {/* Mother Duplicate Warnings & Quick Link */}
                  {motherDuplicates.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                      <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Можливий дублікат у дереві ({motherDuplicates[0].confidence}% збіг)</span>
                      </div>
                      {motherDuplicates.map((dup, idx) => (
                        <div
                          key={`m_dup_${dup.person.id}_${idx}`}
                          className="p-2 rounded-lg bg-black/20 border border-amber-500/20 text-xs flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-200 truncate">
                              {dup.person.name?.surname || dup.person.lastName}{' '}
                              {dup.person.name?.given || dup.person.firstName}
                              {dup.person.maidenName ? ` (${dup.person.maidenName})` : ''}
                            </p>
                            <p className="text-[10px] text-neutral-400">
                              {dup.person.birthYear ? `нар. ${dup.person.birthYear} р.` : 'рік невідомий'}
                              {dup.person.birthPlace ? ` • ${dup.person.birthPlace}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedExistingMother(dup.person)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] shrink-0 transition-colors cursor-pointer"
                          >
                            Використати
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Shared Context Place */}
          <div>
            <label className={`block text-xs font-semibold ${theme.textMuted} mb-1`}>
              Спільний населений пункт родини (село / містечко / повіт)
            </label>
            <input
              type="text"
              value={sharedPlace}
              onChange={(e) => setSharedPlace(e.target.value)}
              placeholder="напр. с. Мошни, Черкаський повіт"
              className={`w-full px-3 py-1.5 text-xs rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
            />
          </div>

          {/* Chronological Issues Inline Warning Box */}
          {chronologicalIssues.length > 0 && (
            <div
              className={`p-3.5 rounded-xl border space-y-1.5 ${
                hasCriticalErrors
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                {hasCriticalErrors ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="text-rose-400">Виявлено неможливі хронологічні дані:</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-amber-400">Хронологічні застереження перед збереженням:</span>
                  </>
                )}
              </div>
              <ul className="list-disc list-inside text-xs space-y-1 pl-1">
                {chronologicalIssues.map((issue, idx) => (
                  <li key={idx} className={issue.severity === 'error' ? 'text-rose-300 font-medium' : 'text-amber-300'}>
                    {issue.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${theme.cardBorder} flex items-center justify-between bg-black/10 shrink-0`}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
          >
            Скасувати
          </button>

          <button
            type="button"
            onClick={handlePreSaveClick}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer ${
              hasCriticalErrors
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : hasWarnings
                ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                : 'bg-amber-500 hover:bg-amber-600 text-neutral-950'
            }`}
          >
            {hasCriticalErrors ? (
              <>
                <AlertCircle className="w-4 h-4" />
                <span>Перевірити помилки років</span>
              </>
            ) : hasWarnings ? (
              <>
                <AlertTriangle className="w-4 h-4" />
                <span>Зберегти сім&apos;ю (є застереження)</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Створити обох батьків та зв&apos;язати сім&apos;ю</span>
              </>
            )}
          </button>
        </div>

        {/* Pre-save Verification Modal Prompt */}
        {showWarningConfirmation && (
          <div className="absolute inset-0 z-70 bg-black/85 backdrop-blur-xs flex items-center justify-center p-6 animate-in fade-in">
            <div className={`w-full max-w-lg p-6 rounded-2xl border ${hasCriticalErrors ? 'border-rose-500/40' : 'border-amber-500/40'} ${theme.cardBg} shadow-2xl space-y-4`}>
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${hasCriticalErrors ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'} shrink-0`}>
                  {hasCriticalErrors ? <AlertCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${theme.textPrimary}`}>
                    {hasCriticalErrors ? 'Помилка у хронології років' : 'Попередження перед збереженням родини'}
                  </h3>
                  <p className={`text-xs ${theme.textMuted} mt-0.5`}>
                    {hasCriticalErrors
                      ? 'Вказано нелогічні роки, які суперечать законам природи та генеалогії:'
                      : 'Виявлено наступні зауваження або потенційні дублікати:'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 max-h-56 overflow-y-auto space-y-2 text-xs">
                {chronologicalIssues.map((issue, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className={issue.severity === 'error' ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold'}>•</span>
                    <span className={issue.severity === 'error' ? 'text-rose-300 font-semibold' : 'text-neutral-300'}>
                      {issue.text}
                    </span>
                  </div>
                ))}

                {fatherDuplicates.length > 0 && !selectedExistingFather && (
                  <div className="flex items-start gap-2 pt-1">
                    <span className="text-amber-400 font-bold">•</span>
                    <span className="text-neutral-300">
                      Для батька є схожий запис у базі: {fatherDuplicates[0].person.name?.surname} {fatherDuplicates[0].person.name?.given} ({fatherDuplicates[0].confidence}% збіг).
                    </span>
                  </div>
                )}

                {motherDuplicates.length > 0 && !selectedExistingMother && (
                  <div className="flex items-start gap-2 pt-1">
                    <span className="text-amber-400 font-bold">•</span>
                    <span className="text-neutral-300">
                      Для матері є схожий запис у базі: {motherDuplicates[0].person.name?.surname} {motherDuplicates[0].person.name?.given} ({motherDuplicates[0].confidence}% збіг).
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWarningConfirmation(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
                >
                  Повернутися та виправити
                </button>

                {!hasCriticalErrors && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowWarningConfirmation(false);
                      executeSave();
                    }}
                    className="px-4 py-2 text-xs font-bold text-neutral-950 bg-amber-500 hover:bg-amber-400 rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    Все одно підтвердити та зберегти
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
