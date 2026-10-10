import { differenceInCalendarDays, format, formatDistanceToNow, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';

export const formatDate = (iso: string) => format(new Date(iso), 'd MMM yyyy', { locale: fr });

export const formatRelative = (iso: string) =>
  formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr });

export function dueLabel(iso: string): string {
  const days = differenceInCalendarDays(new Date(iso), new Date());
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Demain';
  if (days === -1) return 'Hier';
  return formatDate(iso);
}

export const isOverdue = (iso: string | null, done: boolean) =>
  !!iso && !done && isPast(new Date(iso));

/** Valeur d'un <input type="date"> (AAAA-MM-JJ) → ISO : échéance en fin de journée locale. */
export function dateInputToIso(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T23:59:59`).toISOString();
}

/** ISO → valeur d'un <input type="date">. */
export function isoToDateInput(iso: string | null): string {
  return iso ? format(new Date(iso), 'yyyy-MM-dd') : '';
}
