import { ValidateIf } from 'class-validator';

/**
 * Champ optionnel mais non nullable : absent => ignoré ; `null` => validé (donc rejeté par les
 * validateurs suivants). `@IsOptional()` laisserait passer `null` vers une colonne NOT NULL.
 */
export const IsOptionalNonNull = () =>
  ValidateIf((_object: object, value: unknown) => value !== undefined);
