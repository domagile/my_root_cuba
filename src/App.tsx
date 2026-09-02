/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GenealogyProvider, useUIStore } from './context/GenealogyContext';
import { useAuthStore, initCloudAuthSync } from './stores/useAuthStore';
import { useSharedTreeStore } from './stores/useSharedTreeStore';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { FamilyTreeView } from './components/Tree/FamilyTreeView';
import { RodovidView } from './rodovid/RodovidView';
import { PersonDetailModal } from './components/Tree/PersonDetailModal';
import { AddPersonModal } from './components/Tree/AddPersonModal';
import { RelationManagerModal } from './components/Tree/RelationManagerModal';
import { AuthModal } from './components/AuthModal';
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
import { SharedPinScreen } from './components/SharedPinScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ContactModal } from './components/ContactModal';
import { getThemeConfig } from './utils/theme';
import { RefreshCw, AlertCircle, ArrowLeft, Lock, X } from 'lucide-react';

function AppContent() {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const themePalette = useUIStore((s) => s.themePalette);
  const isAuthModalOpen = useUIStore((s) => s.isAuthModalOpen);
  const authModalFeature = useUIStore((s) => s.authModalFeature);
  const openAuthModal = useUIStore((s) => s.openAuthModal);
  const closeAuthModal = useUIStore((s) => s.closeAuthModal);
  const openContactModal = useUIStore((s) => s.openContactModal);

  const [showVisitorBanner, setShowVisitorBanner] = useState(true);

  const currentUser = useAuthStore((s) => s.currentUser);
  const whitelist = useAuthStore((s) => s.whitelist);
  const theme = getThemeConfig(themePalette);

  const isWhitelisted = Boolean(
    currentUser &&
    currentUser.isAuthenticated &&
    (currentUser.role === 'admin' ||
      whitelist.some(
        (w) => w.email.toLowerCase() === currentUser.email?.toLowerCase() && w.status === 'active'
      ))
  );

  const {
    isSharedMode,
    isLoading: isSharedLoading,
    error: sharedError,
    sharedTree,
    pinRequired,
    pinVerified,
    initFromUrl,
    exitSharedMode
  } = useSharedTreeStore();

  useEffect(() => {
    initFromUrl();
  }, [initFromUrl]);

  useEffect(() => {
    const unsub = initCloudAuthSync();
    return () => {
      unsub();
    };
  }, []);

  const [inspectPersonId, setInspectPersonId] = useState<string | null>(null);
  const [personToEdit, setPersonToEdit] = useState<Person | null>(null);
  const [relationManagerPerson, setRelationManagerPerson] = useState<Person | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addRelation, setAddRelation] = useState<{
    type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling';
    targetPersonId: string;
  } | null>(null);

  // If in Shared Viewer Mode
  if (isSharedMode) {
    if (isSharedLoading) {
      return (
        <div className={`min-h-screen w-full flex flex-col items-center justify-center p-6 ${theme.appBg} font-sans`}>
          <div className="flex flex-col items-center space-y-4">
            <RefreshCw className="w-10 h-10 text-[#B88E3E] animate-spin" />
            <div className="text-center">
              <h2 className={`font-bold text-lg ${theme.cardTitle}`}>Завантаження родинного дерева...</h2>
              <p className="text-xs opacity-70 mt-1">Отримуємо актуальну версію родоводу з хмари</p>
            </div>
          </div>
        </div>
      );
    }

    if (sharedError || !sharedTree) {
      return (
        <div className={`min-h-screen w-full flex flex-col items-center justify-center p-6 ${theme.appBg} font-sans`}>
          <div className={`w-full max-w-md p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl text-center space-y-4`}>
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className={`font-bold text-base sm:text-lg ${theme.cardTitle}`}>Дерево не знайдено</h2>
              <p className="text-xs opacity-75 mt-1.5">{sharedError || 'Перевірте правильність посилання або зверніться до автора.'}</p>
            </div>
            <button
              onClick={exitSharedMode}
              className={`w-full py-2.5 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Перейти на головну</span>
            </button>
          </div>
        </div>
      );
    }

    if (pinRequired && !pinVerified) {
      return <SharedPinScreen />;
    }

    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col">
        <RodovidView
          customDatabase={sharedTree.database as any}
          isSharedViewer={true}
          sharedMeta={sharedTree}
          onExitShared={exitSharedMode}
        />
        <ContactModal />
      </div>
    );
  }

  const handleOpenAddModal = () => {
    if (!isWhitelisted) {
      openAuthModal('Додавання особи');
      return;
    }
    setPersonToEdit(null);
    setAddRelation(null);
    setShowAddModal(true);
  };

  const handleOpenAddModalWithRelation = (
    type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling',
    targetPersonId: string
  ) => {
    if (!isWhitelisted) {
      openAuthModal('Редагування родинних зв’язків');
      return;
    }
    setPersonToEdit(null);
    setAddRelation({ type, targetPersonId });
    setShowAddModal(true);
  };

  const handleEditPerson = (person: Person) => {
    if (!isWhitelisted) {
      openAuthModal('Редагування анкети');
      return;
    }
    setPersonToEdit(person);
    setAddRelation(null);
    setShowAddModal(true);
  };

  const renderRestrictedGuard = (featureName: string) => (
    <div className="flex-1 flex items-center justify-center p-6 text-center">
      <div className={`max-w-md w-full p-8 rounded-3xl border ${theme.cardBorder} ${theme.cardBg} ${theme.cardTitle} shadow-2xl space-y-4`}>
        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold">Розділ «{featureName}» захищено</h3>
        <p className="text-xs opacity-80 leading-relaxed">
          Цей розділ містить конфіденційні архівні матеріали, чернетки та налаштування, які доступні лише авторизованим дослідникам за Білим списком.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => openAuthModal(featureName)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            Увійти за Whitelist
          </button>
          <button
            onClick={() => setActiveTab('tree')}
            className="px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 font-semibold text-xs transition-colors cursor-pointer"
          >
            Повернутися до Дерева
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`flex h-screen w-screen overflow-hidden font-sans transition-colors duration-300 ${theme.appBg}`}>
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <Header 
          onOpenAddPerson={handleOpenAddModal} 
          onInspectPerson={(id) => setInspectPersonId(id)}
        />

        {/* Visitor Contact Notice Banner (for open guest access) */}
        {!isWhitelisted && showVisitorBanner && (
          <div className="bg-emerald-500/10 dark:bg-emerald-950/40 border-b border-emerald-500/20 px-3 sm:px-5 py-2 text-xs flex items-center justify-between gap-2.5 text-emerald-900 dark:text-emerald-200 shrink-0">
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">🌿 Шукаєте спільних предків?</span>
              <span className="hidden md:inline opacity-80 truncate">
                Дерево відкрите для пошуку. Якщо ви маєте спільні корені чи документи — напишіть автору родоводу:
              </span>
              <button
                type="button"
                onClick={() => openContactModal()}
                className="font-mono font-bold underline text-emerald-700 dark:text-emerald-300 hover:text-emerald-500 cursor-pointer shrink-0"
              >
                domagile@gmail.com
              </button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openContactModal()}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-xs cursor-pointer transition-colors"
              >
                Написати автору
              </button>
              <button
                type="button"
                onClick={() => setShowVisitorBanner(false)}
                className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 opacity-60 hover:opacity-100 cursor-pointer"
                title="Сховати підказку"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Tab Router */}
        <main className="flex-1 flex flex-col h-full min-h-0 relative overflow-hidden">
          {activeTab === 'tree' && <RodovidView />}

          {activeTab === 'research' && (isWhitelisted ? <ResearchView /> : renderRestrictedGuard('Детективні розкопки'))}
          {activeTab === 'ai-analysis' && (isWhitelisted ? <InvestigativeAiView /> : renderRestrictedGuard('Слідчий AI аналіз'))}
          {activeTab === 'documents' && (isWhitelisted ? <DocumentsView /> : renderRestrictedGuard('Речові докази'))}
          {activeTab === 'requests' && (isWhitelisted ? <RequestsView /> : renderRestrictedGuard('Запити на доступ'))}
          {activeTab === 'matrix' && (isWhitelisted ? <YearMatrixView /> : renderRestrictedGuard('Літопис подій'))}
          {(activeTab === 'notes' || activeTab === 'tasks') && (isWhitelisted ? <TasksView /> : renderRestrictedGuard('Чернетки & Завдання'))}
          {activeTab === 'findings' && (isWhitelisted ? <FindingsView /> : renderRestrictedGuard('Зачіпки'))}
          {activeTab === 'hypotheses' && (isWhitelisted ? <HypothesesView /> : renderRestrictedGuard('Підозри & Гіпотези'))}
          {activeTab === 'settings' && (isWhitelisted ? <SettingsView /> : renderRestrictedGuard('Налаштування'))}
          {activeTab === 'persons' && (isWhitelisted ? (
            <PersonsListView
              onInspectPerson={(id) => setInspectPersonId(id)}
              onEditPerson={handleEditPerson}
              onOpenAddPerson={handleOpenAddModal}
            />
          ) : renderRestrictedGuard('Список осіб'))}
          {activeTab === 'timeline' && (
            <TimelineView
              onInspectPerson={(id) => setInspectPersonId(id)}
            />
          )}
          {activeTab === 'experiment' && (isWhitelisted ? <ExperimentView /> : renderRestrictedGuard('Експеримент'))}
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
          onSaveAndOpenProfile={(id) => setInspectPersonId(id)}
          onClose={() => {
            setShowAddModal(false);
            setPersonToEdit(null);
            setAddRelation(null);
          }}
        />
      )}

      {/* Whitelist Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        targetFeatureName={authModalFeature}
      />

      {/* Contact Author Modal */}
      <ContactModal />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GenealogyProvider>
        <AppContent />
      </GenealogyProvider>
    </ErrorBoundary>
  );
}
