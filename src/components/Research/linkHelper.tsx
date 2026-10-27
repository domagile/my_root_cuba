/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { ResearchNote } from '../../types';

// Common domain TLDs particularly relevant for archives, genealogy, institutions and global web
export const DOMAIN_TLDS =
  '(?:com|org|net|edu|gov|mil|int|ua|ee|pl|de|cz|lt|lv|uk|eu|io|me|info|biz|app|online|site|store|tech|top|xyz|pro|by|ru|ro|hu|sk|fr|be|nl|ch|at|se|no|fi|dk|es|it|pt|gr|bg|hr|rs|si|md|am|ge|az|kz|uz|kg|tj|tm|is|ie|li|lu|mc|sm|va|ad|al|ba|mk|mt|cy|ca|us|au|nz|il|tr|in|cn|jp|kr|br|ar|mx|za)';

// Matches:
// 1) Explicit protocol URLs: https?://...
// 2) www. URLs: www....
// 3) Naked domains with recognized TLD & optional path (e.g. ra.ee/dgs/..., archives.gov.ua/..., familysearch.org)
// 4) Any valid domain with a path (e.g. ra.ee/dgs/_purl.php?shc=ERA.5056.1.18)
export const URL_PATTERN_STRING =
  `(?:https?:\\/\\/|www\\.)[^\\s<>()]+|` +
  `[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\\.${DOMAIN_TLDS}(?::\\d+)?(?:\\/[^\\s<>()]*)?|` +
  `[a-zA-Z0-9][-a-zA-Z0-9]*\\.[a-zA-Z]{2,}\\/[^\\s<>()]+`;

// Regex for markdown links: [Title](url)
export const MARKDOWN_LINK_REGEX = new RegExp(`\\[([^\\]]+)\\]\\(((?:${URL_PATTERN_STRING}))\\)`, 'g');

// Regex for plain URLs
export const URL_REGEX = new RegExp(`((?:${URL_PATTERN_STRING}))`, 'g');

// Combined scanner for markdown links and raw URLs
export const COMBINED_LINK_REGEX = new RegExp(
  `(\\[([^\\]]+)\\]\\(((?:${URL_PATTERN_STRING}))\\))|(${URL_PATTERN_STRING})`,
  'g'
);

/**
 * Checks if a string contains any recognized URL
 */
export function hasLink(text: string): boolean {
  if (!text) return false;
  const regex = new RegExp(URL_PATTERN_STRING);
  return regex.test(text);
}

/**
 * Trims trailing punctuation often attached to URLs in natural writing
 */
export function cleanUrl(raw: string): { url: string; trailing: string } {
  let url = raw;
  let trailing = '';
  while (url.length > 0 && /[.,;:!?)"'>\]]$/.test(url)) {
    trailing = url.slice(-1) + trailing;
    url = url.slice(0, -1);
  }
  return { url, trailing };
}

/**
 * Normalizes URL for href attribute (ensures http:// or https:// prefix)
 */
export function getHref(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Formats a URL for compact display
 */
export function formatUrlDisplay(rawUrl: string, maxLen = 75): string {
  try {
    const fullUrl = getHref(rawUrl);
    const parsed = new URL(fullUrl);
    let display = parsed.hostname.replace(/^www\./, '');
    const pathAndSearch = (parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '') + (parsed.search || '');
    if (pathAndSearch) {
      display += pathAndSearch;
    }
    if (display.length > maxLen) {
      const start = display.slice(0, maxLen - 16);
      const end = display.slice(-12);
      return `${start}…${end}`;
    }
    return display;
  } catch {
    return rawUrl.length > maxLen ? rawUrl.slice(0, maxLen - 3) + '…' : rawUrl;
  }
}

/**
 * Extracts all unique URLs from a note (linkUrl, content, checklist items)
 */
export function extractAllLinksFromNote(note: ResearchNote | null): string[] {
  if (!note) return [];
  const found = new Set<string>();

  if (note.linkUrl && note.linkUrl.trim()) {
    found.add(cleanUrl(note.linkUrl.trim()).url);
  }

  const collectFromText = (text: string) => {
    if (!text) return;
    // Check markdown links first
    let match: RegExpExecArray | null;
    const mdRegex = new RegExp(MARKDOWN_LINK_REGEX);
    while ((match = mdRegex.exec(text)) !== null) {
      if (match[2]) {
        found.add(cleanUrl(match[2]).url);
      }
    }

    // Check plain urls
    const urlRegex = new RegExp(URL_REGEX);
    while ((match = urlRegex.exec(text)) !== null) {
      if (match[1]) {
        found.add(cleanUrl(match[1]).url);
      }
    }
  };

  if (note.content) {
    collectFromText(note.content);
  }

  if (note.checklistItems && Array.isArray(note.checklistItems)) {
    note.checklistItems.forEach((item) => {
      if (item && item.text) {
        collectFromText(item.text);
      }
    });
  }

  return Array.from(found);
}

/**
 * Renders text with clickable links for both markdown links [Text](url) and plain URLs
 */
export function renderContentWithClickableLinks(
  text: string,
  options?: {
    className?: string;
    stopClickPropagation?: boolean;
  }
): React.ReactNode {
  if (!text) return null;

  const stopClick = options?.stopClickPropagation ?? true;
  const segments: React.ReactNode[] = [];
  let keyIdx = 0;

  const combinedRegex = new RegExp(COMBINED_LINK_REGEX);

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      segments.push(
        <React.Fragment key={`txt-${keyIdx++}`}>
          {text.substring(lastIndex, match.index)}
        </React.Fragment>
      );
    }

    if (match[1]) {
      // It's a markdown link [Title](URL)
      const label = match[2];
      const rawUrl = match[3];
      const { url, trailing } = cleanUrl(rawUrl);
      const href = getHref(url);

      segments.push(
        <a
          key={`md-${keyIdx++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (stopClick) e.stopPropagation();
          }}
          className={`text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-semibold underline underline-offset-2 inline-flex items-center gap-0.5 break-all cursor-pointer transition-colors ${options?.className || ''}`}
          title={`Відкрити: ${href}`}
        >
          <span>{label}</span>
          <ExternalLink className="w-2.5 h-2.5 inline shrink-0 opacity-70" />
        </a>
      );
      if (trailing) {
        segments.push(<React.Fragment key={`tr-${keyIdx++}`}>{trailing}</React.Fragment>);
      }
    } else if (match[4]) {
      // It's a plain URL (including ra.ee/..., familysearch.org/..., https://...)
      const rawUrl = match[4];
      const { url, trailing } = cleanUrl(rawUrl);
      const href = getHref(url);

      segments.push(
        <a
          key={`url-${keyIdx++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (stopClick) e.stopPropagation();
          }}
          className={`text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-semibold underline underline-offset-2 inline-flex items-center gap-0.5 break-all cursor-pointer transition-colors ${options?.className || ''}`}
          title={`Відкрити посилання: ${href}`}
        >
          <span>{url}</span>
          <ExternalLink className="w-2.5 h-2.5 inline shrink-0 opacity-70" />
        </a>
      );
      if (trailing) {
        segments.push(<React.Fragment key={`tr-${keyIdx++}`}>{trailing}</React.Fragment>);
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Add any remaining text
  if (lastIndex < text.length) {
    segments.push(
      <React.Fragment key={`txt-${keyIdx++}`}>
        {text.substring(lastIndex)}
      </React.Fragment>
    );
  }

  return segments;
}

/**
 * Component to display extracted interactive links bar
 */
export const NoteLinksBar: React.FC<{
  links: string[];
  className?: string;
  label?: string;
}> = ({ links, className = '', label }) => {
  if (!links || links.length === 0) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`p-2 sm:p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-wrap items-center gap-1.5 sm:gap-2 ${className}`}
    >
      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1 shrink-0">
        <Globe className="w-3.5 h-3.5" />
        <span>{label || `Посилання (${links.length}):`}</span>
      </span>
      {links.map((link, idx) => {
        const href = getHref(link);
        const display = formatUrlDisplay(link, 70);
        return (
          <a
            key={idx}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-800 dark:text-amber-200 transition-colors shadow-2xs max-w-full cursor-pointer break-all"
            title={`Відкрити: ${href}`}
          >
            <span className="truncate max-w-xs sm:max-w-md">{display}</span>
            <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-80" />
          </a>
        );
      })}
    </div>
  );
};
