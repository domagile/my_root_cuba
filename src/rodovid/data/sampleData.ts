/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenealogyDatabase } from '../types/genealogy';

export const SAMPLE_DATABASE: GenealogyDatabase = {
  metadata: {
    title: 'Родовід',
    description: 'База даних родоводу',
    lastModified: new Date().toISOString(),
    author: 'Дослідник',
  },
  persons: {},
  families: {},
  sources: {},
  events: {},
  places: {},
  lastModified: new Date().toISOString()
};
