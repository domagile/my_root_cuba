/**
 * Utility functions for hashtags and tagging across genealogical records.
 */

import { Person } from '../types';

/**
 * Extracts hashtags from free text (e.g. "#козак #полтавщина 1850 р.")
 */
export function extractHashtagsFromText(text?: string): string[] {
  if (!text || typeof text !== 'string') return [];
  // Regex to match unicode letters/numbers following #
  const matches = text.match(/#([\p{L}\p{N}_-]+)/gu);
  if (!matches) return [];
  return matches.map((m) => m.replace(/^#+/, '').trim()).filter(Boolean);
}

/**
 * Parses user tag input (supports comma-separated, space-separated with #, or array)
 * and returns clean, unique list of tag names without leading '#'.
 */
export function parseAndNormalizeTags(
  input: string | string[] | undefined,
  extraTextSources?: (string | undefined)[]
): string[] {
  const result = new Set<string>();

  if (Array.isArray(input)) {
    input.forEach((t) => {
      if (typeof t === 'string') {
        const cleaned = t.trim().replace(/^#+/, '');
        if (cleaned) result.add(cleaned);
      }
    });
  } else if (typeof input === 'string') {
    // If input contains commas, split by comma. Otherwise if it has hashtags, split by whitespace
    const tokens = input.includes(',')
      ? input.split(',')
      : input.split(/\s+/);

    tokens.forEach((token) => {
      const cleaned = token.trim().replace(/^#+/, '');
      if (cleaned) result.add(cleaned);
    });
  }

  // Also extract hashtags written in notes or bio if provided
  if (extraTextSources && extraTextSources.length > 0) {
    extraTextSources.forEach((src) => {
      if (src) {
        const extracted = extractHashtagsFromText(src);
        extracted.forEach((tag) => result.add(tag));
      }
    });
  }

  return Array.from(result);
}

/**
 * Ensures hashtag is formatted with '#' prefix for display
 */
export function formatHashtag(tag: string): string {
  if (!tag) return '';
  const trimmed = tag.trim();
  if (trimmed.startsWith('#')) return trimmed;
  return `#${trimmed}`;
}

/**
 * Aggregates all unique hashtags and their usage counts across a collection of persons
 */
export function getTreeHashtagsWithCounts(
  persons: Person[] | Record<string, Person> | undefined
): { tag: string; count: number }[] {
  if (!persons) return [];
  const list = Array.isArray(persons) ? persons : Object.values(persons);
  const tagCounts: Record<string, { display: string; count: number }> = {};

  list.forEach((p) => {
    if (!p) return;
    const combinedTags = new Set<string>();

    // From p.tags
    (p.tags || []).forEach((t) => {
      const clean = t.trim().replace(/^#+/, '');
      if (clean) combinedTags.add(clean);
    });

    // From notes & bio hashtags
    extractHashtagsFromText(p.notes).forEach((t) => combinedTags.add(t));
    extractHashtagsFromText(p.bio).forEach((t) => combinedTags.add(t));

    combinedTags.forEach((tag) => {
      const key = tag.toLowerCase();
      if (!tagCounts[key]) {
        tagCounts[key] = { display: tag, count: 0 };
      }
      tagCounts[key].count += 1;
    });
  });

  return Object.values(tagCounts)
    .map((item) => ({ tag: item.display, count: item.count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'uk'));
}
