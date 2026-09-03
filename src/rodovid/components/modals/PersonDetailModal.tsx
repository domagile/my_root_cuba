/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
  personId,
  onClose,
  onSelectPerson,
  onDeletePerson,
  onChangeRoot,
  onOpenKinshipWith,
  isReadOnly = false
}) => {
  const { deletePerson } = useGenealogy();

  if (!personId) return null;

  return (
    <AddPersonModal
      personId={personId}
      onClose={onClose}
      onSelectPerson={onSelectPerson}
      onDeletePerson={onDeletePerson || deletePerson}
      onChangeRoot={onChangeRoot}
      onOpenKinshipWith={onOpenKinshipWith}
      isReadOnly={isReadOnly}
    />
  );
};
