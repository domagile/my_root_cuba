/**
 * Utility to identify, sanitize, and purge demo data from all layers of the application.
 */

export const MASTER_ADMIN_EMAILS = [
  'domagile@gmail.com',
  'cubatarara400@gmail.com'
].map((e) => e.toLowerCase());

export function isMasterAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return MASTER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export const DEMO_EMAILS_TO_PURGE = [
  'admin@genealogy.org.ua',
  'kovalenko.family@gmail.com',
  'archive.poltava.research@gmail.com',
  'bogdan.kovalenko.1952@gmail.com',
  'alex.kovalenko@gmail.com',
  'pin.guest@genealogy.local',
  'demo@genealogy.org.ua',
  'test@genealogy.org.ua',
  'user@genealogy.org.ua',
  'fastagile7@gmail.com',
  'demo@example.com',
  'test@example.com'
].map((e) => e.toLowerCase());

export function isDemoEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  // Master admins are NEVER demo emails
  if (isMasterAdminEmail(clean)) return false;
  if (DEMO_EMAILS_TO_PURGE.includes(clean)) return true;
  if (
    clean.includes('kovalenko') ||
    clean.includes('demo') ||
    clean.includes('sample') ||
    clean.endsWith('@genealogy.org.ua') ||
    clean.endsWith('@genealogy.local') ||
    clean.endsWith('@example.com')
  ) {
    return true;
  }
  return false;
}

export function isDemoPerson(person: any): boolean {
  if (!person) return false;
  const id = String(person.id || '').trim();
  const lastName = String(person.lastName || person.name?.surname || '').trim().toLowerCase();
  const firstName = String(person.firstName || person.name?.given || '').trim().toLowerCase();
  const birthPlace = String(person.birthPlace || '').toLowerCase();
  const deathPlace = String(person.deathPlace || '').toLowerCase();
  const notes = String(person.notes || person.bio || '').toLowerCase();

  // IDs p1, p2, ... p15 were from sampleData.ts (Коваленки)
  if (/^p[0-9]+$/.test(id)) return true;
  if (lastName === 'коваленко') return true;
  if (lastName === 'шевченко' && (birthPlace.includes('чернечий яр') || deathPlace.includes('чернечий яр'))) return true;
  if (firstName === 'остап' && lastName.includes('коваленк')) return true;
  if (birthPlace.includes('чернечий яр') || deathPlace.includes('чернечий яр')) return true;
  if (notes.includes('чернечий яр') || notes.includes('кузні біля річки ворскла')) return true;

  return false;
}

export function isDemoFamily(familyId: string, family?: any): boolean {
  const id = String(familyId || family?.id || '').trim();
  // f1 ... f10 were demo families from sampleData.ts
  if (/^f[0-9]+$/.test(id)) return true;
  if (family?.husbandId && /^p[0-9]+$/.test(family.husbandId)) return true;
  if (family?.wifeId && /^p[0-9]+$/.test(family.wifeId)) return true;
  return false;
}

export function isDemoEvent(eventId: string, event?: any): boolean {
  const id = String(eventId || event?.id || '').trim();
  if (/^e[0-9]+$/i.test(id)) return true;
  const text = String(
    (event?.title || '') + ' ' +
    (event?.description || '') + ' ' +
    (event?.place || '')
  ).toLowerCase();
  if (text.includes('коваленк') || text.includes('чернечий яр') || text.includes('диканьк') || text.includes('лисенк')) return true;
  return false;
}

export function isDemoSource(sourceId: string, source?: any): boolean {
  const id = String(sourceId || source?.id || '').trim();
  if (/^s[0-9]+$/i.test(id)) return true;
  const text = String(
    (source?.title || '') + ' ' +
    (source?.name || '') + ' ' +
    (source?.notes || '') + ' ' +
    (source?.archiveReference || '')
  ).toLowerCase();
  if (text.includes('коваленк') || text.includes('чернечий яр') || text.includes('диканьк') || text.includes('покровської церкви 1878')) return true;
  return false;
}

export function isDemoResearchItem(item: any): boolean {
  if (!item) return false;
  const id = String(item.id || '');
  if (/^(m|mr|doc|task|t|fnd|f|hyp|h|req|mx)-[0-9]+$/i.test(id)) return true;
  const text = String(
    (item.title || '') + ' ' +
    (item.transcription || '') + ' ' +
    (item.hypothesis || '') + ' ' +
    (item.village || '') + ' ' +
    (item.archive || '')
  ).toLowerCase();
  if (text.includes('коваленк') || text.includes('чернечий яр') || text.includes('диканьк')) return true;
  if (Array.isArray(item.persons)) {
    if (item.persons.some((p: any) => String(p.name || '').toLowerCase().includes('коваленк'))) {
      return true;
    }
  }
  if (Array.isArray(item.indexedPersons)) {
    if (item.indexedPersons.some((p: any) => String(p.name || '').toLowerCase().includes('коваленк'))) {
      return true;
    }
  }
  return false;
}

export function isDemoNote(note: any): boolean {
  if (!note) return false;
  const id = String(note.id || '');
  const title = String(note.title || '').toLowerCase();
  const content = String(note.content || '').toLowerCase();
  if (/^note-[0-9]+$/.test(id)) return true;
  if (title.includes('коваленк') || content.includes('коваленк') || content.includes('чернечий яр')) return true;
  if (title.includes('дапо (полтава)') && title.includes('план')) return true;
  return false;
}

export function isDemoSnapshot(snap: any): boolean {
  if (!snap) return false;
  const note = String(snap.note || '').toLowerCase();
  if (note.includes('демо') || note.includes('sample') || note.includes('коваленк')) return true;
  if (snap.data?.persons && Array.isArray(snap.data.persons)) {
    if (snap.data.persons.some(isDemoPerson)) return true;
  }
  return false;
}

/**
 * Proactively purges all demo traces from browser localStorage.
 */
export function purgeDemoStorage(): void {
  try {
    // 1. Whitelist
    const wlKey = 'genealogy_auth_security_v1_whitelist';
    const wlSaved = localStorage.getItem(wlKey);
    if (wlSaved) {
      const parsed = JSON.parse(wlSaved);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((w: any) => !isDemoEmail(w.email));
        localStorage.setItem(wlKey, JSON.stringify(cleaned));
      }
    }

    // 2. Requests
    const reqKey = 'genealogy_auth_security_v1_requests';
    const reqSaved = localStorage.getItem(reqKey);
    if (reqSaved) {
      const parsed = JSON.parse(reqSaved);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((r: any) => r.id !== 'req-1' && !isDemoEmail(r.email));
        localStorage.setItem(reqKey, JSON.stringify(cleaned));
      }
    }

    // 3. Persons
    const pKey = 'genealogy_workstation_data_v4_familio_persons';
    const pSaved = localStorage.getItem(pKey);
    if (pSaved) {
      const parsed = JSON.parse(pSaved);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((p: any) => !isDemoPerson(p));
        localStorage.setItem(pKey, JSON.stringify(cleaned));
      }
    }

    // 4. Families
    const fKey = 'genealogy_workstation_data_v4_familio_families';
    const fSaved = localStorage.getItem(fKey);
    if (fSaved) {
      const parsed = JSON.parse(fSaved);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const cleaned: Record<string, any> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (!isDemoFamily(k, v)) {
            cleaned[k] = v;
          }
        }
        localStorage.setItem(fKey, JSON.stringify(cleaned));
      }
    }

    // 4b. Sources
    const sKey = 'genealogy_workstation_data_v4_familio_sources';
    const sSaved = localStorage.getItem(sKey);
    if (sSaved) {
      const parsed = JSON.parse(sSaved);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const cleaned: Record<string, any> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (!isDemoSource(k, v)) {
            cleaned[k] = v;
          }
        }
        localStorage.setItem(sKey, JSON.stringify(cleaned));
      }
    }

    // 4c. Events
    const eKey = 'genealogy_workstation_data_v4_familio_events';
    const eSaved = localStorage.getItem(eKey);
    if (eSaved) {
      const parsed = JSON.parse(eSaved);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const cleaned: Record<string, any> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (!isDemoEvent(k, v)) {
            cleaned[k] = v;
          }
        }
        localStorage.setItem(eKey, JSON.stringify(cleaned));
      }
    }

    // 5. Research items (both v2 and v1 keys)
    const researchKeys = ['metrics', 'documents', 'tasks', 'findings', 'hypotheses', 'requests', 'matrix'];
    ['genealogy_workstation_data_v2_', 'genealogy_research_hub_v1_'].forEach((prefix) => {
      researchKeys.forEach((sub) => {
        const rKey = `${prefix}${sub}`;
        const rSaved = localStorage.getItem(rKey);
        if (rSaved) {
          const parsed = JSON.parse(rSaved);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter((item: any) => !isDemoResearchItem(item));
            localStorage.setItem(rKey, JSON.stringify(cleaned));
          }
        }
      });
    });

    // Comprehensive scan across all localStorage keys starting with 'genealogy_'
    try {
      const allKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) allKeys.push(k);
      }
      for (const k of allKeys) {
        if (!k.startsWith('genealogy_')) continue;
        const val = localStorage.getItem(k);
        if (!val) continue;
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((item: any) => {
            if (isDemoPerson(item)) return false;
            if (isDemoResearchItem(item)) return false;
            if (isDemoNote(item)) return false;
            if (item?.email && isDemoEmail(item.email)) return false;
            if (item?.id === 'req-1' || item?.id === 't-1' || item?.id === 't-2' || item?.id === 'doc-1' || item?.id === 'f-1' || item?.id === 'h-1') return false;
            return true;
          });
          if (cleaned.length !== parsed.length) {
            localStorage.setItem(k, JSON.stringify(cleaned));
          }
        } else if (parsed && typeof parsed === 'object') {
          let changed = false;
          const cleaned: Record<string, any> = {};
          for (const [propKey, propVal] of Object.entries(parsed)) {
            if (isDemoFamily(propKey, propVal) || isDemoSource(propKey, propVal) || isDemoEvent(propKey, propVal)) {
              changed = true;
            } else {
              cleaned[propKey] = propVal;
            }
          }
          if (changed) {
            localStorage.setItem(k, JSON.stringify(cleaned));
          }
        }
      }
    } catch {}

    // 6. Notes
    const notesKey = 'genealogy_research_notes_v1';
    const notesSaved = localStorage.getItem(notesKey);
    if (notesSaved) {
      const parsed = JSON.parse(notesSaved);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((n: any) => !isDemoNote(n));
        localStorage.setItem(notesKey, JSON.stringify(cleaned));
      }
    }

    // 7. Security config mode
    const confKey = 'genealogy_auth_security_v1_config';
    const confSaved = localStorage.getItem(confKey);
    if (confSaved) {
      const parsed = JSON.parse(confSaved);
      if (parsed.mode === 'open_demo') {
        parsed.mode = 'whitelist_only';
        localStorage.setItem(confKey, JSON.stringify(parsed));
      }
    }
  } catch (e) {
    console.warn('Demo purge error:', e);
  }
}
