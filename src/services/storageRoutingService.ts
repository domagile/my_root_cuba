/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Person, PersonDocumentItem } from '../types';
import { isPersonLiving } from '../rodovid/utils/privacy';
import { generatePersonArchivePath, getGitHubConfig } from './githubService';

export interface StorageRoutingPolicy {
  targetStorage: 'github' | 'gdrive';
  isLiving: boolean;
  isDeceased: boolean;
  title: string;
  badgeLabel: string;
  badgeColor: 'purple' | 'blue';
  description: string;
  privacyWarning?: string;
  suggestedPathOrQuery: string;
}

/**
 * Checks whether the person is deceased
 */
export function isPersonDeceased(person?: Person | null): boolean {
  if (!person) return false;
  return !isPersonLiving(person);
}

/**
 * Determines the smart storage destination based on the person's life status:
 * - Deceased ancestors -> GitHub Repository (open/versioned historical archive for metric books, censuses)
 * - Living relatives -> Google Drive (private, GDPR-compliant cloud storage with access control)
 */
export function getStorageRoutingPolicy(person?: Person | null): StorageRoutingPolicy {
  const isLiving = person ? isPersonLiving(person) : false;
  const isDeceased = !isLiving;

  const githubConfig = getGitHubConfig();
  const personName = person
    ? [person.lastName || person.name?.surname || '', person.firstName || person.name?.given || ''].filter(Boolean).join(' ') || person.id
    : '';

  if (isDeceased) {
    const archivePath = person
      ? generatePersonArchivePath(person, 'метрика_або_документ.jpg', githubConfig.baseFolder || 'archive')
      : 'archive/ancestor/...';

    return {
      targetStorage: 'github',
      isLiving: false,
      isDeceased: true,
      title: 'GitHub Архів (для померлої особи)',
      badgeLabel: '📜 GitHub Архів',
      badgeColor: 'purple',
      description:
        'Для померлої особи історичні метричні книги, ревізькі казки, сповідні розписи та архівні документи зберігаються у версіованому репозиторії GitHub для вічного збереження спадщини роду.',
      suggestedPathOrQuery: archivePath
    };
  }

  // Living person -> Google Drive
  const driveSearchUrl = personName
    ? `https://drive.google.com/drive/search?q=${encodeURIComponent(personName)}`
    : 'https://drive.google.com/drive/my-drive';

  return {
    targetStorage: 'gdrive',
    isLiving: true,
    isDeceased: false,
    title: 'Google Диск (для живої особи)',
    badgeLabel: '🌿 Google Диск (Приватне)',
    badgeColor: 'blue',
    description:
      'Для живої особи діє режим захисту персональних даних (GDPR). Рекомендовано зберігати документи у приватному сховищі Google Drive з контрольованим рівнем доступу.',
    privacyWarning:
      'Увага: для живих осіб не рекомендовано завантажувати документи у публічний Git-репозиторій. Використовуйте Google Диск для збереження конфіденційності.',
    suggestedPathOrQuery: driveSearchUrl
  };
}

/**
 * Generate Google Drive search URL for a person
 */
export function getGoogleDrivePersonUrl(person?: Person | null): string {
  if (!person) return 'https://drive.google.com/drive/my-drive';
  const personName = [person.lastName || person.name?.surname || '', person.firstName || person.name?.given || ''].filter(Boolean).join(' ');
  if (!personName) return 'https://drive.google.com/drive/my-drive';
  return `https://drive.google.com/drive/search?q=${encodeURIComponent(personName)}`;
}

/**
 * Validate user storage choice against privacy guidelines
 */
export function validateStorageChoice(
  person: Person | null | undefined,
  chosenStorage: 'github' | 'gdrive' | 'firestore' | 'external'
): { isValid: boolean; warning?: string } {
  if (!person) return { isValid: true };

  const isLiving = isPersonLiving(person);

  if (isLiving && chosenStorage === 'github') {
    return {
      isValid: true,
      warning:
        '⚠️ Особа є живою! Публікація документів у GitHub-репозиторій може зробити персональні дані загальнодоступними. Якщо це приватний репозиторій — це допустимо, але рекомендується використовувати Google Drive.'
    };
  }

  if (!isLiving && chosenStorage === 'gdrive') {
    return {
      isValid: true,
      warning:
        '💡 Підказка: Для померлих предків краще зберігати метричні книги та архівні скани в GitHub Архіві, щоб зберегти структуровану історію роду.'
    };
  }

  return { isValid: true };
}
