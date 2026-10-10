import { useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/display';
import { cn } from '@/lib/utils';
import { TASK_STATUSES, type ProjectRole, type Task, type TaskStatus } from '@/types/api';
import { can } from '../../projects/permissions';
import { useChangeTaskStatus } from '../api';
import { STATUS_META } from '../labels';
import { DueBadge, PriorityBadge } from './badges';
import { TaskActions } from './TaskActions';

interface TaskBoardProps {
  tasks: Task[];
  role: ProjectRole;
  onOpen: (task: Task) => void;
}

/**
 * Vue Kanban : glisser-déposer entre colonnes (souris) ; le menu « Changer le statut »
 * de chaque carte offre l'alternative clavier et tactile.
 */
export function TaskBoard({ tasks, role, onOpen }: TaskBoardProps) {
  const changeStatus = useChangeTaskStatus();
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const draggable = can.editTask(role);

  const onDrop = (event: DragEvent, to: TaskStatus) => {
    event.preventDefault();
    setDragOver(null);
    const task = tasks.find((item) => item.id === event.dataTransfer.getData('text/plain'));
    if (!task || task.status === to) return;
    if (!can.changeStatus(role, task.status, to)) {
      toast.error(
        'Seuls le propriétaire et les administrateurs peuvent rouvrir une tâche terminée',
      );
      return;
    }
    changeStatus.mutate({ id: task.id, status: to });
  };

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
      {TASK_STATUSES.map((status) => {
        const { label, icon: Icon } = STATUS_META[status];
        const column = tasks.filter((task) => task.status === status);
        return (
          <section
            key={status}
            aria-label={label}
            onDragOver={(event) => {
              if (!draggable) return;
              event.preventDefault();
              setDragOver(status);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(event) => onDrop(event, status)}
            className={cn(
              'flex w-[85vw] max-w-sm shrink-0 snap-start flex-col rounded-2xl border border-border bg-surface-muted/50 p-3 transition-colors md:w-auto md:max-w-none',
              dragOver === status && 'border-primary bg-primary-soft',
            )}
          >
            <header className="mb-3 flex items-center gap-2 px-1">
              <Icon className="size-4 text-muted" aria-hidden />
              <h2 className="text-sm font-semibold">{label}</h2>
              <span className="ml-auto rounded-full bg-surface px-2 text-xs text-muted">
                {column.length}
              </span>
            </header>
            <ul className="flex min-h-24 flex-col gap-2">
              {column.map((task) => (
                <li
                  key={task.id}
                  draggable={draggable}
                  onDragStart={(event) => event.dataTransfer.setData('text/plain', task.id)}
                  className={cn(
                    'rounded-xl border border-border bg-surface p-3 shadow-sm',
                    draggable && 'cursor-grab active:cursor-grabbing',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen(task)}
                      className={cn(
                        'min-w-0 flex-1 cursor-pointer text-left text-sm font-medium hover:text-primary',
                        task.status === 'DONE' && 'text-muted line-through',
                      )}
                    >
                      {task.title}
                    </button>
                    <TaskActions task={task} role={role} onEdit={() => onOpen(task)} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <PriorityBadge priority={task.priority} />
                    {task.dueDate && (
                      <DueBadge dueDate={task.dueDate} done={task.status === 'DONE'} />
                    )}
                    {task.assignee && (
                      <Avatar name={task.assignee.name} className="ml-auto size-6" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
