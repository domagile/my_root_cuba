/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AddPersonModal } from '../../../components/Tree/AddPersonModal';
import { useGenealogy } from '../../../context/GenealogyContext';
import { GenealogyDatabase } from '../../../types';

export interface PersonDetailModalProps {
  database?: GenealogyDatabase;
  personId: string | null;
  onClose: () => void;
  onSelectPerson?: (id: string) => void;
  onEditPerson?: (id: string) => void;
  onDeletePerson?: (id: string) => void;
  onChangeRoot?: (id: string) => void;
  onOpenKinshipWith?: (id: string) => void;
  onOpenRelationManager?: (id: string) => void;
  onAddRelation?: (type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling', targetPersonId: string) => void;
  isReadOnly?: boolean;
  initialMode?: 'view' | 'edit' | 'full' | 'express';
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
  database,
  personId,
  onClose,
  onSelectPerson,
  onEditPerson,
  onDeletePerson,
  onChangeRoot,
  onOpenKinshipWith,
  onAddRelation,
  isReadOnly = false,
  initialMode = 'view'
}) => {
  const { deletePerson } = useGenealogy();
  const [activePersonId, setActivePersonId] = useState<string | null>(personId);

  useEffect(() => {
    setActivePersonId(personId);
  }, [personId]);

  if (!activePersonId) return null;

  const targetPerson = database?.persons && activePersonId ? database.persons[activePersonId] : undefined;

  return (
    <AddPersonModal
      database={database}
      personId={activePersonId}
      initialPersonToEdit={targetPerson}
      initialMode={initialMode}
      onClose={onClose}
      onSelectPerson={(id) => {
        setActivePersonId(id);
        if (onSelectPerson) onSelectPerson(id);
      }}
      onOpenAddRelation={(type, targetId) => {
        if (onAddRelation && (type === 'father' || type === 'mother' || type === 'parent' || type === 'child' || type === 'spouse' || type === 'sibling')) {
          onAddRelation(type, targetId);
        }
      }}
      onDeletePerson={onDeletePerson || deletePerson}
      onChangeRoot={onChangeRoot}
      onOpenKinshipWith={onOpenKinshipWith}
      isReadOnly={isReadOnly}
    />
  );
};
