import { Transform } from 'class-transformer';

/** Supprime les espaces en début et fin des chaînes (laisse les autres types intacts). */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** Normalise un email : trim + minuscules. */
export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
