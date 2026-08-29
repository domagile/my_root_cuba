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
import { PersonDetailModal } from './components/modals/PersonDetailModal';
import { EditPersonModal } from './components/modals/EditPersonModal';
import { EditFamilyModal } from './components/modals/EditFamilyModal';
import { EditSourceModal } from './components/modals/EditSourceModal';
import { GedcomModal } from './components/modals/GedcomModal';
import { RelationManagerModal } from '../components/Tree/RelationManagerModal';
import { AddPersonModal } from '../components/Tree/AddPersonModal';
import { useGenealogy } from '../context/GenealogyContext';
import { useUIStore } from '../stores/useUIStore';
import { getThemeConfig } from '../utils/theme';

export const RodovidView: React.FC = () => {
  const currentView = useUIStore((s) => s.rodovidView);
  const setCurrentView = useUIStore((s) => s.setRodovidView);
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);

  const {
    persons,
    families,
    sources,
    events,
    selectedPersonId,
    setSelectedPersonId,
    addPerson,
    updatePerson,
    deletePerson,
    saveFamily,
    deleteFamily,
    saveSource,
    loadGenealogyDatabase
  } = useGenealogy();

  // Single Source of Truth Database view
  const database: GenealogyDatabase = useMemo(() => {
    const personsMap: Record<string, Person> = {};
    persons.forEach((p) => {
      personsMap[p.id] = p;
    });

    return {
      metadata: {
        title: 'Родовід родини Бом, Дядькіних та Бичихіних',
        description: 'Єдине сховище генеалогічних даних (39 осіб, 9 поколінь)',
        lastModified: new Date().toISOString(),
        author: 'Дослідник'
      },
      rootPersonId: selectedPersonId || 'p_bom_olga',
      persons: personsMap,
      families: families || {},
      sources: sources || {},
      events: events || {},
      lastModified: new Date().toISOString()
    };
  }, [persons, families, sources, events, selectedPersonId]);

  const activePersonId = useMemo(() => {
    if (selectedPersonId && database.persons[selectedPersonId]) {
      return selectedPersonId;
    }
    if (database.persons['p_bom_olga']) return 'p_bom_olga';
    const firstPerson = Object.values(database.persons)[0];
    return firstPerson?.id || 'p_bom_olga';
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
  const [kinshipInitialAId, setKinshipInitialAId] = useState<string | undefined>(undefined);

  // Handle Person CRUD
  const handleSavePerson = useCallback((person: Person) => {
    const exists = persons.some((p) => p.id === person.id);
    if (exists) {
      updatePerson(person);
    } else {
      addPerson(person);
    }
  }, [persons, updatePerson, addPerson]);

  const handleDeletePerson = useCallback((personId: string) => {
    deletePerson(personId);
    if (activePersonId === personId) {
      const remaining = persons.filter((p) => p.id !== personId);
      if (remaining.length > 0) {
        setSelectedPersonId(remaining[0].id);
      }
    }
  }, [deletePerson, activePersonId, persons, setSelectedPersonId]);

  // Handle Family CRUD
  const handleSaveFamily = useCallback((family: Family) => {
    saveFamily(family);
  }, [saveFamily]);

  const handleDeleteFamily = useCallback((familyId: string) => {
    deleteFamily(familyId);
  }, [deleteFamily]);

  // Handle Source CRUD
  const handleSaveSource = useCallback((source: Source) => {
    saveSource(source);
  }, [saveSource]);

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
      {/* Top Navigation Bar inside Rodovid */}
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenGedcomModal={() => setIsGedcomModalOpen(true)}
        onOpenAddPersonModal={() => setEditPersonTarget('NEW')}
        databaseTitle={title}
        totalPersonsCount={persons.length}
      />

      {/* Main View Area */}
      <div className="flex-1 min-h-0 overflow-auto relative">
        {currentView === 'tree' && (
          <TreeView
            database={database}
            activePersonId={activePersonId}
            onSelectPerson={(id) => setInspectPersonId(id)}
            onOpenAddChild={(_parentId) => {
              setEditPersonTarget('NEW');
            }}
            onOpenAddParent={(_childId) => {
              setEditPersonTarget('NEW');
            }}
            onChangeRoot={(id) => setSelectedPersonId(id)}
            onOpenRelationManager={(id) => setRelationManagerPersonId(id)}
            onSwitchToFan={() => setCurrentView('fan')}
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
          <PersonsListView
            database={database}
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
        )}

        {currentView === 'families' && (
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
        )}

        {currentView === 'timeline' && (
          <EventsTimelineView
            database={database}
            onSelectPerson={(id) => setInspectPersonId(id)}
          />
        )}

        {(currentView === 'map' || currentView === 'places') && (
          <PlacesMapView
            database={database}
            onSelectPerson={(id) => setInspectPersonId(id)}
          />
        )}

        {currentView === 'sources' && (
          <SourcesView
            database={database}
            onSelectPerson={(id) => setInspectPersonId(id)}
            onOpenAddSource={() => setEditSourceTarget('NEW')}
            onEditSource={(id) => setEditSourceTarget(id)}
          />
        )}

        {(currentView === 'calculator' || currentView === 'kinship') && (
          <KinshipCalculatorView
            database={database}
            initialPersonAId={kinshipInitialAId || activePersonId}
            onSelectPerson={(id) => setInspectPersonId(id)}
          />
        )}

        {(currentView === 'statistics' || currentView === 'stats') && (
          <StatisticsView
            database={database}
            onSelectPerson={(id) => setInspectPersonId(id)}
          />
        )}

        {currentView === 'reports' && (
          <ReportsView
            database={database}
            activePersonId={activePersonId}
            onSelectPerson={(id) => setInspectPersonId(id)}
          />
        )}
      </div>

      {/* Modals */}
      {inspectPersonId && (
        <PersonDetailModal
          personId={inspectPersonId}
          database={database}
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
          onClose={() => setAddRelation(null)}
        />
      )}
    </div>
  );
};
