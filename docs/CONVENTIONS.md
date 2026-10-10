# Conventions

## 1. Code

- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`. Pas de `any` (règle ESLint en erreur).
- Prettier : 2 espaces, guillemets simples, point-virgule, largeur 100.
- Imports absolus via alias : `@/` (web : `src/`), API : chemins relatifs dans un module, `src/common/...` entre modules.
- Code et identifiants **en anglais** ; textes affichés à l'utilisateur et documentation **en français**.

### Nommage

| Élément | Convention | Exemple |
|---|---|---|
| Fichiers API | `kebab-case.type.ts` | `tasks.service.ts`, `update-task.dto.ts` |
| Fichiers composants React | `PascalCase.tsx` | `TaskCard.tsx` |
| Hooks | `useXxx.ts` | `useUpdateTask.ts` |
| Classes / types | `PascalCase` | `UpdateTaskDto` |
| Variables / fonctions | `camelCase` | `taskWhereEditable` |
| Tables / colonnes SQL | `snake_case` (via `@@map` / `@map`) | `project_members.user_id` |
| Enums | `UPPER_SNAKE_CASE` | `IN_PROGRESS` |
| Routes | pluriel, `kebab-case` | `/projects/:id/members` |

## 2. Backend

- **Controllers minces** : `@CurrentUser('id') userId` est toujours passé explicitement au service ;
  un service de ressource ne s'appelle jamais sans `userId`.
- **Une méthode de service = une intention métier** (`update`, `remove`, `addMember`…).
- **DTO** : un fichier par DTO, `class-validator` + `@ApiProperty`. `UpdateXxxDto` via
  `PartialType(CreateXxxDto)` en retirant les champs immuables (`OmitType`).
- **Sélection explicite** : chaque service définit un `select` constant (`taskSelect`) ; pas de
  retour d'entité Prisma brute.
- **Exceptions** : `NotFoundException`, `ConflictException`, `UnprocessableEntityException`,
  `UnauthorizedException`. `ForbiddenException` est **interdite** dans les modules de ressources.
- **Transactions** : `prisma.$transaction` pour toute opération multi-écritures.
- **Erreurs Prisma** traduites dans `AllExceptionsFilter` :

  | Code Prisma | HTTP |
  |---|---|
  | `P2025` (record not found) | 404 |
  | `P2002` (unique) | 409 |
  | `P2003` sur la FK `tasks_assignee_fkey` | 422 |
  | autre | 500 |

### Checklist de revue — autorisation (bloquante)

- [ ] Chaque requête sur `Task`, `Project`, `ProjectMember` utilise un constructeur de `*-access.ts`.
- [ ] Aucune vérification d'appartenance dans un `if` après lecture.
- [ ] Aucun `403` ; tout refus d'accès produit `404`.
- [ ] Les identifiants de rattachement (`projectId`, `userId`) viennent de l'URL ou du token, jamais d'un champ libre du body.
- [ ] Le `select` n'expose pas de champ sensible.
- [ ] Les tests de la matrice d'autorisation sont mis à jour si une route est ajoutée.

## 3. Frontend

- Organisation par fonctionnalité (`features/*`), composants génériques dans `components/ui`.
- Pas d'appel `fetch` direct dans les composants : passer par des hooks TanStack Query de la feature.
- Pas d'état global hors `AuthProvider` et cache TanStack Query.
- Classes Tailwind composées avec `cn()` (`clsx` + `tailwind-merge`) ; variantes de composants via
  un objet de variantes, pas de chaînes conditionnelles dispersées.
- Tout texte visible est en français.

## 4. Git

- Branche principale `main`, protégée (CI verte + 1 revue).
- Branches : `feat/…`, `fix/…`, `chore/…`, `docs/…`, `test/…`.
- Commits : **Conventional Commits** (`feat(tasks): add DONE deletion guard`).
- PR petites et ciblées ; une migration Prisma = une PR relue avec attention.
- Versionnage SemVer, tags `vX.Y.Z`, changelog généré depuis les commits.
