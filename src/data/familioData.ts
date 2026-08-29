import { Person, Family, Source, LifeEvent } from '../types';

export const FAMILIO_PERSONS: Person[] = [
  // Покоління 0 (Я - Коренева особа)
  {
    id: 'p_bom_olga',
    firstName: 'Ольга',
    lastName: 'Бом',
    gender: 'female',
    fatherId: 'p_bolotny_mikhail',
    motherId: 'p_dyadkina_tatyana',
    parentFamilyId: 'fam_bolotny',
    generation: 0,
    notes: 'Я (Коренева особа родоводу)',
    bio: 'Коренева особа в генеалогічній схемі Familio.'
  },

  // Покоління 1 (Батьки)
  {
    id: 'p_bolotny_mikhail',
    firstName: 'Михаил',
    lastName: 'Болотный',
    gender: 'male',
    spouseIds: ['p_dyadkina_tatyana'],
    childrenIds: ['p_bom_olga'],
    spouseFamilyIds: ['fam_bolotny'],
    generation: 1,
    notes: 'Отец'
  },
  {
    id: 'p_dyadkina_tatyana',
    firstName: 'Татьяна',
    lastName: 'Болотна',
    maidenName: 'Дядькина',
    patronymic: 'Вадимовна',
    gender: 'female',
    fatherId: 'p_dyadkin_vadim',
    motherId: 'p_lazarenko_evgenia',
    spouseIds: ['p_bolotny_mikhail'],
    childrenIds: ['p_bom_olga'],
    parentFamilyId: 'fam_dyadkin_vadim',
    spouseFamilyIds: ['fam_bolotny'],
    generation: 1,
    notes: 'Мать (Дядькина)'
  },

  // Покоління 2 (Дідусі та бабусі)
  {
    id: 'p_dyadkin_vadim',
    firstName: 'Вадим',
    lastName: 'Дядькин',
    patronymic: 'Андреевич',
    gender: 'male',
    fatherId: 'p_dyadkin_andrey',
    motherId: 'p_baldinova_tatyana',
    spouseIds: ['p_lazarenko_evgenia'],
    childrenIds: ['p_dyadkina_tatyana'],
    parentFamilyId: 'fam_dyadkin_andrey',
    spouseFamilyIds: ['fam_dyadkin_vadim'],
    generation: 2,
    notes: 'Дедушка'
  },
  {
    id: 'p_lazarenko_evgenia',
    firstName: 'Евгения',
    lastName: 'Лазаренко',
    patronymic: 'Никифоровна',
    gender: 'female',
    spouseIds: ['p_dyadkin_vadim'],
    childrenIds: ['p_dyadkina_tatyana'],
    spouseFamilyIds: ['fam_dyadkin_vadim'],
    generation: 2,
    notes: 'Бабушка'
  },

  // Покоління 3 (Прадідусі та прабабусі)
  {
    id: 'p_dyadkin_andrey',
    firstName: 'Андрей',
    lastName: 'Дядькин',
    patronymic: 'Андреевич',
    gender: 'male',
    fatherId: 'p_dyadkin_mikhail',
    motherId: 'p_bychikhina_maria',
    spouseIds: ['p_baldinova_tatyana'],
    childrenIds: ['p_dyadkin_vadim'],
    parentFamilyId: 'fam_dyadkin_mikhail',
    spouseFamilyIds: ['fam_dyadkin_andrey'],
    generation: 3,
    notes: 'Прадедушка'
  },
  {
    id: 'p_baldinova_tatyana',
    firstName: 'Татьяна',
    lastName: 'Дядькина',
    maidenName: 'Балдинова',
    patronymic: 'Петровна',
    gender: 'female',
    fatherId: 'p_baldinov_petr',
    motherId: 'p_zelenskaya_olga',
    spouseIds: ['p_dyadkin_andrey'],
    childrenIds: ['p_dyadkin_vadim'],
    parentFamilyId: 'fam_baldinov_petr',
    spouseFamilyIds: ['fam_dyadkin_andrey'],
    generation: 3,
    notes: 'Прабабушка (Балдинова)'
  },

  // Покоління 4 (Пра(2)дідусі та пра(2)бабусі)
  {
    id: 'p_dyadkin_mikhail',
    firstName: 'Михаил',
    lastName: 'Дядькин',
    patronymic: 'Васильевич',
    gender: 'male',
    birthYear: 1852,
    birthPlace: 'Мариуполь',
    fatherId: 'p_dyadkin_vasiliy',
    spouseIds: ['p_bychikhina_maria'],
    childrenIds: ['p_dyadkin_andrey'],
    parentFamilyId: 'fam_dyadkin_vasiliy',
    spouseFamilyIds: ['fam_dyadkin_mikhail'],
    generation: 4,
    notes: 'Пра(2)дедушка • Мариуполь, 1852 — ум. ?'
  },
  {
    id: 'p_bychikhina_maria',
    firstName: 'Мария',
    lastName: 'Дядькина',
    maidenName: 'Бычихина',
    patronymic: 'Максимовна',
    gender: 'female',
    birthDate: '1869-08-14',
    birthYear: 1869,
    birthPlace: 'Бердянск',
    fatherId: 'p_bychikhin_maksim',
    motherId: 'p_polulyakhova_anna_ivanovna',
    spouseIds: ['p_dyadkin_mikhail'],
    childrenIds: ['p_dyadkin_andrey'],
    parentFamilyId: 'fam_bychikhin_maksim',
    spouseFamilyIds: ['fam_dyadkin_mikhail'],
    generation: 4,
    notes: 'Пра(2)бабушка (Бычихина) • Бердянск, 14.08.1869 — ум. ?'
  },
  {
    id: 'p_baldinov_petr',
    firstName: 'Петр',
    lastName: 'Балдинов',
    patronymic: 'Иванович',
    gender: 'male',
    birthYear: 1875,
    deathYear: 1937,
    fatherId: 'p_baldinov_ivan',
    motherId: 'p_baldinova_evdokia',
    spouseIds: ['p_zelenskaya_olga'],
    childrenIds: ['p_baldinova_tatyana'],
    parentFamilyId: 'fam_baldinov_ivan',
    spouseFamilyIds: ['fam_baldinov_petr'],
    generation: 4,
    notes: 'Пра(2)дедушка • 1875 — 1937, ≈62 года'
  },
  {
    id: 'p_zelenskaya_olga',
    firstName: 'Ольга',
    lastName: 'Балдинова',
    maidenName: 'Зеленская',
    patronymic: 'Федоровна',
    gender: 'female',
    birthYear: 1880,
    deathYear: 1945,
    fatherId: 'p_zelensky_fedor',
    spouseIds: ['p_baldinov_petr'],
    childrenIds: ['p_baldinova_tatyana'],
    parentFamilyId: 'fam_zelensky_fedor',
    spouseFamilyIds: ['fam_baldinov_petr'],
    generation: 4,
    notes: 'Пра(2)бабушка (Зеленская) • 1880 — 1945, ≈65 лет'
  },

  // Покоління 5 (Пра(3)дідусі та пра(3)бабусі)
  {
    id: 'p_dyadkin_vasiliy',
    firstName: 'Василий',
    lastName: 'Дядькин',
    patronymic: 'Федорович',
    gender: 'male',
    birthYear: 1821,
    birthPlace: 'Мирславль',
    fatherId: 'p_dyadkin_fedor_ilyich',
    childrenIds: ['p_dyadkin_mikhail'],
    parentFamilyId: 'fam_dyadkin_fedor_ilyich',
    spouseFamilyIds: ['fam_dyadkin_vasiliy'],
    generation: 5,
    notes: 'Пра(3)дедушка • Мирславль, до 1821 — ум. ?'
  },
  {
    id: 'p_bychikhin_maksim',
    firstName: 'Максим',
    lastName: 'Бычихин',
    patronymic: 'Сергеевич',
    gender: 'male',
    birthYear: 1846,
    birthPlace: 'Бердянск',
    fatherId: 'p_bychikhin_sergey',
    motherId: 'p_guseva_natalya',
    spouseIds: ['p_polulyakhova_anna_ivanovna'],
    childrenIds: ['p_bychikhina_maria'],
    parentFamilyId: 'fam_bychikhin_sergey',
    spouseFamilyIds: ['fam_bychikhin_maksim'],
    generation: 5,
    notes: 'Пра(3)дедушка • Бердянск, 1846 — ум. ?'
  },
  {
    id: 'p_polulyakhova_anna_ivanovna',
    firstName: 'Анна',
    lastName: 'Бычихина',
    maidenName: 'Полуляхова',
    patronymic: 'Ивановна',
    gender: 'female',
    birthYear: 1849,
    birthPlace: 'Бердянск',
    fatherId: 'p_polulyakhov_ivan',
    motherId: 'p_polulyakhova_evdokia',
    spouseIds: ['p_bychikhin_maksim'],
    childrenIds: ['p_bychikhina_maria'],
    parentFamilyId: 'fam_polulyakhov_ivan',
    spouseFamilyIds: ['fam_bychikhin_maksim'],
    generation: 5,
    notes: 'Пра(3)бабушка (Полуляхова) • Бердянск, 1849 — ум. ?'
  },
  {
    id: 'p_baldinov_ivan',
    firstName: 'Иван',
    lastName: 'Балдинов',
    gender: 'male',
    spouseIds: ['p_baldinova_evdokia'],
    childrenIds: ['p_baldinov_petr'],
    spouseFamilyIds: ['fam_baldinov_ivan'],
    generation: 5,
    notes: 'Пра(3)дедушка'
  },
  {
    id: 'p_baldinova_evdokia',
    firstName: 'Евдокия',
    lastName: 'Балдинова',
    patronymic: 'Федоровна',
    gender: 'female',
    spouseIds: ['p_baldinov_ivan'],
    childrenIds: ['p_baldinov_petr'],
    spouseFamilyIds: ['fam_baldinov_ivan'],
    generation: 5,
    notes: 'Пра(3)бабушка'
  },
  {
    id: 'p_zelensky_fedor',
    firstName: 'Федор',
    lastName: 'Зеленский',
    gender: 'male',
    childrenIds: ['p_zelenskaya_olga'],
    spouseFamilyIds: ['fam_zelensky_fedor'],
    generation: 5,
    notes: 'Пра(3)дедушка'
  },

  // Покоління 6 (Пра(4)дідусі та пра(4)бабусі)
  {
    id: 'p_dyadkin_fedor_ilyich',
    firstName: 'Федор',
    lastName: 'Дядькин',
    patronymic: 'Ильич',
    gender: 'male',
    birthYear: 1787,
    birthPlace: 'Мирславль',
    fatherId: 'p_dyadkin_ilya',
    motherId: 'p_dyadkina_evdokia_nikitina',
    childrenIds: ['p_dyadkin_vasiliy'],
    parentFamilyId: 'fam_dyadkin_ilya',
    spouseFamilyIds: ['fam_dyadkin_fedor_ilyich'],
    generation: 6,
    notes: 'Пра(4)дедушка • Мирславль, ок. 1787 — ум. ?'
  },
  {
    id: 'p_bychikhin_sergey',
    firstName: 'Сергей',
    lastName: 'Бычихин',
    patronymic: 'Иванович',
    gender: 'male',
    birthYear: 1817,
    birthPlace: 'Приморск',
    fatherId: 'p_bychikhin_ivan',
    motherId: 'p_bychikhina_anastasia',
    spouseIds: ['p_guseva_natalya'],
    childrenIds: ['p_bychikhin_maksim'],
    parentFamilyId: 'fam_bychikhin_ivan',
    spouseFamilyIds: ['fam_bychikhin_sergey'],
    generation: 6,
    notes: 'Пра(4)дедушка • Приморск, 1817 — ум. ?'
  },
  {
    id: 'p_guseva_natalya',
    firstName: 'Наталья',
    lastName: 'Бычихина',
    maidenName: 'Гусева',
    patronymic: 'Ильинична',
    gender: 'female',
    birthYear: 1817,
    fatherId: 'p_gusev_ilch',
    motherId: 'p_guseva_mavra',
    spouseIds: ['p_bychikhin_sergey'],
    childrenIds: ['p_bychikhin_maksim'],
    parentFamilyId: 'fam_gusev_ilch',
    spouseFamilyIds: ['fam_bychikhin_sergey'],
    generation: 6,
    notes: 'Пра(4)бабушка (Гусева) • до 1817 — ум. ?'
  },
  {
    id: 'p_polulyakhov_ivan',
    firstName: 'Иван',
    lastName: 'Полуляхов',
    patronymic: 'Яковлевич',
    gender: 'male',
    birthYear: 1821,
    deathDate: '1904-09-01',
    deathYear: 1904,
    birthPlace: 'Бердянск',
    fatherId: 'p_polulyakhov_yakov',
    motherId: 'p_polulyakhova_anna_vasilievna',
    spouseIds: ['p_polulyakhova_evdokia'],
    childrenIds: ['p_polulyakhova_anna_ivanovna'],
    parentFamilyId: 'fam_polulyakhov_yakov',
    spouseFamilyIds: ['fam_polulyakhov_ivan'],
    generation: 6,
    notes: 'Пра(4)дедушка • Бердянск, 1821 — 01.09.1904, ≈83 года'
  },
  {
    id: 'p_polulyakhova_evdokia',
    firstName: 'Евдокия',
    lastName: 'Полуляхова',
    patronymic: 'Макаровна',
    gender: 'female',
    birthYear: 1821,
    deathDate: '1896-10-07',
    deathYear: 1896,
    birthPlace: 'Бердянск',
    spouseIds: ['p_polulyakhov_ivan'],
    childrenIds: ['p_polulyakhova_anna_ivanovna'],
    spouseFamilyIds: ['fam_polulyakhov_ivan'],
    generation: 6,
    notes: 'Пра(4)бабушка • Бердянск, 1821 — 07.10.1896, ≈75 лет'
  },

  // Покоління 7 (Пра(5)дідусі та пра(5)бабусі)
  {
    id: 'p_dyadkin_ilya',
    firstName: 'Илья',
    lastName: 'Дядькин',
    patronymic: 'Иванович',
    gender: 'male',
    birthYear: 1765,
    birthPlace: 'Мирславль',
    fatherId: 'p_dyadkin_ivan_fedorovich',
    motherId: 'p_dyadkina_natalya_ievlevna',
    spouseIds: ['p_dyadkina_evdokia_nikitina'],
    childrenIds: ['p_dyadkin_fedor_ilyich'],
    parentFamilyId: 'fam_dyadkin_ivan_fedorovich',
    spouseFamilyIds: ['fam_dyadkin_ilya'],
    generation: 7,
    notes: 'Пра(5)дедушка • Мирславль, ок. 1765 — ум. ?'
  },
  {
    id: 'p_dyadkina_evdokia_nikitina',
    firstName: 'Евдокия / Авдотья',
    lastName: 'Дядькина',
    patronymic: 'Никитина',
    gender: 'female',
    birthYear: 1763,
    spouseIds: ['p_dyadkin_ilya'],
    childrenIds: ['p_dyadkin_fedor_ilyich'],
    spouseFamilyIds: ['fam_dyadkin_ilya'],
    generation: 7,
    notes: 'Пра(5)бабушка • ок. 1763 — ум. ?'
  },
  {
    id: 'p_bychikhin_ivan',
    firstName: 'Иван',
    lastName: 'Бычихин',
    patronymic: 'Тихонович',
    gender: 'male',
    birthYear: 1794,
    deathDate: '1836-08-15',
    deathYear: 1836,
    fatherId: 'p_bychikhin_tikhon',
    motherId: 'p_bychikhina_irina',
    spouseIds: ['p_bychikhina_anastasia'],
    childrenIds: ['p_bychikhin_sergey'],
    parentFamilyId: 'fam_bychikhin_tikhon',
    spouseFamilyIds: ['fam_bychikhin_ivan'],
    generation: 7,
    notes: 'Пра(5)дедушка • 1794 — 15.08.1836, ≈42 года'
  },
  {
    id: 'p_bychikhina_anastasia',
    firstName: 'Анастасия',
    lastName: 'Бычихина',
    patronymic: 'Антоновна',
    gender: 'female',
    birthYear: 1795,
    deathDate: '1880-08-30',
    deathYear: 1880,
    spouseIds: ['p_bychikhin_ivan'],
    childrenIds: ['p_bychikhin_sergey'],
    spouseFamilyIds: ['fam_bychikhin_ivan'],
    generation: 7,
    notes: 'Пра(5)бабушка • 1795 — 30.08.1880, ≈85 лет'
  },
  {
    id: 'p_gusev_ilch',
    firstName: 'Ильч',
    lastName: 'Гусев',
    patronymic: 'Логвинович',
    gender: 'male',
    birthYear: 1793,
    fatherId: 'p_gusev_logvin',
    spouseIds: ['p_guseva_mavra'],
    childrenIds: ['p_guseva_natalya'],
    parentFamilyId: 'fam_gusev_logvin',
    spouseFamilyIds: ['fam_gusev_ilch'],
    generation: 7,
    notes: 'Пра(5)дедушка • до 1793 — ум. ?'
  },
  {
    id: 'p_guseva_mavra',
    firstName: 'Мавра',
    lastName: 'Гусева',
    patronymic: 'Федоровна',
    gender: 'female',
    birthYear: 1795,
    spouseIds: ['p_gusev_ilch'],
    childrenIds: ['p_guseva_natalya'],
    spouseFamilyIds: ['fam_gusev_ilch'],
    generation: 7,
    notes: 'Пра(5)бабушка • до 1795 — ум. ?'
  },
  {
    id: 'p_polulyakhov_yakov',
    firstName: 'Яков',
    lastName: 'Полуляхов',
    patronymic: 'Максимович',
    gender: 'male',
    birthYear: 1800,
    deathDate: '1880-07-24',
    deathYear: 1880,
    birthPlace: 'Бердянск',
    fatherId: 'p_polulyakhov_maksim',
    spouseIds: ['p_polulyakhova_anna_vasilievna'],
    childrenIds: ['p_polulyakhov_ivan'],
    parentFamilyId: 'fam_polulyakhov_maksim',
    spouseFamilyIds: ['fam_polulyakhov_yakov'],
    generation: 7,
    notes: 'Пра(5)дедушка • Бердянск, 1800 — 24.07.1880, ≈80 лет'
  },
  {
    id: 'p_polulyakhova_anna_vasilievna',
    firstName: 'Анна',
    lastName: 'Полуляхова',
    patronymic: 'Васильевна',
    gender: 'female',
    birthYear: 1802,
    deathDate: '1874-11-15',
    deathYear: 1874,
    spouseIds: ['p_polulyakhov_yakov'],
    childrenIds: ['p_polulyakhov_ivan'],
    spouseFamilyIds: ['fam_polulyakhov_yakov'],
    generation: 7,
    notes: 'Пра(5)бабушка • до 1802 — 15.11.1874'
  },

  // Покоління 8 (Пра(6)дідусі та пра(6)бабусі)
  {
    id: 'p_dyadkin_ivan_fedorovich',
    firstName: 'Иван',
    lastName: 'Дядькин',
    patronymic: 'Федорович',
    gender: 'male',
    birthYear: 1743,
    fatherId: 'p_dyadkin_fedor_1718',
    motherId: 'p_dyadkina_marya',
    spouseIds: ['p_dyadkina_natalya_ievlevna'],
    childrenIds: ['p_dyadkin_ilya'],
    parentFamilyId: 'fam_dyadkin_fedor_1718',
    spouseFamilyIds: ['fam_dyadkin_ivan_fedorovich'],
    generation: 8,
    notes: 'Пра(6)дедушка • ок. 1743 — ум. ?'
  },
  {
    id: 'p_dyadkina_natalya_ievlevna',
    firstName: 'Наталья',
    lastName: 'Дядькина',
    patronymic: 'Иевлевна',
    gender: 'female',
    birthYear: 1738,
    birthPlace: 'Беляницыно, Турабьево',
    spouseIds: ['p_dyadkin_ivan_fedorovich'],
    childrenIds: ['p_dyadkin_ilya'],
    spouseFamilyIds: ['fam_dyadkin_ivan_fedorovich'],
    generation: 8,
    notes: 'Пра(6)бабушка • Беляницыно, Турабьев..., ок. 1738 — ум. ?'
  },
  {
    id: 'p_bychikhin_tikhon',
    firstName: 'Тихон',
    lastName: 'Бычихин',
    patronymic: 'Логвинович',
    gender: 'male',
    birthYear: 1758,
    deathDate: '1843-05-29',
    deathYear: 1843,
    spouseIds: ['p_bychikhina_irina'],
    childrenIds: ['p_bychikhin_ivan'],
    spouseFamilyIds: ['fam_bychikhin_tikhon'],
    generation: 8,
    notes: 'Пра(6)дедушка • 1758 — 29.05.1843, ≈85 лет'
  },
  {
    id: 'p_bychikhina_irina',
    firstName: 'Ирина',
    lastName: 'Бычихина',
    patronymic: 'Лукьяновна',
    gender: 'female',
    birthYear: 1762,
    deathDate: '1834-07-12',
    deathYear: 1834,
    birthPlace: 'Приморск',
    spouseIds: ['p_bychikhin_tikhon'],
    childrenIds: ['p_bychikhin_ivan'],
    spouseFamilyIds: ['fam_bychikhin_tikhon'],
    generation: 8,
    notes: 'Пра(6)бабушка • Приморск, 1762 — 12.07.1834, ≈72 года'
  },
  {
    id: 'p_gusev_logvin',
    firstName: 'Логвин',
    lastName: 'Гусев',
    patronymic: 'Иванович',
    gender: 'male',
    birthYear: 1774,
    deathDate: '1854-12-03',
    deathYear: 1854,
    childrenIds: ['p_gusev_ilch'],
    spouseFamilyIds: ['fam_gusev_logvin'],
    generation: 8,
    notes: 'Пра(6)дедушка • 1774 — 03.12.1854, ≈80 лет'
  },
  {
    id: 'p_polulyakhov_maksim',
    firstName: 'Максим',
    lastName: 'Полуляхов',
    patronymic: 'Фролович',
    gender: 'male',
    birthYear: 1776,
    deathDate: '1841-04-30',
    deathYear: 1841,
    fatherId: 'p_polulyakhov_frol',
    childrenIds: ['p_polulyakhov_yakov'],
    parentFamilyId: 'fam_polulyakhov_frol',
    spouseFamilyIds: ['fam_polulyakhov_maksim'],
    generation: 8,
    notes: 'Пра(6)дедушка • 1776 — 30.04.1841, ≈65 лет'
  },

  // Покоління 9 (Пра(7)дідусі та пра(7)бабусі)
  {
    id: 'p_dyadkin_fedor_1718',
    firstName: 'Федор',
    lastName: 'Дядькин',
    gender: 'male',
    birthYear: 1718,
    spouseIds: ['p_dyadkina_marya'],
    childrenIds: ['p_dyadkin_ivan_fedorovich'],
    spouseFamilyIds: ['fam_dyadkin_fedor_1718'],
    generation: 9,
    notes: 'Пра(7)дедушка • род. ок. 1718'
  },
  {
    id: 'p_dyadkina_marya',
    firstName: 'Марья',
    lastName: 'Дядькина',
    patronymic: 'Ильинична',
    gender: 'female',
    birthYear: 1723,
    birthPlace: 'Мирславль',
    spouseIds: ['p_dyadkin_fedor_1718'],
    childrenIds: ['p_dyadkin_ivan_fedorovich'],
    spouseFamilyIds: ['fam_dyadkin_fedor_1718'],
    generation: 9,
    notes: 'Пра(7)бабушка • Мирславль, ок. 1723 — ум. ?'
  },
  {
    id: 'p_polulyakhov_frol',
    firstName: 'Фрол',
    lastName: 'Полуляхов',
    gender: 'male',
    birthYear: 1750,
    childrenIds: ['p_polulyakhov_maksim'],
    spouseFamilyIds: ['fam_polulyakhov_frol'],
    generation: 9,
    notes: 'Пра(7)дедушка • до 1750 — ум. ?'
  }
];

export const FAMILIO_FAMILIES: Record<string, Family> = {
  fam_bolotny: {
    id: 'fam_bolotny',
    husbandId: 'p_bolotny_mikhail',
    wifeId: 'p_dyadkina_tatyana',
    relationshipType: 'Married',
    children: [{ personId: 'p_bom_olga', relationType: 'Biological' }],
    childrenIds: ['p_bom_olga']
  },
  fam_dyadkin_vadim: {
    id: 'fam_dyadkin_vadim',
    husbandId: 'p_dyadkin_vadim',
    wifeId: 'p_lazarenko_evgenia',
    relationshipType: 'Married',
    children: [{ personId: 'p_dyadkina_tatyana', relationType: 'Biological' }],
    childrenIds: ['p_dyadkina_tatyana']
  },
  fam_dyadkin_andrey: {
    id: 'fam_dyadkin_andrey',
    husbandId: 'p_dyadkin_andrey',
    wifeId: 'p_baldinova_tatyana',
    relationshipType: 'Married',
    children: [{ personId: 'p_dyadkin_vadim', relationType: 'Biological' }],
    childrenIds: ['p_dyadkin_vadim']
  },
  fam_dyadkin_mikhail: {
    id: 'fam_dyadkin_mikhail',
    husbandId: 'p_dyadkin_mikhail',
    wifeId: 'p_bychikhina_maria',
    relationshipType: 'Married',
    children: [{ personId: 'p_dyadkin_andrey', relationType: 'Biological' }],
    childrenIds: ['p_dyadkin_andrey']
  },
  fam_baldinov_petr: {
    id: 'fam_baldinov_petr',
    husbandId: 'p_baldinov_petr',
    wifeId: 'p_zelenskaya_olga',
    relationshipType: 'Married',
    children: [{ personId: 'p_baldinova_tatyana', relationType: 'Biological' }],
    childrenIds: ['p_baldinova_tatyana']
  },
  fam_dyadkin_vasiliy: {
    id: 'fam_dyadkin_vasiliy',
    husbandId: 'p_dyadkin_vasiliy',
    relationshipType: 'Married',
    children: [{ personId: 'p_dyadkin_mikhail', relationType: 'Biological' }],
    childrenIds: ['p_dyadkin_mikhail']
  },
  fam_bychikhin_maksim: {
    id: 'fam_bychikhin_maksim',
    husbandId: 'p_bychikhin_maksim',
    wifeId: 'p_polulyakhova_anna_ivanovna',
    relationshipType: 'Married',
    children: [{ personId: 'p_bychikhina_maria', relationType: 'Biological' }],
    childrenIds: ['p_bychikhina_maria']
  },
  fam_baldinov_ivan: {
    id: 'fam_baldinov_ivan',
    husbandId: 'p_baldinov_ivan',
    wifeId: 'p_baldinova_evdokia',
    relationshipType: 'Married',
    children: [{ personId: 'p_baldinov_petr', relationType: 'Biological' }],
    childrenIds: ['p_baldinov_petr']
  },
  fam_zelensky_fedor: {
    id: 'fam_zelensky_fedor',
    husbandId: 'p_zelensky_fedor',
    relationshipType: 'Married',
    children: [{ personId: 'p_zelenskaya_olga', relationType: 'Biological' }],
    childrenIds: ['p_zelenskaya_olga']
  },
  fam_dyadkin_fedor_ilyich: {
    id: 'fam_dyadkin_fedor_ilyich',
    husbandId: 'p_dyadkin_fedor_ilyich',
    relationshipType: 'Married',
    children: [{ personId: 'p_dyadkin_vasiliy', relationType: 'Biological' }],
    childrenIds: ['p_dyadkin_vasiliy']
  },
  fam_bychikhin_sergey: {
    id: 'fam_bychikhin_sergey',
    husbandId: 'p_bychikhin_sergey',
    wifeId: 'p_guseva_natalya',
    relationshipType: 'Married',
    children: [{ personId: 'p_bychikhin_maksim', relationType: 'Biological' }],
    childrenIds: ['p_bychikhin_maksim']
  },
  fam_polulyakhov_ivan: {
    id: 'fam_polulyakhov_ivan',
    husbandId: 'p_polulyakhov_ivan',
    wifeId: 'p_polulyakhova_evdokia',
    relationshipType: 'Married',
    children: [{ personId: 'p_polulyakhova_anna_ivanovna', relationType: 'Biological' }],
    childrenIds: ['p_polulyakhova_anna_ivanovna']
  },
  fam_dyadkin_ilya: {
    id: 'fam_dyadkin_ilya',
    husbandId: 'p_dyadkin_ilya',
    wifeId: 'p_dyadkina_evdokia_nikitina',
    relationshipType: 'Married',
    children: [{ personId: 'p_dyadkin_fedor_ilyich', relationType: 'Biological' }],
    childrenIds: ['p_dyadkin_fedor_ilyich']
  },
  fam_bychikhin_ivan: {
    id: 'fam_bychikhin_ivan',
    husbandId: 'p_bychikhin_ivan',
    wifeId: 'p_bychikhina_anastasia',
    relationshipType: 'Married',
    children: [{ personId: 'p_bychikhin_sergey', relationType: 'Biological' }],
    childrenIds: ['p_bychikhin_sergey']
  },
  fam_gusev_ilch: {
    id: 'fam_gusev_ilch',
    husbandId: 'p_gusev_ilch',
    wifeId: 'p_guseva_mavra',
    relationshipType: 'Married',
    children: [{ personId: 'p_guseva_natalya', relationType: 'Biological' }],
    childrenIds: ['p_guseva_natalya']
  },
  fam_polulyakhov_yakov: {
    id: 'fam_polulyakhov_yakov',
    husbandId: 'p_polulyakhov_yakov',
    wifeId: 'p_polulyakhova_anna_vasilievna',
    relationshipType: 'Married',
    children: [{ personId: 'p_polulyakhov_ivan', relationType: 'Biological' }],
    childrenIds: ['p_polulyakhov_ivan']
  },
  fam_dyadkin_ivan_fedorovich: {
    id: 'fam_dyadkin_ivan_fedorovich',
    husbandId: 'p_dyadkin_ivan_fedorovich',
    wifeId: 'p_dyadkina_natalya_ievlevna',
    relationshipType: 'Married',
    children: [{ personId: 'p_dyadkin_ilya', relationType: 'Biological' }],
    childrenIds: ['p_dyadkin_ilya']
  },
  fam_bychikhin_tikhon: {
    id: 'fam_bychikhin_tikhon',
    husbandId: 'p_bychikhin_tikhon',
    wifeId: 'p_bychikhina_irina',
    relationshipType: 'Married',
    children: [{ personId: 'p_bychikhin_ivan', relationType: 'Biological' }],
    childrenIds: ['p_bychikhin_ivan']
  },
  fam_gusev_logvin: {
    id: 'fam_gusev_logvin',
    husbandId: 'p_gusev_logvin',
    relationshipType: 'Married',
    children: [{ personId: 'p_gusev_ilch', relationType: 'Biological' }],
    childrenIds: ['p_gusev_ilch']
  },
  fam_polulyakhov_maksim: {
    id: 'fam_polulyakhov_maksim',
    husbandId: 'p_polulyakhov_maksim',
    relationshipType: 'Married',
    children: [{ personId: 'p_polulyakhov_yakov', relationType: 'Biological' }],
    childrenIds: ['p_polulyakhov_yakov']
  },
  fam_dyadkin_fedor_1718: {
    id: 'fam_dyadkin_fedor_1718',
    husbandId: 'p_dyadkin_fedor_1718',
    wifeId: 'p_dyadkina_marya',
    relationshipType: 'Married',
    children: [{ personId: 'p_dyadkin_ivan_fedorovich', relationType: 'Biological' }],
    childrenIds: ['p_dyadkin_ivan_fedorovich']
  },
  fam_polulyakhov_frol: {
    id: 'fam_polulyakhov_frol',
    husbandId: 'p_polulyakhov_frol',
    relationshipType: 'Married',
    children: [{ personId: 'p_polulyakhov_maksim', relationType: 'Biological' }],
    childrenIds: ['p_polulyakhov_maksim']
  }
};

export const FAMILIO_SOURCES: Record<string, Source> = {
  src_familio_1: {
    id: 'src_familio_1',
    title: 'Генеалогічне дерево Familio (експорт схеми)',
    repository: 'Familio.org',
    archiveReference: 'familio-my-tree_29-08-2026_15-31-56.png',
    notes: 'Повна графічна схема висхідного родоводу Ольги Бом (родини Дядькіних, Бичихіних, Балдінових, Полуляхових, Гусєвих, Зеленських).'
  }
};

export const FAMILIO_EVENTS: Record<string, LifeEvent> = {
  ev_1: {
    id: 'ev_1',
    type: 'birth',
    title: 'Народження Марії Максимовни Бичихіної',
    date: '1869-08-14',
    year: 1869,
    place: 'м. Бердянськ',
    personId: 'p_bychikhina_maria',
    sourceId: 'src_familio_1'
  },
  ev_2: {
    id: 'ev_2',
    type: 'death',
    title: 'Смерть Івана Яковича Полуляхова',
    date: '1904-09-01',
    year: 1904,
    place: 'м. Бердянськ',
    personId: 'p_polulyakhov_ivan',
    sourceId: 'src_familio_1'
  },
  ev_3: {
    id: 'ev_3',
    type: 'death',
    title: 'Смерть Євдокії Макарівни Полуляхової',
    date: '1896-10-07',
    year: 1896,
    place: 'м. Бердянськ',
    personId: 'p_polulyakhova_evdokia',
    sourceId: 'src_familio_1'
  }
};
