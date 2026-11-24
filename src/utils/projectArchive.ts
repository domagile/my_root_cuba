/** Archive data only: authentication, tokens and access-control settings are excluded. */
export const ARCHIVE_ARRAY_KEYS=['persons','metricRecords','documents','tasks','findings','hypotheses','requests','matrixEntries'] as const;
export const ARCHIVE_MAP_KEYS=['families','sources','events','places'] as const;
export type ArchiveContent=Partial<Record<typeof ARCHIVE_ARRAY_KEYS[number],any[]>&Record<typeof ARCHIVE_MAP_KEYS[number],Record<string,any>>>;
const isObject=(value: unknown): value is Record<string,any> => Boolean(value)&&typeof value==='object'&&!Array.isArray(value);

export function parseProjectArchive(json: string): ArchiveContent {
  const input=JSON.parse(json);
  if(!isObject(input)) throw new Error('Архів має бути JSON-об’єктом.');
  if(input.version!==undefined&&!['2.0','3.0'].includes(input.version)) throw new Error('Непідтримувана версія архіву.');
  if(input.researchData!==undefined&&!isObject(input.researchData)) throw new Error('Некоректний розділ researchData.');
  const data={ ...(input.researchData||{}),...input };
  const archive: ArchiveContent={};
  // Validate every supported section before the caller changes any application state.
  for(const key of ARCHIVE_ARRAY_KEYS) {
    if(!(key in data)) continue;
    if(!Array.isArray(data[key])||!data[key].every(isObject)) throw new Error(`Некоректний розділ ${key}.`);
    if(key==='persons'&&!data[key].every((person: any) => typeof person.id==='string'&&person.id.length>0)) throw new Error('У персони відсутній ID.');
    archive[key]=data[key];
  }
  for(const key of ARCHIVE_MAP_KEYS) {
    if(!(key in data)) continue;
    if(!isObject(data[key])||!Object.values(data[key]).every(isObject)) throw new Error(`Некоректний розділ ${key}.`);
    archive[key]=data[key];
  }
  if(Object.keys(archive).length===0) throw new Error('Архів не містить даних родоводу.');
  return archive;
}

export function createProjectArchive(data: ArchiveContent) {
  const fields=Object.fromEntries([...ARCHIVE_ARRAY_KEYS,...ARCHIVE_MAP_KEYS]
    .filter((key) => data[key]!==undefined).map((key) => [key,data[key]]));
  return { version: '3.0',exportedAt: new Date().toISOString(),...fields };
}
