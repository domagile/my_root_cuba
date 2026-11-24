import type { Person } from '../types';

/** A document date is not a birth date, and an AI candidate is not verified evidence. */
export function aiEntityToPerson(entity: { name?: string; year?: string; place?: string; status?: string; role?: string },context: string): Person {
  const name=entity.name?.trim();
  if(!name) throw new Error('У розпізнаного кандидата немає імені.');
  const parts=name.split(/\s+/);
  return {
    id: `person-${crypto.randomUUID()}`,
    firstName: parts.length>1? parts[1]:parts[0],
    lastName: parts.length>1? parts[0]:'',
    patronymic: parts.slice(2).join(' '),
    gender: 'U',
    researchStatus: 'needs_verification',
    notes: `Кандидат ШІ: ${name}. Потребує перевірки за оригіналом.\n${context}\n${[
      entity.year&&`Рік у документі: ${entity.year}`,
      entity.place&&`Місце у документі: ${entity.place}`,
      entity.status&&`Стан: ${entity.status}`,
      entity.role&&`Роль: ${entity.role}`
    ].filter(Boolean).join('\n')}`
  };
}
