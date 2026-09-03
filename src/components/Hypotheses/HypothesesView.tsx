/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useGenealogy } from '../../context/GenealogyContext';
import { getThemeConfig } from '../../utils/theme';
import { SheetsAnalyzerTab } from './SheetsAnalyzerTab';
import { CandidateTreeCanvas } from './CandidateTreeCanvas';
import { CandidateInspectorModal } from './CandidateInspectorModal';
import { CandidateDraftTree, CandidateTreeNode, ExtractedMetricRecord } from '../../types/sheetsAnalysis';
import { Person, GenealogyHypothesis } from '../../types';
import {
  Sparkles,
  Layers,
  FileSpreadsheet,
  GitFork,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  X,
  Lightbulb,
  Search,
  Users,
  ShieldCheck,
  ArrowRight,
  Database,
  BookmarkPlus
} from 'lucide-react';

export const HypothesesView: React.FC = () => {
  const {
    hypotheses,
    addHypothesis,
    updateHypothesis,
    deleteHypothesis,
    persons,
    addPerson,
    themePalette
  } = useGenealogy();

  const theme = getThemeConfig(themePalette);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'analyzer' | 'candidate_tree' | 'connections_table' | 'registry'>('analyzer');

  // Candidate Tree & Records state
  const [candidateTree, setCandidateTree] = useState<CandidateDraftTree | null>(null);
  const [extractedRecords, setExtractedRecords] = useState<ExtractedMetricRecord[]>([]);

  // Inspector Modal state
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateTreeNode | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Hypothesis modal state
  const [isHypoModalOpen, setIsHypoModalOpen] = useState(false);
  const [editingHypo, setEditingHypo] = useState<GenealogyHypothesis | null>(null);
  const [hypoTitle, setHypoTitle] = useState('');
  const [hypoDesc, setHypoDesc] = useState('');
  const [hypoConfidence, setHypoConfidence] = useState(70);
  const [hypoEvidence, setHypoEvidence] = useState(1);
  const [hypoStatus, setHypoStatus] = useState<GenealogyHypothesis['status']>('testing');

  // When tree is generated from sheets analyzer
  const handleTreeGenerated = (tree: CandidateDraftTree, records: ExtractedMetricRecord[]) => {
    setCandidateTree(tree);
    setExtractedRecords(records);
    setActiveTab('candidate_tree'); // automatically switch to visual tree
  };

  // Inspect a candidate node
  const handleOpenInspector = (node: CandidateTreeNode) => {
    setSelectedCandidate(node);
    setIsInspectorOpen(true);
  };

  // Merge a single candidate into main tree
  const handleConfirmAddPerson = (newPerson: Person) => {
    addPerson(newPerson);

    // Update candidate tree state
    if (candidateTree && selectedCandidate) {
      const updatedNodes = candidateTree.nodes.map(n => {
        if (n.id === selectedCandidate.id) {
          return {
            ...n,
            alreadyInMainTree: true,
            isMergedToTree: true,
            matchedMainPersonId: newPerson.id,
            matchedMainPersonName: `${newPerson.lastName} ${newPerson.firstName}`,
            confidenceScore: 100
          };
        }
        return n;
      });

      setCandidateTree({
        ...candidateTree,
        nodes: updatedNodes,
        stats: {
          ...candidateTree.stats,
          newPersonsReadyToMerge: Math.max(0, candidateTree.stats.newPersonsReadyToMerge - 1),
          matchesInMainTree: candidateTree.stats.matchesInMainTree + 1
        }
      });
    }

    alert(`Особу «${newPerson.firstName} ${newPerson.lastName}» успішно додано до основного родинного дерева!`);
  };

  // Batch merge all new candidates into main tree
  const handleBatchMergeAll = () => {
    if (!candidateTree) return;

    const unmerged = candidateTree.nodes.filter(n => !n.alreadyInMainTree);
    if (unmerged.length === 0) {
      alert('Усі знайдені персони вже присутні в основному дереві.');
      return;
    }

    if (!window.confirm(`Ви впевнені, що хочете додати всіх ${unmerged.length} знайдених родичів до основного родоводу?`)) {
      return;
    }

    unmerged.forEach(node => {
      const newPerson: Person = {
        id: `p_import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        firstName: node.firstName || node.fullName.split(' ')[1] || '',
        lastName: node.lastName || node.fullName.split(' ')[0] || '',
        patronymic: node.patronymic,
        gender: node.gender,
        birthYear: node.estimatedBirthYear ? Number(node.estimatedBirthYear) : undefined,
        birthPlace: node.place,
        socialStatus: node.socialStatus || 'Козак',
        estateOrSocialStatus: node.socialStatus || 'Козак',
        researchStatus: 'hypothetical',
        godparents: node.godparentDetails?.map(gp => ({
          id: `gp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: gp.name,
          role: gp.role,
          notes: `Знайдено на листі «${gp.sheet}»`
        })) || [],
        notes: `Імпортовано зі сгенерованого AI дерева.\n${node.citations.map(c => `[${c.sheet}]: ${c.excerpt}`).join('\n')}`
      };

      addPerson(newPerson);
    });

    const updatedNodes = candidateTree.nodes.map(n => ({
      ...n,
      alreadyInMainTree: true,
      isMergedToTree: true,
      confidenceScore: 100
    }));

    setCandidateTree({
      ...candidateTree,
      nodes: updatedNodes,
      stats: {
        ...candidateTree.stats,
        newPersonsReadyToMerge: 0,
        matchesInMainTree: candidateTree.nodes.length
      }
    });

    alert(`Успішно імпортовано ${unmerged.length} осіб до вашого основного родовідного дерева!`);
  };

  // Convert record or connection to hypothesis
  const handleCreateHypothesisFromRecord = (rec: ExtractedMetricRecord) => {
    const title = `Підозра: ${rec.primaryPerson.fullName} (${rec.recordType} ${rec.year ? rec.year + ' р.' : ''})`;
    const godparentInfo = rec.godparents.length > 0 
      ? `\nХрещені/Восприємники: ${rec.godparents.map(g => `${g.fullName} (${g.role})`).join(', ')}`
      : '';
    const desc = `Запис з листа «${rec.sourceSheet}»:\n${rec.rawText}${godparentInfo}`;

    addHypothesis({
      id: `hypo-${Date.now()}`,
      title,
      description: desc,
      confidence: 85,
      evidenceCount: 2,
      status: 'testing'
    });

    alert('Запис успішно збережено до Реєстру детективних підозр!');
  };

  // Hypothesis modal handlers
  const openAddHypo = () => {
    setEditingHypo(null);
    setHypoTitle('');
    setHypoDesc('');
    setHypoConfidence(70);
    setHypoEvidence(1);
    setHypoStatus('testing');
    setIsHypoModalOpen(true);
  };

  const openEditHypo = (h: GenealogyHypothesis) => {
    setEditingHypo(h);
    setHypoTitle(h.title);
    setHypoDesc(h.description || '');
    setHypoConfidence(Number(h.confidence) || 70);
    setHypoEvidence(Number(h.evidenceCount) || 1);
    setHypoStatus(h.status);
    setIsHypoModalOpen(true);
  };

  const handleSaveHypo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hypoTitle.trim()) return;

    if (editingHypo) {
      updateHypothesis({
        ...editingHypo,
        title: hypoTitle,
        description: hypoDesc,
        confidence: hypoConfidence,
        evidenceCount: hypoEvidence,
        status: hypoStatus
      });
    } else {
      addHypothesis({
        id: `hypo-${Date.now()}`,
        title: hypoTitle,
        description: hypoDesc,
        confidence: hypoConfidence,
        evidenceCount: hypoEvidence,
        status: hypoStatus
      });
    }
    setIsHypoModalOpen(false);
  };

  return (
    <div className={`flex-1 p-4 sm:p-6 lg:p-8 ${theme.appBg} overflow-y-auto overflow-x-auto space-y-6 transition-colors duration-300 min-h-screen`}>
      {/* 1. Header Banner */}
      <div className={`p-6 rounded-3xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#B88E3E]/20 text-[#B88E3E] border border-[#B88E3E]/30">
              <Lightbulb className="w-5 h-5" />
            </span>
            <h2 className={`text-xl font-bold ${theme.cardTitle}`}>
              Підозри, Гіпотези & AI Аналіз Таблиць
            </h2>
          </div>
          <p className={`text-xs ${theme.cardSubtext}`}>
            Перехресний пошук родинних зв&apos;язків по всіх листах Google Sheets / Excel, аналіз <strong>хрещених (восприємників)</strong>, перевірка з основним деревом та генерація чернеткового дерева.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openAddHypo}
            className={`px-4 py-2 ${theme.badgeBg} ${theme.badgeText} border ${theme.cardBorder} font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs hover:opacity-90 transition-all cursor-pointer`}
          >
            <Plus className="w-4 h-4" />
            <span>Нова підозра вручну</span>
          </button>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-black/10 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('analyzer')}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'analyzer'
              ? `${theme.accentBtn} ${theme.accentBtnText} shadow-md`
              : `${theme.badgeBg} ${theme.badgeText} hover:opacity-90`
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Аналізатор Google Sheets & Excel</span>
        </button>

        <button
          onClick={() => {
            if (!candidateTree) {
              alert('Спочатку виконайте аналіз таблиці на вкладці «Аналізатор Google Sheets».');
              return;
            }
            setActiveTab('candidate_tree');
          }}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'candidate_tree'
              ? 'bg-[#18453B] text-[#E2C382] border border-[#E2C382] shadow-md ring-1 ring-[#E2C382]/30'
              : `${theme.badgeBg} ${theme.badgeText} hover:opacity-90 ${!candidateTree ? 'opacity-50' : ''}`
          }`}
        >
          <Sparkles className="w-4 h-4 text-[#B88E3E]" />
          <span>AI Чернеткове Дерево {candidateTree ? `(${candidateTree.nodes.length})` : ''}</span>
        </button>

        <button
          onClick={() => {
            if (extractedRecords.length === 0) {
              alert('Спочатку виконайте аналіз таблиці на вкладці «Аналізатор Google Sheets».');
              return;
            }
            setActiveTab('connections_table');
          }}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'connections_table'
              ? `${theme.accentBtn} ${theme.accentBtnText} shadow-md`
              : `${theme.badgeBg} ${theme.badgeText} hover:opacity-90 ${extractedRecords.length === 0 ? 'opacity-50' : ''}`
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Зв&apos;язки & Хрещені по листах ({extractedRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('registry')}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'registry'
              ? `${theme.accentBtn} ${theme.accentBtnText} shadow-md`
              : `${theme.badgeBg} ${theme.badgeText} hover:opacity-90`
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          <span>Реєстр підозр ({hypotheses.length})</span>
        </button>
      </div>

      {/* 3. Tab Content */}
      {activeTab === 'analyzer' && (
        <SheetsAnalyzerTab
          treePersons={persons}
          onTreeGenerated={handleTreeGenerated}
          theme={theme}
        />
      )}

      {activeTab === 'candidate_tree' && candidateTree && (
        <CandidateTreeCanvas
          tree={candidateTree}
          onSelectNode={handleOpenInspector}
          onMergeNodeToMainTree={handleOpenInspector}
          onBatchMergeAll={handleBatchMergeAll}
          theme={theme}
        />
      )}

      {activeTab === 'connections_table' && (
        <div className={`p-6 rounded-3xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/10 pb-4">
            <div>
              <h3 className={`font-bold text-base ${theme.cardTitle}`}>
                Витягнуті записи та перехресні зв&apos;язки хрещених
              </h3>
              <p className={`text-xs ${theme.cardSubtext}`}>
                Усі фігуранти, знайдені на різних листах за цільовими прізвищами.
              </p>
            </div>
            <span className="text-xs text-[#E2C382] font-semibold">
              Всього записів: {extractedRecords.length}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-black/10">
            <table className={`w-full text-left text-xs ${theme.cardTitle}`}>
              <thead className={`${theme.badgeBg} uppercase font-mono text-[10px]`}>
                <tr>
                  <th className="p-3">Лист / Джерело</th>
                  <th className="p-3">Рік / Тип</th>
                  <th className="p-3">Головна особа</th>
                  <th className="p-3">Батьки / Подружжя</th>
                  <th className="p-3">Хрещені (Восприємники) & Куми</th>
                  <th className="p-3 text-right">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {extractedRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="p-3 font-semibold text-[#B88E3E]">
                      {rec.sourceSheet}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-black/20 font-mono text-[11px]">
                        {rec.year ? `${rec.year} р.` : '—'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-sm text-[#F5EEDC]">
                        {rec.primaryPerson.fullName}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {rec.place || 'Парафія не вказана'}
                      </div>
                    </td>
                    <td className="p-3 text-xs space-y-0.5">
                      {rec.father && (
                        <div><strong>Батько:</strong> {rec.father.fullName}</div>
                      )}
                      {rec.mother && (
                        <div><strong>Мати:</strong> {rec.mother.fullName}</div>
                      )}
                      {!rec.father && !rec.mother && (
                        <span className="text-neutral-500 italic">Не вказано</span>
                      )}
                    </td>
                    <td className="p-3 text-xs space-y-1">
                      {rec.godparents.length > 0 ? (
                        rec.godparents.map((gp, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-[#B88E3E] shrink-0" />
                            <span>
                              <strong>{gp.fullName}</strong> ({gp.role === 'godmother' ? 'хрещена мати' : 'хрещений батько'})
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-neutral-500 italic">Немає хрещених у цьому рядку</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleCreateHypothesisFromRecord(rec)}
                        className={`px-3 py-1.5 rounded-xl ${theme.badgeBg} ${theme.badgeText} font-bold text-[11px] hover:border-[#B88E3E] border transition-all cursor-pointer inline-flex items-center gap-1`}
                        title="Зберегти як детективну підозру"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5 text-[#B88E3E]" />
                        <span>У підозри</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'registry' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className={`text-base font-bold ${theme.cardTitle}`}>
              Реєстр активних детективних підозр ({hypotheses.length})
            </h3>
            <button
              onClick={openAddHypo}
              className={`px-3.5 py-1.5 ${theme.accentBtn} ${theme.accentBtnText} font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm hover:opacity-90 cursor-pointer`}
            >
              <Plus className="w-4 h-4" />
              <span>Додати підозру</span>
            </button>
          </div>

          <div className="space-y-3">
            {hypotheses.length === 0 ? (
              <div className={`p-12 text-center rounded-3xl ${theme.cardBg} border ${theme.cardBorder} space-y-2`}>
                <Lightbulb className="w-10 h-10 mx-auto text-[#B88E3E] opacity-50" />
                <p className={`text-sm font-semibold ${theme.cardTitle}`}>Реєстр підозр наразі порожній</p>
                <p className={`text-xs ${theme.cardSubtext}`}>
                  Запустіть AI аналіз Google Таблиць або створіть власну дослідницьку гіпотезу.
                </p>
              </div>
            ) : (
              hypotheses.map(h => (
                <div
                  key={h.id}
                  className={`p-5 ${theme.cardBg} border ${theme.cardBorder} rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#B88E3E] transition-all shadow-xs`}
                >
                  <div className="space-y-1 max-w-2xl">
                    <h4 className={`font-bold text-sm ${theme.cardTitle}`}>{h.title}</h4>
                    <p className={`text-xs ${theme.cardSubtext} whitespace-pre-line`}>{h.description}</p>
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-center">
                    <div className="text-right space-y-0.5">
                      <span className={`px-3 py-1 ${theme.badgeBg} ${theme.badgeText} font-mono rounded-xl text-xs font-bold block border ${theme.cardBorder}`}>
                        {h.confidence}% вірогідність
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold block">
                        Доказів: {h.evidenceCount || 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditHypo(h)}
                        className={`p-2 ${theme.badgeBg} ${theme.badgeText} rounded-xl hover:opacity-80 cursor-pointer`}
                        title="Редагувати"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteHypothesis(h.id)}
                        className="p-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-xl cursor-pointer"
                        title="Видалити"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Candidate Inspector Modal */}
      <CandidateInspectorModal
        node={selectedCandidate}
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        onConfirmAddPerson={handleConfirmAddPerson}
        onLinkToExistingPerson={() => {}}
        treePersons={persons}
        theme={theme}
      />

      {/* Manual Hypothesis Create/Edit Modal */}
      {isHypoModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-3xl w-full max-w-lg p-6 sm:p-8 space-y-4 shadow-2xl text-xs`}>
            <div className={`flex items-center justify-between border-b ${theme.cardBorder} pb-3`}>
              <h3 className={`text-base font-bold ${theme.cardTitle}`}>
                {editingHypo ? 'Редагувати гіпотезу' : 'Створити нову детективну підозру'}
              </h3>
              <button onClick={() => setIsHypoModalOpen(false)} className="text-neutral-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHypo} className="space-y-4">
              <div>
                <label className={`block ${theme.cardSubtext} mb-1 font-semibold`}>Формулювання підозри</label>
                <input
                  type="text"
                  value={hypoTitle}
                  onChange={e => setHypoTitle(e.target.value)}
                  placeholder="напр. Василь Коваленко є рідним братом Семена за метрикою 1882..."
                  className={`w-full ${theme.inputBg} border ${theme.inputBorder} rounded-xl px-3 py-2 ${theme.inputText} font-bold`}
                  required
                />
              </div>

              <div>
                <label className={`block ${theme.cardSubtext} mb-1 font-semibold`}>Обґрунтування, хрещені та архівні свідчення</label>
                <textarea
                  rows={4}
                  value={hypoDesc}
                  onChange={e => setHypoDesc(e.target.value)}
                  placeholder="Опишіть джерела, хрещених батьків, село або парафію..."
                  className={`w-full ${theme.inputBg} border ${theme.inputBorder} rounded-xl p-3 ${theme.inputText}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block ${theme.cardSubtext} mb-1 font-semibold`}>Впевненість ({hypoConfidence}%)</label>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={hypoConfidence}
                    onChange={e => setHypoConfidence(Number(e.target.value))}
                    className="w-full accent-[#B88E3E]"
                  />
                </div>
                <div>
                  <label className={`block ${theme.cardSubtext} mb-1 font-semibold`}>Кількість доказів</label>
                  <input
                    type="number"
                    value={hypoEvidence}
                    onChange={e => setHypoEvidence(Number(e.target.value))}
                    className={`w-full ${theme.inputBg} border ${theme.inputBorder} rounded-xl px-3 py-2 ${theme.inputText}`}
                  />
                </div>
              </div>

              <div className={`flex justify-end gap-2 pt-3 border-t ${theme.cardBorder}`}>
                <button
                  type="button"
                  onClick={() => setIsHypoModalOpen(false)}
                  className={`px-4 py-2 ${theme.badgeBg} ${theme.badgeText} rounded-xl font-medium cursor-pointer`}
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 ${theme.accentBtn} ${theme.accentBtnText} font-bold rounded-xl shadow-md cursor-pointer`}
                >
                  Зберегти
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
