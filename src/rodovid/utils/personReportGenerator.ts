/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Person, GenealogyDatabase, PersonLifeEventItem, GodparentItem, CustomFieldItem } from '../types/genealogy';
import { getFullName } from './relationship';
import { comparePersonsByAge, getPersonBirthYear } from './treeLayout';

export interface PersonReportOptions {
  includeBio?: boolean;
  includeEvents?: boolean;
  includeRelations?: boolean;
  includeExtendedRelations?: boolean; // Grandparents, grandchildren, godparents
  includeSources?: boolean;
  includeCustomFields?: boolean;
  maskLiving?: boolean;
}

const DEFAULT_OPTIONS: PersonReportOptions = {
  includeBio: true,
  includeEvents: true,
  includeRelations: true,
  includeExtendedRelations: true,
  includeSources: true,
  includeCustomFields: true,
  maskLiving: false
};

/**
 * Format lifespan string, e.g.: "(1814 — 1861, 47 років)" or "(нар. 1954, 72 роки)"
 */
export function formatPersonLifespan(p?: Person | null): string {
  if (!p) return '';
  const birthYear = p.birthYear || (p.birthDate ? p.birthDate.match(/\b(1\d{3}|20\d{2})\b/)?.[1] : undefined);
  const deathYear = p.deathYear || (p.deathDate ? p.deathDate.match(/\b(1\d{3}|20\d{2})\b/)?.[1] : undefined);
  const isLiving = p.isLiving === true || (!deathYear && !p.deathDate && birthYear && Number(birthYear) > 1925);

  const bNum = birthYear ? Number(birthYear) : undefined;
  const dNum = deathYear ? Number(deathYear) : undefined;

  let ageStr = '';
  if (bNum && dNum && dNum >= bNum) {
    const age = dNum - bNum;
    ageStr = `, ${age} ${getUkrainianAgeWord(age)}`;
  } else if (bNum && isLiving) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - bNum;
    if (age >= 0 && age < 120) {
      ageStr = `, ${age} ${getUkrainianAgeWord(age)}`;
    }
  }

  if (birthYear && deathYear) {
    return `(${birthYear} — ${deathYear}${ageStr})`;
  } else if (birthYear) {
    return isLiving ? `(нар. ${birthYear}${ageStr})` : `(нар. ${birthYear})`;
  } else if (deathYear) {
    return `(пом. ${deathYear})`;
  }
  return '';
}

function getUkrainianAgeWord(age: number): string {
  const mod10 = age % 10;
  const mod100 = age % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'років';
  if (mod10 === 1) return 'рік';
  if (mod10 >= 2 && mod10 <= 4) return 'роки';
  return 'років';
}

function getGenderLabel(gender?: string): string {
  if (gender === 'male' || gender === 'M') return 'Чоловіча';
  if (gender === 'female' || gender === 'F') return 'Жіноча';
  return 'Не вказано';
}

function getResearchStatusLabel(status?: string): string {
  switch (status) {
    case 'confirmed': return 'Підтверджено архівними даними';
    case 'hypothetical': return 'Гіпотеза / Потребує перевірки';
    case 'in_progress': return 'В процесі дослідження';
    case 'archival_search': return 'Пошук в архівах';
    case 'needs_verification': return 'Потребує верифікації';
    default: return status || 'Основний запис';
  }
}

/**
 * Generate a clean, highly readable plain-text report of a person
 */
export function generatePersonTextReport(
  person: Person,
  database: GenealogyDatabase,
  userOptions?: PersonReportOptions
): string {
  const opts = { ...DEFAULT_OPTIONS, ...userOptions };
  const lines: string[] = [];

  const sepDouble = '═'.repeat(64);
  const sepSingle = '─'.repeat(64);

  const fullName = getFullName(person);
  const lifespan = formatPersonLifespan(person);
  const isLiving = person.isLiving === true || (!person.deathDate && !person.deathYear);

  lines.push(sepDouble);
  lines.push('             ГЕНЕАЛОГІЧНИЙ ЗВІТ ПРО ОСОБУ');
  lines.push(sepDouble);
  lines.push(`ПІБ:             ${fullName} ${lifespan}`.trim());

  if (person.maidenName && (person.gender === 'female' || person.gender === 'F')) {
    lines.push(`Дівоче прізвище: ${person.maidenName}`);
  }
  if (person.nameVariants && person.nameVariants.length > 0) {
    lines.push(`Варіанти імені:  ${person.nameVariants.join(', ')}`);
  }
  if (person.surnameVariants && person.surnameVariants.length > 0) {
    lines.push(`Варіанти прізв.: ${person.surnameVariants.join(', ')}`);
  }

  lines.push(`Стать:           ${getGenderLabel(person.gender)}`);
  lines.push(`Життєвий статус: ${isLiving ? 'Жива особа' : 'Померла особа'}`);
  
  if (person.researchBranch && person.researchBranch !== "Без прив'язки") {
    lines.push(`Гілка родоводу:  ${person.researchBranch}`);
  }
  if (person.researchStatus) {
    lines.push(`Статус пошуку:   ${getResearchStatusLabel(person.researchStatus)}`);
  }
  if (person.occupation) {
    lines.push(`Рід занять / фах: ${person.occupation}`);
  }
  if (person.socialStatus || person.estate || person.estateOrSocialStatus) {
    lines.push(`Стан / суспільство: ${person.socialStatus || person.estate || person.estateOrSocialStatus}`);
  }
  if (person.militaryRank) {
    lines.push(`Військове звання: ${person.militaryRank}`);
  }
  if (person.confession) {
    lines.push(`Віросповідання:  ${person.confession}`);
  }
  if (person.residencePlace) {
    lines.push(`Місце проживання: ${person.residencePlace}`);
  }

  // 1. DATES & PLACES
  lines.push('');
  lines.push(sepSingle);
  lines.push('ЖИТТЄВИЙ ЦИКЛ (ДАТИ ТА МІСЦЯ)');
  lines.push(sepSingle);

  let hasLifecycle = false;
  if (person.birthDate || person.birthYear || person.birthPlace) {
    hasLifecycle = true;
    const bDate = person.birthDate || person.birthYear || 'Дата невідома';
    const bPlace = person.birthPlace ? ` — ${person.birthPlace}` : '';
    lines.push(`• Народження:    ${bDate}${bPlace}`);
  }

  // Look for baptism in events
  const baptismEvent = (person.events || []).find(
    (e) => e.type === 'baptism' || (e.title && e.title.toLowerCase().includes('хрещ'))
  );
  if (baptismEvent) {
    hasLifecycle = true;
    const bpDate = baptismEvent.date || baptismEvent.year || 'Дата невідома';
    const bpPlace = baptismEvent.place ? ` — ${baptismEvent.place}` : '';
    lines.push(`• Хрещення:      ${bpDate}${bpPlace}`);
  }

  if (person.marriageDate || person.marriagePlace) {
    hasLifecycle = true;
    const mDate = person.marriageDate || 'Дата невідома';
    const mPlace = person.marriagePlace ? ` — ${person.marriagePlace}` : '';
    lines.push(`• Шлюб / вінчання: ${mDate}${mPlace}`);
  }

  if (person.deathDate || person.deathYear || person.deathPlace || person.deathReason) {
    hasLifecycle = true;
    const dDate = person.deathDate || person.deathYear || 'Дата невідома';
    const dPlace = person.deathPlace ? ` — ${person.deathPlace}` : '';
    const dReason = person.deathReason ? ` (Причина: ${person.deathReason})` : '';
    lines.push(`• Смерть:        ${dDate}${dPlace}${dReason}`);
  }

  // Look for burial in events
  const burialEvent = (person.events || []).find(
    (e) => e.type === 'burial' || (e.title && e.title.toLowerCase().includes('похов'))
  );
  if (burialEvent) {
    hasLifecycle = true;
    const buDate = burialEvent.date || burialEvent.year || 'Дата невідома';
    const buPlace = burialEvent.place ? ` — ${burialEvent.place}` : '';
    lines.push(`• Поховання:     ${buDate}${buPlace}`);
  }

  if (!hasLifecycle) {
    lines.push('Точні дати та місця життєвого циклу не зафіксовані в базі даних.');
  }

  // 2. CHRONOLOGY OF LIFE EVENTS
  if (opts.includeEvents && person.events && person.events.length > 0) {
    lines.push('');
    lines.push(sepSingle);
    lines.push(`ХРОНОЛОГІЯ ПОДІЙ ТА ФАКТІВ (${person.events.length})`);
    lines.push(sepSingle);

    const sortedEvents = [...person.events].sort((a, b) => {
      const yA = a.year ? Number(a.year) : (a.date?.match(/\b(1\d{3}|20\d{2})\b/)?.[1] ? Number(a.date.match(/\b(1\d{3}|20\d{2})\b/)?.[1]) : 9999);
      const yB = b.year ? Number(b.year) : (b.date?.match(/\b(1\d{3}|20\d{2})\b/)?.[1] ? Number(b.date.match(/\b(1\d{3}|20\d{2})\b/)?.[1]) : 9999);
      return yA - yB;
    });

    sortedEvents.forEach((ev: PersonLifeEventItem, idx: number) => {
      const datePart = ev.date || (ev.year ? String(ev.year) : 'Рік невідомий');
      const titlePart = ev.title || ev.type || 'Подія';
      const placePart = ev.place ? ` [${ev.place}]` : '';
      const descPart = ev.description ? `\n     Опис: ${ev.description}` : '';
      const srcPart = ev.source ? `\n     Джерело: ${ev.source}` : '';
      lines.push(`${idx + 1}. ${datePart} — ${titlePart}${placePart}${descPart}${srcPart}`);
    });
  }

  // 3. FAMILY RELATIONS
  if (opts.includeRelations) {
    lines.push('');
    lines.push(sepSingle);
    lines.push('РОДИННІ ЗВ\'ЯЗКИ ТА СПОРІДНЕНІСТЬ');
    lines.push(sepSingle);

    // Parents
    const fId = person.fatherId || (person.parentFamilyId ? database.families[person.parentFamilyId]?.husbandId : undefined);
    const mId = person.motherId || (person.parentFamilyId ? database.families[person.parentFamilyId]?.wifeId : undefined);
    const father = fId ? database.persons[fId] : null;
    const mother = mId ? database.persons[mId] : null;

    lines.push('БАТЬКИ:');
    if (father) {
      lines.push(`  • Батько:  ${getFullName(father)} ${formatPersonLifespan(father)}`);
    } else {
      lines.push('  • Батько:  Невідомо');
    }
    if (mother) {
      lines.push(`  • Мати:    ${getFullName(mother)} ${formatPersonLifespan(mother)}`);
    } else {
      lines.push('  • Мати:    Невідомо');
    }

    // Extended Relations: Grandparents
    if (opts.includeExtendedRelations && (father || mother)) {
      const patGFId = father ? (father.fatherId || (father.parentFamilyId ? database.families[father.parentFamilyId]?.husbandId : undefined)) : undefined;
      const patGMId = father ? (father.motherId || (father.parentFamilyId ? database.families[father.parentFamilyId]?.wifeId : undefined)) : undefined;
      const matGFId = mother ? (mother.fatherId || (mother.parentFamilyId ? database.families[mother.parentFamilyId]?.husbandId : undefined)) : undefined;
      const matGMId = mother ? (mother.motherId || (mother.parentFamilyId ? database.families[mother.parentFamilyId]?.wifeId : undefined)) : undefined;

      const patGF = patGFId ? database.persons[patGFId] : null;
      const patGM = patGMId ? database.persons[patGMId] : null;
      const matGF = matGFId ? database.persons[matGFId] : null;
      const matGM = matGMId ? database.persons[matGMId] : null;

      if (patGF || patGM || matGF || matGM) {
        lines.push('');
        lines.push('ДІДУСІ ТА БАБУСІ:');
        if (patGF) lines.push(`  • Дід (по батькові):   ${getFullName(patGF)} ${formatPersonLifespan(patGF)}`);
        if (patGM) lines.push(`  • Бабуся (по батькові): ${getFullName(patGM)} ${formatPersonLifespan(patGM)}`);
        if (matGF) lines.push(`  • Дід (по матері):     ${getFullName(matGF)} ${formatPersonLifespan(matGF)}`);
        if (matGM) lines.push(`  • Бабуся (по матері):   ${getFullName(matGM)} ${formatPersonLifespan(matGM)}`);
      }
    }

    // Spouses
    const spouseIdSet = new Set<string>();
    if (person.spouseIds) person.spouseIds.forEach((s) => spouseIdSet.add(s));
    if (person.spouseFamilyIds) {
      person.spouseFamilyIds.forEach((fId) => {
        const fam = database.families[fId];
        if (fam) {
          if (fam.husbandId && fam.husbandId !== person.id) spouseIdSet.add(fam.husbandId);
          if (fam.wifeId && fam.wifeId !== person.id) spouseIdSet.add(fam.wifeId);
        }
      });
    }
    const spouses = Array.from(spouseIdSet)
      .map((id) => database.persons[id])
      .filter((p): p is Person => Boolean(p));

    lines.push('');
    lines.push(`ПОДРУЖЖЯ / ПАРТНЕРИ (${spouses.length}):`);
    if (spouses.length > 0) {
      spouses.forEach((sp, idx) => {
        lines.push(`  ${idx + 1}. ${getFullName(sp)} ${formatPersonLifespan(sp)}`);
      });
    } else {
      lines.push('  • Дані про шлюб відсутні');
    }

    // Children
    const childIdSet = new Set<string>();
    if (person.childrenIds) person.childrenIds.forEach((c) => childIdSet.add(c));
    Object.values(database.persons).forEach((p) => {
      if (p.fatherId === person.id || p.motherId === person.id) childIdSet.add(p.id);
    });
    if (person.spouseFamilyIds) {
      person.spouseFamilyIds.forEach((fId) => {
        const fam = database.families[fId];
        if (fam && fam.childrenIds) fam.childrenIds.forEach((cId) => childIdSet.add(cId));
      });
    }
    const children = Array.from(childIdSet)
      .map((id) => database.persons[id])
      .filter((p): p is Person => Boolean(p))
      .sort((a, b) => comparePersonsByAge(a, b));

    lines.push('');
    lines.push(`ДІТИ (${children.length}):`);
    if (children.length > 0) {
      children.forEach((c, idx) => {
        const ageRelation = getAgeRelation(person, c);
        lines.push(`  ${idx + 1}. ${getFullName(c)} ${formatPersonLifespan(c)}${ageRelation ? ` [${ageRelation}]` : ''}`);
      });
    } else {
      lines.push('  • Дітей не зафіксовано');
    }

    // Siblings
    const siblingIdSet = new Set<string>();
    if (person.siblingIds) {
      person.siblingIds.forEach((s) => {
        if (s !== person.id) siblingIdSet.add(s);
      });
    }
    Object.values(database.persons).forEach((p) => {
      if (p.id === person.id) return;
      const pF = p.fatherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
      const pM = p.motherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);
      if ((fId && pF === fId) || (mId && pM === mId) || (p.siblingIds && p.siblingIds.includes(person.id))) {
        siblingIdSet.add(p.id);
      }
    });

    const siblings = Array.from(siblingIdSet)
      .map((id) => database.persons[id])
      .filter((p): p is Person => Boolean(p))
      .sort((a, b) => comparePersonsByAge(a, b));

    lines.push('');
    lines.push(`БРАТИ ТА СЕСТРИ (${siblings.length}):`);
    if (siblings.length > 0) {
      siblings.forEach((s, idx) => {
        const siblingType = getSiblingRole(person, s);
        lines.push(`  ${idx + 1}. ${getFullName(s)} ${formatPersonLifespan(s)} — ${siblingType}`);
      });
    } else {
      lines.push('  • Рідні брати або сестри не вказані');
    }

    // Grandchildren
    if (opts.includeExtendedRelations && children.length > 0) {
      const grandChildrenList: Person[] = [];
      children.forEach((child) => {
        const gIds = child.childrenIds || [];
        Object.values(database.persons).forEach((p) => {
          if (p.fatherId === child.id || p.motherId === child.id) {
            if (!gIds.includes(p.id)) gIds.push(p.id);
          }
        });
        gIds.forEach((gId) => {
          const gc = database.persons[gId];
          if (gc && !grandChildrenList.some((existing) => existing.id === gc.id)) {
            grandChildrenList.push(gc);
          }
        });
      });

      if (grandChildrenList.length > 0) {
        grandChildrenList.sort((a, b) => comparePersonsByAge(a, b));
        lines.push('');
        lines.push(`ОНУКИ (${grandChildrenList.length}):`);
        grandChildrenList.forEach((gc, idx) => {
          lines.push(`  ${idx + 1}. ${getFullName(gc)} ${formatPersonLifespan(gc)}`);
        });
      }
    }

    // Godparents
    if (opts.includeExtendedRelations && person.godparents && person.godparents.length > 0) {
      lines.push('');
      lines.push(`ХРЕЩЕНІ БАТЬКИ (КУМИ) ТА СВІДКИ (${person.godparents.length}):`);
      person.godparents.forEach((gp: GodparentItem, idx: number) => {
        const roleStr = gp.role === 'godfather' ? 'Хрещений батько' : gp.role === 'godmother' ? 'Хрещена мати' : gp.role === 'witness' ? 'Свідок' : (gp.role || 'Хрещений');
        const notes = gp.notes ? ` (${gp.notes})` : '';
        lines.push(`  ${idx + 1}. ${roleStr}: ${gp.name}${notes}`);
      });
    }
  }

  // 4. BIOGRAPHY & RESEARCH NOTES
  if (opts.includeBio) {
    if (person.bio || person.notes) {
      lines.push('');
      lines.push(sepSingle);
      lines.push('БІОГРАФІЧНІ ДАНІ ТА НОТАТКИ');
      lines.push(sepSingle);
      if (person.bio) {
        lines.push('Біографічний нарис:');
        lines.push(person.bio);
      }
      if (person.notes) {
        if (person.bio) lines.push('');
        lines.push('Дослідницькі примітки:');
        lines.push(person.notes);
      }
    }
  }

  // 5. CUSTOM FIELDS & ATTRIBUTES
  if (opts.includeCustomFields && person.customFields) {
    const fields = Array.isArray(person.customFields)
      ? person.customFields
      : Object.entries(person.customFields).map(([key, value]) => ({ key, label: key, value: String(value) }));

    if (fields.length > 0) {
      lines.push('');
      lines.push(sepSingle);
      lines.push('ДОДАТКОВІ ВІДОМОСТІ ТА АТРИБУТИ');
      lines.push(sepSingle);
      fields.forEach((f: CustomFieldItem) => {
        const label = f.label || f.key || 'Атрибут';
        lines.push(`• ${label}: ${f.value}`);
      });
    }
  }

  // 6. SOURCES & CITATIONS
  if (opts.includeSources) {
    const sourceList: string[] = [];
    if (person.sourceCitations) {
      person.sourceCitations.forEach((c) => sourceList.push(c));
    }
    if (person.sourceIds) {
      person.sourceIds.forEach((sId) => {
        const src = database.sources[sId];
        if (src) {
          const ref = src.archiveReference || src.archive;
          sourceList.push(`${src.title}${ref ? ` [${ref}]` : ''}${src.author ? ` (${src.author})` : ''}`);
        }
      });
    }
    if (person.documents && person.documents.length > 0) {
      person.documents.forEach((d) => {
        sourceList.push(`Документ: ${d.title}${d.archiveRef ? ` (архівний шифр: ${d.archiveRef})` : ''}`);
      });
    }

    if (sourceList.length > 0) {
      lines.push('');
      lines.push(sepSingle);
      lines.push(`АРХІВНІ ДЖЕРЕЛА ТА ПОСИЛАННЯ (${sourceList.length})`);
      lines.push(sepSingle);
      sourceList.forEach((s, idx) => {
        lines.push(`${idx + 1}. ${s}`);
      });
    }
  }

  // Footer
  lines.push('');
  lines.push(sepDouble);
  const now = new Date();
  const dateStr = now.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  lines.push(`Сформовано в системі «Родовід» | Дата: ${dateStr} ${timeStr}`);
  lines.push(sepDouble);

  return lines.join('\n');
}

function getSiblingRole(current: Person, sibling: Person): string {
  const isFemale = sibling.gender === 'female' || sibling.gender === 'F';
  const yearCur = getPersonBirthYear(current);
  const yearSib = getPersonBirthYear(sibling);

  if (yearCur !== 9999 && yearSib !== 9999) {
    if (yearSib < yearCur) {
      return isFemale ? 'старша сестра' : 'старший брат';
    } else if (yearSib > yearCur) {
      return isFemale ? 'молодша сестра' : 'молодший брат';
    } else {
      return isFemale ? 'сестра (одноліток/близнюк)' : 'брат (одноліток/близнюк)';
    }
  }
  return isFemale ? 'сестра' : 'брат';
}

function getAgeRelation(parent: Person, child: Person): string {
  const pYear = getPersonBirthYear(parent);
  const cYear = getPersonBirthYear(child);
  if (pYear !== 9999 && cYear !== 9999 && cYear >= pYear) {
    const parentAgeAtBirth = cYear - pYear;
    return `народжений у віці батьків: ${parentAgeAtBirth} р.`;
  }
  return '';
}

/**
 * Trigger immediate download of the plain text report as a .txt file
 */
export function downloadPersonTextReport(
  person: Person,
  database: GenealogyDatabase,
  options?: PersonReportOptions
): void {
  const reportText = generatePersonTextReport(person, database, options);
  const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const rawSurname = person.name?.surname || person.lastName || 'Особа';
  const rawGiven = person.name?.given || person.firstName || '';
  const safeFileName = `Звіт_${rawSurname}_${rawGiven}`.replace(/[\s/\\?%*:|"<>]+/g, '_').replace(/_+$/, '');
  a.download = `${safeFileName}.txt`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy plain text report to clipboard
 */
export async function copyPersonTextReport(
  person: Person,
  database: GenealogyDatabase,
  options?: PersonReportOptions
): Promise<boolean> {
  const text = generatePersonTextReport(person, database, options);
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback to execCommand
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

/**
 * Print-to-PDF helper: creates a hidden iframe with standard A4 print styling and opens the print dialog
 */
export function printPersonReport(
  person: Person,
  database: GenealogyDatabase,
  options?: PersonReportOptions
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const fullName = getFullName(person);
  const lifespan = formatPersonLifespan(person);
  const reportText = generatePersonTextReport(person, database, opts);

  // Build clean print-friendly HTML for pristine A4 printing/PDF generation
  const printHtml = `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <title>Генеалогічний звіт — ${fullName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #b88e3e;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .emblem {
      font-size: 18pt;
      color: #b88e3e;
      margin-bottom: 4px;
    }
    .sub-title {
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #71717a;
      margin-bottom: 4px;
      font-family: Arial, sans-serif;
    }
    h1 {
      font-size: 18pt;
      margin: 4px 0;
      color: #111827;
      font-weight: bold;
    }
    .lifespan {
      font-size: 12pt;
      color: #b45309;
      font-style: italic;
    }
    .meta-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      font-size: 9pt;
      font-family: Arial, sans-serif;
      margin-top: 6px;
      color: #4b5563;
    }
    .meta-badge {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .content-box {
      font-family: 'Courier New', Courier, monospace;
      font-size: 9.5pt;
      line-height: 1.45;
      white-space: pre-wrap;
      background: #fafafa;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 16px;
      margin-top: 12px;
      color: #1f2937;
    }
    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      font-size: 8pt;
      font-family: Arial, sans-serif;
      color: #9ca3af;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="emblem">❖ РОДОВІД ❖</div>
    <div class="sub-title">Генеалогічна довідка про особу</div>
    <h1>${fullName}</h1>
    <div class="lifespan">${lifespan}</div>
    <div class="meta-bar">
      <span class="meta-badge">Стать: ${getGenderLabel(person.gender)}</span>
      ${person.researchBranch ? `<span class="meta-badge">Гілка: ${person.researchBranch}</span>` : ''}
      ${person.occupation ? `<span class="meta-badge">Фах: ${person.occupation}</span>` : ''}
    </div>
  </div>

  <div class="content-box">${escapeHtml(reportText)}</div>

  <div class="footer">
    <span>Електронна генеалогічна картка «Родовід»</span>
    <span>Складено: ${new Date().toLocaleDateString('uk-UA')}</span>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

  // Create temporary invisible iframe to isolate print styling
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(printHtml);
    doc.close();
  }

  // Remove iframe after print dialog is closed or after 2 minutes
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }, 120000);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
