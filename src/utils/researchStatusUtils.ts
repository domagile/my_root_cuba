import { Person } from '../types';

export type MetricSearchStatus = 'not_searched' | 'in_progress' | 'found' | 'not_found' | 'partial';

export interface MetricStatusConfig {
  id: MetricSearchStatus;
  value: MetricSearchStatus;
  label: string;
  shortLabel: string;
  icon: string;
  iconName: string;
  badgeClass: string;
  badgeClassDark: string;
  dotClass: string;
  description: string;
}

export const METRIC_SEARCH_STATUS_OPTIONS: MetricStatusConfig[] = [
  {
    id: 'not_searched',
    value: 'not_searched',
    label: 'Ще не шукала',
    shortLabel: 'Ще не шукала',
    icon: '❓',
    iconName: 'HelpCircle',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    badgeClassDark: 'dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700',
    dotClass: 'bg-slate-400',
    description: 'Метричні книги та архівні документи по цій особі ще не шукала'
  },
  {
    id: 'in_progress',
    value: 'in_progress',
    label: 'В процесі',
    shortLabel: 'В процесі',
    icon: '⏳',
    iconName: 'Clock',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    badgeClassDark: 'dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-500',
    description: 'Триває пошук або перегляд метричних книг та документів'
  },
  {
    id: 'found',
    value: 'found',
    label: 'Знайдено',
    shortLabel: 'Знайдено',
    icon: '✅',
    iconName: 'CheckCircle2',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    badgeClassDark: 'dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
    description: 'Метрики або архівні документи знайдено'
  },
  {
    id: 'not_found',
    value: 'not_found',
    label: 'Не знайдено',
    shortLabel: 'Не знайдено',
    icon: '❌',
    iconName: 'XCircle',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-300',
    badgeClassDark: 'dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    dotClass: 'bg-rose-500',
    description: 'Шукала, але в архівах документів не знайдено'
  },
  {
    id: 'partial',
    value: 'partial',
    label: 'Щось є',
    shortLabel: 'Щось є',
    icon: '📄',
    iconName: 'FileText',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-300',
    badgeClassDark: 'dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    dotClass: 'bg-sky-500',
    description: 'Знайдено частину метрик або неповні записи'
  }
];

export function getMetricSearchStatus(person?: Partial<Person> | null): MetricSearchStatus {
  if (!person) return 'not_searched';
  if (person.metricSearchStatus) {
    return person.metricSearchStatus as MetricSearchStatus;
  }
  return 'not_searched';
}

export function getMetricStatusConfig(status?: string | null): MetricStatusConfig {
  const found = METRIC_SEARCH_STATUS_OPTIONS.find((opt) => opt.id === status || opt.value === status);
  return found || METRIC_SEARCH_STATUS_OPTIONS[0];
}

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

