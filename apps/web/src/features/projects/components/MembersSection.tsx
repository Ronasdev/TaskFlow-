import { zodResolver } from '@hookform/resolvers/zod';
import { UserMinus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Avatar, Card, ErrorState, Skeleton } from '@/components/ui/display';
import { Field, Input, Select } from '@/components/ui/form';
import { ApiError } from '@/lib/api-client';
import { applyApiErrors } from '@/lib/form-errors';
import type { AssignableRole, Member, Project } from '@/types/api';
import { addMemberSchema, type AddMemberValues } from '../../tasks/schemas';
import { useMemberMutations, useMembers } from '../api';
import { can, ROLE_LABELS } from '../permissions';
import { RoleBadge } from './RoleBadge';

export function MembersSection({
  project,
  currentUserId,
}: {
  project: Project;
  currentUserId: string;
}) {
  const members = useMembers(project.id);
  const mutations = useMemberMutations(project.id);
  const [removing, setRemoving] = useState<Member | null>(null);
  const manage = can.manageMembers(project.myRole, project.isPersonal);
  const assignable = can.assignableRoles(project.myRole);

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Membres</h2>
      <p className="mt-1 text-sm text-muted">
        {project.isPersonal
          ? 'Votre projet personnel ne peut pas être partagé.'
          : manage
            ? 'Invitez des personnes ayant déjà un compte et gérez leurs rôles.'
            : 'Seuls le propriétaire et les administrateurs gèrent les membres.'}
      </p>

      {manage && <AddMemberForm projectId={project.id} roles={assignable} />}

      <div className="mt-5">
        {members.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : members.isError ? (
          <ErrorState message={members.error.message} onRetry={() => void members.refetch()} />
        ) : (
          <ul className="divide-y divide-border">
            {members.data.map((member) => {
              const editable = manage && can.manageMember(project.myRole, member.role);
              return (
                <li key={member.userId} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={member.name} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.name}
                      {member.userId === currentUserId && (
                        <span className="text-muted"> (vous)</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">{member.email}</p>
                  </div>
                  {editable ? (
                    <>
                      <Select
                        aria-label={`Rôle de ${member.name}`}
                        value={member.role}
                        disabled={mutations.updateRole.isPending}
                        onChange={(event) =>
                          mutations.updateRole.mutate(
                            { userId: member.userId, role: event.target.value as AssignableRole },
                            {
                              onSuccess: () => toast.success('Rôle mis à jour'),
                              onError: (error) => toast.error(error.message),
                            },
                          )
                        }
                        className="h-9 w-40"
                      >
                        {assignable.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </Select>
                      <Button
                        variant="danger-ghost"
                        size="icon"
                        aria-label={`Retirer ${member.name}`}
                        onClick={() => setRemoving(member)}
                      >
                        <UserMinus className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Retirer ce membre ?"
        description={`${removing?.name ?? ''} n'aura plus accès au projet. Ses tâches seront désassignées.`}
        confirmLabel="Retirer"
        loading={mutations.remove.isPending}
        onConfirm={() =>
          removing &&
          mutations.remove.mutate(removing.userId, {
            onSuccess: () => {
              toast.success('Membre retiré');
              setRemoving(null);
            },
            onError: (error) => toast.error(error.message),
          })
        }
      />
    </Card>
  );
}

function AddMemberForm({ projectId, roles }: { projectId: string; roles: AssignableRole[] }) {
  const { add } = useMemberMutations(projectId);
  const form = useForm<AddMemberValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { email: '', role: 'MEMBER' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await add.mutateAsync(values);
      toast.success('Membre ajouté');
      form.reset({ email: '', role: values.role });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        form.setError('email', { message: 'Aucun compte ne peut être ajouté avec cet email' });
      } else if (error instanceof ApiError && error.status === 409) {
        form.setError('email', { message: error.message });
      } else {
        applyApiErrors(error, form.setError, ['email', 'role']);
      }
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start"
    >
      <Field label="Email" error={errors.email?.message} className="flex-1">
        {(a11y) => (
          <Input type="email" placeholder="nom@exemple.com" {...a11y} {...form.register('email')} />
        )}
      </Field>
      <Field label="Rôle" error={errors.role?.message} className="sm:w-44">
        {(a11y) => (
          <Select {...a11y} {...form.register('role')}>
            {roles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Button type="submit" loading={isSubmitting} className="sm:mt-6.5">
        Ajouter
      </Button>
    </form>
  );
}
