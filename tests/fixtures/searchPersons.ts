import type { Person } from '../../src/types';

export const searchPersons: Person[] = [
  { id: 'ukr', firstName: 'Микола', lastName: 'Надточій', gender: 'M', birthPlace: 'Бердянськ', notes: 'Сімейне свідоцтво' },
  { id: 'rus', firstName: 'Николай', lastName: 'Надточей', gender: 'M', birthPlace: 'Бердянск', notes: 'архівний запис' },
  { id: 'typo', firstName: 'Іван', lastName: 'Шевченко', gender: 'M', bio: 'свідоцтво про народження',
    historicalPlaces: [{ type: 'birth', modernPlace: 'Київ', historicalText: 'Кіевъ' }] },
  { id: 'multi', firstName: 'Іван', lastName: 'Петренко', patronymic: 'Миколайович', gender: 'M',
    customFields: [{ label: 'Архів', value: 'позначка' }], events: [{ type: 'birth', place: 'Одеса', description: 'свідоцтво' }] },
  { id: 'repeated', firstName: 'Микола', lastName: 'Петренко', gender: 'M', notes: 'архівний запис', sourceCitations: ['позначка'] },
  { id: 'deleted', firstName: 'Микола', lastName: 'Надточій', gender: 'M', isDeleted: true, notes: 'свідоцтво позначка' },
  { id: 'variant', firstName: 'Ганна', lastName: 'Коваль', gender: 'F', nameVariants: ['Анна'], surnameVariants: ['Ковальська'],
    customFields: { archive: 'свідоцтво позначка' } }
] as Person[];

export function searchResultView(rows: any[]) {
  return rows.map(({ person, ...details }) => ({ id: person.id, ...details }));
}
