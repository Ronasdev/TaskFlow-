import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { ApiError } from '@/lib/api-client';
import { applyApiErrors } from '@/lib/form-errors';
import { useAuth } from './auth-context';
import { registerSchema, type RegisterValues } from './schemas';

export function RegisterPage() {
  const { register } = useAuth();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ confirmPassword: _confirm, ...values }) => {
    try {
      await register(values);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        form.setError('email', { message: error.message });
      } else {
        applyApiErrors(error, form.setError, ['name', 'email', 'password']);
      }
    }
  });

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Créer un compte</h1>
      <p className="mt-1 text-sm text-muted">Organisez vos tâches en quelques secondes.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-4">
        <Field label="Nom" error={errors.name?.message}>
          {(a11y) => <Input autoComplete="name" autoFocus {...a11y} {...form.register('name')} />}
        </Field>
        <Field label="Email" error={errors.email?.message}>
          {(a11y) => (
            <Input type="email" autoComplete="email" {...a11y} {...form.register('email')} />
          )}
        </Field>
        <Field
          label="Mot de passe"
          error={errors.password?.message}
          hint="8 caractères minimum, avec au moins une lettre et un chiffre."
        >
          {(a11y) => (
            <Input
              type="password"
              autoComplete="new-password"
              {...a11y}
              {...form.register('password')}
            />
          )}
        </Field>
        <Field label="Confirmer le mot de passe" error={errors.confirmPassword?.message}>
          {(a11y) => (
            <Input
              type="password"
              autoComplete="new-password"
              {...a11y}
              {...form.register('confirmPassword')}
            />
          )}
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
          Créer mon compte
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Déjà inscrit ?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Se connecter
        </Link>
      </p>
    </>
  );
}
