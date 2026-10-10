import { z } from 'zod';

/** Contraintes identiques à CreateTaskDto / UpdateTaskDto (docs/API.md §1). */
export const taskSchema = z.object({
  projectId: z.string().uuid('Choisissez un projet'),
  title: z.string().trim().min(1, 'Le titre est requis').max(200, 'Au plus 200 caractères'),
  description: z.string().max(5000, 'Au plus 5000 caractères'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  /** Valeur d'un <input type="date"> ou chaîne vide. */
  dueDate: z.string(),
  /** UUID d'un membre ou chaîne vide (non assignée). */
  assigneeId: z.string(),
});

export type TaskFormValues = z.infer<typeof taskSchema>;

export const projectSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(100, 'Au plus 100 caractères'),
  description: z.string().trim().max(2000, 'Au plus 2000 caractères'),
});
export type ProjectFormValues = z.infer<typeof projectSchema>;

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "L'email est requis").email('Email invalide'),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});
export type AddMemberValues = z.infer<typeof addMemberSchema>;
