import { Person } from '../types';

/**
 * Checks if a person has the research status of a hypothesis ('гіпотеза')
 */
export function isPersonHypothesis(person?: Partial<Person> | null): boolean {
  if (!person) return false;
  if (person.researchStatus === 'hypothetical') return true;
  if (person.isHypothesis === true) return true;
  if (person.researchStatus === 'confirmed') return false;
  if (person.notes && person.notes.toLowerCase().includes('гіпотеза')) return true;
  return false;
}

/**
 * Checks if a person is confirmed ('підтверджена особа')
 */
export function isPersonConfirmed(person?: Partial<Person> | null): boolean {
  return !isPersonHypothesis(person);
}

/**
 * Returns formatted status information
 */
export function getResearchStatusInfo(person?: Partial<Person> | null) {
  const isHypo = isPersonHypothesis(person);
  return {
    isHypothesis: isHypo,
    status: isHypo ? ('hypothesis' as const) : ('confirmed' as const),
    label: isHypo ? 'Гіпотеза' : 'Підтверджена особа',
    shortLabel: isHypo ? 'Гіпотеза' : 'Підтверджено',
    description: isHypo
      ? 'Особа є дослідницькою гіпотезою, що потребує архівних доказів'
      : 'Особа підтверджена родинними джерелами або архівними записами'
  };
}
