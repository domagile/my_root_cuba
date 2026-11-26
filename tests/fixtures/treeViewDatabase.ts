import type { GenealogyDatabase, Person } from '../../src/rodovid/types/genealogy';

/** Synthetic relationships only; never reads an application database. */
export function treeViewDatabase(wide = false): GenealogyDatabase {
  const people: Person[] = [
    { id: 'root', firstName: 'Марко', lastName: 'Тестовий', gender: 'male', fatherId: 'father', motherId: 'mother', parentFamilyId: 'parents', spouseFamilyIds: ['union'], isLiving: false },
    { id: 'father', firstName: 'Петро', lastName: 'Тестовий', gender: 'male', spouseFamilyIds: ['parents'], isLiving: false },
    { id: 'mother', firstName: 'Олена', lastName: 'Приклад', gender: 'female', spouseFamilyIds: ['parents'], isLiving: false },
    { id: 'sister-a', firstName: 'Анна', lastName: 'Тестова', gender: 'female', parentFamilyId: 'parents', isLiving: false },
    { id: 'sister-b', firstName: 'Ніна', lastName: 'Тестова', gender: 'female', parentFamilyId: 'parents', isLiving: false },
    { id: 'spouse', firstName: 'Катерина', lastName: 'Зразок', gender: 'female', spouseFamilyIds: ['union'], isLiving: false },
    { id: 'child', firstName: 'Іван', lastName: 'Тестовий', gender: 'male', parentFamilyId: 'union', isLiving: false }
  ];
  const extra = Array.from({ length: wide ? 400 : 0 }, (_, i): Person => ({
    id: `sibling-${i}`, firstName: `Родич ${i}`, lastName: `Приклад ${i}`, gender: 'male', parentFamilyId: 'parents', isLiving: false
  }));
  return {
    persons: Object.fromEntries([...people, ...extra].map(person => [person.id, person])),
    families: {
      parents: { id: 'parents', husbandId: 'father', wifeId: 'mother', children: [], childrenIds: ['root', 'sister-a', 'sister-b', ...extra.map(person => person.id)] },
      union: { id: 'union', husbandId: 'root', wifeId: 'spouse', children: [], childrenIds: ['child'] }
    }, sources: {}, events: {}, rootPersonId: 'root', lastModified: 'synthetic'
  };
}
