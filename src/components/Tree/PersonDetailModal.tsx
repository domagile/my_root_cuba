/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AddPersonModal } from './AddPersonModal';
import { useGenealogy, useUIStore } from '../../context/GenealogyContext';
import { useAuthStore } from '../../stores/useAuthStore';
import { Person } from '../../types';

export interface PersonDetailModalProps {
  personId: string;
  onClose: () => void;
  onEdit?: (person: Person) => void;
  onOpenAddRelation?: (type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling', targetPersonId: string) => void;
  onSelectPerson?: (id: string) => void;
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
  personId,
  onClose,
  onEdit,
  onOpenAddRelation,
  onSelectPerson
}) => {
  const { deletePerson, setSelectedPersonId, persons, getGenealogyDatabase } = useGenealogy();
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const currentUser = useAuthStore((s) => s.currentUser);
  const whitelist = useAuthStore((s) => s.whitelist);

  const [activePersonId, setActivePersonId] = useState(personId);

  useEffect(() => {
    setActivePersonId(personId);
  }, [personId]);

  const targetPerson = React.useMemo(() => {
    if (!activePersonId) return null;
    const found = persons.find((p) => p.id === activePersonId);
    if (found) return found;
    try {
      const db = getGenealogyDatabase?.();
      if (db?.persons && db.persons[activePersonId]) {
        return db.persons[activePersonId];
      }
    } catch {}
    return null;
  }, [activePersonId, persons, getGenealogyDatabase]);

  const canEdit = Boolean(
    currentUser &&
    currentUser.isAuthenticated &&
    (currentUser.role === 'admin' ||
      (currentUser.role === 'editor' && currentUser.isWhitelisted) ||
      whitelist.some(
        (w) => w.email.toLowerCase() === currentUser.email?.toLowerCase() &&
               w.status === 'active' &&
               (w.role === 'admin' || w.role === 'editor')
      ))
  );

  return (
    <AddPersonModal
      personId={activePersonId}
      initialPersonToEdit={targetPerson}
      initialMode="view"
      onClose={onClose}
      isReadOnly={!canEdit}
      onChangeRoot={(id) => {
        setSelectedPersonId(id);
        setActiveTab('tree');
      }}
      onOpenKinshipWith={(id) => {
        setSelectedPersonId(id);
        setActiveTab('kinship');
      }}
      onDeletePerson={deletePerson}
      onSelectPerson={(id) => {
        setActivePersonId(id);
        setSelectedPersonId(id);
        if (onSelectPerson) onSelectPerson(id);
      }}
    />
  );
};
