import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { NotFoundPage } from '@/app/NotFoundPage';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Card, ErrorState, PageHeader, Skeleton } from '@/components/ui/display';
import { Field, Input, Textarea } from '@/components/ui/form';
import { ApiError } from '@/lib/api-client';
import { applyApiErrors } from '@/lib/form-errors';
import type { Project } from '@/types/api';
import { useCurrentUser } from '../auth/auth-context';
import { projectSchema, type ProjectFormValues } from '../tasks/schemas';
import { useDeleteProject, useLeaveProject, useProject, useUpdateProject } from './api';
import { MembersSection } from './components/MembersSection';
import { can } from './permissions';

export function ProjectSettingsPage() {
  const { projectId = '' } = useParams();
  const project = useProject(projectId);
  const user = useCurrentUser();

  if (project.isPending) return <Skeleton className="h-96 rounded-2xl" />;
  if (project.isError) {
    if (project.error instanceof ApiError && project.error.status === 404) return <NotFoundPage />;
    return <ErrorState message={project.error.message} onRetry={() => void project.refetch()} />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to={`/projects/${projectId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Retour au projet
      </Link>
      <PageHeader title="Paramètres du projet" description={project.data.name} />
      <div className="flex flex-col gap-6">
        <GeneralSection project={project.data} />
        <MembersSection project={project.data} currentUserId={user.id} />
        <DangerZone project={project.data} />
      </div>
    </div>
  );
}

function GeneralSection({ project }: { project: Project }) {
  const update = useUpdateProject(project.id);
  const editable = can.editProject(project.myRole);
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: project.name, description: project.description ?? '' },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  useEffect(() => {
    form.reset({ name: project.name, description: project.description ?? '' });
  }, [project.name, project.description, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ name: values.name, description: values.description || null });
      toast.success('Projet mis à jour');
    } catch (error) {
      applyApiErrors(error, form.setError, ['name', 'description']);
    }
  });

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Informations</h2>
      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={!editable} className="mt-4 flex flex-col gap-4">
          <Field label="Nom" error={errors.name?.message}>
            {(a11y) => <Input {...a11y} {...form.register('name')} />}
          </Field>
          <Field label="Description" error={errors.description?.message}>
            {(a11y) => <Textarea rows={3} {...a11y} {...form.register('description')} />}
          </Field>
          {editable && (
            <div className="flex justify-end">
              <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
                Enregistrer
              </Button>
            </div>
          )}
        </fieldset>
      </form>
    </Card>
  );
}

function DangerZone({ project }: { project: Project }) {
  const navigate = useNavigate();
  const deleteProject = useDeleteProject();
  const leaveProject = useLeaveProject();
  const [confirm, setConfirm] = useState<'delete' | 'leave' | null>(null);
  const canDelete = can.deleteProject(project.myRole, project.isPersonal);
  const canLeave = can.leaveProject(project.myRole);

  if (!canDelete && !canLeave) return null;

  const onDone = (message: string) => {
    toast.success(message);
    setConfirm(null);
    void navigate('/projects', { replace: true });
  };

  return (
    <Card className="border-danger/40 p-5">
      <h2 className="font-semibold text-danger">Zone sensible</h2>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {canDelete
            ? 'Supprimer le projet efface définitivement toutes ses tâches.'
            : 'Quitter le projet vous retire son accès ; vos tâches assignées seront désassignées.'}
        </p>
        <Button variant="danger" onClick={() => setConfirm(canDelete ? 'delete' : 'leave')}>
          {canDelete ? 'Supprimer le projet' : 'Quitter le projet'}
        </Button>
      </div>

      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Supprimer le projet ?"
        description={`« ${project.name} » et toutes ses tâches seront définitivement supprimés.`}
        confirmLabel="Supprimer"
        loading={deleteProject.isPending}
        onConfirm={() =>
          deleteProject.mutate(project.id, {
            onSuccess: () => onDone('Projet supprimé'),
            onError: (error) => toast.error(error.message),
          })
        }
      />
      <ConfirmDialog
        open={confirm === 'leave'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Quitter le projet ?"
        description={`Vous n'aurez plus accès à « ${project.name} ».`}
        confirmLabel="Quitter"
        loading={leaveProject.isPending}
        onConfirm={() =>
          leaveProject.mutate(project.id, {
            onSuccess: () => onDone('Vous avez quitté le projet'),
            onError: (error) => toast.error(error.message),
          })
        }
      />
    </Card>
  );
}
