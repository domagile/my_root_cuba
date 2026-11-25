import type { ProjectSyncData } from './cloudSyncService';

/** Read-only preparation: the caller may replace local state only after this succeeds. */
export async function prepareCloudRestore<T>(
  getData: () => ProjectSyncData,
  backup: (data: ProjectSyncData) => Promise<unknown>,
  read: () => Promise<T>,
  hasPendingDeletions: () => boolean = () => false
): Promise<T> {
  const ensureReady = () => {
    if (hasPendingDeletions()) throw new Error('Є невивантажені видалення або відновлення. Спочатку вивантажте зміни у хмару.');
  };
  ensureReady();
  const before=getData();
  if(!await backup(before)) throw new Error('Не вдалося зберегти резервну точку. Завантаження з хмари скасовано.');
  const result=await read();
  ensureReady();
  const current=getData();
  if((Object.keys(before) as (keyof ProjectSyncData)[]).some((key) => before[key]!==current[key])) {
    throw new Error('Під час завантаження з’явилися локальні зміни. Їх збережено; повторіть завантаження.');
  }
  return result;
}
