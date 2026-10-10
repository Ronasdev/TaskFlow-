import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().min(1).default('/api/v1'),
});

/** Validé au chargement : une configuration invalide échoue immédiatement. */
export const env = envSchema.parse(import.meta.env);
