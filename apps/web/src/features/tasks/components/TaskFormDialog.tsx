import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { dateInputToIso, formatRelative, isoToDateInput } from '@/lib/dates';
import { applyApiErrors } from '@/lib/form-errors';
import { TASK_PRIORITIES, TASK_STATUSES, type Project, type Task } from '@/types/api';
import { useMembers } from '../../projects/api';
import { can } from '../../projects/permissions';
import { useCreateTask, useUpdateTask, type TaskInput } from '../api';
import { PRIORITY_META, STATUS_META } from '../labels';
import { taskSchema, type TaskFormValues } from '../schemas';

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tâche à modifier ; absente = création. */
  task?: Task | null;
  /** Projets proposés à la création (ceux où l'utilisateur peut créer). */
  projects: Project[];
  defaultProjectId?: string;
}

const toFormValues = (task: Task | null | undefined, projectId: string): TaskFormValues => ({
  projectId: task?.projectId ?? projectId,
  title: task?.title ?? '',
  description: task?.description ?? '',
  status: task?.status ?? 'TODO',
  priority: task?.priority ?? 'MEDIUM',
  dueDate: isoToDateInput(task?.dueDate ?? null),
  assigneeId: task?.assignee?.userId ?? '',
});

const toInput = (values: TaskFormValues): TaskInput => ({
  title: values.title,
  description: values.description.trim() || null,
  status: values.status,
  priority: values.priority,
  dueDate: dateInputToIso(values.dueDate),
  assigneeId: values.assigneeId || null,
});

/** Création / modification / consultation (lecture seule pour un VIEWER) d'une tâche. */
export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  projects,
  defaultProjectId,
}: TaskFormDialogProps) {
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const isEdit = !!task;
  const fallbackProjectId = defaultProjectId ?? projects[0]?.id ?? '';

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: toFormValues(task, fallbackProjectId),
  });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (open) form.reset(toFormValues(task, fallbackProjectId));
  }, [open, task, fallbackProjectId, form]);

  const projectId = useWatch({ control: form.control, name: 'projectId' });
  const members = useMembers(open ? projectId : undefined);
  const role = isEdit
    ? (projects.find((project) => project.id === task.projectId)?.myRole ?? 'VIEWER')
    : 'MEMBER';
  const readOnly = isEdit && !can.editTask(role);
  const canReopen = !isEdit || task.status !== 'DONE' || can.changeStatus(role, 'DONE', 'TODO');

  const onSubmit = form.handleSubmit(async (values) => {
    const input = toInput(values);
    try {
      if (isEdit) {
        // N'envoie que les champs modifiés (completedAt n'est pas réécrit inutilement).
        const original = toInput(toFormValues(task, task.projectId));
        const changes = Object.fromEntries(
          Object.entries(input).filter(
            ([key, value]) => original[key as keyof TaskInput] !== value,
          ),
        );
        if (Object.keys(changes).length > 0)
          await updateTask.mutateAsync({ id: task.id, input: changes });
        toast.success('Tâche mise à jour');
      } else {
        await createTask.mutateAsync({ projectId: values.projectId, input });
        toast.success('Tâche créée');
      }
      onOpenChange(false);
    } catch (error) {
      applyApiErrors(error, form.setError, [
        'title',
        'description',
        'status',
        'priority',
        'dueDate',
        'assigneeId',
      ]);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      variant="sheet"
      title={readOnly ? 'Détail de la tâche' : isEdit ? 'Modifier la tâche' : 'Nouvelle tâche'}
      description={
        isEdit
          ? `${task.projectName} · créée ${formatRelative(task.createdAt)}${task.creator ? ` par ${task.creator.name}` : ''}`
          : undefined
      }
      footer={
        readOnly ? (
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" form="task-form" loading={isSubmitting}>
              {isEdit ? 'Enregistrer' : 'Créer la tâche'}
            </Button>
          </>
        )
      }
    >
      <form id="task-form" onSubmit={onSubmit} noValidate>
        <fieldset disabled={readOnly} className="flex flex-col gap-4">
          {readOnly && (
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-muted">
              Vous avez un accès en lecture seule à ce projet.
            </p>
          )}
          {!isEdit && !defaultProjectId && (
            <Field label="Projet" error={errors.projectId?.message}>
              {(a11y) => (
                <Select
                  {...a11y}
                  {...form.register('projectId', {
                    onChange: () => form.setValue('assigneeId', ''),
                  })}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field label="Titre" error={errors.title?.message}>
            {(a11y) => <Input autoFocus={!isEdit} {...a11y} {...form.register('title')} />}
          </Field>
          <Field label="Description" error={errors.description?.message}>
            {(a11y) => <Textarea rows={5} {...a11y} {...form.register('description')} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Statut"
              error={errors.status?.message}
              hint={
                canReopen
                  ? undefined
                  : 'Seuls les administrateurs peuvent rouvrir une tâche terminée.'
              }
            >
              {(a11y) => (
                <Select {...a11y} {...form.register('status')} disabled={!canReopen}>
                  {TASK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_META[status].label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Priorité" error={errors.priority?.message}>
              {(a11y) => (
                <Select {...a11y} {...form.register('priority')}>
                  {TASK_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {PRIORITY_META[priority].label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Échéance" error={errors.dueDate?.message}>
              {(a11y) => <Input type="date" {...a11y} {...form.register('dueDate')} />}
            </Field>
            <Field label="Assignée à" error={errors.assigneeId?.message}>
              {(a11y) => (
                <Select {...a11y} {...form.register('assigneeId')} disabled={members.isLoading}>
                  <option value="">Personne</option>
                  {members.data?.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
