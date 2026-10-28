/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { GenealogyDatabase, ViewMode, Person, Family, Source } from './types/genealogy';
import { Header } from './components/layout/Header';
import { TreeView } from './components/views/TreeView';
import { useGenealogy } from '../context/GenealogyContext';
import { useUIStore } from '../stores/useUIStore';
import { useAuthStore, isMasterAdminEmail } from '../stores/useAuthStore';
import { AUTHOR_CONTACT_EMAIL } from '../constants/contact';
import { getThemeConfig } from '../utils/theme';
import { findRootPersonId } from './utils/relationship';
import { Globe, Shield, ArrowLeft, Download, Check, Sparkles, Mail, RefreshCw } from 'lucide-react';

// Lazy-loaded secondary views
const FanChartView = React.lazy(() => import('./components/views/FanChartView').then(m => ({ default: m.FanChartView })));
const PersonsListView = React.lazy(() => import('./components/views/PersonsListView').then(m => ({ default: m.PersonsListView })));
const FamiliesListView = React.lazy(() => import('./components/views/FamiliesListView').then(m => ({ default: m.FamiliesListView })));
const EventsTimelineView = React.lazy(() => import('./components/views/EventsTimelineView').then(m => ({ default: m.EventsTimelineView })));
const PlacesMapView = React.lazy(() => import('./components/views/PlacesMapView').then(m => ({ default: m.PlacesMapView })));
const SourcesView = React.lazy(() => import('./components/views/SourcesView').then(m => ({ default: m.SourcesView })));
const KinshipCalculatorView = React.lazy(() => import('./components/views/KinshipCalculatorView').then(m => ({ default: m.KinshipCalculatorView })));
const StatisticsView = React.lazy(() => import('./components/views/StatisticsView').then(m => ({ default: m.StatisticsView })));
const ReportsView = React.lazy(() => import('./components/views/ReportsView').then(m => ({ default: m.ReportsView })));
const ConflictsView = React.lazy(() => import('./components/views/ConflictsView').then(m => ({ default: m.ConflictsView })));

// Lazy-loaded modals
const PersonDetailModal = React.lazy(() => import('./components/modals/PersonDetailModal').then(m => ({ default: m.PersonDetailModal })));
const EditFamilyModal = React.lazy(() => import('./components/modals/EditFamilyModal').then(m => ({ default: m.EditFamilyModal })));
const EditSourceModal = React.lazy(() => import('./components/modals/EditSourceModal').then(m => ({ default: m.EditSourceModal })));
const GedcomModal = React.lazy(() => import('./components/modals/GedcomModal').then(m => ({ default: m.GedcomModal })));
const ShareTreeModal = React.lazy(() => import('./components/modals/ShareTreeModal').then(m => ({ default: m.ShareTreeModal })));
const GlobalSearchModal = React.lazy(() => import('../components/GlobalSearchModal').then(m => ({ default: m.GlobalSearchModal })));
const RelationManagerModal = React.lazy(() => import('../components/Tree/RelationManagerModal').then(m => ({ default: m.RelationManagerModal })));
const AddPersonModal = React.lazy(() => import('../components/Tree/AddPersonModal').then(m => ({ default: m.AddPersonModal })));
const AuthModal = React.lazy(() => import('../components/AuthModal').then(m => ({ default: m.AuthModal })));
const ContactAuthorModal = React.lazy(() => import('../components/ContactAuthorModal').then(m => ({ default: m.ContactAuthorModal })));

const ViewLoadingFallback = () => (
  <div className="h-full w-full flex items-center justify-center p-8">
    <div className="flex items-center gap-2.5 text-xs text-neutral-400 font-medium animate-pulse">
      <RefreshCw className="w-4 h-4 animate-spin text-[#B88E3E]" />
      <span>Завантаження розділу...</span>
    </div>
  </div>
);

interface RodovidViewProps {
  customDatabase?: GenealogyDatabase;
  isSharedViewer?: boolean;
  sharedMeta?: {
    title: string;
    authorName: string;
    authorEmail?: string;
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
    if (!currentUser || !currentUser.isAuthenticated) return true;
    if (currentUser.role === 'admin' || isMasterAdminEmail(currentUser.email)) return false;
    if (currentUser.isWhitelisted && (currentUser.role === 'editor' || currentUser.role === 'researcher')) return false;
    const cleanEmail = currentUser.email?.toLowerCase();
    if (!cleanEmail) return true;
    const entry = whitelist.find(
      (w) => w.email.toLowerCase() === cleanEmail && w.status === 'active'
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
      rootPersonId: customDatabase?.rootPersonId || findRootPersonId(personsMap),
      persons: personsMap,
      families: families || {},
      sources: sources || {},
      events: events || {},
      lastModified: new Date().toISOString()
    };
  }, [customDatabase, persons, families, sources, events]);

  const activePersonId = useMemo(() => {
    if (selectedPersonId && database.persons[selectedPersonId]) {
      return selectedPersonId;
    }
    return database.rootPersonId || findRootPersonId(database.persons);
  }, [selectedPersonId, database.persons, database.rootPersonId]);

  // Modals state
  const inspectPersonId = useUIStore((s) => s.activeInspectPersonId);
  const setInspectPersonId = useUIStore((s) => s.setInspectPersonId);
  const [relationManagerPersonId, setRelationManagerPersonId] = useState<string | null>(null);
  const [addRelation, setAddRelation] = useState<{
    type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling' | 'godparent' | 'witness';
    targetPersonId: string;
  } | null>(null);
  const [editPersonTarget, setEditPersonTarget] = useState<string | null>(null); // 'NEW' or personId
  const [editFamilyTarget, setEditFamilyTarget] = useState<string | null>(null); // 'NEW' or familyId
  const [editSourceTarget, setEditSourceTarget] = useState<string | null>(null); // 'NEW' or sourceId
  const [isGedcomModalOpen, setIsGedcomModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isGlobalSearchModalOpen, setIsGlobalSearchModalOpen] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
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
              <div className="text-[11px] opacity-90 truncate flex items-center gap-2 flex-wrap">
                <span>Дослідник: <strong>{sharedMeta.authorName || 'Головний дослідник'}</strong> • {persons.length} осіб</span>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setShowContactModal(true)}
                  className="inline-flex items-center gap-1 font-semibold underline hover:text-amber-100 cursor-pointer"
                  title="Зв'язатися з автором дерева щодо спільних предків"
                >
                  <Mail className="w-3 h-3" />
                  <span>{sharedMeta.authorEmail || AUTHOR_CONTACT_EMAIL}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowContactModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/25 hover:bg-black/40 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              title={`Написати автору (${sharedMeta.authorEmail || AUTHOR_CONTACT_EMAIL})`}
            >
              <Mail className="w-3.5 h-3.5 text-amber-200" />
              <span>Зв'язок з автором</span>
            </button>

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
          onOpenGlobalSearch={() => setIsGlobalSearchModalOpen(true)}
          onOpenContactAuthor={() => setShowContactModal(true)}
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
            onEditPerson={(id) => {
              if (isReadOnly) return;
              setEditPersonTarget(id);
            }}
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
            onImportDatabase={handleImportDatabase}
            isReadOnly={isReadOnly}
          />
        )}

        <React.Suspense fallback={<ViewLoadingFallback />}>
          {currentView === 'fan' && (
            <FanChartView
              database={database}
              activePersonId={activePersonId}
              onSelectPerson={(id) => setInspectPersonId(id)}
              onChangeRoot={(id) => setSelectedPersonId(id)}
              onSwitchToTree={() => setCurrentView('tree')}
              onImportDatabase={handleImportDatabase}
            />
          )}

          {currentView === 'persons' && (
            <div className="h-full w-full overflow-y-auto overflow-x-auto">
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
                onUpdatePerson={updatePerson}
              />
            </div>
          )}

          {currentView === 'families' && (
            <div className="h-full w-full overflow-y-auto overflow-x-auto">
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
            <div className="h-full w-full overflow-y-auto overflow-x-auto">
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
            <div className="h-full w-full overflow-y-auto overflow-x-auto">
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
            <div className="h-full w-full overflow-y-auto overflow-x-auto">
              <KinshipCalculatorView
                database={database}
                initialPersonAId={kinshipInitialAId || activePersonId}
                onSelectPerson={(id) => setInspectPersonId(id)}
              />
            </div>
          )}

          {(currentView === 'statistics' || currentView === 'stats') && (
            <div className="h-full w-full overflow-y-auto overflow-x-auto">
              <StatisticsView
                database={database}
                onSelectPerson={(id) => setInspectPersonId(id)}
              />
            </div>
          )}

          {currentView === 'reports' && (
            <div className="h-full w-full overflow-y-auto overflow-x-auto">
              <ReportsView
                database={database}
                activePersonId={activePersonId}
                onSelectPerson={(id) => setInspectPersonId(id)}
              />
            </div>
          )}

          {(currentView === 'conflicts' || currentView === 'audit' || currentView === 'duplicates') && (
            <div className="h-full w-full overflow-y-auto overflow-x-auto">
              <ConflictsView
                persons={persons}
                families={families}
                initialSubTab={currentView === 'duplicates' ? 'duplicates' : 'health'}
                onUpdatePersons={(newPersons) => setPersons(newPersons)}
                onUpdateFamilies={(newFamilies) => setFamilies(newFamilies)}
                onSelectPerson={(id) => setInspectPersonId(id)}
              />
            </div>
          )}
        </React.Suspense>
      </div>

      {/* Modals */}
      <React.Suspense fallback={null}>
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
          <AddPersonModal
            personId={editPersonTarget === 'NEW' ? null : editPersonTarget}
            onClose={() => setEditPersonTarget(null)}
            onSaveAndOpenProfile={(id) => setInspectPersonId(id)}
            onChangeRoot={(id) => {
              setSelectedPersonId(id);
              setCurrentView('tree');
            }}
            onOpenKinshipWith={handleOpenKinshipWith}
            onDeletePerson={handleDeletePerson}
            isReadOnly={isReadOnly}
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

        {isGlobalSearchModalOpen && (
          <GlobalSearchModal
            isOpen={isGlobalSearchModalOpen}
            onClose={() => setIsGlobalSearchModalOpen(false)}
            onInspectPerson={(id) => setInspectPersonId(id)}
          />
        )}

        {showContactModal && (
          <ContactAuthorModal
            isOpen={showContactModal}
            onClose={() => setShowContactModal(false)}
          />
        )}
      </React.Suspense>
    </div>
  );
};
