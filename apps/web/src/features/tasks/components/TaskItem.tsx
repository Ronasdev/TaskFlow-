import { Check } from 'lucide-react';
import { Avatar } from '@/components/ui/display';
import { cn } from '@/lib/utils';
import type { ProjectRole, Task } from '@/types/api';
import { can } from '../../projects/permissions';
import { useChangeTaskStatus } from '../api';
import { DueBadge, PriorityBadge, StatusBadge } from './badges';
import { TaskActions } from './TaskActions';

interface TaskItemProps {
  task: Task;
  role: ProjectRole;
  onOpen: () => void;
  showProject?: boolean;
}

/** Ligne de tâche (vue liste). */
export function TaskItem({ task, role, onOpen, showProject = false }: TaskItemProps) {
  const changeStatus = useChangeTaskStatus();
  const done = task.status === 'DONE';
  const nextStatus = done ? 'TODO' : 'DONE';
  const canToggle = can.changeStatus(role, task.status, nextStatus);

  return (
    <li className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-muted/60">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Rouvrir « ${task.title} »` : `Terminer « ${task.title} »`}
        disabled={!canToggle}
        onClick={() => changeStatus.mutate({ id: task.id, status: nextStatus })}
        className={cn(
          'mt-0.5 grid size-5 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          done
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-border hover:border-primary',
        )}
      >
        {done && <Check className="size-3" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            'block max-w-full cursor-pointer truncate text-left text-sm font-medium hover:text-primary',
            done && 'text-muted line-through',
          )}
        >
          {task.title}
        </button>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          {task.dueDate && <DueBadge dueDate={task.dueDate} done={done} />}
          {showProject && <span className="text-xs text-muted">· {task.projectName}</span>}
        </div>
      </div>

      {task.assignee && (
        <Avatar name={task.assignee.name} className="mt-0.5 hidden sm:inline-grid" />
      )}
      <TaskActions task={task} role={role} onEdit={onOpen} />
    </li>
  );
}
