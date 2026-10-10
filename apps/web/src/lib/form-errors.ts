import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError } from './api-client';

/**
 * Réinjecte les erreurs 400 de l'API dans le formulaire (par champ) ;
 * les autres erreurs sont affichées en toast.
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): void {
  if (error instanceof ApiError && error.fieldErrors.length > 0) {
    let mapped = false;
    for (const fieldError of error.fieldErrors) {
      const field = fields.find((name) => name === fieldError.field);
      if (field) {
        setError(field, { message: fieldError.constraints[0] });
        mapped = true;
      }
    }
    if (mapped) return;
  }
  toast.error(error instanceof Error ? error.message : 'Une erreur est survenue');
}
