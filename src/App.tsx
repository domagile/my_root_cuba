/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GenealogyProvider, useUIStore } from './context/GenealogyContext';
import { useAuthStore } from './stores/useAuthStore';
import { useSharedTreeStore } from './stores/useSharedTreeStore';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { Person } from './types';
import { SharedPinScreen } from './components/SharedPinScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ContactAuthorModal, AUTHOR_CONTACT_EMAIL } from './components/ContactAuthorModal';
import { getThemeConfig } from './utils/theme';
import { isUserWhitelisted } from './rodovid/utils/privacy';
import { RefreshCw, AlertCircle, ArrowLeft, Lock, Mail } from 'lucide-react';

// Lazy-loaded secondary tabs & heavy views to optimize initial load & runtime memory
const RodovidView = React.lazy(() => import('./rodovid/RodovidView').then(m => ({ default: m.RodovidView })));
const SettingsView = React.lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));
const InvestigativeAiView = React.lazy(() => import('./components/InvestigativeAiView').then(m => ({ default: m.InvestigativeAiView })));
const PersonsListView = React.lazy(() => import('./components/PersonsListView').then(m => ({ default: m.PersonsListView })));
const TimelineView = React.lazy(() => import('./components/TimelineView').then(m => ({ default: m.TimelineView })));

const ResearchView = React.lazy(() => import('./components/OtherViews').then(m => ({ default: m.ResearchView })));
const YearMatrixView = React.lazy(() => import('./components/OtherViews').then(m => ({ default: m.YearMatrixView })));
const HypothesesView = React.lazy(() => import('./components/OtherViews').then(m => ({ default: m.HypothesesView })));

// Lazy-loaded modals
const PersonDetailModal = React.lazy(() => import('./components/Tree/PersonDetailModal').then(m => ({ default: m.PersonDetailModal })));
const AddPersonModal = React.lazy(() => import('./components/Tree/AddPersonModal').then(m => ({ default: m.AddPersonModal })));
const RelationManagerModal = React.lazy(() => import('./components/Tree/RelationManagerModal').then(m => ({ default: m.RelationManagerModal })));

const ViewLoadingFallback = () => (
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="flex items-center gap-2.5 text-xs text-neutral-400 font-medium animate-pulse">
      <RefreshCw className="w-4 h-4 animate-spin text-[#B88E3E]" />
      <span>Завантаження...</span>
    </div>
  </div>
);

function AppContent() {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const themePalette = useUIStore((s) => s.themePalette);
  const isAuthModalOpen = useUIStore((s) => s.isAuthModalOpen);
  const authModalFeature = useUIStore((s) => s.authModalFeature);
  const openAuthModal = useUIStore((s) => s.openAuthModal);
  const closeAuthModal = useUIStore((s) => s.closeAuthModal);

  const currentUser = useAuthStore((s) => s.currentUser);
  const whitelist = useAuthStore((s) => s.whitelist);
  const initCloudAuthSync = useAuthStore((s) => s.initCloudAuthSync);
  const theme = getThemeConfig(themePalette);

  const isWhitelisted = isUserWhitelisted(currentUser, whitelist);

  // Realtime Cloud Auth Sync (Whitelist, Access Requests, Security Config across all browsers)
  useEffect(() => {
    const unsub = initCloudAuthSync();
    return () => {
      unsub();
    };
  }, [initCloudAuthSync]);

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
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const pId = params.get('personId') || params.get('person');
        if (pId) {
          useUIStore.getState().setInspectPersonId(pId);
        } else {
          useUIStore.getState().setInspectPersonId(null);
        }
        if (tab) {
          const rodovidViews = ['tree', 'fan', 'persons', 'timeline', 'places', 'sources', 'kinship', 'stats', 'reports', 'conflicts', 'duplicates'];
          if (rodovidViews.includes(tab)) {
            useUIStore.getState().setRodovidView(tab as any);
          } else {
            useUIStore.getState().setActiveTab(tab);
          }
        }
      } catch {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const inspectPersonId = useUIStore((s) => s.activeInspectPersonId);
  const setInspectPersonId = useUIStore((s) => s.setInspectPersonId);
  const [personToEdit, setPersonToEdit] = useState<Person | null>(null);
  const [relationManagerPerson, setRelationManagerPerson] = useState<Person | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [addRelation, setAddRelation] = useState<{
    type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling' | 'godparent' | 'witness';
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
    type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling' | 'godparent' | 'witness',
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
          Цей розділ містить конфіденційні архівні матеріали, чернетки та налаштування. Для доступу необхідно надіслати запит або увійти.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => openAuthModal(featureName)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            Надіслати запит або увійти
          </button>
          <button
            onClick={() => setActiveTab('tree')}
            className="px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 font-semibold text-xs transition-colors cursor-pointer"
          >
            Повернутися до Дерева
          </button>
        </div>

        <div className="pt-3 border-t border-black/10 dark:border-white/10 text-[11px] opacity-80">
          <span>Шукаєте спільних предків чи маєте запитання? Зв'яжіться з автором: </span>
          <button
            type="button"
            onClick={() => setShowContactModal(true)}
            className="font-bold text-[#B88E3E] hover:underline font-mono cursor-pointer ml-1 inline-flex items-center gap-1"
          >
            <Mail className="w-3 h-3" />
            <span>{AUTHOR_CONTACT_EMAIL}</span>
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
          onOpenContactModal={() => setShowContactModal(true)}
        />

        {/* Tab Router */}
        <main className="flex-1 flex flex-col h-full min-h-0 relative overflow-x-auto overflow-y-hidden">
          <React.Suspense fallback={<ViewLoadingFallback />}>
            {activeTab === 'tree' && <RodovidView />}
            {activeTab === 'research' && (isWhitelisted ? <ResearchView /> : renderRestrictedGuard('Детективні розкопки'))}
            {activeTab === 'ai-analysis' && (isWhitelisted ? <InvestigativeAiView /> : renderRestrictedGuard('Слідчий AI аналіз'))}
            {activeTab === 'matrix' && (isWhitelisted ? <YearMatrixView /> : renderRestrictedGuard('Літопис подій'))}
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
          </React.Suspense>
        </main>
      </div>

      <React.Suspense fallback={null}>
        {/* Inspect Person Profile Modal */}
        {inspectPersonId && activeTab !== 'tree' && (
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
      </React.Suspense>

      {/* Whitelist Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        targetFeatureName={authModalFeature}
      />

      {/* Contact Author Modal (domagile@gmail.com) */}
      {showContactModal && (
        <ContactAuthorModal
          isOpen={showContactModal}
          onClose={() => setShowContactModal(false)}
        />
      )}
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
