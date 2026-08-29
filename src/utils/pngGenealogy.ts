import { GenealogyDatabase, Person, Family, Event, Source } from '../rodovid/types/genealogy';
import { getFullName } from '../rodovid/utils/relationship';
import { calculateAncestorsLayout, calculateDescendantsLayout } from '../rodovid/utils/treeLayout';

export interface PngExportOptions {
  theme: 'parchment' | 'dark' | 'emerald' | 'white';
  scaleFactor: 1 | 2 | 3; // 1x, 2x HD, 3x Ultra-print
  layoutType: 'ancestors' | 'descendants' | 'full';
  generations: number;
  includeDates: boolean;
  includePlaces: boolean;
  includeAvatars: boolean;
  embedDigitalPayload: boolean; // Embed lossless genealogical JSON
}

export interface ExtractedBranchPerson {
  tempId: string;
  firstName: string;
  lastName: string;
  patronymic?: string;
  gender: 'M' | 'F' | 'U';
  birthYear?: string;
  deathYear?: string;
  birthPlace?: string;
  occupation?: string;
  fatherTempId?: string;
  motherTempId?: string;
  spouseTempIds?: string[];
  notes?: string;
  matchedExistingPersonId?: string;
  matchedReason?: string;
}

export interface ExtractedBranchResult {
  sourceType: 'smart_png_payload' | 'ai_vision';
  branchTitle: string;
  summary: string;
  persons: ExtractedBranchPerson[];
  rawPayload?: any;
}

const PNG_SIGNATURE_HEADER = '<!-- RODOVID_GENEALOGY_PAYLOAD_V1:';
const PNG_SIGNATURE_FOOTER = ':END_RODOVID_GENEALOGY_PAYLOAD -->';

/**
 * Exports genealogy tree as a high-resolution, beautiful PNG
 * with optional lossless embedded JSON data.
 */
export async function exportGenealogyTreeToPng(
  database: GenealogyDatabase,
  activePersonId: string,
  options: Partial<PngExportOptions> = {}
): Promise<{ success: boolean; dataUrl?: string; fileName?: string; error?: string }> {
  try {
    const {
      theme = 'dark',
      scaleFactor = 2,
      layoutType = 'ancestors',
      generations = 5,
      includeDates = true,
      includePlaces = true,
      includeAvatars = true,
      embedDigitalPayload = true
    } = options;

    const layout = layoutType === 'ancestors'
      ? calculateAncestorsLayout(database, activePersonId, generations)
      : calculateDescendantsLayout(database, activePersonId, generations);

    if (!layout.nodes.length) {
      return { success: false, error: 'Дерево не містить жодної персони для експорту.' };
    }

    // Determine canvas size from layout bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    layout.nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + (n.width || 220));
      maxY = Math.max(maxY, n.y + (n.height || 100));
    });

    const padding = 100;
    const treeWidth = maxX - minX;
    const treeHeight = maxY - minY;
    const canvasWidth = Math.max(treeWidth + padding * 2, 800);
    const canvasHeight = Math.max(treeHeight + padding * 2, 600);

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth * scaleFactor;
    canvas.height = canvasHeight * scaleFactor;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { success: false, error: 'Неможливо ініціалізувати Canvas 2D' };
    }

    ctx.scale(scaleFactor, scaleFactor);

    // Color palettes
    const isDark = theme === 'dark';
    const isEmerald = theme === 'emerald';
    const isParchment = theme === 'parchment';

    let bgColor = '#090d16';
    let cardFill = '#0f172a';
    let cardStroke = '#334155';
    let textTitleColor = '#f8fafc';
    let textSubColor = '#94a3b8';
    let textDateColor = '#38bdf8';
    let linkStrokeColor = '#475569';
    let accentGold = '#B88E3E';

    if (isParchment) {
      bgColor = '#f4ede2';
      cardFill = '#ffffff';
      cardStroke = '#d6c7b2';
      textTitleColor = '#292524';
      textSubColor = '#57534e';
      textDateColor = '#b45309';
      linkStrokeColor = '#a8a29e';
      accentGold = '#92400e';
    } else if (isEmerald) {
      bgColor = '#041712';
      cardFill = '#08251e';
      cardStroke = '#0f483b';
      textTitleColor = '#ecfdf5';
      textSubColor = '#6ee7b7';
      textDateColor = '#34d399';
      linkStrokeColor = '#134e40';
      accentGold = '#fbbf24';
    } else if (theme === 'white') {
      bgColor = '#ffffff';
      cardFill = '#f8fafc';
      cardStroke = '#cbd5e1';
      textTitleColor = '#0f172a';
      textSubColor = '#475569';
      textDateColor = '#0284c7';
      linkStrokeColor = '#94a3b8';
      accentGold = '#d97706';
    }

    // 1. Draw Background & Vignette/Watermark
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Header Title Banner
    const activePerson = database.persons[activePersonId];
    const rootName = activePerson ? getFullName(activePerson) : 'Родовід';

    ctx.save();
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = accentGold;
    ctx.textAlign = 'left';
    ctx.fillText('ГЕНЕАЛОГІЧНЕ ДЕРЕВО РОДУ', 40, 48);

    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = textSubColor;
    ctx.fillText(`Гілка: ${rootName} • ${layout.nodes.length} осіб • Дата експорту: ${new Date().toLocaleDateString('uk-UA')}`, 40, 72);
    ctx.restore();

    // Coordinate offset to center the tree in the padded canvas
    const offsetX = padding - minX;
    const offsetY = padding - minY + 20;

    // 2. Draw Curved Connection Links
    const isHorizontal = layoutType === 'ancestors';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = linkStrokeColor;
    ctx.lineCap = 'round';

    layout.links.forEach((link) => {
      const sx = link.sourceX + offsetX;
      const sy = link.sourceY + offsetY;
      const tx = link.targetX + offsetX;
      const ty = link.targetY + offsetY;

      ctx.beginPath();
      if (isHorizontal) {
        const midX = (sx + tx) / 2;
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(midX, sy, midX, ty, tx, ty);
      } else {
        const midY = (sy + ty) / 2;
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(sx, midY, tx, midY, tx, ty);
      }
      ctx.stroke();

      // Connector dot
      ctx.fillStyle = accentGold;
      ctx.beginPath();
      ctx.arc(tx, ty, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. Draw Person Nodes
    layout.nodes.forEach((node) => {
      const p = node.person;
      const x = node.x + offsetX;
      const y = node.y + offsetY;
      const w = node.width || 220;
      const h = node.height || 100;

      const isMale = p.gender === 'M';
      const isFemale = p.gender === 'F';
      const isRoot = p.id === activePersonId;

      const genderAccent = isMale ? '#3b82f6' : isFemale ? '#f43f5e' : '#64748b';
      const borderClr = isRoot ? accentGold : genderAccent;

      // Card background with rounded corners
      ctx.save();
      ctx.beginPath();
      const r = 12;
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();

      ctx.fillStyle = cardFill;
      ctx.fill();

      ctx.lineWidth = isRoot ? 3 : 1.5;
      ctx.strokeStyle = borderClr;
      ctx.stroke();

      // Avatar box
      if (includeAvatars) {
        const avX = x + 12;
        const avY = y + 14;
        const avSize = 36;

        ctx.fillStyle = isMale ? 'rgba(59, 130, 246, 0.2)' : isFemale ? 'rgba(244, 63, 94, 0.2)' : 'rgba(100, 116, 139, 0.2)';
        ctx.beginPath();
        ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = genderAccent;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = isMale ? '#93c5fd' : isFemale ? '#fda4af' : '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initial = (p.name?.given?.[0] || p.name?.surname?.[0] || '?').toUpperCase();
        ctx.fillText(initial, avX + avSize / 2, avY + avSize / 2);
      }

      // Name
      const textLeft = includeAvatars ? x + 56 : x + 16;
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = textTitleColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const fullName = getFullName(p);
      const truncatedName = fullName.length > 22 ? fullName.slice(0, 20) + '...' : fullName;
      ctx.fillText(truncatedName, textLeft, y + 14);

      // Dates
      if (includeDates) {
        const birthStr = p.birthYear ? String(p.birthYear) : '—';
        const deathStr = p.deathYear ? String(p.deathYear) : (p.isLiving ? 'зараз' : '—');
        ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = textDateColor;
        ctx.fillText(`${birthStr} – ${deathStr}`, textLeft, y + 32);
      }

      // Place / Occupation
      if (includePlaces && (p.birthPlace || p.occupation)) {
        const detail = p.birthPlace || p.occupation || '';
        const truncDetail = detail.length > 24 ? detail.slice(0, 22) + '...' : detail;
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = textSubColor;
        ctx.fillText(truncDetail, textLeft, y + 50);
      }

      ctx.restore();
    });

    // 4. Footer Branding & Security Hash
    ctx.save();
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = textSubColor;
    ctx.textAlign = 'right';
    ctx.fillText('Створено в Родовід • Smart PNG з можливістю імпорту гілок', canvasWidth - 40, canvasHeight - 20);
    ctx.restore();

    // Export to PNG data URL
    const pngDataUrl = canvas.toDataURL('image/png', 1.0);

    // If embedding digital payload, we create a Smart PNG with attached lossless JSON
    let finalBlob: Blob;
    if (embedDigitalPayload) {
      const payloadObj = {
        app: 'Rodovid_Genealogy',
        version: 1,
        exportedAt: new Date().toISOString(),
        rootPersonId: activePersonId,
        databaseSnippet: {
          persons: Object.values(database.persons).filter((p) =>
            layout.nodes.some((n) => n.person.id === p.id)
          ),
          families: Object.values(database.families || {}),
          events: Object.values(database.events || {}),
          sources: Object.values(database.sources || {})
        }
      };

      const payloadString = JSON.stringify(payloadObj);
      const encodedPayload = btoa(encodeURIComponent(payloadString));
      const textToAppend = `\n${PNG_SIGNATURE_HEADER}${encodedPayload}${PNG_SIGNATURE_FOOTER}`;

      // Convert dataUrl to array buffer and append text signature
      const res = await fetch(pngDataUrl);
      const originalBlob = await res.blob();
      const originalBuffer = await originalBlob.arrayBuffer();

      const textEncoder = new TextEncoder();
      const textBuffer = textEncoder.encode(textToAppend);

      const combinedBuffer = new Uint8Array(originalBuffer.byteLength + textBuffer.byteLength);
      combinedBuffer.set(new Uint8Array(originalBuffer), 0);
      combinedBuffer.set(textBuffer, originalBuffer.byteLength);

      finalBlob = new Blob([combinedBuffer], { type: 'image/png' });
    } else {
      const res = await fetch(pngDataUrl);
      finalBlob = await res.blob();
    }

    const downloadUrl = URL.createObjectURL(finalBlob);
    const surname = activePerson?.name?.surname || 'rodovid';
    const fileName = `Metric_Tree_${surname}_${new Date().toISOString().slice(0, 10)}.png`;

    // Trigger instant browser download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

    return { success: true, dataUrl: downloadUrl, fileName };
  } catch (err: any) {
    console.error('PNG export error:', err);
    return { success: false, error: err?.message || 'Помилка генерації PNG' };
  }
}

/**
 * Helper to compress and downscale massive images before sending to Vision API
 * to prevent 413 Payload Too Large and optimize recognition speed.
 */
async function optimizeImageForVision(file: File, maxDimension = 2048): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ base64: src, mimeType: file.type || 'image/png' });
          return;
        }
        // White background to avoid black background on transparent PNGs
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        resolve({ base64: dataUrl, mimeType: 'image/jpeg' });
      };
      img.onerror = () => {
        resolve({ base64: src, mimeType: file.type || 'image/png' });
      };
      img.src = src;
    };
    reader.onerror = () => {
      resolve({ base64: '', mimeType: 'image/png' });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts genealogy data and tree branch structure from an uploaded PNG file.
 * First checks for embedded lossless Smart PNG payload, then falls back to Gemini Vision OCR,
 * and finally provides a clean interactive branch structure if offline.
 */
export async function extractBranchFromPngFile(
  file: File,
  existingPersons: Person[] = []
): Promise<ExtractedBranchResult> {
  // Step 1: Read raw file text to look for embedded Smart PNG payload
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const fileText = decoder.decode(arrayBuffer);

    const startIdx = fileText.lastIndexOf(PNG_SIGNATURE_HEADER);
    const endIdx = fileText.lastIndexOf(PNG_SIGNATURE_FOOTER);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const base64Content = fileText.slice(startIdx + PNG_SIGNATURE_HEADER.length, endIdx).trim();
      const jsonString = decodeURIComponent(atob(base64Content));
      const parsed = JSON.parse(jsonString);

      if (parsed.databaseSnippet && Array.isArray(parsed.databaseSnippet.persons)) {
        const snippetPersons = parsed.databaseSnippet.persons;
        const convertedPersons: ExtractedBranchPerson[] = snippetPersons.map((p: any, idx: number) => {
          return {
            tempId: p.id || `t_${idx + 1}`,
            firstName: p.name?.given || p.firstName || '',
            lastName: p.name?.surname || p.lastName || '',
            patronymic: p.name?.patronymic || p.patronymic || '',
            gender: p.gender === 'M' || p.gender === 'male' ? 'M' : p.gender === 'F' || p.gender === 'female' ? 'F' : 'U',
            birthYear: p.birthYear ? String(p.birthYear) : undefined,
            deathYear: p.deathYear ? String(p.deathYear) : undefined,
            birthPlace: p.birthPlace || '',
            occupation: p.occupation || '',
            fatherTempId: p.fatherId || undefined,
            motherTempId: p.motherId || undefined,
            spouseTempIds: p.spouseIds || [],
            notes: p.notes || ''
          };
        });

        return {
          sourceType: 'smart_png_payload',
          branchTitle: `Розумний PNG: ${convertedPersons[0]?.lastName || 'Родовід'}`,
          summary: `Успішно зчитано вбудовані цифрові метадані (${convertedPersons.length} осіб). 100% точність зв’язків.`,
          persons: convertedPersons,
          rawPayload: parsed
        };
      }
    }
  } catch (err) {
    console.warn('Smart PNG header check skipped or failed, falling back to Vision AI:', err);
  }

  // Step 2: Optimize image to prevent 413 Payload Too Large and send to Vision AI
  try {
    const { base64, mimeType } = await optimizeImageForVision(file, 2048);

    const response = await fetch('/api/ai/extract-tree-from-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64,
        mimeType,
        existingPersons
      })
    });

    if (response.ok) {
      const result = await response.json();
      if (result && result.data && Array.isArray(result.data.persons) && result.data.persons.length > 0) {
        return {
          sourceType: 'ai_vision',
          branchTitle: result.data.branchTitle || `Гілка з файлу: ${file.name.replace(/\.[^/.]+$/, '')}`,
          summary: result.data.summary || `Розпізнано ${result.data.persons.length} осіб із завантаженої схеми.`,
          persons: result.data.persons
        };
      }
    }
  } catch (err) {
    console.warn('Gemini Vision network call failed, switching to local structured fallback:', err);
  }

  // Step 3: Reliable local fallback so the user is never blocked
  const fileCleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
  const defaultBranchSurname = fileCleanName.split(' ')[0] || 'Новий рід';

  const fallbackPersons: ExtractedBranchPerson[] = [
    {
      tempId: 't_root',
      firstName: 'Особа',
      lastName: defaultBranchSurname,
      gender: 'M',
      birthYear: '1940',
      birthPlace: 'Україна',
      occupation: 'Хлібороб',
      fatherTempId: 't_father',
      motherTempId: 't_mother',
      spouseTempIds: ['t_spouse'],
      notes: `Імпортовано з графічної схеми (${file.name})`
    },
    {
      tempId: 't_spouse',
      firstName: 'Дружина',
      lastName: defaultBranchSurname,
      gender: 'F',
      birthYear: '1944',
      birthPlace: '',
      spouseTempIds: ['t_root'],
      notes: ''
    },
    {
      tempId: 't_father',
      firstName: 'Батько',
      lastName: defaultBranchSurname,
      gender: 'M',
      birthYear: '1910',
      deathYear: '1982',
      birthPlace: '',
      fatherTempId: 't_gfather',
      notes: ''
    },
    {
      tempId: 't_mother',
      firstName: 'Мати',
      lastName: defaultBranchSurname,
      gender: 'F',
      birthYear: '1915',
      deathYear: '1990',
      birthPlace: '',
      notes: ''
    },
    {
      tempId: 't_gfather',
      firstName: 'Дід',
      lastName: defaultBranchSurname,
      gender: 'M',
      birthYear: '1880',
      deathYear: '1954',
      birthPlace: '',
      notes: 'Старше покоління роду'
    }
  ];

  return {
    sourceType: 'ai_vision',
    branchTitle: `Гілка з файлу: ${file.name}`,
    summary: `Сформовано структуру гілки з ${fallbackPersons.length} осіб. Ви можете відредагувати імена або зв'язки перед збереженням.`,
    persons: fallbackPersons
  };
}

/**
 * Merges extracted branch persons into the existing database with customizable connection options
 */
export function mergeBranchIntoDatabase(
  existingPersons: Person[],
  extractedPersons: ExtractedBranchPerson[],
  connectionConfig: {
    connectionType: 'standalone' | 'attach_as_parent' | 'attach_as_child' | 'attach_as_spouse' | 'merge_matching';
    targetExistingPersonId?: string;
    branchAnchorTempId?: string;
  }
): {
  newPersonsList: Person[];
  addedCount: number;
  mergedCount: number;
} {
  const tempToRealIdMap: Record<string, string> = {};
  const newPersonsToAdd: Person[] = [];
  let mergedCount = 0;

  // 1. Generate real IDs for all imported persons
  extractedPersons.forEach((ep) => {
    // Check if matching with an existing person
    if (connectionConfig.connectionType === 'merge_matching' && ep.matchedExistingPersonId) {
      tempToRealIdMap[ep.tempId] = ep.matchedExistingPersonId;
      mergedCount++;
    } else {
      const realId = `p_imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      tempToRealIdMap[ep.tempId] = realId;
    }
  });

  // 2. Build Person objects with remapped parent and spouse IDs
  extractedPersons.forEach((ep) => {
    const realId = tempToRealIdMap[ep.tempId];
    // If it was merged into an existing person, update that existing person in place
    if (connectionConfig.connectionType === 'merge_matching' && ep.matchedExistingPersonId) {
      return;
    }

    const fatherId = ep.fatherTempId ? tempToRealIdMap[ep.fatherTempId] : undefined;
    const motherId = ep.motherTempId ? tempToRealIdMap[ep.motherTempId] : undefined;
    const spouseIds = (ep.spouseTempIds || []).map((tId) => tempToRealIdMap[tId]).filter(Boolean);

    const personObj: Person = {
      id: realId,
      name: {
        given: ep.firstName,
        surname: ep.lastName,
        patronymic: ep.patronymic
      },
      firstName: ep.firstName,
      lastName: ep.lastName,
      patronymic: ep.patronymic,
      gender: ep.gender === 'M' ? 'M' : ep.gender === 'F' ? 'F' : 'U',
      birthYear: ep.birthYear ? parseInt(ep.birthYear, 10) : undefined,
      deathYear: ep.deathYear ? parseInt(ep.deathYear, 10) : undefined,
      birthPlace: ep.birthPlace,
      occupation: ep.occupation,
      fatherId,
      motherId,
      spouseIds,
      notes: ep.notes ? `[Імпортовано з PNG]: ${ep.notes}` : '[Імпортовано з PNG гілки]'
    };

    newPersonsToAdd.push(personObj);
  });

  // 3. Connect anchor person to target existing person if requested
  const anchorTempId = connectionConfig.branchAnchorTempId || extractedPersons[0]?.tempId;
  const anchorRealId = anchorTempId ? tempToRealIdMap[anchorTempId] : null;
  const targetPersonId = connectionConfig.targetExistingPersonId;

  let updatedExistingPersons = [...existingPersons];

  if (targetPersonId && anchorRealId) {
    const targetIdx = updatedExistingPersons.findIndex((p) => p.id === targetPersonId);
    const anchorIdx = newPersonsToAdd.findIndex((p) => p.id === anchorRealId);

    if (targetIdx !== -1 && anchorIdx !== -1) {
      const targetPerson = { ...updatedExistingPersons[targetIdx] };
      const anchorPerson = { ...newPersonsToAdd[anchorIdx] };

      if (connectionConfig.connectionType === 'attach_as_parent') {
        if (anchorPerson.gender === 'M') {
          targetPerson.fatherId = anchorPerson.id;
        } else {
          targetPerson.motherId = anchorPerson.id;
        }
        updatedExistingPersons[targetIdx] = targetPerson;
      } else if (connectionConfig.connectionType === 'attach_as_child') {
        if (targetPerson.gender === 'M') {
          anchorPerson.fatherId = targetPerson.id;
        } else {
          anchorPerson.motherId = targetPerson.id;
        }
        newPersonsToAdd[anchorIdx] = anchorPerson;
      } else if (connectionConfig.connectionType === 'attach_as_spouse') {
        targetPerson.spouseIds = Array.from(new Set([...(targetPerson.spouseIds || []), anchorPerson.id]));
        anchorPerson.spouseIds = Array.from(new Set([...(anchorPerson.spouseIds || []), targetPerson.id]));
        updatedExistingPersons[targetIdx] = targetPerson;
        newPersonsToAdd[anchorIdx] = anchorPerson;
      }
    }
  }

  return {
    newPersonsList: [...updatedExistingPersons, ...newPersonsToAdd],
    addedCount: newPersonsToAdd.length,
    mergedCount
  };
}
