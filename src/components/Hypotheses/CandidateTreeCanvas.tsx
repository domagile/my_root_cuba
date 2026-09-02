/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { CandidateDraftTree, CandidateTreeNode } from '../../types/sheetsAnalysis';
import {
  Sparkles,
  Users,
  ShieldCheck,
  PlusCircle,
  Link,
  Search,
  Filter,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Heart,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface CandidateTreeCanvasProps {
  tree: CandidateDraftTree;
  onSelectNode: (node: CandidateTreeNode) => void;
  onMergeNodeToMainTree: (node: CandidateTreeNode) => void;
  onBatchMergeAll: () => void;
  theme: any;
}

export const CandidateTreeCanvas: React.FC<CandidateTreeCanvasProps> = ({
  tree,
  onSelectNode,
  onMergeNodeToMainTree,
  onBatchMergeAll,
  theme
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'new' | 'in_tree' | 'godparents'>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(tree.nodes[0]?.id || null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [highlightGodparents, setHighlightGodparents] = useState(true);

  // Filter nodes
  const filteredNodes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return tree.nodes.filter(node => {
      // Search filter
      const matchesSearch = !q || 
        node.fullName.toLowerCase().includes(q) || 
        node.roleInSource.toLowerCase().includes(q) ||
        (node.place && node.place.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Category filter
      if (filterRole === 'new') return !node.alreadyInMainTree;
      if (filterRole === 'in_tree') return node.alreadyInMainTree;
      if (filterRole === 'godparents') return (node.godchildrenCandidateIds.length > 0 || node.godparentCandidateIds.length > 0);

      return true;
    });
  }, [tree.nodes, searchQuery, filterRole]);

  // Group nodes by generation levels
  const generationGroups = useMemo(() => {
    const groups: Record<number, CandidateTreeNode[]> = {};
    filteredNodes.forEach(node => {
      const gen = node.generationLevel || 0;
      if (!groups[gen]) groups[gen] = [];
      groups[gen].push(node);
    });
    return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
  }, [filteredNodes]);

  const activeNode = useMemo(() => {
    return tree.nodes.find(n => n.id === selectedNodeId) || tree.nodes[0];
  }, [tree.nodes, selectedNodeId]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Toolbar */}
      <div className={`p-4 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-sm`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500/30 to-[#B88E3E]/20 text-[#B88E3E] flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`font-bold text-sm ${theme.cardTitle}`}>{tree.title}</h3>
              <p className={`text-[11px] ${theme.cardSubtext}`}>
                Кандидатів: <strong>{tree.stats.totalCandidates}</strong> • Нових: <strong className="text-amber-500">{tree.stats.newPersonsReadyToMerge}</strong> • Хрещених: <strong className="text-[#E2C382]">{tree.stats.godparentsFound}</strong>
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative min-w-[200px] sm:min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Пошук особи, села чи ролі..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-3 py-1.5 ${theme.inputBg} border ${theme.inputBorder} rounded-xl text-xs ${theme.inputText} placeholder-neutral-500 focus:outline-none`}
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setFilterRole('all')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                filterRole === 'all' ? `${theme.accentBtn} ${theme.accentBtnText} shadow-xs` : `${theme.badgeBg} ${theme.badgeText}`
              }`}
            >
              Усі ({tree.nodes.length})
            </button>
            <button
              onClick={() => setFilterRole('new')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                filterRole === 'new' ? 'bg-amber-600 text-white shadow-xs' : `${theme.badgeBg} text-amber-500 border border-amber-500/20`
              }`}
            >
              Тільки нові ({tree.stats.newPersonsReadyToMerge})
            </button>
            <button
              onClick={() => setFilterRole('godparents')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                filterRole === 'godparents' ? 'bg-[#B88E3E] text-white shadow-xs' : `${theme.badgeBg} text-[#E2C382] border border-[#B88E3E]/30`
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Хрещені / Куми ({tree.stats.godparentsFound})</span>
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end lg:self-center">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#E2C382] cursor-pointer bg-[#B88E3E]/10 px-2.5 py-1 rounded-xl border border-[#B88E3E]/30">
            <input
              type="checkbox"
              checked={highlightGodparents}
              onChange={e => setHighlightGodparents(e.target.checked)}
              className="accent-[#B88E3E] rounded"
            />
            <span>Показувати зв&apos;язки хрещених</span>
          </label>

          <button
            onClick={onBatchMergeAll}
            disabled={tree.stats.newPersonsReadyToMerge === 0}
            className={`px-3.5 py-1.5 ${theme.accentBtn} ${theme.accentBtnText} font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md hover:opacity-90 transition-all disabled:opacity-40 cursor-pointer`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Додати всіх нових ({tree.stats.newPersonsReadyToMerge}) в дерево</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas & Inspector Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[500px]">
        {/* Left 2 Cols: Generation Tiers Tree */}
        <div className={`lg:col-span-2 p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} overflow-y-auto space-y-6 shadow-sm relative`}>
          <div className="flex items-center justify-between border-b border-black/10 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#B88E3E]" />
              <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.cardTitle}`}>
                Структура знайдених поколінь та родин
              </h4>
            </div>
            <span className="text-[11px] text-neutral-400">
              Натисніть на картку для перегляду доказів та додавання
            </span>
          </div>

          {filteredNodes.length === 0 ? (
            <div className="p-12 text-center text-xs opacity-60">
              Нічого не знайдено за вашим фільтром. Спробуйте скинути пошук.
            </div>
          ) : (
            generationGroups.map(([genStr, nodesInGen]) => {
              const genNum = Number(genStr);
              return (
                <div key={genStr} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#B88E3E]/20 text-[#E2C382] border border-[#B88E3E]/30">
                      Покоління {genNum === 0 ? 'I (Старше/Батьки)' : genNum === 1 ? 'II (Діти/Народжені)' : `III+`}
                    </span>
                    <div className="h-px bg-black/10 flex-1" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {nodesInGen.map(node => {
                      const isSelected = node.id === selectedNodeId;
                      const hasGodchildren = node.godchildrenCandidateIds.length > 0;
                      const hasGodparents = node.godparentCandidateIds.length > 0;

                      return (
                        <div
                          key={node.id}
                          onClick={() => {
                            setSelectedNodeId(node.id);
                            onSelectNode(node);
                          }}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                            isSelected
                              ? 'bg-[#18453B] border-[#E2C382] shadow-lg ring-2 ring-[#E2C382]/50'
                              : `${theme.inputBg} ${theme.cardBorder} hover:border-[#B88E3E]/70 hover:shadow-sm`
                          }`}
                        >
                          {/* Top Status Badges */}
                          <div className="flex items-start justify-between gap-1.5 mb-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              node.gender === 'female' ? 'bg-rose-500/20 text-rose-300' : 'bg-blue-500/20 text-blue-300'
                            }`}>
                              {node.estimatedBirthYear ? `~${node.estimatedBirthYear} р.` : 'Рік невідомий'}
                            </span>

                            {node.alreadyInMainTree ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> В дереві ({node.confidenceScore}%)
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Новий кандидат
                              </span>
                            )}
                          </div>

                          {/* Person Name & Role */}
                          <div className="space-y-1">
                            <h5 className={`font-bold text-xs ${isSelected ? 'text-[#F5EEDC]' : theme.cardTitle} group-hover:text-[#E2C382] transition-colors leading-tight`}>
                              {node.fullName}
                            </h5>
                            <p className={`text-[11px] ${isSelected ? 'text-[#C8DCD5]' : theme.cardSubtext} line-clamp-1`}>
                              {node.roleInSource}
                            </p>
                          </div>

                          {/* Special Godparent Indicators */}
                          {highlightGodparents && (hasGodchildren || hasGodparents) && (
                            <div className="mt-2.5 pt-2 border-t border-black/10 flex flex-wrap items-center gap-1.5 text-[10px]">
                              {hasGodchildren && (
                                <span className="px-1.5 py-0.5 rounded bg-[#B88E3E]/20 text-[#E2C382] font-semibold flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5" /> Хрестив {node.godchildrenCandidateIds.length} дітей
                                </span>
                              )}
                              {hasGodparents && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-300 font-semibold">
                                  Хрещених: {node.godparentCandidateIds.length}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Quick Add Button */}
                          <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-black/10">
                            <span className="text-neutral-400 text-[10px]">
                              Згадок: {node.citations.length}
                            </span>
                            
                            {!node.alreadyInMainTree ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMergeNodeToMainTree(node);
                                }}
                                className="px-2.5 py-1 bg-[#E2C382] hover:bg-[#D4B572] text-[#0A2621] font-bold rounded-lg text-[10px] flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                              >
                                <PlusCircle className="w-3 h-3" />
                                <span>Додати</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-medium">Синхронізовано</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right 1 Col: Active Candidate Deep Inspector */}
        <div className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-sm flex flex-col justify-between`}>
          {activeNode ? (
            <div className="space-y-4 overflow-y-auto">
              <div className="border-b border-black/10 pb-3 flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#B88E3E] font-bold block">
                    Картка кандидата зі сгенерованого дерева
                  </span>
                  <h4 className={`text-base font-bold ${theme.cardTitle} mt-0.5`}>
                    {activeNode.fullName}
                  </h4>
                  <p className={`text-xs ${theme.cardSubtext}`}>
                    {activeNode.gender === 'female' ? 'Жінка' : 'Чоловік'} • {activeNode.estimatedBirthYear ? `~${activeNode.estimatedBirthYear} р.н.` : 'Рік орієнтовний'} {activeNode.place ? `• ${activeNode.place}` : ''}
                  </p>
                </div>

                {activeNode.alreadyInMainTree ? (
                  <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400" title="Вже існує в родинному дереві">
                    <CheckCircle2 className="w-5 h-5" />
                  </span>
                ) : (
                  <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400" title="Нова персона">
                    <Sparkles className="w-5 h-5" />
                  </span>
                )}
              </div>

              {/* Status & Tree Match Box */}
              {activeNode.alreadyInMainTree ? (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Знайдено в основному дереві: {activeNode.matchedMainPersonName}</span>
                  </div>
                  <ul className="text-[11px] text-emerald-200/80 list-disc list-inside space-y-0.5">
                    {activeNode.matchReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/40 text-xs text-amber-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Новий родич для додавання до родоводу</span>
                  </div>
                  <p className="text-[11px] text-amber-200/80">
                    Персона виявлена під час перехресного аналізу листів метрик та ревізій.
                  </p>
                </div>
              )}

              {/* Godparent Connections (Хрещені та куми) */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-[#E2C382] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Хрещені зв&apos;язки (Восприємники & Куми):</span>
                </h5>

                {activeNode.godparentDetails && activeNode.godparentDetails.length > 0 ? (
                  <div className="space-y-1.5">
                    {activeNode.godparentDetails.map((gp, i) => (
                      <div key={i} className={`p-2.5 rounded-xl ${theme.inputBg} border ${theme.cardBorder} text-xs flex items-center justify-between`}>
                        <div>
                          <span className={`font-bold ${theme.cardTitle} block`}>{gp.name}</span>
                          <span className="text-[10px] text-neutral-400">
                            {gp.role === 'godmother' ? 'Хрещена мати' : gp.role === 'godfather' ? 'Хрещений батько' : 'Поручитель / Свідок'} ({gp.year ? `${gp.year} р.` : gp.sheet})
                          </span>
                        </div>
                        {gp.matchedTreeId ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            Є в дереві
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#B88E3E]/20 text-[#E2C382]">
                            Архівний кум
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 italic">
                    У записах народження цієї особи відомості про хрещених не виділені або особа є хрещеним для інших.
                  </p>
                )}

                {/* If baptized other children */}
                {activeNode.godchildrenCandidateIds.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-[#B88E3E]/10 border border-[#B88E3E]/30 text-xs text-[#E2C382]">
                    <strong>Хрестив(ла) дітей:</strong> {activeNode.godchildrenCandidateIds.length} осіб у цьому роді.
                  </div>
                )}
              </div>

              {/* Citations / Sheet Sources */}
              <div className="space-y-2">
                <h5 className={`text-xs font-bold ${theme.cardTitle}`}>Архівні джерела та листи таблиці:</h5>
                <div className="space-y-1.5">
                  {activeNode.citations.map((c, i) => (
                    <div key={i} className={`p-2 rounded-xl ${theme.inputBg} border ${theme.cardBorder} text-[11px] space-y-1`}>
                      <div className="flex items-center justify-between font-semibold text-[#B88E3E]">
                        <span>📄 {c.sheet}</span>
                        <span>{c.year ? `${c.year} р.` : ''}</span>
                      </div>
                      <p className={`text-[10px] ${theme.cardSubtext} font-serif italic`}>
                        «{c.excerpt}»
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-neutral-400">
              Оберіть особу зі сгенерованого дерева
            </div>
          )}

          {/* Action Footer */}
          {activeNode && (
            <div className="pt-3 border-t border-black/10 flex flex-col gap-2">
              {!activeNode.alreadyInMainTree ? (
                <button
                  onClick={() => onMergeNodeToMainTree(activeNode)}
                  className={`w-full py-2.5 ${theme.accentBtn} ${theme.accentBtnText} font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md hover:opacity-90 transition-all cursor-pointer`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Додати {activeNode.firstName || activeNode.fullName} до основного дерева</span>
                </button>
              ) : (
                <div className="p-2 text-center text-xs text-emerald-400 font-semibold bg-emerald-950/20 rounded-xl">
                  ✓ Ця персона вже присутня у вашому родовому дереві
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
