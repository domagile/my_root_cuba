/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Person, PersonDocumentItem, GitHubStorageConfig } from '../types';
import { getGitHubConfig, generatePersonArchivePath, uploadFileToGitHub } from './githubService';
import { useGenealogyStore } from '../stores/useGenealogyStore';

export interface ScanItemToMigrate {
  id: string;
  personId: string;
  personName: string;
  personGeneration?: number;
  itemType: 'document' | 'photo' | 'avatar' | 'birth_scan' | 'marriage_scan' | 'death_scan';
  docIndex?: number;
  title: string;
  dataBase64: string;
  sizeBytes: number;
  suggestedPath: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'skipped';
  newUrl?: string;
  error?: string;
}

export interface UnmigratedScansReport {
  totalItems: number;
  totalSizeBytes: number;
  items: ScanItemToMigrate[];
}

export interface MigrationProgress {
  total: number;
  current: number;
  currentTitle: string;
  percent: number;
  bytesFreed: number;
  failedCount: number;
}

export interface MigrationResult {
  success: boolean;
  totalProcessed: number;
  migratedCount: number;
  failedCount: number;
  bytesFreed: number;
  items: ScanItemToMigrate[];
  error?: string;
}

/**
 * Format bytes to readable string (KB / MB)
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 Б';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

/**
 * Approximate byte length of a Base64 string
 */
function estimateBase64Bytes(b64: string): number {
  if (!b64) return 0;
  const clean = b64.includes(',') ? b64.split(',')[1] : b64;
  return Math.round((clean.length * 3) / 4);
}

/**
 * Scan all persons in the database and find all embedded Base64 scans/photos
 */
export function detectUnmigratedScans(persons: Person[]): UnmigratedScansReport {
  const items: ScanItemToMigrate[] = [];
  let totalSizeBytes = 0;
  const config = getGitHubConfig();
  const baseFolder = config.baseFolder || 'archive';

  (persons || []).forEach((person) => {
    if (!person || person.isDeleted) return;

    const personName = `${person.lastName || person.name?.surname || ''} ${person.firstName || person.name?.given || ''}`.trim() || person.id;

    // 1. Documents
    if (person.documents && Array.isArray(person.documents)) {
      person.documents.forEach((doc, idx) => {
        if (doc && doc.url && (doc.url.startsWith('data:') || doc.storageType === 'firestore')) {
          const size = estimateBase64Bytes(doc.url);
          const safeName = (doc.title || `документ_${idx + 1}`).replace(/[^\w\dа-яіїєґА-ЯІЇЄҐ\-_\.]/g, '_') + '.jpg';
          const suggestedPath = generatePersonArchivePath(person, safeName, baseFolder);

          items.push({
            id: `doc_${person.id}_${doc.id || idx}`,
            personId: person.id,
            personName,
            personGeneration: person.generation,
            itemType: 'document',
            docIndex: idx,
            title: doc.title || `Архівний документ #${idx + 1}`,
            dataBase64: doc.url,
            sizeBytes: size,
            suggestedPath,
            status: 'pending'
          });
          totalSizeBytes += size;
        }
      });
    }

    // 2. Photos
    if (person.photos && Array.isArray(person.photos)) {
      person.photos.forEach((ph, idx) => {
        if (ph && ph.startsWith('data:')) {
          const size = estimateBase64Bytes(ph);
          const safeName = `фото_${idx + 1}.jpg`;
          const suggestedPath = generatePersonArchivePath(person, safeName, baseFolder);

          items.push({
            id: `photo_${person.id}_${idx}`,
            personId: person.id,
            personName,
            personGeneration: person.generation,
            itemType: 'photo',
            docIndex: idx,
            title: `Світлина #${idx + 1}`,
            dataBase64: ph,
            sizeBytes: size,
            suggestedPath,
            status: 'pending'
          });
          totalSizeBytes += size;
        }
      });
    }

    // 3. Avatar
    if (person.avatar && person.avatar.startsWith('data:')) {
      const size = estimateBase64Bytes(person.avatar);
      const safeName = `портрет.jpg`;
      const suggestedPath = generatePersonArchivePath(person, safeName, baseFolder);

      items.push({
        id: `avatar_${person.id}`,
        personId: person.id,
        personName,
        personGeneration: person.generation,
        itemType: 'avatar',
        title: `Портрет особи`,
        dataBase64: person.avatar,
        sizeBytes: size,
        suggestedPath,
        status: 'pending'
      });
      totalSizeBytes += size;
    }

    // 4. Life Events Scan URLs (Birth, Marriage, Death)
    if (person.birthScanUrl && person.birthScanUrl.startsWith('data:')) {
      const size = estimateBase64Bytes(person.birthScanUrl);
      const safeName = `метрика_народження_${person.birthYear || 'запис'}.jpg`;
      const suggestedPath = generatePersonArchivePath(person, safeName, baseFolder);

      items.push({
        id: `birth_scan_${person.id}`,
        personId: person.id,
        personName,
        personGeneration: person.generation,
        itemType: 'birth_scan',
        title: person.birthScanTitle || `Скан метрики про народження`,
        dataBase64: person.birthScanUrl,
        sizeBytes: size,
        suggestedPath,
        status: 'pending'
      });
      totalSizeBytes += size;
    }

    if (person.marriageScanUrl && person.marriageScanUrl.startsWith('data:')) {
      const size = estimateBase64Bytes(person.marriageScanUrl);
      const safeName = `метрика_шлюб.jpg`;
      const suggestedPath = generatePersonArchivePath(person, safeName, baseFolder);

      items.push({
        id: `marriage_scan_${person.id}`,
        personId: person.id,
        personName,
        personGeneration: person.generation,
        itemType: 'marriage_scan',
        title: person.marriageScanTitle || `Скан вінчального запису`,
        dataBase64: person.marriageScanUrl,
        sizeBytes: size,
        suggestedPath,
        status: 'pending'
      });
      totalSizeBytes += size;
    }

    if (person.deathScanUrl && person.deathScanUrl.startsWith('data:')) {
      const size = estimateBase64Bytes(person.deathScanUrl);
      const safeName = `метрика_смерть_${person.deathYear || 'запис'}.jpg`;
      const suggestedPath = generatePersonArchivePath(person, safeName, baseFolder);

      items.push({
        id: `death_scan_${person.id}`,
        personId: person.id,
        personName,
        personGeneration: person.generation,
        itemType: 'death_scan',
        title: person.deathScanTitle || `Скан метрики про смерть`,
        dataBase64: person.deathScanUrl,
        sizeBytes: size,
        suggestedPath,
        status: 'pending'
      });
      totalSizeBytes += size;
    }
  });

  return {
    totalItems: items.length,
    totalSizeBytes,
    items
  };
}

/**
 * Perform 1-Click Batch Migration of all Base64 scans into GitHub Repository
 */
export async function executeScanMigrationToGitHub(
  itemsToMigrate: ScanItemToMigrate[],
  configOverride?: GitHubStorageConfig,
  onProgress?: (progress: MigrationProgress) => void,
  abortSignal?: AbortSignal
): Promise<MigrationResult> {
  const config = configOverride || getGitHubConfig();

  if (!config.isConfigured) {
    return {
      success: false,
      totalProcessed: 0,
      migratedCount: 0,
      failedCount: 0,
      bytesFreed: 0,
      items: itemsToMigrate,
      error: 'GitHub не налаштовано. Вкажіть токен та репозиторій у Налаштуваннях.'
    };
  }

  const { persons, updatePersons } = useGenealogyStore.getState();
  const personMap = new Map<string, Person>();
  persons.forEach((p) => {
    personMap.set(p.id, JSON.parse(JSON.stringify(p)));
  });

  let migratedCount = 0;
  let failedCount = 0;
  let bytesFreed = 0;

  for (let i = 0; i < itemsToMigrate.length; i++) {
    if (abortSignal?.aborted) {
      break;
    }

    const item = itemsToMigrate[i];
    item.status = 'uploading';

    if (onProgress) {
      onProgress({
        total: itemsToMigrate.length,
        current: i + 1,
        currentTitle: `${item.personName} — ${item.title}`,
        percent: Math.round(((i + 1) / itemsToMigrate.length) * 100),
        bytesFreed,
        failedCount
      });
    }

    try {
      const uploadRes = await uploadFileToGitHub({
        config,
        path: item.suggestedPath,
        fileBase64: item.dataBase64,
        commitMessage: `[Пакетна міграція] ${item.title} (${item.personName})`
      });

      if (uploadRes.success && uploadRes.rawUrl) {
        item.status = 'completed';
        item.newUrl = uploadRes.rawUrl;
        migratedCount++;
        bytesFreed += item.sizeBytes;

        // Mutate in-memory person
        const targetPerson = personMap.get(item.personId);
        if (targetPerson) {
          if (item.itemType === 'document' && targetPerson.documents && item.docIndex !== undefined) {
            targetPerson.documents[item.docIndex] = {
              ...targetPerson.documents[item.docIndex],
              url: uploadRes.rawUrl,
              storageType: 'github',
              githubPath: uploadRes.path
            };
          } else if (item.itemType === 'photo' && targetPerson.photos && item.docIndex !== undefined) {
            targetPerson.photos[item.docIndex] = uploadRes.rawUrl;
          } else if (item.itemType === 'avatar') {
            targetPerson.avatar = uploadRes.rawUrl;
            targetPerson.avatarUrl = uploadRes.rawUrl;
            targetPerson.photoUrl = uploadRes.rawUrl;
          } else if (item.itemType === 'birth_scan') {
            targetPerson.birthScanUrl = uploadRes.rawUrl;
          } else if (item.itemType === 'marriage_scan') {
            targetPerson.marriageScanUrl = uploadRes.rawUrl;
          } else if (item.itemType === 'death_scan') {
            targetPerson.deathScanUrl = uploadRes.rawUrl;
          }
        }
      } else {
        item.status = 'failed';
        item.error = uploadRes.error || 'Помилка завантаження файлу на GitHub API';
        failedCount++;
      }
    } catch (err: any) {
      item.status = 'failed';
      item.error = err.message || String(err);
      failedCount++;
    }

    // Gentle throttle to respect GitHub API rate limits
    await new Promise((r) => setTimeout(r, 120));
  }

  // Commit all updated persons back to the store
  if (migratedCount > 0) {
    const updatedPersonsList = Array.from(personMap.values());
    updatePersons(updatedPersonsList);
  }

  return {
    success: failedCount === 0,
    totalProcessed: itemsToMigrate.length,
    migratedCount,
    failedCount,
    bytesFreed,
    items: itemsToMigrate
  };
}
