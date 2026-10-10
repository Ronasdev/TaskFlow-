# Plan d'implémentation

> **État (2026-10-10)** : phases 0 à 5 livrées — MVP complet, testé et conteneurisé.
> Les points de la phase 6 restent à planifier.

Chaque phase se termine par une PR verte (lint, typecheck, tests) et respecte la
[définition de « terminé »](#définition-de-terminé).

## Phase 0 — Socle (monorepo et outillage)

- [x] `package.json` racine avec workspaces `apps/api`, `apps/web` ; scripts `dev`, `build`, `lint`, `typecheck`, `test`
- [x] TypeScript strict, ESLint (flat config), Prettier, `.editorconfig`, `.gitignore`, `.nvmrc` (22)
- [x] `docker-compose.yml` (PostgreSQL 16) et `docker-compose.test.yml`
- [x] Squelette NestJS : `main.ts` (helmet, CORS, cookie-parser, ValidationPipe, préfixe `/api/v1`, shutdown hooks), config Zod, logs pino, `/health`
- [x] Squelette Vite + React + Tailwind v4 + Router + TanStack Query
- [x] CI GitHub Actions (lint, typecheck, tests)

## Phase 1 — Données

- [x] `schema.prisma` conforme à [DATA_MODEL.md](DATA_MODEL.md)
- [x] Migration initiale + contraintes SQL manuelles (owner unique, `CHECK`)
- [x] `PrismaService`, `AllExceptionsFilter`
- [x] Fabriques de test, tests des contraintes SQL
- [x] Seed de démo

## Phase 2 — Authentification (API)

- [x] `register` (transaction user + projet personnel + OWNER), `login`, `refresh` (rotation, réutilisation), `logout`, `logout-all`
- [x] `JwtStrategy`, `JwtAuthGuard` global, `@Public()`, `@CurrentUser()`
- [x] Throttling des routes d'auth
- [x] `users/me` (GET, PATCH, mot de passe)
- [x] Tests §5 de [TESTING.md](TESTING.md)

## Phase 3 — Projets, membres, tâches (API)

- [x] `project-access.ts`, `task-access.ts` + tests unitaires 100 %
- [x] Projets : CRUD
- [x] Membres : liste, ajout, changement de rôle, retrait (avec désassignation), quitter
- [x] Tâches : liste filtrée/paginée par projet, `/tasks` global, détail, création, modification, suppression
- [x] Dashboard
- [x] **Matrice d'autorisation complète** (§4 de TESTING.md) + cas transverses
- [x] Swagger

## Phase 4 — Frontend

- [x] Design system `components/ui`, thème clair/sombre, layouts (sidebar / navigation mobile)
- [x] `api-client` avec refresh partagé, `AuthProvider`, `ProtectedRoute`, `PublicOnlyRoute`
- [x] Pages login / register
- [x] Tableau de bord
- [x] Projets : liste, création, paramètres, membres
- [x] Tâches : liste + filtres, Kanban (glisser-déposer + alternative clavier), panneau d'édition
- [x] Profil
- [x] Affichage selon `myRole` (`can()`)
- [x] Tests Vitest

## Phase 5 — Production

- [x] Dockerfiles API et Web (Nginx, CSP), `docker-compose.prod.yml`, job `migrate`
- [x] Purge planifiée des refresh tokens
- [x] Playwright (parcours §8 de TESTING.md) en CI
- [x] `npm audit`, Dependabot
- [x] Checklist [DEPLOYMENT.md §7](DEPLOYMENT.md#7-checklist-de-mise-en-production)

## Phase 6 — Après MVP

- Notifications in-app (`TASK_ASSIGNED`), compteur non lus
- Invitations par email, transfert de propriété, suppression de compte
- Commentaires sur les tâches, pièces jointes
- OAuth (Google, GitHub)
- Temps réel (WebSocket / SSE)

## Définition de « terminé »

- Le code respecte [CONVENTIONS.md](CONVENTIONS.md) et la checklist d'autorisation.
- Tests écrits et verts, seuils de couverture respectés.
- Aucun `403`, aucune requête de ressource sans constructeur d'accès.
- États chargement / vide / erreur présents sur chaque écran.
- Documentation mise à jour si le contrat d'API ou le modèle change.
