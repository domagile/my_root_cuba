/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { GenealogyDatabase, ViewMode, Person, Family, Source } from './types/genealogy';
import { Header } from './components/layout/Header';
import { TreeView } from './components/views/TreeView';
import { FanChartView } from './components/views/FanChartView';
import { PersonsListView } from './components/views/PersonsListView';
import { FamiliesListView } from './components/views/FamiliesListView';
import { EventsTimelineView } from './components/views/EventsTimelineView';
import { PlacesMapView } from './components/views/PlacesMapView';
import { SourcesView } from './components/views/SourcesView';
import { KinshipCalculatorView } from './components/views/KinshipCalculatorView';
import { StatisticsView } from './components/views/StatisticsView';
import { ReportsView } from './components/views/ReportsView';
import { ConflictsView } from './components/views/ConflictsView';
import { PersonDetailModal } from './components/modals/PersonDetailModal';
import { EditPersonModal } from './components/modals/EditPersonModal';
import { EditFamilyModal } from './components/modals/EditFamilyModal';
import { EditSourceModal } from './components/modals/EditSourceModal';
import { GedcomModal } from './components/modals/GedcomModal';
import { ShareTreeModal } from './components/modals/ShareTreeModal';
import { RelationManagerModal } from '../components/Tree/RelationManagerModal';
import { AddPersonModal } from '../components/Tree/AddPersonModal';
import { useGenealogy } from '../context/GenealogyContext';
import { useUIStore } from '../stores/useUIStore';
import { useAuthStore } from '../stores/useAuthStore';
import { AuthModal } from '../components/AuthModal';
import { getThemeConfig } from '../utils/theme';
import { Globe, Shield, ArrowLeft, Download, Check, Sparkles } from 'lucide-react';

interface RodovidViewProps {
  customDatabase?: GenealogyDatabase;
  isSharedViewer?: boolean;
  sharedMeta?: {
    title: string;
    authorName: string;
    updatedAt: string;
    mode: 'readonly' | 'editable';
    id?: string;
  };
  onExitShared?: () => void;
}

export const RodovidView: React.FC<RodovidViewProps> = ({
  customDatabase,
  isSharedViewer = false,
  sharedMeta,
  onExitShared
}) => {
  const currentView = useUIStore((s) => s.rodovidView);
  const setCurrentView = useUIStore((s) => s.setRodovidView);
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);

  const {
    persons: contextPersons,
    setPersons,
    families: contextFamilies,
    setFamilies,
    sources: contextSources,
    events: contextEvents,
    selectedPersonId: contextSelectedPersonId,
    setSelectedPersonId: contextSetSelectedPersonId,
    addPerson,
    updatePerson,
    deletePerson,
    saveFamily,
    deleteFamily,
    saveSource,
    deleteSource,
    loadGenealogyDatabase
  } = useGenealogy();

  const [localSelectedPersonId, setLocalSelectedPersonId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const currentUser = useAuthStore((s) => s.currentUser);
  const whitelist = useAuthStore((s) => s.whitelist);
  const logout = useAuthStore((s) => s.logout);

  // Read-only condition: Only whitelisted users with active status and role admin/editor can edit
  const isReadOnly = useMemo(() => {
    if (isSharedViewer && sharedMeta?.mode === 'readonly') return true;
    if (!currentUser) return true;
    const entry = whitelist.find(
      (w) => w.email.toLowerCase() === currentUser.email.toLowerCase() && w.status === 'active'
    );
    if (!entry) return true;
    return entry.role !== 'admin' && entry.role !== 'editor';
  }, [isSharedViewer, sharedMeta, currentUser, whitelist]);

  // If custom database is provided (e.g. shared viewer mode)
  const persons = useMemo(() => {
    if (customDatabase) {
      return Object.values(customDatabase.persons || {});
    }
    return contextPersons;
  }, [customDatabase, contextPersons]);

  const families = useMemo(() => {
    if (customDatabase) {
      return customDatabase.families || {};
    }
    return contextFamilies;
  }, [customDatabase, contextFamilies]);

  const sources = useMemo(() => {
    if (customDatabase) {
      return customDatabase.sources || {};
    }
    return contextSources;
  }, [customDatabase, contextSources]);

  const events = useMemo(() => {
    if (customDatabase) {
      return customDatabase.events || {};
    }
    return contextEvents;
  }, [customDatabase, contextEvents]);

  const selectedPersonId = isSharedViewer 
    ? (localSelectedPersonId || customDatabase?.rootPersonId || Object.keys(customDatabase?.persons || {})[0] || 'p1')
    : contextSelectedPersonId;

  const setSelectedPersonId = isSharedViewer ? setLocalSelectedPersonId : contextSetSelectedPersonId;

  // Single Source of Truth Database view
  const database: GenealogyDatabase = useMemo(() => {
    if (customDatabase) return customDatabase;

    const personsMap: Record<string, Person> = {};
    persons.forEach((p) => {
      personsMap[p.id] = p;
    });

    return {
      metadata: {
        title: 'Родовід родини',
        description: 'Єдине сховище генеалогічних даних',
        lastModified: new Date().toISOString(),
        author: 'Дослідник'
      },
      rootPersonId: selectedPersonId || Object.keys(personsMap)[0] || 'p1',
      persons: personsMap,
      families: families || {},
      sources: sources || {},
      events: events || {},
      lastModified: new Date().toISOString()
    };
  }, [customDatabase, persons, families, sources, events, selectedPersonId]);

  const activePersonId = useMemo(() => {
    if (selectedPersonId && database.persons[selectedPersonId]) {
      return selectedPersonId;
    }
    const firstPerson = Object.values(database.persons)[0];
    return firstPerson?.id || selectedPersonId || 'p1';
  }, [selectedPersonId, database.persons]);

  // Modals state
  const [inspectPersonId, setInspectPersonId] = useState<string | null>(null);
  const [relationManagerPersonId, setRelationManagerPersonId] = useState<string | null>(null);
  const [addRelation, setAddRelation] = useState<{
    type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling';
    targetPersonId: string;
  } | null>(null);
  const [editPersonTarget, setEditPersonTarget] = useState<string | null>(null); // 'NEW' or personId
  const [editFamilyTarget, setEditFamilyTarget] = useState<string | null>(null); // 'NEW' or familyId
  const [editSourceTarget, setEditSourceTarget] = useState<string | null>(null); // 'NEW' or sourceId
  const [isGedcomModalOpen, setIsGedcomModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [kinshipInitialAId, setKinshipInitialAId] = useState<string | undefined>(undefined);
  const [savedCopySuccess, setSavedCopySuccess] = useState(false);

  const handleSaveCopyToLocal = () => {
    if (customDatabase) {
      loadGenealogyDatabase(customDatabase);
      setSavedCopySuccess(true);
      setTimeout(() => setSavedCopySuccess(false), 3500);
    }
  };

  // Handle Person CRUD
  const handleSavePerson = useCallback((person: Person) => {
    if (isReadOnly) {
      setIsAuthModalOpen(true);
      return;
    }
    const exists = persons.some((p) => p.id === person.id);
    if (exists) {
      updatePerson(person);
    } else {
      addPerson(person);
    }

    // Sync parent childrenIds
    if (person.fatherId) {
      const father = persons.find((p) => p.id === person.fatherId);
      if (father && !father.childrenIds?.includes(person.id)) {
        updatePerson({
          ...father,
          childrenIds: Array.from(new Set([...(father.childrenIds || []), person.id]))
        });
      }
    }
    if (person.motherId) {
      const mother = persons.find((p) => p.id === person.motherId);
      if (mother && !mother.childrenIds?.includes(person.id)) {
        updatePerson({
          ...mother,
          childrenIds: Array.from(new Set([...(mother.childrenIds || []), person.id]))
        });
      }
    }
  }, [persons, updatePerson, addPerson, isReadOnly]);

  const handleDeletePerson = useCallback((personId: string) => {
    if (isReadOnly) {
      setIsAuthModalOpen(true);
      return;
    }
    deletePerson(personId);
    if (activePersonId === personId) {
      const remaining = persons.filter((p) => p.id !== personId);
      if (remaining.length > 0) {
        setSelectedPersonId(remaining[0].id);
      }
    }
  }, [deletePerson, activePersonId, persons, setSelectedPersonId, isReadOnly]);

  // Handle Family CRUD
  const handleSaveFamily = useCallback((family: Family) => {
    if (isReadOnly) {
      setIsAuthModalOpen(true);
      return;
    }
    saveFamily(family);
  }, [saveFamily, isReadOnly]);

  const handleDeleteFamily = useCallback((familyId: string) => {
    if (isReadOnly) {
      setIsAuthModalOpen(true);
      return;
    }
    deleteFamily(familyId);
  }, [deleteFamily, isReadOnly]);

  // Handle Source CRUD
  const handleSaveSource = useCallback((source: Source) => {
    if (isReadOnly) {
      setIsAuthModalOpen(true);
      return;
    }
    saveSource(source);
  }, [saveSource, isReadOnly]);

  const handleDeleteSource = useCallback((sourceId: string) => {
    if (isReadOnly) {
      setIsAuthModalOpen(true);
      return;
    }
    deleteSource(sourceId);
  }, [deleteSource, isReadOnly]);

  // Handle full database import
  const handleImportDatabase = useCallback((newDb: GenealogyDatabase) => {
    loadGenealogyDatabase(newDb);
    if (newDb.rootPersonId) {
      setSelectedPersonId(newDb.rootPersonId);
    }
  }, [loadGenealogyDatabase, setSelectedPersonId]);

  const handleOpenKinshipWith = useCallback((personId: string) => {
    setKinshipInitialAId(personId);
    setCurrentView('calculator');
  }, []);

  const title = database.metadata?.title || 'Генеалогічна база роду';

  return (
    <div className={`flex-1 flex flex-col h-full min-h-0 ${theme.appBg} font-sans overflow-hidden transition-colors duration-200`}>
      {/* Shared Mode Top Notification Bar */}
      {isSharedViewer && sharedMeta && (
        <div className="bg-gradient-to-r from-amber-600 via-[#B88E3E] to-emerald-700 text-white px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 shadow-md z-40 text-xs sm:text-sm">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-white" />
            </span>
            <div className="min-w-0">
              <div className="font-bold truncate flex items-center gap-2">
                <span>{sharedMeta.title || 'Спільне родинне дерево'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-mono font-medium">
                  Тільки перегляд
                </span>
              </div>
              <div className="text-[11px] opacity-90 truncate">
                Дослідник: <strong>{sharedMeta.authorName || 'Головний дослідник'}</strong> • {persons.length} осіб у родинній схемі
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSaveCopyToLocal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-neutral-900 hover:bg-neutral-100 font-bold text-xs shadow-xs transition-colors cursor-pointer"
              title="Зберегти це дерево як власну робочу копію"
            >
              {savedCopySuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Download className="w-3.5 h-3.5 text-[#B88E3E]" />}
              <span>{savedCopySuccess ? 'Збережено в кабінет!' : 'Зберегти копію собі'}</span>
            </button>

            {onExitShared && (
              <button
                onClick={onExitShared}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/25 hover:bg-black/40 text-white text-xs font-semibold transition-colors cursor-pointer"
                title="Повернутися до власного проєкту"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Вийти</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Navigation Bar inside Rodovid - only in standalone shared viewer mode */}
      {isSharedViewer && (
        <Header
          currentView={currentView}
          onViewChange={setCurrentView}
          onOpenGedcomModal={() => setIsGedcomModalOpen(true)}
          onOpenAddPersonModal={() => setEditPersonTarget('NEW')}
          onOpenShareModal={() => setIsShareModalOpen(true)}
          databaseTitle={title}
          totalPersonsCount={persons.length}
          isReadOnly={isReadOnly}
          currentUser={currentUser}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onLogout={logout}
        />
      )}

      {/* Main View Area */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {currentView === 'tree' && (
          <TreeView
            database={database}
            activePersonId={activePersonId}
            onSelectPerson={(id) => setInspectPersonId(id)}
            onOpenAddChild={(_parentId) => {
              if (isReadOnly) return;
              setEditPersonTarget('NEW');
            }}
            onOpenAddParent={(_childId) => {
              if (isReadOnly) return;
              setEditPersonTarget('NEW');
            }}
            onChangeRoot={(id) => setSelectedPersonId(id)}
            onOpenRelationManager={(id) => {
              if (isReadOnly) return;
              setRelationManagerPersonId(id);
            }}
            onSwitchToFan={() => setCurrentView('fan')}
            isReadOnly={isReadOnly}
          />
        )}

        {currentView === 'fan' && (
          <FanChartView
            database={database}
            activePersonId={activePersonId}
            onSelectPerson={(id) => setInspectPersonId(id)}
            onChangeRoot={(id) => setSelectedPersonId(id)}
            onSwitchToTree={() => setCurrentView('tree')}
          />
        )}

        {currentView === 'persons' && (
          <div className="h-full w-full overflow-y-auto overflow-x-hidden">
            <PersonsListView
              database={database}
              isReadOnly={isReadOnly}
              onSelectPerson={(id) => setInspectPersonId(id)}
              onEditPerson={(id) => setEditPersonTarget(id)}
              onDeletePerson={handleDeletePerson}
              onOpenAddPerson={() => setEditPersonTarget('NEW')}
              onChangeRoot={(id) => {
                setSelectedPersonId(id);
                setCurrentView('tree');
              }}
              onOpenKinshipWith={handleOpenKinshipWith}
            />
          </div>
        )}

        {currentView === 'families' && (
          <div className="h-full w-full overflow-y-auto overflow-x-hidden">
            <FamiliesListView
              database={database}
              onSelectPerson={(id) => setInspectPersonId(id)}
              onEditFamily={(id) => setEditFamilyTarget(id)}
              onDeleteFamily={handleDeleteFamily}
              onOpenAddFamily={() => setEditFamilyTarget('NEW')}
              onChangeRoot={(id) => {
                setSelectedPersonId(id);
                setCurrentView('tree');
              }}
            />
          </div>
        )}

        {currentView === 'timeline' && (
          <div className="h-full w-full overflow-y-auto overflow-x-hidden">
            <EventsTimelineView
              database={database}
              onSelectPerson={(id) => setInspectPersonId(id)}
            />
          </div>
        )}

        {(currentView === 'map' || currentView === 'places') && (
          <div className="h-full w-full overflow-hidden">
            <PlacesMapView
              database={database}
              onSelectPerson={(id) => setInspectPersonId(id)}
            />
          </div>
        )}

        {currentView === 'sources' && (
          <div className="h-full w-full overflow-y-auto overflow-x-hidden">
            <SourcesView
              database={database}
              onSelectPerson={(id) => setInspectPersonId(id)}
              onOpenAddSource={() => setEditSourceTarget('NEW')}
              onEditSource={(id) => setEditSourceTarget(id)}
              onDeleteSource={handleDeleteSource}
            />
          </div>
        )}

        {(currentView === 'calculator' || currentView === 'kinship') && (
          <div className="h-full w-full overflow-y-auto overflow-x-hidden">
            <KinshipCalculatorView
              database={database}
              initialPersonAId={kinshipInitialAId || activePersonId}
              onSelectPerson={(id) => setInspectPersonId(id)}
            />
          </div>
        )}

        {(currentView === 'statistics' || currentView === 'stats') && (
          <div className="h-full w-full overflow-y-auto overflow-x-hidden">
            <StatisticsView
              database={database}
              onSelectPerson={(id) => setInspectPersonId(id)}
            />
          </div>
        )}

        {currentView === 'reports' && (
          <ReportsView
            database={database}
            activePersonId={activePersonId}
            onSelectPerson={(id) => setInspectPersonId(id)}
          />
        )}

        {(currentView === 'conflicts' || currentView === 'audit' || currentView === 'duplicates') && (
          <ConflictsView
            persons={persons}
            families={families}
            onUpdatePersons={(newPersons) => setPersons(newPersons)}
            onUpdateFamilies={(newFamilies) => setFamilies(newFamilies)}
            onSelectPerson={(id) => setInspectPersonId(id)}
          />
        )}
      </div>

      {/* Modals */}
      {inspectPersonId && (
        <PersonDetailModal
          personId={inspectPersonId}
          database={database}
          isReadOnly={isReadOnly}
          onClose={() => setInspectPersonId(null)}
          onSelectPerson={(id) => setInspectPersonId(id)}
          onEditPerson={(id) => {
            setInspectPersonId(null);
            setEditPersonTarget(id);
          }}
          onDeletePerson={handleDeletePerson}
          onChangeRoot={(id) => {
            setSelectedPersonId(id);
            setCurrentView('tree');
          }}
          onOpenKinshipWith={handleOpenKinshipWith}
          onOpenRelationManager={(id) => {
            setInspectPersonId(null);
            setRelationManagerPersonId(id);
          }}
          onAddRelation={(type, targetPersonId) => {
            setInspectPersonId(null);
            setAddRelation({ type, targetPersonId });
          }}
        />
      )}

      {editPersonTarget && (
        <EditPersonModal
          personId={editPersonTarget === 'NEW' ? null : editPersonTarget}
          database={database}
          onClose={() => setEditPersonTarget(null)}
          onSave={handleSavePerson}
        />
      )}

      {editFamilyTarget && (
        <EditFamilyModal
          familyId={editFamilyTarget === 'NEW' ? null : editFamilyTarget}
          database={database}
          onClose={() => setEditFamilyTarget(null)}
          onSave={handleSaveFamily}
        />
      )}

      {editSourceTarget && (
        <EditSourceModal
          sourceId={editSourceTarget === 'NEW' ? null : editSourceTarget}
          database={database}
          onClose={() => setEditSourceTarget(null)}
          onSave={handleSaveSource}
          onDelete={handleDeleteSource}
        />
      )}

      {isGedcomModalOpen && (
        <GedcomModal
          database={database}
          onClose={() => setIsGedcomModalOpen(false)}
          onImportDatabase={handleImportDatabase}
        />
      )}

      {relationManagerPersonId && (
        <RelationManagerModal
          targetPerson={persons.find((p) => p.id === relationManagerPersonId) || { id: relationManagerPersonId, firstName: 'Особа', lastName: '' } as any}
          onClose={() => setRelationManagerPersonId(null)}
          onOpenAddModalWithRelation={(type, targetId) => {
            setRelationManagerPersonId(null);
            setAddRelation({ type, targetPersonId: targetId });
          }}
        />
      )}

      {addRelation && (
        <AddPersonModal
          initialRelation={addRelation}
          onSaveAndOpenProfile={(id) => setInspectPersonId(id)}
          onClose={() => setAddRelation(null)}
        />
      )}

      {isShareModalOpen && (
        <ShareTreeModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          database={database}
          activePersonId={activePersonId}
        />
      )}

      {isAuthModalOpen && (
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      )}
    </div>
  );
};
