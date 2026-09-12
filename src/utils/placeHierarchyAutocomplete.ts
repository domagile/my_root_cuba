/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Person, MetricRecord } from '../types';

export interface PlaceSuggestionItem {
  id: string;
  fullName: string;
  settlementName: string;
  hierarchy?: {
    settlement?: string;
    parishOrVolost?: string;
    districtOrUyezd?: string;
    regionOrGubernia?: string;
  };
  historicalName?: string;
  modernName?: string;
  usageCount: number;
  sourceType: 'person' | 'metric' | 'historical';
}

/**
 * Standardizes Ukrainian place names, cleans repetitive prefixes, and extracts hierarchy parts.
 */
export function extractPlaceHierarchy(rawPlace: string) {
  const parts = rawPlace.split(/[,;\/]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const settlement = parts[0]?.replace(/^(с\.|село|м\.|місто|смт\.|дер\.|деревня|хут\.|хутір|урочище)\s*/i, '').trim();
  let districtOrUyezd: string | undefined;
  let regionOrGubernia: string | undefined;
  let parishOrVolost: string | undefined;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (/(повіт|район|уезд|повита)/i.test(part)) {
      districtOrUyezd = part;
    } else if (/(губ|губернія|обл|область|воєводство|край|земля)/i.test(part)) {
      regionOrGubernia = part;
    } else if (/(вол|волость|парафія|приход)/i.test(part)) {
      parishOrVolost = part;
    } else if (!regionOrGubernia) {
      regionOrGubernia = part;
    }
  }

  return {
    settlement: settlement || parts[0],
    parishOrVolost,
    districtOrUyezd,
    regionOrGubernia
  };
}

/**
 * Builds an aggregated index of all places across the database (persons + metric records).
 */
export function buildPlaceSuggestionsIndex(
  persons: Person[],
  metricRecords?: MetricRecord[]
): PlaceSuggestionItem[] {
  const map = new Map<string, {
    fullName: string;
    settlement: string;
    hierarchy?: any;
    count: number;
    sources: Set<'person' | 'metric' | 'historical'>;
  }>();

  const addRawPlace = (raw: string | undefined, source: 'person' | 'metric' | 'historical') => {
    if (!raw) return;
    const clean = raw.trim();
    if (clean.length < 2) return;

    const key = clean.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.sources.add(source);
    } else {
      const hierarchy = extractPlaceHierarchy(clean);
      map.set(key, {
        fullName: clean,
        settlement: hierarchy?.settlement || clean,
        hierarchy,
        count: 1,
        sources: new Set([source])
      });
    }
  };

  // 1. Scan Persons
  persons.forEach((p) => {
    addRawPlace(p.birthPlace, 'person');
    addRawPlace(p.deathPlace, 'person');
    addRawPlace(p.residencePlace, 'person');
    addRawPlace(p.marriagePlace, 'person');
    if (p.historicalPlaces && Array.isArray(p.historicalPlaces)) {
      p.historicalPlaces.forEach((hp) => {
        addRawPlace(hp.modernPlace || hp.historicalText, 'historical');
      });
    }
  });

  // 2. Scan Metric Records
  if (metricRecords && Array.isArray(metricRecords)) {
    metricRecords.forEach((m) => {
      addRawPlace(m.village, 'metric');
      addRawPlace(m.church, 'metric');
    });
  }

  return Array.from(map.entries())
    .map(([key, data]) => {
      const srcType: 'person' | 'metric' | 'historical' = data.sources.has('metric')
        ? 'metric'
        : data.sources.has('historical')
        ? 'historical'
        : 'person';

      return {
        id: key,
        fullName: data.fullName,
        settlementName: data.settlement,
        hierarchy: data.hierarchy,
        usageCount: data.count,
        sourceType: srcType
      };
    })
    .sort((a, b) => b.usageCount - a.usageCount);
}

/**
 * Filters suggestions by user query.
 */
export function searchPlaceSuggestions(
  index: PlaceSuggestionItem[],
  query: string,
  limit = 7
): PlaceSuggestionItem[] {
  if (!query || !query.trim()) {
    return index.slice(0, limit);
  }
  const q = query.trim().toLowerCase();
  return index
    .filter((item) =>
      item.fullName.toLowerCase().includes(q) ||
      item.settlementName.toLowerCase().includes(q)
    )
    .slice(0, limit);
}
