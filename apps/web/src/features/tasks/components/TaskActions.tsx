import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TASK_STATUSES, type ProjectRole, type Task } from '@/types/api';
import { can } from '../../projects/permissions';
import { useChangeTaskStatus, useDeleteTask } from '../api';
import { STATUS_META } from '../labels';

interface TaskActionsProps {
  task: Task;
  role: ProjectRole;
  onEdit: () => void;
}

/**
 * Menu d'actions d'une tâche. Sert aussi d'alternative clavier au glisser-déposer du Kanban.
 */
export function TaskActions({ task, role, onEdit }: TaskActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const changeStatus = useChangeTaskStatus();
  const deleteTask = useDeleteTask();

  if (!can.editTask(role)) return null;
  const canDelete = can.deleteTask(role, task.status);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions pour « ${task.title} »`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem icon={<Pencil className="size-4" />} onSelect={onEdit}>
            Modifier
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Changer le statut</DropdownMenuLabel>
          {TASK_STATUSES.filter((status) => status !== task.status).map((status) => {
            const { label, icon: Icon } = STATUS_META[status];
            return (
              <DropdownMenuItem
                key={status}
                icon={<Icon className="size-4" />}
                disabled={!can.changeStatus(role, task.status, status)}
                onSelect={() => changeStatus.mutate({ id: task.id, status })}
              >
                {label}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            icon={<Trash2 className="size-4" />}
            disabled={!canDelete}
            onSelect={() => setConfirmOpen(true)}
          >
            {canDelete ? 'Supprimer' : 'Supprimer (réservé aux admins)'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Supprimer la tâche ?"
        description={`« ${task.title} » sera définitivement supprimée.`}
        confirmLabel="Supprimer"
        loading={deleteTask.isPending}
        onConfirm={() =>
          deleteTask.mutate(task.id, {
            onSuccess: () => {
              setConfirmOpen(false);
              toast.success('Tâche supprimée');
            },
            onError: (error) => toast.error(error.message),
          })
        }
      />
    </>
  );
}
