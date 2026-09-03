/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AddPersonModal } from './AddPersonModal';
import { useGenealogy, useUIStore } from '../../context/GenealogyContext';
import { useAuthStore } from '../../stores/useAuthStore';
import { Person } from '../../types';

export interface PersonDetailModalProps {
  personId: string;
  onClose: () => void;
  onEdit?: (person: Person) => void;
  onOpenAddRelation?: (type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling', targetPersonId: string) => void;
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
  personId,
  onClose,
  onEdit,
  onOpenAddRelation
}) => {
  const { deletePerson, setSelectedPersonId } = useGenealogy();
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const currentUser = useAuthStore((s) => s.currentUser);
  const whitelist = useAuthStore((s) => s.whitelist);

  const canEdit = Boolean(
    currentUser &&
    currentUser.isAuthenticated &&
    (currentUser.role === 'admin' ||
      currentUser.role === 'editor' ||
      whitelist.some(
        (w) => w.email.toLowerCase() === currentUser.email?.toLowerCase() &&
               w.status === 'active' &&
               (w.role === 'admin' || w.role === 'editor')
      ))
  );

  return (
    <AddPersonModal
      personId={personId}
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
        setSelectedPersonId(id);
      }}
    />
  );
};
