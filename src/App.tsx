/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GenealogyProvider, useUIStore } from './context/GenealogyContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { FamilyTreeView } from './components/Tree/FamilyTreeView';
import { RodovidView } from './rodovid/RodovidView';
import { PersonDetailModal } from './components/Tree/PersonDetailModal';
import { AddPersonModal } from './components/Tree/AddPersonModal';
import { RelationManagerModal } from './components/Tree/RelationManagerModal';
import { Person } from './types';
import { 
  ResearchView, 
  RequestsView, 
  YearMatrixView, 
  TasksView, 
  FindingsView, 
  HypothesesView 
} from './components/OtherViews';
import { DocumentsView } from './components/DocumentsView';
import { SettingsView } from './components/SettingsView';
import { InvestigativeAiView } from './components/InvestigativeAiView';
import { PersonsListView } from './components/PersonsListView';
import { TimelineView } from './components/TimelineView';
import { ExperimentView } from './components/ExperimentView';
import { AccessLockScreen } from './components/AccessLockScreen';
import { getThemeConfig } from './utils/theme';

function AppContent() {
  const activeTab = useUIStore((s) => s.activeTab);
  const themePalette = useUIStore((s) => s.themePalette);
  const isUnlocked = useUIStore((s) => s.isUnlocked);
  const theme = getThemeConfig(themePalette);

  if (!isUnlocked) {
    return <AccessLockScreen />;
  }

  const [inspectPersonId, setInspectPersonId] = useState<string | null>(null);
  const [personToEdit, setPersonToEdit] = useState<Person | null>(null);
  const [relationManagerPerson, setRelationManagerPerson] = useState<Person | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addRelation, setAddRelation] = useState<{
    type: 'father' | 'mother' | 'child' | 'spouse' | 'sibling';
    targetPersonId: string;
  } | null>(null);

  const handleOpenAddModal = () => {
    setPersonToEdit(null);
    setAddRelation(null);
    setShowAddModal(true);
  };

  const handleOpenAddModalWithRelation = (
    type: 'father' | 'mother' | 'child' | 'spouse' | 'sibling',
    targetPersonId: string
  ) => {
    setPersonToEdit(null);
    setAddRelation({ type, targetPersonId });
    setShowAddModal(true);
  };

  const handleEditPerson = (person: Person) => {
    setPersonToEdit(person);
    setAddRelation(null);
    setShowAddModal(true);
  };

  return (
    <div className={`flex h-screen w-screen overflow-hidden font-sans transition-colors duration-300 ${theme.appBg}`}>
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <Header onOpenAddPerson={handleOpenAddModal} />

        {/* Tab Router */}
        <main className="flex-1 flex flex-col h-full min-h-0 relative">
          {activeTab === 'tree' && <RodovidView />}

          {activeTab === 'research' && <ResearchView />}
          {activeTab === 'ai-analysis' && <InvestigativeAiView />}
          {activeTab === 'documents' && <DocumentsView />}
          {activeTab === 'requests' && <RequestsView />}
          {activeTab === 'matrix' && <YearMatrixView />}
          {(activeTab === 'notes' || activeTab === 'tasks') && <TasksView />}
          {activeTab === 'findings' && <FindingsView />}
          {activeTab === 'hypotheses' && <HypothesesView />}
          {activeTab === 'settings' && <SettingsView />}
          {activeTab === 'persons' && (
            <PersonsListView
              onInspectPerson={(id) => setInspectPersonId(id)}
              onEditPerson={handleEditPerson}
              onOpenAddPerson={handleOpenAddModal}
            />
          )}
          {activeTab === 'timeline' && (
            <TimelineView
              onInspectPerson={(id) => setInspectPersonId(id)}
            />
          )}
          {activeTab === 'experiment' && <ExperimentView />}
        </main>
      </div>

      {/* Inspect Person Profile Modal */}
      {inspectPersonId && (
        <PersonDetailModal
          personId={inspectPersonId}
          onClose={() => setInspectPersonId(null)}
          onEdit={handleEditPerson}
          onOpenAddRelation={handleOpenAddModalWithRelation}
        />
      )}

      {/* Relation Manager Modal (Add relative to tree) */}
      {relationManagerPerson && (
        <RelationManagerModal
          targetPerson={relationManagerPerson}
          onClose={() => setRelationManagerPerson(null)}
          onOpenAddModalWithRelation={(type, targetId) => {
            setRelationManagerPerson(null);
            handleOpenAddModalWithRelation(type, targetId);
          }}
        />
      )}

      {/* Create / Edit Person Modal */}
      {showAddModal && (
        <AddPersonModal
          initialPersonToEdit={personToEdit}
          initialRelation={addRelation}
          onClose={() => {
            setShowAddModal(false);
            setPersonToEdit(null);
            setAddRelation(null);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <GenealogyProvider>
      <AppContent />
    </GenealogyProvider>
  );
}
