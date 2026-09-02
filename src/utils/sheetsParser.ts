/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { SheetDataset, ExtractedMetricRecord, ExtractedGodparent, ExtractedPersonMeta } from '../types/sheetsAnalysis';
import { Person } from '../types';

/**
 * Normalizes Ukrainian patronymics to derive father's given name
 */
export function deriveFatherNameFromPatronymic(patronymic?: string): string | undefined {
  if (!patronymic) return undefined;
  const clean = patronymic.trim();
  
  // Male endings: -ович, -евич, -ич, -овіч
  if (clean.endsWith('ович') || clean.endsWith('овіч')) {
    return clean.replace(/ович$|овіч$/, '');
  }
  if (clean.endsWith('евич')) {
    return clean.replace(/евич$/, 'ь');
  }
  if (clean.endsWith('євич')) {
    return clean.replace(/євич$/, 'й');
  }
  if (clean.endsWith('ич')) {
    return clean.replace(/ич$/, '');
  }

  // Female endings: -івна, -овна, -ївна, -евна
  if (clean.endsWith('івна')) {
    const base = clean.replace(/івна$/, '');
    if (base.endsWith('ов')) return base.slice(0, -2);
    if (base.endsWith('ев')) return base.slice(0, -2) + 'ь';
    return base;
  }
  if (clean.endsWith('ївна')) {
    return clean.replace(/ївна$/, 'й');
  }
  if (clean.endsWith('овна')) {
    return clean.replace(/овна$/, '');
  }
  if (clean.endsWith('евна')) {
    return clean.replace(/евна$/, 'ь');
  }

  return undefined;
}

/**
 * Checks if a name or text matches any of the target surnames with Ukrainian morphology
 */
export function matchesTargetSurname(text: string, targetSurnames: string[]): { matches: boolean; matchedSurname?: string } {
  if (!text || targetSurnames.length === 0) return { matches: true };

  const lowerText = text.toLowerCase();
  
  for (const rawSurname of targetSurnames) {
    const target = rawSurname.trim().toLowerCase();
    if (!target) continue;

    // Direct inclusion
    if (lowerText.includes(target)) {
      return { matches: true, matchedSurname: rawSurname };
    }

    // Stem matching (removing common Ukrainian endings: -енко, -ова, -івна, -ин, -ський, -иха, -ук, -юк)
    const stem = target
      .replace(/(енко|івна|ович|ова|ин|ський|ська|цький|цька|иха|ук|юк|ов|єв|ко)$/i, '')
      .trim();

    if (stem.length >= 3 && lowerText.includes(stem)) {
      return { matches: true, matchedSurname: rawSurname };
    }
  }

  return { matches: false };
}

/**
 * Splits full name into lastName, firstName, patronymic
 */
export function parseFullName(rawName: string): { lastName: string; firstName: string; patronymic?: string; gender: 'male' | 'female' } {
  const parts = rawName.trim().replace(/[,;]/g, ' ').split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { lastName: 'Невідомо', firstName: '', gender: 'male' };
  }

  let lastName = '';
  let firstName = '';
  let patronymic: string | undefined = undefined;
  let gender: 'male' | 'female' = 'male';

  // Check if first or last part is patronymic
  const isPatronymic = (w: string) => /.*(ович|евич|євич|ич|овіч|івна|ївна|овна|евна)$/i.test(w);
  const isFemaleNameOrPatronymic = (w: string) => /.*(івна|ївна|овна|евна|ія|га|на|ка|ла|та|ра|ва|ха|да|ша|ля)$/i.test(w);

  if (parts.length === 1) {
    lastName = parts[0];
    firstName = '';
  } else if (parts.length === 2) {
    // Check if second is patronymic
    if (isPatronymic(parts[1])) {
      firstName = parts[0];
      patronymic = parts[1];
    } else {
      lastName = parts[0];
      firstName = parts[1];
    }
  } else if (parts.length >= 3) {
    if (isPatronymic(parts[2])) {
      lastName = parts[0];
      firstName = parts[1];
      patronymic = parts[2];
    } else if (isPatronymic(parts[1])) {
      firstName = parts[0];
      patronymic = parts[1];
      lastName = parts.slice(2).join(' ');
    } else {
      lastName = parts[0];
      firstName = parts[1];
      patronymic = parts.slice(2).join(' ');
    }
  }

  if (patronymic && (patronymic.endsWith('івна') || patronymic.endsWith('ївна') || patronymic.endsWith('овна') || patronymic.endsWith('евна'))) {
    gender = 'female';
  } else if (isFemaleNameOrPatronymic(firstName) || (lastName.endsWith('а') && !lastName.endsWith('ко') && !lastName.endsWith('ло'))) {
    gender = 'female';
  }

  return { lastName, firstName, patronymic, gender };
}

/**
 * Extracts godparents from various column text formats
 */
export function extractGodparentsFromText(text: string, sheetName: string, rowIndex: number): ExtractedGodparent[] {
  if (!text || text.trim().length < 2) return [];

  const results: ExtractedGodparent[] = [];
  // Split multiple godparents by comma, semicolon, "та", "і", "із", newline
  const parts = text
    .split(/[,;\n]|\s+та\s+|\s+і\s+|\s+и\s+/i)
    .map(p => p.trim())
    .filter(p => p.length > 2);

  parts.forEach((part, idx) => {
    let role: ExtractedGodparent['role'] = 'godfather';
    let cleanText = part;

    if (/хрещена|кума|восприємниця|хрещена мати|кума:|восприемница/i.test(cleanText)) {
      role = 'godmother';
    } else if (/хрещений|кум|восприємник|хрещений батько|восприемник/i.test(cleanText)) {
      role = 'godfather';
    } else if (/поручитель|свідок|поручители|свидетели/i.test(cleanText)) {
      role = 'witness';
    }

    // Clean out descriptors
    cleanText = cleanText
      .replace(/^(хрещений батько|хрещена мати|восприємник|восприємниця|кум|кума|поручитель|свідок|козак|селянин|міщанин|житель|села|с\.|х\.|д\.)[:\s-]*/gi, '')
      .trim();

    if (cleanText.length > 2) {
      const parsed = parseFullName(cleanText);
      if (parsed.gender === 'female' && role === 'godfather') {
        role = 'godmother';
      }

      results.push({
        id: `gp_${sheetName}_r${rowIndex}_${idx}`,
        fullName: cleanText,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        patronymic: parsed.patronymic,
        role,
        notes: `Знайдено у графі восприємників/хрещених (${part})`
      });
    }
  });

  return results;
}

/**
 * Reads an uploaded Excel / CSV workbook buffer and extracts all sheets
 */
export function parseWorkbookMultiSheets(binaryOrBuffer: any): SheetDataset[] {
  const workbook = XLSX.read(binaryOrBuffer, { type: 'binary' });
  const datasets: SheetDataset[] = [];

  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return;

    const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    if (jsonRows.length === 0) return;

    const headers = Object.keys(jsonRows[0] || {});

    // Detect sheet type
    const sheetLower = sheetName.toLowerCase();
    let detectedType: SheetDataset['detectedType'] = 'general';
    if (/народженн|рожд|birth|метр.*нар/i.test(sheetLower)) detectedType = 'birth';
    else if (/шлюб|брак|marriage|вінчан/i.test(sheetLower)) detectedType = 'marriage';
    else if (/смерт|умер|death|похорон/i.test(sheetLower)) detectedType = 'death';
    else if (/ревіз|ревиз|сказк|перепис|двір/i.test(sheetLower)) detectedType = 'revision';
    else if (/сповід|исповед|відомост|роспис/i.test(sheetLower)) detectedType = 'confession';

    // Year estimate from sheet title or headers
    const yearMatch = sheetName.match(/\b(1[6-9]\d\d|20\d\d)\b/);
    const yearEstimate = yearMatch ? Number(yearMatch[1]) : undefined;

    datasets.push({
      sheetName,
      rowCount: jsonRows.length,
      headers,
      rows: jsonRows,
      detectedType,
      yearEstimate
    });
  });

  return datasets;
}

/**
 * Analyzes multi-sheet datasets with target surnames and extracts genealogical records with godparents
 */
export function extractRecordsFromSheets(
  datasets: SheetDataset[],
  targetSurnames: string[]
): ExtractedMetricRecord[] {
  const records: ExtractedMetricRecord[] = [];

  datasets.forEach((dataset) => {
    dataset.rows.forEach((row, rowIndex) => {
      // Find person name column
      const personKey = Object.keys(row).find(k => 
        /піб|особа|дитина|ім.*я|прізвище|назва|фігурант|новонароджен|наречений|померлий|глава|name|person/i.test(k)
      ) || Object.keys(row)[0];

      const rawPersonName = String(row[personKey] || '').trim();
      if (!rawPersonName || rawPersonName.length < 2) return;

      // Extract Year
      const yearKey = Object.keys(row).find(k => /рік|год|year|дата|date/i.test(k));
      let year: number | string | undefined = dataset.yearEstimate;
      if (yearKey && row[yearKey]) {
        const yMatch = String(row[yearKey]).match(/\b(1[6-9]\d\d|20\d\d)\b/);
        if (yMatch) year = Number(yMatch[1]);
        else year = row[yearKey];
      }

      // Extract Place/Village
      const placeKey = Object.keys(row).find(k => /село|парафія|місце|церква|повіт|губернія|place|village|church/i.test(k));
      const place = placeKey ? String(row[placeKey] || '') : undefined;

      // Extract Parents / Relatives
      const parentsKey = Object.keys(row).find(k => /батьк|родич|отец|мать|семья|parents|relatives|склад/i.test(k));
      const rawParents = parentsKey ? String(row[parentsKey] || '') : '';

      // Extract Godparents (Восприємники)
      const godparentsKey = Object.keys(row).find(k => /восприєм|хрещен|кум|свідк|поручител|godparent|witness|sponsor/i.test(k));
      let godparentsText = godparentsKey ? String(row[godparentsKey] || '') : '';
      
      // If no dedicated column, look inside notes or parents
      const notesKey = Object.keys(row).find(k => /примітк|замітк|текст|запис|notes|comment/i.test(k));
      const notesText = notesKey ? String(row[notesKey] || '') : '';

      if (!godparentsText && /восприєм|хрещен|кум|поручител/i.test(rawParents)) {
        godparentsText = rawParents;
      }
      if (!godparentsText && /восприєм|хрещен|кум|поручител/i.test(notesText)) {
        godparentsText = notesText;
      }

      const godparents = extractGodparentsFromText(godparentsText, dataset.sheetName, rowIndex);

      // Parse primary person
      const parsedPrimary = parseFullName(rawPersonName);
      const primaryPersonMeta: ExtractedPersonMeta = {
        fullName: rawPersonName,
        firstName: parsedPrimary.firstName,
        lastName: parsedPrimary.lastName,
        patronymic: parsedPrimary.patronymic,
        gender: parsedPrimary.gender,
        birthYear: typeof year === 'number' ? year : undefined,
        residence: place
      };

      // Check target surnames match in:
      // 1. Primary person
      // 2. Parents
      // 3. Godparents / Witnesses
      const fullRowText = Object.values(row).join(' ');
      const checkPrimary = matchesTargetSurname(rawPersonName, targetSurnames);
      const checkParents = matchesTargetSurname(rawParents, targetSurnames);
      const checkGodparents = godparents.some(gp => matchesTargetSurname(gp.fullName, targetSurnames).matches);
      const checkFullRow = matchesTargetSurname(fullRowText, targetSurnames);

      const matchingSurnames: string[] = [];
      if (checkPrimary.matchedSurname) matchingSurnames.push(checkPrimary.matchedSurname);
      if (checkParents.matchedSurname) matchingSurnames.push(checkParents.matchedSurname);
      godparents.forEach(gp => {
        const res = matchesTargetSurname(gp.fullName, targetSurnames);
        if (res.matchedSurname && !matchingSurnames.includes(res.matchedSurname)) {
          matchingSurnames.push(res.matchedSurname);
        }
      });

      const isRelevant = targetSurnames.length === 0 || checkPrimary.matches || checkParents.matches || checkGodparents || checkFullRow.matches;

      // Extract parents if present
      let fatherMeta: ExtractedPersonMeta | undefined = undefined;
      let motherMeta: ExtractedPersonMeta | undefined = undefined;

      if (rawParents) {
        // Try extract father & mother
        const fatherMatch = rawParents.match(/(?:батько|отець|отец)[:\s]+([^,;]+)/i);
        const motherMatch = rawParents.match(/(?:мати|матерь|мать|дружина)[:\s]+([^,;]+)/i);

        if (fatherMatch) {
          const p = parseFullName(fatherMatch[1]);
          fatherMeta = {
            fullName: fatherMatch[1].trim(),
            firstName: p.firstName,
            lastName: p.lastName || parsedPrimary.lastName,
            patronymic: p.patronymic,
            gender: 'male'
          };
        } else if (parsedPrimary.patronymic) {
          const derivedFatherFirst = deriveFatherNameFromPatronymic(parsedPrimary.patronymic);
          if (derivedFatherFirst && parsedPrimary.lastName) {
            fatherMeta = {
              fullName: `${parsedPrimary.lastName} ${derivedFatherFirst}`,
              firstName: derivedFatherFirst,
              lastName: parsedPrimary.lastName,
              gender: 'male'
            };
          }
        }

        if (motherMatch) {
          const p = parseFullName(motherMatch[1]);
          motherMeta = {
            fullName: motherMatch[1].trim(),
            firstName: p.firstName,
            lastName: p.lastName || parsedPrimary.lastName,
            patronymic: p.patronymic,
            gender: 'female'
          };
        }
      } else if (parsedPrimary.patronymic) {
        const derivedFatherFirst = deriveFatherNameFromPatronymic(parsedPrimary.patronymic);
        if (derivedFatherFirst && parsedPrimary.lastName) {
          fatherMeta = {
            fullName: `${parsedPrimary.lastName} ${derivedFatherFirst}`,
            firstName: derivedFatherFirst,
            lastName: parsedPrimary.lastName,
            gender: 'male'
          };
        }
      }

      records.push({
        id: `rec_${dataset.sheetName}_${rowIndex}_${Date.now()}`,
        sourceSheet: dataset.sheetName,
        rowIndex,
        year,
        recordType: dataset.detectedType,
        place,
        primaryPerson: primaryPersonMeta,
        father: fatherMeta,
        mother: motherMeta,
        godparents,
        householdMembers: [],
        notes: notesText || rawParents,
        rawText: fullRowText,
        relevanceToTargetSurnames: isRelevant,
        matchingSurnames
      });
    });
  });

  return records;
}

/**
 * Returns a high-quality multi-sheet sample dataset for immediate testing
 */
export function getSampleMultiSheetData(): SheetDataset[] {
  return [
    {
      sheetName: '1882_Метрики_Народження',
      rowCount: 6,
      detectedType: 'birth',
      yearEstimate: 1882,
      headers: ['Номер', 'Дата', 'Ім\'я народженого', 'Батьки', 'Восприємники (Хрещені)', 'Село'],
      rows: [
        {
          'Номер': '12',
          'Дата': '15.04.1882',
          'Ім\'я народженого': 'Коваленко Григорій Микитович',
          'Батьки': 'Козак Микита Семенович Коваленко та законна дружина Євдокія Іванівна',
          'Восприємники (Хрещені)': 'Козак Степан Іванович Шевченко та козачка Марія Семенівна Коваленко',
          'Село': 'Чернечий Яр'
        },
        {
          'Номер': '18',
          'Дата': '22.06.1882',
          'Ім\'я народженого': 'Шакало Іван Семенович',
          'Батьки': 'Козак Семен Федорович Шакало та дружина Параскева Григорівна',
          'Восприємники (Хрещені)': 'Козак Микита Семенович Коваленко та козачка Ганна Шакало',
          'Село': 'Диканька'
        },
        {
          'Номер': '25',
          'Дата': '10.08.1882',
          'Ім\'я народженого': 'Коваленко Марія Микитівна',
          'Батьки': 'Козак Микита Семенович Коваленко та Євдокія Іванівна',
          'Восприємники (Хрещені)': 'Козак Петро Семенович Шакало та дівчина Наталія Іванівна Шевченко',
          'Село': 'Чернечий Яр'
        },
        {
          'Номер': '31',
          'Дата': '02.10.1882',
          'Ім\'я народженого': 'Шевель Василь Андрійович',
          'Батьки': 'Козак Андрій Опанасович Шевель та Варвара Миколаївна',
          'Восприємники (Хрещені)': 'Козак Григорій Микитович Коваленко та Марія Шевель',
          'Село': 'Чернечий Яр'
        },
        {
          'Номер': '44',
          'Дата': '18.11.1882',
          'Ім\'я народженого': 'Бондаренко Андрій Кузьмич',
          'Батьки': 'Козак Кузьма Романович Бондаренко та Тетяна Данилівна',
          'Восприємники (Хрещені)': 'Козак Іван Семенович Шакало та Євдокія Коваленко',
          'Село': 'Великі Будища'
        }
      ]
    },
    {
      sheetName: '1898_Метрики_Шлюби',
      rowCount: 4,
      detectedType: 'marriage',
      yearEstimate: 1898,
      headers: ['Номер', 'Дата', 'Наречений', 'Наречена', 'Поручителі / Свідки', 'Парафія'],
      rows: [
        {
          'Номер': '5',
          'Дата': '20.01.1898',
          'Наречений': 'Коваленко Григорій Микитович (16 р.)',
          'Наречена': 'Шакало Ганна Семенівна (17 р.)',
          'Поручителі / Свідки': 'За нареченим: козак Андрій Шевель та Степан Шевченко; За нареченою: козак Іван Шакало та Кузьма Бондаренко',
          'Парафія': 'Покровська церква'
        },
        {
          'Номер': '9',
          'Дата': '14.02.1898',
          'Наречений': 'Шевель Петро Андрійович (20 р.)',
          'Наречена': 'Коваленко Марія Микитівна (16 р.)',
          'Поручителі / Свідки': 'За нареченим: козак Василь Шевель; За нареченою: козак Григорій Коваленко',
          'Парафія': 'Покровська церква'
        }
      ]
    },
    {
      sheetName: '1858_Ревізька_казка_Двір_14',
      rowCount: 5,
      detectedType: 'revision',
      yearEstimate: 1858,
      headers: ['№ Двору', 'Глава сім\'ї та склад', 'Вік за минулою ревізією', 'Вік нині (1858)', 'Родинні зв\'язки', 'Примітки'],
      rows: [
        {
          '№ Двору': '14',
          'Глава сім\'ї та склад': 'Коваленко Семен Васильович',
          'Вік за минулою ревізією': '38',
          'Вік нині (1858)': '50',
          'Родинні зв\'язки': 'Глава сім\'ї, козак',
          'Примітки': 'Дружина Марія Іванівна (48 р.)'
        },
        {
          '№ Двору': '14',
          'Глава сім\'ї та склад': 'Коваленко Микита Семенович',
          'Вік за минулою ревізією': '12',
          'Вік нині (1858)': '24',
          'Родинні зв\'язки': 'Семенів син',
          'Примітки': 'Одружений з Євдокією'
        },
        {
          '№ Двору': '14',
          'Глава сім\'ї та склад': 'Коваленко Петро Семенович',
          'Вік за минулою ревізією': '8',
          'Вік нині (1858)': '20',
          'Родинні зв\'язки': 'Семенів син (брат Микити)',
          'Примітки': 'На військовій службі'
        },
        {
          '№ Двору': '14',
          'Глава сім\'ї та склад': 'Коваленко Іван Семенович',
          'Вік за минулою ревізією': 'народився',
          'Вік нині (1858)': '6',
          'Родинні зв\'язки': 'Семенів син',
          'Примітки': 'У хаті батька'
        }
      ]
    },
    {
      sheetName: '1905_Сповідний_розпис',
      rowCount: 4,
      detectedType: 'confession',
      yearEstimate: 1905,
      headers: ['№ Двору', 'Парафіянин', 'Вік', 'Стан', 'Сповідь', 'Родинний статус'],
      rows: [
        {
          '№ Двору': '22',
          'Парафіянин': 'Коваленко Григорій Микитович',
          'Вік': '23',
          'Стан': 'Козак',
          'Сповідь': 'Був у сповіді',
          'Родинний статус': 'Глава родини'
        },
        {
          '№ Двору': '22',
          'Парафіянин': 'Коваленко (Шакало) Ганна Семенівна',
          'Вік': '24',
          'Стан': 'Козачка',
          'Сповідь': 'Була у сповіді',
          'Родинний статус': 'Дружина Григорія'
        },
        {
          '№ Двору': '22',
          'Парафіянин': 'Коваленко Василь Григорович',
          'Вік': '3',
          'Стан': 'Козак',
          'Сповідь': 'Дитятко',
          'Родинний статус': 'Син Григорія'
        }
      ]
    }
  ];
}
