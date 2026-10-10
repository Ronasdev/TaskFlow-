import { Circle, CircleCheck, CircleDashed, type LucideIcon } from 'lucide-react';
import type { TaskPriority, TaskStatus } from '@/types/api';

/** Le statut n'est jamais communiqué par la couleur seule : libellé + icône. */
export const STATUS_META: Record<
  TaskStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  TODO: {
    label: 'À faire',
    icon: Circle,
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  IN_PROGRESS: {
    label: 'En cours',
    icon: CircleDashed,
    className: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  },
  DONE: {
    label: 'Terminée',
    icon: CircleCheck,
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
};

export const PRIORITY_META: Record<TaskPriority, { label: string; className: string }> = {
  HIGH: { label: 'Haute', className: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
  MEDIUM: {
    label: 'Moyenne',
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  },
  LOW: {
    label: 'Basse',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
};
