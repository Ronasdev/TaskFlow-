import { z } from 'zod';

/** Mêmes contraintes que l'API (docs/API.md §1) : l'API reste la source de vérité. */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "L'email est requis")
  .max(254)
  .email('Email invalide');

export const passwordSchema = z
  .string()
  .min(8, 'Au moins 8 caractères')
  .max(128, 'Au plus 128 caractères')
  .regex(/[A-Za-z]/, 'Au moins une lettre')
  .regex(/\d/, 'Au moins un chiffre');

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Le nom est requis')
  .max(100, 'Au plus 100 caractères');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Le mot de passe est requis').max(128),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas',
  });
export type RegisterValues = z.infer<typeof registerSchema>;

export const profileSchema = z.object({ name: nameSchema });
export type ProfileValues = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Le mot de passe actuel est requis'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas',
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
