import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Sparkles, 
  FileText, 
  BookOpen, 
  ExternalLink, 
  CheckCircle2, 
  ArrowRight,
  Filter,
  History
} from 'lucide-react';
import decodedData from '../../data/nyshporka/decoded_frames.json';
import dahmoCases from '../../data/nyshporka/dahmo_sample_cases.json';
import { normalizeForMatching, historicalFuzzyScore } from '../../utils/nyshporkaTranslit';
import { getStoredResearchProfile } from '../../utils/nyshporkaStorage';

interface NyshporkaSearchProps {
  theme: any;
  onOpenViewerWithFrame?: (frameId: string, lineIdx?: number) => void;
}

export const NyshporkaSearch: React.FC<NyshporkaSearchProps> = ({ theme, onOpenViewerWithFrame }) => {
  const profile = getStoredResearchProfile();
  const [query, setQuery] = useState(profile.primarySurname || 'Долищинський');
  const [minScore, setMinScore] = useState<number>(0.65);

  const framesObj = (decodedData as any).frames || {};

  // Build searchable index from decoded frames lines
  const frameLines = useMemo(() => {
    const items: Array<{
      frameId: string;
      lineIdx: number;
      text: string;
      voice: 'pysar' | 'diak' | 'skryba';
    }> = [];

    Object.entries(framesObj).forEach(([fId, fVal]: [string, any]) => {
      const pLines = (fVal.pysarText || '').split('\n');
      pLines.forEach((l: string, idx: number) => {
        if (l.trim()) {
          items.push({ frameId: fId, lineIdx: idx, text: l, voice: 'pysar' });
        }
      });

      const dLines = (fVal.diakText || '').split('\n');
      dLines.forEach((l: string, idx: number) => {
        if (l.trim()) {
          items.push({ frameId: fId, lineIdx: idx, text: l, voice: 'diak' });
        }
      });

      const sLines = (fVal.skrybaText || '').split('\n');
      sLines.forEach((l: string, idx: number) => {
        if (l.trim()) {
          items.push({ frameId: fId, lineIdx: idx, text: l, voice: 'skryba' });
        }
      });
    });

    return items;
  }, [framesObj]);

  // Search results calculation
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];

    const normQ = normalizeForMatching(query);
    const results: Array<{
      type: 'frame_line' | 'case';
      frameId?: string;
      lineIdx?: number;
      title: string;
      subtitle: string;
      snippet: string;
      score: number;
      matchReason: string;
    }> = [];

    // Search in decoded manuscript lines
    frameLines.forEach(item => {
      const score = historicalFuzzyScore(query, item.text);
      if (score >= minScore) {
        results.push({
          type: 'frame_line',
          frameId: item.frameId,
          lineIdx: item.lineIdx,
          title: `ДАХмО 315-1-159 · Аркуш ${item.frameId}, рядок ${item.lineIdx + 1}`,
          subtitle: `Рушій ${item.voice === 'pysar' ? 'PySar (скоропис)' : item.voice === 'diak' ? 'Diak (устав)' : 'Skryba (латинка)'}`,
          snippet: item.text,
          score: Math.round(score * 100),
          matchReason: `Архівний збіг: "${normQ}" у тексті`
        });
      }
    });

    // Search in DAHMO cases
    (dahmoCases as any[]).forEach(c => {
      const text = `${c.description} ${c.fondTitle} ${c.fondNo}`;
      const score = historicalFuzzyScore(query, text);
      if (score >= minScore) {
        results.push({
          type: 'case',
          title: `ДАХмО Ф. ${c.fondNo}, ${c.invLabel}, спр. ${c.caseNo} (${c.date})`,
          subtitle: c.fondTitle,
          snippet: c.description,
          score: Math.round(score * 100),
          matchReason: 'Збіг в описі справи архіву'
        });
      }
    });

    return results.sort((a, b) => b.score - a.score);
  }, [query, minScore, frameLines]);

  const quickQueries = useMemo(() => {
    const set = new Set<string>([
      profile.primarySurname,
      ...profile.historicalVariants.slice(0, 3),
      ...profile.polishVariants.slice(0, 2),
      'Липовеньке',
      'Григорій',
      'Подільська',
      'священник'
    ]);
    return Array.from(set).filter(Boolean);
  }, [profile]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={`text-xl font-bold ${theme.cardTitle} flex items-center gap-2`}>
          <Search className="w-5 h-5 text-amber-500" />
          Пошук прізвищ за скорописом з архівною нормалізацією
        </h2>
        <p className={`text-xs ${theme.cardSubtext} mt-0.5`}>
          Враховує дореформену орфографію (ѣ→e, ъ/ь, ѳ→f, -скій / -ський), скорописні плутанини та розбіжності рушіїв
        </p>
      </div>

      {/* Search Controls */}
      <div className={`p-5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-4`}>
        <div className="relative">
          <Search className="w-5 h-5 text-amber-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введіть прізвище, ім'я або село (напр. Долищинський, Виробинська, Липовеньке)..."
            className="w-full pl-12 pr-4 py-3 text-sm rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 font-medium"
          />
        </div>

        {/* Quick Sample Queries */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-neutral-400 font-medium mr-1 flex items-center gap-1">
            <History className="w-3.5 h-3.5" />
            Приклади зі справ:
          </span>
          {quickQueries.map(q => (
            <button
              key={q}
              type="button"
              onClick={() => setQuery(q)}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                query === q
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Normalization Info Banner */}
        <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              Нормалізований запит: <strong className="font-mono text-amber-600 dark:text-amber-400">{normalizeForMatching(query)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 text-[11px]">Поріг схожості:</span>
            <input
              type="range"
              min="0.4"
              max="0.9"
              step="0.05"
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              className="w-20 accent-amber-500 cursor-pointer"
            />
            <span className="font-mono text-[11px] font-bold text-neutral-700 dark:text-neutral-300 w-8">
              {Math.round(minScore * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1 text-xs text-neutral-500">
        <span>Знайдено збігів: <strong>{searchResults.length}</strong></span>
        <span>Сортування за оцінкою відповідності</span>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {searchResults.length > 0 ? (
          searchResults.map((res, i) => (
            <div
              key={i}
              className={`p-4 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/50 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs`}
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                    {res.title}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    {res.score}% збіг
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    {res.subtitle}
                  </span>
                </div>

                {/* Highlighted text snippet */}
                <div className="text-xs font-serif leading-relaxed text-neutral-800 dark:text-neutral-200 bg-neutral-50 dark:bg-neutral-900/50 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800/80">
                  «{res.snippet}»
                </div>

                <div className="text-[11px] text-neutral-400">
                  {res.matchReason}
                </div>
              </div>

              {res.type === 'frame_line' && res.frameId && onOpenViewerWithFrame && (
                <button
                  type="button"
                  onClick={() => onOpenViewerWithFrame(res.frameId!, res.lineIdx)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors cursor-pointer shrink-0"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Показати на скані
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        ) : (
          <div className={`p-12 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} text-center space-y-2`}>
            <Search className="w-8 h-8 text-neutral-400 mx-auto" />
            <div className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
              Нічого не знайдено за запитом «{query}»
            </div>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Спробуйте зменшити поріг схожості або спробуйте одне із запропонованих ключових слів.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
