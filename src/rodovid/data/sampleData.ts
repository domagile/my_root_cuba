/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenealogyDatabase } from '../types/genealogy';

export const SAMPLE_DATABASE: GenealogyDatabase = {
  metadata: {
    title: 'Родовід родини Коваленків та Шевченків',
    description: 'Генеалогічне дерево з метричними виписками та архівними документами XVII-XX ст.',
    lastModified: new Date().toISOString(),
    author: 'Тарас Коваленко',
  },
  rootPersonId: 'p1',
  persons: {
    'p1': {
      id: 'p1',
      name: {
        given: 'Остап',
        surname: 'Коваленко',
        patronymic: 'Григорович',
        prefix: 'козак'
      },
      firstName: 'Остап',
      lastName: 'Коваленко',
      patronymic: 'Григорович',
      gender: 'M',
      isLiving: false,
      birthDate: '1845-04-12',
      birthYear: 1845,
      birthPlace: 'с. Чернечий Яр, Полтавська губ.',
      deathDate: '1918-11-20',
      deathYear: 1918,
      deathPlace: 'с. Чернечий Яр',
      occupation: 'Коваль, сотник громади',
      bio: 'Засновник родинної кузні біля річки Ворскла. Згаданий у сповідному розписі 1880 р.',
      notes: 'Засновник родинної кузні біля річки Ворскла. Згаданий у сповідному розписі 1880 р.',
      parentFamilyId: 'f4',
      spouseFamilyIds: ['f1'],
      fatherId: 'p10',
      motherId: 'p11',
      spouseIds: ['p2'],
      childrenIds: ['p3', 'p4', 'p5'],
      generation: 1,
      confession: 'Православний',
      estate: 'Козак',
      tags: ['Коваль', 'Полтавщина']
    },
    'p2': {
      id: 'p2',
      name: {
        given: 'Марія',
        surname: 'Коваленко',
        maidenName: 'Лисенко',
        patronymic: 'Іванівна'
      },
      firstName: 'Марія',
      lastName: 'Коваленко',
      maidenName: 'Лисенко',
      patronymic: 'Іванівна',
      gender: 'F',
      isLiving: false,
      birthDate: '1850-08-19',
      birthYear: 1850,
      birthPlace: 'м. Диканька',
      deathDate: '1924-03-14',
      deathYear: 1924,
      deathPlace: 'с. Чернечий Яр',
      notes: 'Знана травниця та вишивальниця.',
      bio: 'Знана травниця та вишивальниця.',
      spouseFamilyIds: ['f1'],
      spouseIds: ['p1'],
      childrenIds: ['p3', 'p4', 'p5'],
      generation: 1,
      confession: 'Православна',
      estate: 'Козачка'
    },
    'p3': {
      id: 'p3',
      name: {
        given: 'Іван',
        surname: 'Коваленко',
        patronymic: 'Остапович'
      },
      firstName: 'Іван',
      lastName: 'Коваленко',
      patronymic: 'Остапович',
      gender: 'M',
      isLiving: false,
      birthDate: '1878-02-10',
      birthYear: 1878,
      birthPlace: 'с. Чернечий Яр',
      deathDate: '1943-09-15',
      deathYear: 1943,
      deathPlace: 'м. Полтава',
      occupation: 'Вчитель початкових класів',
      parentFamilyId: 'f1',
      spouseFamilyIds: ['f2'],
      fatherId: 'p1',
      motherId: 'p2',
      spouseIds: ['p6'],
      childrenIds: ['p7', 'p8'],
      generation: 2,
      confession: 'Православний'
    },
    'p4': {
      id: 'p4',
      name: {
        given: 'Ганна',
        surname: 'Шевченко',
        maidenName: 'Коваленко',
        patronymic: 'Остапівна'
      },
      firstName: 'Ганна',
      lastName: 'Шевченко',
      maidenName: 'Коваленко',
      patronymic: 'Остапівна',
      gender: 'F',
      isLiving: false,
      birthDate: '1882-06-25',
      birthYear: 1882,
      birthPlace: 'с. Чернечий Яр',
      deathDate: '1960-01-18',
      deathYear: 1960,
      parentFamilyId: 'f1',
      spouseFamilyIds: [],
      fatherId: 'p1',
      motherId: 'p2',
      generation: 2
    },
    'p5': {
      id: 'p5',
      name: {
        given: 'Петро',
        surname: 'Коваленко',
        patronymic: 'Остапович'
      },
      firstName: 'Петро',
      lastName: 'Коваленко',
      patronymic: 'Остапович',
      gender: 'M',
      isLiving: false,
      birthDate: '1886-11-03',
      birthYear: 1886,
      birthPlace: 'с. Чернечий Яр',
      deathDate: '1920-05-12',
      deathYear: 1920,
      parentFamilyId: 'f1',
      spouseFamilyIds: [],
      fatherId: 'p1',
      motherId: 'p2',
      generation: 2
    },
    'p6': {
      id: 'p6',
      name: {
        given: 'Олена',
        surname: 'Коваленко',
        maidenName: 'Гриценко',
        patronymic: 'Василівна'
      },
      firstName: 'Олена',
      lastName: 'Коваленко',
      maidenName: 'Гриценко',
      patronymic: 'Василівна',
      gender: 'F',
      isLiving: false,
      birthDate: '1884-05-14',
      birthYear: 1884,
      birthPlace: 'м. Охтирка',
      deathDate: '1958-12-02',
      deathYear: 1958,
      spouseFamilyIds: ['f2'],
      spouseIds: ['p3'],
      childrenIds: ['p7', 'p8'],
      generation: 2
    },
    'p7': {
      id: 'p7',
      name: {
        given: 'Михайло',
        surname: 'Коваленко',
        patronymic: 'Іванович'
      },
      firstName: 'Михайло',
      lastName: 'Коваленко',
      patronymic: 'Іванович',
      gender: 'M',
      isLiving: false,
      birthDate: '1912-09-08',
      birthYear: 1912,
      birthPlace: 'с. Чернечий Яр',
      deathDate: '1988-04-30',
      deathYear: 1988,
      occupation: 'Агроном, дослідник',
      parentFamilyId: 'f2',
      spouseFamilyIds: ['f3'],
      fatherId: 'p3',
      motherId: 'p6',
      spouseIds: ['p9'],
      childrenIds: ['p12'],
      generation: 3
    },
    'p8': {
      id: 'p8',
      name: {
        given: 'Софія',
        surname: 'Коваленко',
        patronymic: 'Іванівна'
      },
      firstName: 'Софія',
      lastName: 'Коваленко',
      patronymic: 'Іванівна',
      gender: 'F',
      isLiving: false,
      birthDate: '1916-03-22',
      birthYear: 1916,
      deathDate: '1995-10-11',
      parentFamilyId: 'f2',
      spouseFamilyIds: [],
      fatherId: 'p3',
      motherId: 'p6',
      generation: 3
    },
    'p9': {
      id: 'p9',
      name: {
        given: 'Катерина',
        surname: 'Коваленко',
        maidenName: 'Бондар',
        patronymic: 'Семенівна'
      },
      firstName: 'Катерина',
      lastName: 'Коваленко',
      maidenName: 'Бондар',
      patronymic: 'Семенівна',
      gender: 'F',
      isLiving: false,
      birthDate: '1918-12-05',
      birthYear: 1918,
      deathDate: '2002-07-19',
      spouseFamilyIds: ['f3'],
      spouseIds: ['p7'],
      childrenIds: ['p12'],
      generation: 3
    },
    'p10': {
      id: 'p10',
      name: {
        given: 'Григорій',
        surname: 'Коваленко',
        patronymic: 'Данилович'
      },
      firstName: 'Григорій',
      lastName: 'Коваленко',
      patronymic: 'Данилович',
      gender: 'M',
      isLiving: false,
      birthDate: '1815-01-10',
      birthYear: 1815,
      deathDate: '1889-08-04',
      deathYear: 1889,
      spouseFamilyIds: ['f4'],
      generation: 0,
      childrenIds: ['p1']
    },
    'p11': {
      id: 'p11',
      name: {
        given: 'Параскева',
        surname: 'Коваленко',
        patronymic: 'Федорівна'
      },
      firstName: 'Параскева',
      lastName: 'Коваленко',
      patronymic: 'Федорівна',
      gender: 'F',
      isLiving: false,
      birthDate: '1820-10-15',
      birthYear: 1820,
      deathDate: '1895-02-18',
      deathYear: 1895,
      spouseFamilyIds: ['f4'],
      generation: 0,
      childrenIds: ['p1']
    },
    'p12': {
      id: 'p12',
      name: {
        given: 'Богдан',
        surname: 'Коваленко',
        patronymic: 'Михайлович'
      },
      firstName: 'Богдан',
      lastName: 'Коваленко',
      patronymic: 'Михайлович',
      gender: 'M',
      isLiving: true,
      birthDate: '1952-07-14',
      birthYear: 1952,
      birthPlace: 'м. Полтава',
      occupation: 'Інженер-конструктор',
      parentFamilyId: 'f3',
      spouseFamilyIds: [],
      fatherId: 'p7',
      motherId: 'p9',
      generation: 4
    }
  },
  families: {
    'f1': {
      id: 'f1',
      husbandId: 'p1',
      wifeId: 'p2',
      relationshipType: 'Married',
      children: [
        { personId: 'p3', relationType: 'Biological' },
        { personId: 'p4', relationType: 'Biological' },
        { personId: 'p5', relationType: 'Biological' }
      ],
      childrenIds: ['p3', 'p4', 'p5'],
      marriageDate: '1875-10-18',
      marriageYear: 1875,
      marriagePlace: 'Церква св. Миколая, Диканька'
    },
    'f2': {
      id: 'f2',
      husbandId: 'p3',
      wifeId: 'p6',
      relationshipType: 'Married',
      children: [
        { personId: 'p7', relationType: 'Biological' },
        { personId: 'p8', relationType: 'Biological' }
      ],
      childrenIds: ['p7', 'p8'],
      marriageDate: '1908-01-26',
      marriageYear: 1908,
      marriagePlace: 'Покровська церква, с. Чернечий Яр'
    },
    'f3': {
      id: 'f3',
      husbandId: 'p7',
      wifeId: 'p9',
      relationshipType: 'Married',
      children: [
        { personId: 'p12', relationType: 'Biological' }
      ],
      childrenIds: ['p12'],
      marriageDate: '1940-06-12',
      marriageYear: 1940,
      marriagePlace: 'м. Полтава'
    },
    'f4': {
      id: 'f4',
      husbandId: 'p10',
      wifeId: 'p11',
      relationshipType: 'Married',
      children: [
        { personId: 'p1', relationType: 'Biological' }
      ],
      childrenIds: ['p1'],
      marriageDate: '1840-02-15',
      marriageYear: 1840
    }
  },
  sources: {
    's1': {
      id: 's1',
      title: 'Метрична книга церкви Покрови Пресвятої Богородиці 1878 року',
      repository: 'Державний архів Полтавської області (ДАПО)',
      archiveReference: 'Ф. 1011, Оп. 1, Спр. 45, Арк. 12 зв.',
      archiveFund: 'Фонд 1011',
      inventory: 'Опис 1',
      caseNumber: 'Справа 45',
      page: 'Арк. 12 зв.',
      notes: 'Запис №14 про народження та хрещення Івана Остаповича Коваленка.'
    },
    's2': {
      id: 's2',
      title: 'Сповідний розпис Диканської протопопії 1880 р.',
      repository: 'ЦДІАК України',
      archiveReference: 'Ф. 127, Оп. 1015, Спр. 122, Арк. 88',
      archiveFund: 'Ф. 127',
      inventory: 'Оп. 1015',
      caseNumber: 'Спр. 122',
      page: 'Арк. 88',
      notes: 'Повний поіменний список родини козака Остапа Григоровича Коваленка.'
    }
  },
  events: {
    'e1': {
      id: 'e1',
      type: 'birth',
      title: 'Народження Остапа Коваленка',
      date: '1845-04-12',
      year: 1845,
      place: 'с. Чернечий Яр',
      personId: 'p1',
      sourceId: 's2'
    },
    'e2': {
      id: 'e2',
      type: 'marriage',
      title: 'Шлюб Остапа Коваленка та Марії Лисенко',
      date: '1875-10-18',
      year: 1875,
      place: 'м. Диканька',
      familyId: 'f1'
    }
  }
};
