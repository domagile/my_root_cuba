/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { GenealogyDatabase, ViewMode, Person, Family, Source } from './types/genealogy';
import { SAMPLE_DATABASE } from './data/sampleData';
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
import { useGenealogy } from '../context/GenealogyContext';

const STORAGE_KEY = 'rodovid_genealogy_database_v2';

function normalizeDatabase(db: any): GenealogyDatabase {
  if (!db || !db.persons) return SAMPLE_DATABASE;
  const normalizedPersons: Record<string, Person> = {};
  
  Object.entries(db.persons).forEach(([id, p]: [string, any]) => {
    if (!p) return;
    const given = p.name?.given || p.firstName || 'Без імені';
    const surname = p.name?.surname || p.lastName || '';
    const patronymic = p.name?.patronymic || p.patronymic;
    const maidenName = p.name?.maidenName || p.maidenName;
    const prefix = p.name?.prefix;

    normalizedPersons[id] = {
      ...p,
      id: p.id || id,
      name: {
        given,
        surname,
        patronymic,
        maidenName,
        prefix
      },
      firstName: given,
      lastName: surname,
      patronymic,
      maidenName,
      gender: p.gender === 'female' ? 'F' : p.gender === 'male' ? 'M' : (p.gender || 'M'),
      spouseFamilyIds: Array.isArray(p.spouseFamilyIds) ? p.spouseFamilyIds : []
    };
  });

  const normalizedFamilies: Record<string, Family> = {};
  Object.entries(db.families || {}).forEach(([fId, fam]: [string, any]) => {
    if (!fam) return;
    const children = Array.isArray(fam.children)
      ? fam.children.map((c: any) => (typeof c === 'string' ? { personId: c, relationType: 'Biological' } : c))
      : Array.isArray(fam.childrenIds)
      ? fam.childrenIds.map((cId: string) => ({ personId: cId, relationType: 'Biological' }))
      : [];

    normalizedFamilies[fId] = {
      ...fam,
      id: fam.id || fId,
      children
    };
  });

  return {
    ...db,
    persons: normalizedPersons,
    families: normalizedFamilies,
    sources: db.sources || {},
    events: db.events || {}
  };
}

export const RodovidView: React.FC = () => {
  const { persons: contextPersons, addPerson, updatePerson, deletePerson: deleteContextPerson } = useGenealogy();

  const [database, setDatabase] = useState<GenealogyDatabase>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return normalizeDatabase(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load from storage', e);
    }
    return SAMPLE_DATABASE;
  });

  // Sync contextPersons (Фігуранти справи) into Rodovid database
  useEffect(() => {
    if (!contextPersons || contextPersons.length === 0) return;
    setDatabase((prev) => {
      let changed = false;
      const mergedPersons = { ...prev.persons };

      contextPersons.forEach((cp) => {
        const existing = mergedPersons[cp.id];
        const given = cp.name?.given || cp.firstName || 'Без імені';
        const surname = cp.name?.surname || cp.lastName || '';
        const normPerson: Person = {
          ...existing,
          ...cp,
          name: {
            given,
            surname,
            patronymic: cp.name?.patronymic || cp.patronymic,
            maidenName: cp.name?.maidenName || cp.maidenName,
            prefix: cp.name?.prefix || cp.prefix
          },
          firstName: given,
          lastName: surname,
          patronymic: cp.name?.patronymic || cp.patronymic,
          maidenName: cp.name?.maidenName || cp.maidenName,
          prefix: cp.name?.prefix || cp.prefix,
          gender: cp.gender === 'female' ? 'F' : cp.gender === 'male' ? 'M' : (cp.gender || 'M')
        };

        if (JSON.stringify(existing) !== JSON.stringify(normPerson)) {
          mergedPersons[cp.id] = normPerson;
          changed = true;
        }
      });

      if (!changed) return prev;
      return {
        ...prev,
        persons: mergedPersons
      };
    });
  }, [contextPersons]);

  const [currentView, setCurrentView] = useState<ViewMode>('tree');
  const [activePersonId, setActivePersonId] = useState<string>(
    database.rootPersonId || Object.keys(database.persons)[0] || 'p1'
  );

  // Modals state
  const [inspectPersonId, setInspectPersonId] = useState<string | null>(null);
  const [editPersonTarget, setEditPersonTarget] = useState<string | null>(null); // 'NEW' or personId
  const [editFamilyTarget, setEditFamilyTarget] = useState<string | null>(null); // 'NEW' or familyId
  const [editSourceTarget, setEditSourceTarget] = useState<string | null>(null); // 'NEW' or sourceId
  const [isGedcomModalOpen, setIsGedcomModalOpen] = useState(false);
  const [kinshipInitialAId, setKinshipInitialAId] = useState<string | undefined>(undefined);

  // Auto-save to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
    } catch (e) {
      console.error('Failed to save database to storage', e);
    }
  }, [database]);

  // Handle Person CRUD
  const handleSavePerson = (person: Person) => {
    setDatabase((prev) => ({
      ...prev,
      lastModified: new Date().toISOString(),
      persons: {
        ...prev.persons,
        [person.id]: person
      }
    }));

    // Bidirectional sync with Investigation / GenealogyContext
    const existsInContext = contextPersons.some((p) => p.id === person.id);
    if (existsInContext) {
      updatePerson(person as any);
    } else {
      addPerson(person as any);
    }
  };

  const handleDeletePerson = (personId: string) => {
    setDatabase((prev) => {
      const newPersons = { ...prev.persons };
      delete newPersons[personId];

      // Remove from families
      const newFamilies: Record<string, Family> = {};
      (Object.entries(prev.families) as [string, Family][]).forEach(([fId, fam]) => {
        newFamilies[fId] = {
          ...fam,
          husbandId: fam.husbandId === personId ? undefined : fam.husbandId,
          wifeId: fam.wifeId === personId ? undefined : fam.wifeId,
          children: (fam.children || []).filter((c) => c.personId !== personId)
        };
      });

      const nextRoot = Object.keys(newPersons)[0] || 'p1';
      if (activePersonId === personId) {
        setActivePersonId(nextRoot);
      }

      return {
        ...prev,
        lastModified: new Date().toISOString(),
        persons: newPersons,
        families: newFamilies
      };
    });

    deleteContextPerson(personId);
  };

  // Handle Family CRUD
  const handleSaveFamily = (family: Family) => {
    setDatabase((prev) => {
      const newPersons = { ...prev.persons };

      // Update spouse pointers
      if (family.husbandId && newPersons[family.husbandId]) {
        const h = newPersons[family.husbandId];
        h.spouseFamilyIds = h.spouseFamilyIds || [];
        if (!h.spouseFamilyIds.includes(family.id)) {
          h.spouseFamilyIds.push(family.id);
        }
      }
      if (family.wifeId && newPersons[family.wifeId]) {
        const w = newPersons[family.wifeId];
        w.spouseFamilyIds = w.spouseFamilyIds || [];
        if (!w.spouseFamilyIds.includes(family.id)) {
          w.spouseFamilyIds.push(family.id);
        }
      }

      // Update children parent pointers
      (family.children || []).forEach((c) => {
        if (newPersons[c.personId]) {
          newPersons[c.personId].parentFamilyId = family.id;
        }
      });

      return {
        ...prev,
        lastModified: new Date().toISOString(),
        persons: newPersons,
        families: {
          ...prev.families,
          [family.id]: family
        }
      };
    });
  };

  const handleDeleteFamily = (familyId: string) => {
    setDatabase((prev) => {
      const newFamilies = { ...prev.families };
      delete newFamilies[familyId];

      const newPersons = { ...prev.persons };
      (Object.values(newPersons) as Person[]).forEach((p) => {
        if (p.parentFamilyId === familyId) {
          p.parentFamilyId = undefined;
        }
        p.spouseFamilyIds = (p.spouseFamilyIds || []).filter((fId) => fId !== familyId);
      });

      return {
        ...prev,
        lastModified: new Date().toISOString(),
        persons: newPersons,
        families: newFamilies
      };
    });
  };

  // Handle Source CRUD
  const handleSaveSource = (source: Source) => {
    setDatabase((prev) => ({
      ...prev,
      lastModified: new Date().toISOString(),
      sources: {
        ...prev.sources,
        [source.id]: source
      }
    }));
  };

  // Handle full database import
  const handleImportDatabase = (newDb: GenealogyDatabase) => {
    const normalized = normalizeDatabase(newDb);
    setDatabase(normalized);
    const newRoot = normalized.rootPersonId || Object.keys(normalized.persons)[0] || 'p1';
    setActivePersonId(newRoot);
  };

  const handleOpenKinshipWith = (personId: string) => {
    setKinshipInitialAId(personId);
    setCurrentView('calculator');
  };

  const title = database.metadata?.title || 'Генеалогічна база роду';

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-950 text-slate-100 font-sans overflow-hidden selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation Bar inside Rodovid */}
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenGedcomModal={() => setIsGedcomModalOpen(true)}
        onOpenAddPersonModal={() => setEditPersonTarget('NEW')}
        databaseTitle={title}
        totalPersonsCount={Object.keys(database.persons).length}
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
            onChangeRoot={(id) => setActivePersonId(id)}
          />
        )}

        {currentView === 'fan' && (
          <FanChartView
            database={database}
            activePersonId={activePersonId}
            onSelectPerson={(id) => setInspectPersonId(id)}
            onChangeRoot={(id) => setActivePersonId(id)}
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
              setActivePersonId(id);
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
              setActivePersonId(id);
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

        {currentView === 'map' && (
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

        {currentView === 'calculator' && (
          <KinshipCalculatorView
            database={database}
            initialPersonAId={kinshipInitialAId || activePersonId}
            onSelectPerson={(id) => setInspectPersonId(id)}
          />
        )}

        {currentView === 'statistics' && (
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
            setActivePersonId(id);
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
    </div>
  );
};
