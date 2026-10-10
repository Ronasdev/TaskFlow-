import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, Card, PageHeader } from '@/components/ui/display';
import { Field, Input } from '@/components/ui/form';
import { api, ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/dates';
import { applyApiErrors } from '@/lib/form-errors';
import type { User } from '@/types/api';
import { useAuth, useCurrentUser } from '../auth/auth-context';
import {
  changePasswordSchema,
  profileSchema,
  type ChangePasswordValues,
  type ProfileValues,
} from '../auth/schemas';

export function ProfilePage() {
  const user = useCurrentUser();
  const { logoutAll } = useAuth();
  const logoutAllMutation = useMutation({ mutationFn: logoutAll });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profil" />
      <div className="flex flex-col gap-6">
        <Card className="flex items-center gap-4 p-5">
          <Avatar name={user.name} className="size-14 text-lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
            <p className="text-xs text-muted">Membre depuis le {formatDate(user.createdAt)}</p>
          </div>
        </Card>
        <ProfileForm user={user} />
        <PasswordForm />
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Sessions</h2>
            <p className="mt-1 text-sm text-muted">
              Déconnecte tous vos appareils, y compris celui-ci.
            </p>
          </div>
          <Button
            variant="secondary"
            loading={logoutAllMutation.isPending}
            onClick={() => logoutAllMutation.mutate()}
          >
            <LogOut className="size-4" /> Se déconnecter partout
          </Button>
        </Card>
      </div>
    </div>
  );
}

function ProfileForm({ user }: { user: User }) {
  const { setUser } = useAuth();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const updated = await api.patch<User>('/users/me', values);
      setUser(updated);
      form.reset({ name: updated.name });
      toast.success('Profil mis à jour');
    } catch (error) {
      applyApiErrors(error, form.setError, ['name']);
    }
  });

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Informations personnelles</h2>
      <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-4">
        <Field label="Nom" error={errors.name?.message}>
          {(a11y) => <Input autoComplete="name" {...a11y} {...form.register('name')} />}
        </Field>
        <Field label="Email" hint="L'adresse email ne peut pas être modifiée.">
          {(a11y) => <Input value={user.email} readOnly disabled {...a11y} />}
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await api.patch('/users/me/password', { currentPassword, newPassword });
      form.reset();
      toast.success('Mot de passe modifié. Vos autres sessions ont été déconnectées.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        form.setError('currentPassword', { message: 'Mot de passe actuel incorrect' });
      } else {
        applyApiErrors(error, form.setError, ['currentPassword', 'newPassword']);
      }
    }
  });

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Mot de passe</h2>
      <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-4">
        <Field label="Mot de passe actuel" error={errors.currentPassword?.message}>
          {(a11y) => (
            <Input
              type="password"
              autoComplete="current-password"
              {...a11y}
              {...form.register('currentPassword')}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nouveau mot de passe" error={errors.newPassword?.message}>
            {(a11y) => (
              <Input
                type="password"
                autoComplete="new-password"
                {...a11y}
                {...form.register('newPassword')}
              />
            )}
          </Field>
          <Field label="Confirmation" error={errors.confirmPassword?.message}>
            {(a11y) => (
              <Input
                type="password"
                autoComplete="new-password"
                {...a11y}
                {...form.register('confirmPassword')}
              />
            )}
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting}>
            Changer le mot de passe
          </Button>
        </div>
      </form>
    </Card>
  );
}
