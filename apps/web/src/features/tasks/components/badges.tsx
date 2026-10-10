import { CalendarClock } from 'lucide-react';
import { Badge } from '@/components/ui/display';
import { dueLabel, isOverdue } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { TaskPriority, TaskStatus } from '@/types/api';
import { PRIORITY_META, STATUS_META } from '../labels';

export function StatusBadge({ status }: { status: TaskStatus }) {
  const { label, icon: Icon, className } = STATUS_META[status];
  return (
    <Badge className={className}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const { label, className } = PRIORITY_META[priority];
  return <Badge className={className}>Priorité {label.toLowerCase()}</Badge>;
}

export function DueBadge({ dueDate, done }: { dueDate: string; done: boolean }) {
  const overdue = isOverdue(dueDate, done);
  return (
    <Badge className={cn(overdue ? 'bg-danger-soft text-danger' : 'bg-surface-muted text-muted')}>
      <CalendarClock className="size-3.5" aria-hidden />
      {overdue && <span className="sr-only">En retard :</span>}
      {dueLabel(dueDate)}
    </Badge>
  );
}
