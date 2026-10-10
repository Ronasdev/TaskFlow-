import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/form';
import { applyApiErrors } from '@/lib/form-errors';
import { projectSchema, type ProjectFormValues } from '../../tasks/schemas';
import { useCreateProject } from '../api';

export function ProjectFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: '', description: '' },
  });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (open) form.reset({ name: '', description: '' });
  }, [open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const project = await createProject.mutateAsync({
        name: values.name,
        description: values.description || null,
      });
      toast.success('Projet créé');
      onOpenChange(false);
      void navigate(`/projects/${project.id}`);
    } catch (error) {
      applyApiErrors(error, form.setError, ['name', 'description']);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nouveau projet"
      description="Vous en serez le propriétaire et pourrez inviter des membres."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="project-form" loading={isSubmitting}>
            Créer le projet
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Nom" error={errors.name?.message}>
          {(a11y) => <Input autoFocus {...a11y} {...form.register('name')} />}
        </Field>
        <Field label="Description (facultative)" error={errors.description?.message}>
          {(a11y) => <Textarea rows={3} {...a11y} {...form.register('description')} />}
        </Field>
      </form>
    </Dialog>
  );
}
