/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Person } from '../types';
import { requestAiJson } from './aiApiClient';

export interface RecognizedMetricItem {
  extractedPersonName: string;
  year: string;
  dateExact?: string;
  recordType: string;
  village: string;
  socialStatus?: string;
  parentsOrRelatives: string;
  originalTranscription?: string;
  matchedPersonId?: string;
  matchedPersonName?: string;
  confidence: number;
  linkReason: string;
  suggestedKinship?: string;
}

export interface MetricOcrResponse {
  success: boolean;
  results: RecognizedMetricItem[];
  modelUsed?: string;
  rawOutput?: string;
  fallback?: boolean;
  message?: string;
  error?: string;
}

/**
 * Convert an image URL (including blob:, data:, https:) to Base64
 */
export async function urlOrBlobToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { mimeType: match[1], base64: match[2] };
    }
  }

  // Fetch image blob
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Не вдалося завантажити скан (${response.status}).`);
  const blob = await response.blob();
  const mimeType = blob.type || 'image/jpeg';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Call the AI Vision Archival & Metric Transcription API
 */
export async function transcribeMetricImageWithAI(params: {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  recordTypeHint?: string;
  existingPersons?: Person[];
}): Promise<MetricOcrResponse> {
  try {
    let cleanBase64 = params.imageBase64;
    let mimeType = params.mimeType || 'image/jpeg';

    if (!cleanBase64 && params.imageUrl) {
      const converted = await urlOrBlobToBase64(params.imageUrl);
      cleanBase64 = converted.base64;
      mimeType = converted.mimeType;
    }

    if (!cleanBase64) {
      return {
        success: false,
        results: [],
        error: 'Не надано зображення для аналізу скоропису.'
      };
    }

    // Strip header if present
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }

    const payload = {
      imageBase64: cleanBase64,
      mimeType,
      recordTypeHint: params.recordTypeHint,
      existingPersons: (params.existingPersons || []).slice(0, 30).map((p) => ({
        id: p.id,
        firstName: p.name?.given || p.firstName,
        lastName: p.name?.surname || p.lastName,
        patronymic: p.name?.patronymic || p.patronymic,
        birthYear: p.birthYear,
        birthPlace: p.birthPlace
      }))
    };

    const data = await requestAiJson('/api/ai/analyze-metric', payload);
    if (!Array.isArray(data.results)) throw new Error('Некоректний список результатів ШІ.');
    return {
      success: true,
      results: Array.isArray(data.results) ? data.results : [],
      modelUsed: data.source || data.modelUsed,
      fallback: data.fallback,
      message: data.message
    };
  } catch (err: any) {
    return {
      success: false,
      results: [],
      error: `Помилка аналізу зображення: ${err.message || String(err)}`
    };
  }
}
