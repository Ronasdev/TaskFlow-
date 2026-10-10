import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { ApiError } from '@/lib/api-client';
import { applyApiErrors } from '@/lib/form-errors';
import { useAuth } from './auth-context';
import { loginSchema, type LoginValues } from './schemas';

export function LoginPage() {
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 429)) {
        setFormError(error.message);
      } else {
        applyApiErrors(error, form.setError, ['email', 'password']);
      }
    }
  });

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
      <p className="mt-1 text-sm text-muted">Heureux de vous revoir.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}
        <Field label="Email" error={errors.email?.message}>
          {(a11y) => (
            <Input
              type="email"
              autoComplete="email"
              autoFocus
              {...a11y}
              {...form.register('email')}
            />
          )}
        </Field>
        <Field label="Mot de passe" error={errors.password?.message}>
          {(a11y) => (
            <Input
              type="password"
              autoComplete="current-password"
              {...a11y}
              {...form.register('password')}
            />
          )}
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
          Se connecter
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Pas encore de compte ?{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">
          Créer un compte
        </Link>
      </p>
    </>
  );
}
