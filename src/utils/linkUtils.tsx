/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ExternalLink, Globe, FileText, ScrollText } from 'lucide-react';

export interface ExtractedLink {
  title: string;
  url: string;
  domain: string;
}

/**
 * Extract all URLs and Markdown links from free-form text
 */
export function extractLinksFromText(text: string): ExtractedLink[] {
  if (!text) return [];

  const found: ExtractedLink[] = [];
  const seenUrls = new Set<string>();

  // 1. Match Markdown links [Title](URL)
  const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdRegex.exec(text)) !== null) {
    const title = match[1].trim();
    let url = match[2].trim();
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      try {
        const domain = new URL(url).hostname.replace(/^www\./, '');
        found.push({ title: title || domain, url, domain });
      } catch {
        found.push({ title: title || url, url, domain: 'веб-ресурс' });
      }
    }
  }

  // 2. Match raw URLs: https?://...
  const rawRegex = /(https?:\/\/[^\s<>"'()]+)/g;
  while ((match = rawRegex.exec(text)) !== null) {
    let url = match[1].trim();
    // Trim trailing punctuation like period, comma, or closing brackets
    url = url.replace(/[.,;:!?)\]]+$/, '');
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      try {
        const domain = new URL(url).hostname.replace(/^www\./, '');
        let title = domain;
        if (domain.includes('familysearch.org')) title = 'FamilySearch (Метричні книги)';
        else if (domain.includes('cdiak.archives.gov.ua')) title = 'ЦДІАК України';
        else if (domain.includes('wikipedia.org')) title = 'Вікіпедія';
        else if (domain.includes('dako.gov.ua')) title = 'ДАКО (Київський архів)';
        else if (domain.includes('dazho.gov.ua')) title = 'ДАЖО (Житомирський архів)';
        else if (domain.includes('daho.gov.ua')) title = 'ДАХО (Харківський архів)';
        found.push({ title, url, domain });
      } catch {
        found.push({ title: url, url, domain: 'веб-ресурс' });
      }
    }
  }

  return found;
}

/**
 * Render free-form text with clickable interactive links and basic formatting
 */
export function renderLinkifiedText(text: string, isDark: boolean = false): React.ReactNode {
  if (!text) return null;

  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();

        // Empty line
        if (!trimmed) {
          return <div key={lIdx} className="h-2" />;
        }

        // Header 2: ##
        if (line.startsWith('## ')) {
          return (
            <h3 key={lIdx} className="text-sm font-bold text-amber-500 pt-2 pb-0.5 border-b border-amber-500/20 flex items-center gap-1.5">
              <span>{line.replace(/^##\s*/, '')}</span>
            </h3>
          );
        }

        // Header 3: ###
        if (line.startsWith('### ')) {
          return (
            <h4 key={lIdx} className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 pt-1.5 font-sans">
              {line.replace(/^###\s*/, '')}
            </h4>
          );
        }

        // Horizontal rule: ---
        if (trimmed === '---') {
          return <hr key={lIdx} className="my-2 border-neutral-200 dark:border-neutral-800" />;
        }

        // Quote: >
        if (line.startsWith('> ')) {
          return (
            <blockquote key={lIdx} className="pl-3 border-l-2 border-amber-500/50 italic text-neutral-600 dark:text-neutral-400 my-1 text-xs">
              {renderLineWithLinks(line.replace(/^>\s*/, ''), isDark)}
            </blockquote>
          );
        }

        // Checklist: - [ ] or [ ] or - [x] or [x]
        const checkMatch = line.match(/^(\s*[-*]?\s*)\[([ xX])\]\s*(.*)$/);
        if (checkMatch) {
          const isDone = checkMatch[2].toLowerCase() === 'x';
          return (
            <div key={lIdx} className="flex items-start gap-2 text-xs py-0.5">
              <span className={`w-3.5 h-3.5 rounded mt-0.5 flex items-center justify-center border text-[9px] font-bold ${
                isDone 
                  ? 'bg-emerald-500 border-emerald-500 text-white' 
                  : 'border-neutral-400 dark:border-neutral-600 text-transparent'
              }`}>
                ✓
              </span>
              <span className={isDone ? 'line-through opacity-60' : ''}>
                {renderLineWithLinks(checkMatch[3], isDark)}
              </span>
            </div>
          );
        }

        // Bullet: - or *
        if (/^\s*[-*]\s+/.test(line)) {
          return (
            <div key={lIdx} className="flex items-start gap-2 text-xs py-0.5 pl-2">
              <span className="text-amber-500 font-bold shrink-0">•</span>
              <span>{renderLineWithLinks(line.replace(/^\s*[-*]\s+/, ''), isDark)}</span>
            </div>
          );
        }

        // Regular paragraph line with links
        return (
          <p key={lIdx} className="text-xs">
            {renderLineWithLinks(line, isDark)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Parse a single line and transform raw URLs & Markdown links into clickable <a> elements
 */
export function renderLineWithLinks(line: string, isDark: boolean = false): React.ReactNode {
  // Pattern matches:
  // 1. Markdown link: [Title](URL)
  // 2. Raw URL: https?://...
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s<>"'()]+)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    // Append text before link
    if (match.index > lastIndex) {
      elements.push(line.substring(lastIndex, match.index));
    }

    if (match[1]) {
      // Markdown link: [Title](URL)
      const linkTitle = match[2];
      const linkUrl = match[3];
      elements.push(
        <a
          key={match.index}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-500 underline underline-offset-2 decoration-amber-500/40 hover:decoration-amber-500 transition-all mx-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <span>{linkTitle}</span>
          <ExternalLink className="w-3 h-3 inline shrink-0 opacity-75" />
        </a>
      );
    } else if (match[4]) {
      // Raw URL
      let rawUrl = match[4];
      let trailingPunct = '';
      const punctMatch = rawUrl.match(/[.,;:!?)\]]+$/);
      if (punctMatch) {
        trailingPunct = punctMatch[0];
        rawUrl = rawUrl.slice(0, -trailingPunct.length);
      }

      let displayUrl = rawUrl;
      try {
        const u = new URL(rawUrl);
        displayUrl = u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname.slice(0, 15) + '...' : '');
      } catch {}

      elements.push(
        <a
          key={match.index}
          href={rawUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 underline underline-offset-2 decoration-blue-500/40 hover:decoration-blue-500 transition-all mx-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <span>{displayUrl}</span>
          <ExternalLink className="w-3 h-3 inline shrink-0 opacity-75" />
        </a>
      );

      if (trailingPunct) {
        elements.push(trailingPunct);
      }
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < line.length) {
    elements.push(line.substring(lastIndex));
  }

  return <>{elements}</>;
}
