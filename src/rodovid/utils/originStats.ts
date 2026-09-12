/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenealogyDatabase, Person, MetricRecord } from '../types/genealogy';
import { normalizeUkrainianPlace } from '../../utils/ukrainianPhonetics';
import { isPersonMale, isPersonFemale } from './genderUtils';
import { extractYear } from './genealogyStats';

export interface OriginPlaceItem {
  id: string;
  name: string;
  normalizedName: string;
  regionId: string;
  regionName: string;
  type: 'region' | 'settlement';
  personCount: number;
  birthCount: number;
  marriageCount: number;
  deathCount: number;
  residenceCount: number;
  totalRecords: number;
  percentage: number;
  maleCount: number;
  femaleCount: number;
  persons: Person[];
  clans: { surname: string; count: number }[];
  earliestYear: number | null;
  latestYear: number | null;
  coordinates: { x: number; y: number }; // Percentage 0..100 in Ukraine map viewport
}

export interface OriginStatsSummary {
  totalPersonsWithMetricPlaces: number;
  totalMetricRecordsCount: number;
  totalRegionsCount: number;
  totalSettlementsCount: number;
  primaryCradle: OriginPlaceItem | null; // Top origin settlement or region
  regions: OriginPlaceItem[];
  settlements: OriginPlaceItem[];
  recordsByType: {
    births: number;
    marriages: number;
    deaths: number;
    residences: number;
  };
}

// Canonical Geographic and Historical Regions of Ukraine
export interface RegionDefinition {
  id: string;
  name: string;
  historicalName: string;
  color: string;
  keywords: string[];
  coords: { x: number; y: number }; // Center for pins (viewBox 0 0 1000 650)
  svgPath: string; // Region boundary polygon/path for choropleth map
}

export const UKRAINE_REGIONS: RegionDefinition[] = [
  {
    id: 'poltava',
    name: 'Полтавщина',
    historicalName: 'Полтавська губернія',
    color: '#f59e0b', // Amber
    keywords: [
      'полтав', 'диканьк', 'опішн', 'опошня', 'базилів', 'базилев', 'чернеч',
      'миргород', 'зіньків', 'зиньков', 'лубн', 'кременчук', 'гадяч', 'хорол',
      'кобеляк', 'пирятин', 'решетилів', 'лохвиц', 'золотониш', 'градизьк',
      'оржиц', 'семенівк', 'машивк', 'чутів', 'карлівк', 'великосорочин'
    ],
    coords: { x: 590, y: 260 },
    svgPath: 'M 525 215 L 610 195 L 675 225 L 670 300 L 595 335 L 535 295 Z'
  },
  {
    id: 'kyiv',
    name: 'Київщина',
    historicalName: 'Київська губернія',
    color: '#3b82f6', // Blue
    keywords: [
      'київ', 'киев', 'біла церкв', 'белая церк', 'васильків', 'сквир', 'таращ',
      'фастів', 'богуслав', 'канів', 'бровар', 'бориспіль', 'радомишл', 'переяслав',
      'бородянк', 'вишгород', 'обухів', 'ірпінь', 'буча', 'миронівк', 'кагарлик',
      'володарк', 'яготин', 'баришівк', 'макарів'
    ],
    coords: { x: 470, y: 195 },
    svgPath: 'M 425 150 L 500 135 L 525 215 L 485 270 L 430 250 L 415 190 Z'
  },
  {
    id: 'cherkasy',
    name: 'Черкащина',
    historicalName: 'Черкаський повіт / Наддніпрянщина',
    color: '#10b981', // Emerald
    keywords: [
      'черкас', 'мошн', 'білозір', 'белозер', 'сміл', 'смила', 'уман', 'корсун',
      'звенигород', 'чигирин', 'золотон', 'жашків', 'тальн', 'городищ', 'ватутін',
      'шпол', 'кам\'янк', 'монастирищ', 'христинівк', 'драбів', 'чорнобай', 'лисянк'
    ],
    coords: { x: 510, y: 295 },
    svgPath: 'M 485 270 L 535 295 L 565 350 L 500 375 L 450 335 L 460 280 Z'
  },
  {
    id: 'chernihiv',
    name: 'Чернігівщина',
    historicalName: 'Чернігівська губернія / Сіверщина',
    color: '#8b5cf6', // Violet
    keywords: [
      'чернігів', 'чернигов', 'ніжин', 'нежин', 'батурин', 'прилук', 'борзн',
      'козелец', 'остер', 'сосниц', 'глухів', 'новгород-сівер', 'мена', 'корюк',
      'ічня', 'бахмач', 'горосн', 'ріпк', 'варва', 'семенівка', 'сноськ'
    ],
    coords: { x: 520, y: 120 },
    svgPath: 'M 460 80 L 585 70 L 610 135 L 545 180 L 490 140 Z'
  },
  {
    id: 'podillia',
    name: 'Поділля',
    historicalName: 'Подільська губернія',
    color: '#ec4899', // Pink
    keywords: [
      'поділ', 'подоль', 'вінниц', 'винниц', 'кам\'янець', 'каменец', 'хмельницьк',
      'проскурів', 'бар', 'брацлав', 'могилів-поділь', 'тульчин', 'летичів',
      'ушиц', 'жмеринк', 'бершадь', 'гайсин', 'немирів', 'ямпіль', 'хмільник',
      'дунаївц', 'ізяслав', 'полоне', 'шепетівк', 'старокостянтинів'
    ],
    coords: { x: 360, y: 285 },
    svgPath: 'M 320 230 L 415 220 L 440 280 L 410 365 L 330 350 L 305 280 Z'
  },
  {
    id: 'volyn',
    name: 'Волинь',
    historicalName: 'Волинська губернія',
    color: '#06b6d4', // Cyan
    keywords: [
      'волин', 'волын', 'луцьк', 'луцк', 'ковель', 'ковельськ',
      'м. рівне', 'рівненськ', 'рівненщин', 'ровенск', 'острозьк', 'кременецьк',
      'новоград-волин', 'звягель', 'костопіль', 'сарненськ', 'радивилів',
      'горохівськ', 'маневич', 'любомль', 'камінь-кашир', 'кузнецовськ', 'вараш'
    ],
    coords: { x: 265, y: 155 },
    svgPath: 'M 190 105 L 340 100 L 345 190 L 260 215 L 180 170 Z'
  },
  {
    id: 'halychyna',
    name: 'Галичина',
    historicalName: 'Королівство Галичини та Володимирії',
    color: '#eab308', // Yellow
    keywords: [
      'галич', 'львів', 'львов', 'терноп', 'франківськ', 'станіслав', 'дрогобич',
      'стрий', 'самбір', 'коломи', 'калуш', 'бережан', 'збараж', 'чортків',
      'рогатин', 'перемишл', 'жовкв', 'брод', 'сокаль', 'яворів', 'городок',
      'мостиськ', 'жидачів', 'надвірн', 'теребовля', 'борщів', 'бучач'
    ],
    coords: { x: 195, y: 265 },
    svgPath: 'M 140 190 L 255 195 L 290 280 L 235 345 L 155 315 L 125 240 Z'
  },
  {
    id: 'slobozhanshchyna',
    name: 'Слобожанщина',
    historicalName: 'Харківська губернія / Слобідська Україна',
    color: '#f97316', // Orange
    keywords: [
      'слобож', 'харків', 'харьков', 'сум', 'охтирк', 'ахтырк', 'ізюм', 'изюм',
      'чугуїв', 'чугуев', 'ромн', 'конотоп', 'лебедин', 'куп\'янськ', 'богодухів',
      'валки', 'дергач', 'лозов', 'кролев', 'глухов', 'шостк', 'балаклі',
      'красноград', 'люботин', 'тростянець'
    ],
    coords: { x: 735, y: 215 },
    svgPath: 'M 645 125 L 795 140 L 815 250 L 730 285 L 660 220 Z'
  },
  {
    id: 'zaporizhzhia',
    name: 'Запоріжжя та Придніпров\'я',
    historicalName: 'Катеринославська губернія',
    color: '#14b8a6', // Teal
    keywords: [
      'запоріж', 'запорож', 'катеринослав', 'дніпр', 'днепр', 'бердянськ',
      'бердянск', 'мелітопол', 'мелитопол', 'нікопол', 'никопол', 'павлоград',
      'новомосковськ', 'кривий ріг', 'олександрівськ', 'оріхів', 'гуляйпол',
      'кам\'янськ', 'дніпродзержинськ', 'жовті води', 'синельников', 'томак', 'пологи'
    ],
    coords: { x: 670, y: 345 },
    svgPath: 'M 605 315 L 720 285 L 765 375 L 685 435 L 600 395 Z'
  },
  {
    id: 'south',
    name: 'Південь та Причорномор\'я',
    historicalName: 'Херсонська та Таврійська губернії',
    color: '#0284c7', // Sky blue
    keywords: [
      'херсон', 'таврі', 'таври', 'одес', 'миколаїв', 'николаев', 'очаків',
      'аккерман', 'білгород-дністров', 'ізмаїл', 'ананьїв', 'тираспол',
      'берислав', 'каховк', 'генічеськ', 'скадовськ', 'вознесенськ', 'первомайськ',
      'южноукраїнськ', 'чорноморськ', 'подільськ', 'котовськ'
    ],
    coords: { x: 520, y: 430 },
    svgPath: 'M 455 350 L 585 365 L 610 445 L 530 495 L 430 450 Z'
  },
  {
    id: 'crimea',
    name: 'Крим',
    historicalName: 'Таврійський півострів',
    color: '#6366f1', // Indigo
    keywords: [
      'крим', 'крым', 'сімферопол', 'симферопол', 'севастопол', 'ялт', 'бахчисарай',
      'керч', 'феодосі', 'євпаторі', 'судак', 'джанке', 'армянськ', 'інкерман'
    ],
    coords: { x: 670, y: 520 },
    svgPath: 'M 620 470 L 730 460 L 750 515 L 680 570 L 615 530 Z'
  },
  {
    id: 'sivershchyna',
    name: 'Полісся та Сіверщина',
    historicalName: 'Житомирщина та Волинське Полісся',
    color: '#84cc16', // Lime
    keywords: [
      'поліс', 'полесь', 'житомир', 'коростен', 'овруч', 'бердичів', 'малин',
      'олевськ', 'радомишль', 'новоград', 'баранівк', 'хорошів', 'лугин'
    ],
    coords: { x: 375, y: 175 },
    svgPath: 'M 345 115 L 435 110 L 420 185 L 340 215 Z'
  },
  {
    id: 'donbas',
    name: 'Донбас',
    historicalName: 'Донеччина та Приазов\'я',
    color: '#64748b', // Slate
    keywords: [
      'донбас', 'донец', 'юзівк', 'юзовк', 'луганськ', 'луганск', 'бахмут',
      'маріупол', 'мариупол', 'слов\'янськ', 'краматорськ', 'старобільськ',
      'єнакієв', 'горлівк', 'макіївк', 'лисичанськ', 'сєвєродонецьк', 'дебальцев'
    ],
    coords: { x: 840, y: 320 },
    svgPath: 'M 795 240 L 910 255 L 890 380 L 800 395 L 770 315 Z'
  },
  {
    id: 'transcarpathia',
    name: 'Закарпаття',
    historicalName: 'Підкарпатська Русь',
    color: '#a855f7', // Purple
    keywords: [
      'закарпат', 'ужгород', 'мукачев', 'хуст', 'берегов', 'виноградів',
      'рахів', 'тячів', 'сваляв', 'іршав', 'воловець', 'великий березний'
    ],
    coords: { x: 135, y: 345 },
    svgPath: 'M 85 305 L 160 300 L 195 365 L 140 395 L 90 355 Z'
  },
  {
    id: 'bukovyna',
    name: 'Буковина',
    historicalName: 'Герцогство Буковина',
    color: '#d946ef', // Fuchsia
    keywords: [
      'буковин', 'чернівц', 'черновиц', 'сторожинец', 'вижниц', 'кіцмань',
      'хотин', 'заставн', 'новоселиц', 'сокирян', 'путил'
    ],
    coords: { x: 275, y: 355 },
    svgPath: 'M 240 335 L 315 325 L 330 375 L 265 395 Z'
  },
  {
    id: 'diaspora',
    name: 'Закордоння (Діаспора)',
    historicalName: 'Еміграційні поселення та зарубіжжя',
    color: '#94a3b8', // Gray
    keywords: [
      'польщ', 'польш', 'варшав', 'краків', 'канад', 'торонто', 'сша', 'америк',
      'німеччин', 'германи', 'австрі', 'вена', 'румуні', 'молдов', 'кишинів',
      'франці', 'париж', 'британі', 'лондон', 'казахстан', 'сибір'
    ],
    coords: { x: 80, y: 80 },
    svgPath: '' // Off-map indicator
  }
];

/**
 * Match a raw place string or county to one of the canonical Ukrainian regions.
 * Strictly returns null if no genuine regional match is found, avoiding any guessing or phantom regions.
 */
export function detectRegionFromPlace(placeRaw?: string | null): RegionDefinition | null {
  if (!placeRaw || typeof placeRaw !== 'string') {
    return null;
  }
  const s = placeRaw.toLowerCase().trim();
  if (s.length < 2) return null;

  // Try matching against canonical region keywords
  for (const reg of UKRAINE_REGIONS) {
    if (reg.keywords.some((kw) => s.includes(kw))) {
      return reg;
    }
  }

  // Check generic oblast or gubernia mentions (explicit gubernia/oblast markers only)
  if (s.includes('полтав')) return UKRAINE_REGIONS[0];
  if (s.includes('київ') || s.includes('киев')) return UKRAINE_REGIONS[1];
  if (s.includes('черкас')) return UKRAINE_REGIONS[2];
  if (s.includes('черніг') || s.includes('черниг')) return UKRAINE_REGIONS[3];
  if (s.includes('поділ') || s.includes('вінниц') || s.includes('хмельн')) return UKRAINE_REGIONS[4];
  if (s.includes('волинськ') || s.includes('волынск') || s.includes('рівненськ') || s.includes('ровенск')) return UKRAINE_REGIONS[5];
  if (s.includes('львів') || s.includes('галиць') || s.includes('терноп') || s.includes('франків')) return UKRAINE_REGIONS[6];
  if (s.includes('харків') || s.includes('сумськ') || s.includes('сумск')) return UKRAINE_REGIONS[7];
  if (s.includes('запоріж') || s.includes('дніпр') || s.includes('катериносл')) return UKRAINE_REGIONS[8];
  if (s.includes('одес') || s.includes('херсон') || s.includes('миколаїв')) return UKRAINE_REGIONS[9];
  if (s.includes('крим')) return UKRAINE_REGIONS[10];
  if (s.includes('житомир')) return UKRAINE_REGIONS[11];
  if (s.includes('донецьк') || s.includes('луганськ')) return UKRAINE_REGIONS[12];
  if (s.includes('закарпат') || s.includes('ужгород')) return UKRAINE_REGIONS[13];
  if (s.includes('чернівц') || s.includes('буковин')) return UKRAINE_REGIONS[14];

  // If outside of Ukraine
  if (/(польщ|варшав|краків|канад|торонто|\bсша\b|америк|німеччин|австрі|румуні|молдов|кишинів|париж|казахстан|сибір)/i.test(s)) {
    return UKRAINE_REGIONS.find((r) => r.id === 'diaspora') || null;
  }

  // Strictly no fallback or invention: return null if place is unspecified or unmapped
  return null;
}

/**
 * Clean and extract the specific settlement name from a complex place description.
 * E.g. "с. Мошни, Черкаський повіт, Київська губернія" -> "Мошни"
 * E.g. "у с. Чернечий Яр" -> "Чернечий Яр"
 */
export function extractSettlementName(placeRaw?: string | null): string {
  if (!placeRaw || typeof placeRaw !== 'string') return '';
  const normalized = normalizeUkrainianPlace(placeRaw);
  if (!normalized || normalized === '-' || normalized === '?') return '';
  return normalized;
}

interface RawMetricEvent {
  person: Person;
  placeRaw: string;
  type: 'birth' | 'marriage' | 'death' | 'residence' | 'other';
  year: number | null;
}

/**
 * Computes comprehensive statistical distribution of ancestry origin
 * based on all available metric records, birth/marriage/death places,
 * and external metric books.
 */
export function computeOriginStats(
  database: GenealogyDatabase,
  metricRecordsList?: MetricRecord[]
): OriginStatsSummary {
  const persons = Object.values(database.persons || {}) as Person[];
  const totalTreePersons = persons.length;

  const rawEvents: RawMetricEvent[] = [];
  const personsWithMetricPlaces = new Set<string>();

  // 1. Scan Persons (Metric Birth, Death, Residence)
  persons.forEach((p) => {
    // Birth (Метрика про народження)
    const bPlace = p.birthPlace || (p as any).birthPlaceHistorical;
    if (bPlace && bPlace.trim().length >= 2) {
      rawEvents.push({
        person: p,
        placeRaw: bPlace,
        type: 'birth',
        year: extractYear(p.birthYear || p.birthDate)
      });
      personsWithMetricPlaces.add(p.id);
    }

    // Death (Метрика про упокоєння / смерть)
    const dPlace = p.deathPlace || (p as any).deathPlaceHistorical;
    if (dPlace && dPlace.trim().length >= 2) {
      rawEvents.push({
        person: p,
        placeRaw: dPlace,
        type: 'death',
        year: extractYear(p.deathYear || p.deathDate)
      });
      personsWithMetricPlaces.add(p.id);
    }

    // Residence (Сповідні розписи / ревізькі казки / проживання)
    const rPlace = p.residencePlace || (p as any).residencePlaceHistorical;
    if (rPlace && rPlace.trim().length >= 2) {
      rawEvents.push({
        person: p,
        placeRaw: rPlace,
        type: 'residence',
        year: extractYear(p.birthYear || p.birthDate)
      });
      personsWithMetricPlaces.add(p.id);
    }

    // Person Events (хрещення, вінчання, сповідні розписи)
    if (Array.isArray(p.events)) {
      p.events.forEach((ev) => {
        const loc = ev.placeName || ev.place || ev.location;
        if (loc && loc.trim().length >= 2) {
          const evTypeStr = (ev.type || ev.description || '').toLowerCase();
          let evType: 'birth' | 'marriage' | 'death' | 'residence' | 'other' = 'other';
          if (evTypeStr.includes('хрещ') || evTypeStr.includes('народж') || evTypeStr.includes('birth')) {
            evType = 'birth';
          } else if (evTypeStr.includes('шлюб') || evTypeStr.includes('вінчан') || evTypeStr.includes('marriage')) {
            evType = 'marriage';
          } else if (evTypeStr.includes('смерт') || evTypeStr.includes('похов') || evTypeStr.includes('death')) {
            evType = 'death';
          } else if (evTypeStr.includes('сповід') || evTypeStr.includes('ревіз') || evTypeStr.includes('прожив')) {
            evType = 'residence';
          }

          rawEvents.push({
            person: p,
            placeRaw: loc,
            type: evType,
            year: extractYear(ev.year || ev.date)
          });
          personsWithMetricPlaces.add(p.id);
        }
      });
    }
  });

  // 2. Scan Families (Metric Marriage Records / Вінчання)
  if (database.families) {
    Object.values(database.families).forEach((fam) => {
      const mPlace = fam.marriagePlace;
      if (mPlace && mPlace.trim().length >= 2) {
        const mYear = extractYear(fam.marriageYear || fam.marriageDate);
        if (fam.husbandId && database.persons[fam.husbandId]) {
          const husband = database.persons[fam.husbandId];
          rawEvents.push({
            person: husband,
            placeRaw: mPlace,
            type: 'marriage',
            year: mYear
          });
          personsWithMetricPlaces.add(husband.id);
        }
        if (fam.wifeId && database.persons[fam.wifeId]) {
          const wife = database.persons[fam.wifeId];
          rawEvents.push({
            person: wife,
            placeRaw: mPlace,
            type: 'marriage',
            year: mYear
          });
          personsWithMetricPlaces.add(wife.id);
        }
      }
    });
  }

  // 3. Scan Research Store Metric Records (Метричні книги)
  if (Array.isArray(metricRecordsList)) {
    metricRecordsList.forEach((mr) => {
      const place = mr.village || mr.church;
      if (place && place.trim().length >= 2) {
        const mYear = mr.year || extractYear(mr.date);
        let mType: 'birth' | 'marriage' | 'death' | 'residence' | 'other' = 'other';
        if (mr.recordType === 'birth') mType = 'birth';
        else if (mr.recordType === 'marriage') mType = 'marriage';
        else if (mr.recordType === 'death') mType = 'death';
        else if (mr.recordType === 'confession' || mr.recordType === 'revision') mType = 'residence';

        // Check if linked to person
        if (mr.linkedPersonId && database.persons[mr.linkedPersonId]) {
          const p = database.persons[mr.linkedPersonId];
          rawEvents.push({
            person: p,
            placeRaw: place,
            type: mType,
            year: mYear
          });
          personsWithMetricPlaces.add(p.id);
        } else if (Array.isArray(mr.indexedPersons)) {
          mr.indexedPersons.forEach((ip) => {
            if (ip.linkedPersonId && database.persons[ip.linkedPersonId]) {
              const p = database.persons[ip.linkedPersonId];
              rawEvents.push({
                person: p,
                placeRaw: ip.residence || place,
                type: mType,
                year: mYear
              });
              personsWithMetricPlaces.add(p.id);
            }
          });
        }
      }
    });
  }

  // Aggregation maps
  interface IntermediateData {
    id: string;
    name: string;
    normalizedName: string;
    regionId: string;
    regionName: string;
    type: 'region' | 'settlement';
    personsSet: Set<string>;
    birthCount: number;
    marriageCount: number;
    deathCount: number;
    residenceCount: number;
    totalRecords: number;
    years: number[];
    coordinates: { x: number; y: number };
  }

  const regionAgg = new Map<string, IntermediateData>();
  const settlementAgg = new Map<string, IntermediateData>();

  // Pre-seed all canonical regions
  UKRAINE_REGIONS.forEach((reg) => {
    regionAgg.set(reg.id, {
      id: reg.id,
      name: reg.name,
      normalizedName: reg.name,
      regionId: reg.id,
      regionName: reg.name,
      type: 'region',
      personsSet: new Set(),
      birthCount: 0,
      marriageCount: 0,
      deathCount: 0,
      residenceCount: 0,
      totalRecords: 0,
      years: [],
      coordinates: reg.coords
    });
  });

  let totalBirths = 0;
  let totalMarriages = 0;
  let totalDeaths = 0;
  let totalResidences = 0;

  // Process all extracted metric events
  rawEvents.forEach((ev) => {
    const reg = detectRegionFromPlace(ev.placeRaw);
    const settlementName = extractSettlementName(ev.placeRaw);

    // Update region ONLY if genuinely detected
    if (reg) {
      const rData = regionAgg.get(reg.id);
      if (rData) {
        rData.personsSet.add(ev.person.id);
        rData.totalRecords++;
        if (ev.year) rData.years.push(ev.year);

        if (ev.type === 'birth') {
          rData.birthCount++;
        } else if (ev.type === 'marriage') {
          rData.marriageCount++;
        } else if (ev.type === 'death') {
          rData.deathCount++;
        } else if (ev.type === 'residence') {
          rData.residenceCount++;
        }
      }
    }

    if (ev.type === 'birth') {
      totalBirths++;
    } else if (ev.type === 'marriage') {
      totalMarriages++;
    } else if (ev.type === 'death') {
      totalDeaths++;
    } else if (ev.type === 'residence') {
      totalResidences++;
    }

    // Update settlement
    if (settlementName && settlementName.length >= 2) {
      const sKey = settlementName.toLowerCase();
      if (!settlementAgg.has(sKey)) {
        // Offset coordinates slightly from region center for variation
        const hash = Array.from(sKey).reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const offsetX = ((hash % 30) - 15);
        const offsetY = (((hash >> 2) % 30) - 15);

        const regionId = reg ? reg.id : 'unspecified';
        const regionName = reg ? reg.name : 'Невизначений регіон';
        const baseCoords = reg?.coords || { x: 500, y: 325 };

        settlementAgg.set(sKey, {
          id: sKey,
          name: settlementName,
          normalizedName: settlementName,
          regionId,
          regionName,
          type: 'settlement',
          personsSet: new Set(),
          birthCount: 0,
          marriageCount: 0,
          deathCount: 0,
          residenceCount: 0,
          totalRecords: 0,
          years: [],
          coordinates: {
            x: Math.max(50, Math.min(950, baseCoords.x + offsetX)),
            y: Math.max(50, Math.min(600, baseCoords.y + offsetY))
          }
        });
      } else if (reg) {
        // If we later discover a canonical region for an existing settlement that was unspecified, enrich it
        const sData = settlementAgg.get(sKey);
        if (sData && sData.regionId === 'unspecified') {
          sData.regionId = reg.id;
          sData.regionName = reg.name;
          const hash = Array.from(sKey).reduce((acc, c) => acc + c.charCodeAt(0), 0);
          const offsetX = ((hash % 30) - 15);
          const offsetY = (((hash >> 2) % 30) - 15);
          sData.coordinates = {
            x: Math.max(50, Math.min(950, reg.coords.x + offsetX)),
            y: Math.max(50, Math.min(600, reg.coords.y + offsetY))
          };
        }
      }

      const sData = settlementAgg.get(sKey)!;
      if (ev.person && ev.person.id) {
        sData.personsSet.add(ev.person.id);
      }
      sData.totalRecords++;
      if (ev.year) sData.years.push(ev.year);

      if (ev.type === 'birth') sData.birthCount++;
      else if (ev.type === 'marriage') sData.marriageCount++;
      else if (ev.type === 'death') sData.deathCount++;
      else if (ev.type === 'residence') sData.residenceCount++;
    }
  });

  const buildOriginItem = (data: IntermediateData): OriginPlaceItem => {
    const personObjs = Array.from(data.personsSet)
      .map((id) => database.persons[id])
      .filter(Boolean) as Person[];

    let mCount = 0;
    let fCount = 0;
    const surnameMap: Record<string, number> = {};

    personObjs.forEach((p) => {
      if (isPersonMale(p, database)) mCount++;
      else if (isPersonFemale(p, database)) fCount++;

      const sName = (p.lastName || p.name?.surname || '').trim();
      if (sName && sName.length >= 2) {
        surnameMap[sName] = (surnameMap[sName] || 0) + 1;
      }
    });

    const clans = Object.entries(surnameMap)
      .map(([surname, count]) => ({ surname, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const minYear = data.years.length > 0 ? Math.min(...data.years) : null;
    const maxYear = data.years.length > 0 ? Math.max(...data.years) : null;
    const pct = totalTreePersons > 0 ? Math.round((personObjs.length / totalTreePersons) * 100) : 0;

    return {
      id: data.id,
      name: data.name,
      normalizedName: data.normalizedName,
      regionId: data.regionId,
      regionName: data.regionName,
      type: data.type,
      personCount: personObjs.length,
      birthCount: data.birthCount,
      marriageCount: data.marriageCount,
      deathCount: data.deathCount,
      residenceCount: data.residenceCount,
      totalRecords: data.totalRecords,
      percentage: pct,
      maleCount: mCount,
      femaleCount: fCount,
      persons: personObjs,
      clans,
      earliestYear: minYear,
      latestYear: maxYear,
      coordinates: data.coordinates
    };
  };

  // Build sorted lists
  const regionsList = Array.from(regionAgg.values())
    .map(buildOriginItem)
    .filter((r) => r.personCount > 0 || r.totalRecords > 0)
    .sort((a, b) => b.personCount - a.personCount || b.totalRecords - a.totalRecords);

  const settlementsList = Array.from(settlementAgg.values())
    .map(buildOriginItem)
    .filter((s) => s.personCount > 0 || s.totalRecords > 0)
    .sort((a, b) => b.personCount - a.personCount || b.totalRecords - a.totalRecords);

  const primaryCradle = settlementsList[0] || regionsList[0] || null;

  return {
    totalPersonsWithMetricPlaces: personsWithMetricPlaces.size,
    totalMetricRecordsCount: rawEvents.length,
    totalRegionsCount: regionsList.length,
    totalSettlementsCount: settlementsList.length,
    primaryCradle,
    regions: regionsList,
    settlements: settlementsList,
    recordsByType: {
      births: totalBirths,
      marriages: totalMarriages,
      deaths: totalDeaths,
      residences: totalResidences
    }
  };
}
