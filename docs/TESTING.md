# Stratégie de tests

## 1. Pyramide

| Niveau | Outils | Cible | Base de données |
|---|---|---|---|
| Unitaires API | Jest, `@nestjs/testing` | Constructeurs de `WHERE`, services (logique pure), filtres d'exception, AuthService (rotation) | Aucune (Prisma mocké uniquement pour la logique non-SQL) |
| Intégration / e2e API | Jest + Supertest | Toutes les routes, **matrice d'autorisation**, contraintes SQL | **PostgreSQL réel** (conteneur Docker dédié) |
| Unitaires / composants Web | Vitest, Testing Library, MSW | Formulaires, `ProtectedRoute`, `api-client` (refresh), `can()` | — (API simulée par MSW) |
| E2E navigateur | Playwright | Parcours critiques bout en bout | Stack complète (docker compose) |

> Les règles d'autorisation vivent dans le SQL : **elles ne se testent pas avec un Prisma mocké.**
> Toute la matrice (§4) tourne contre une vraie base.

## 2. Infrastructure de test API

- `docker-compose.test.yml` : PostgreSQL 16 sur un port dédié (`5433`), `tmpfs` pour la vitesse.
- Avant la suite : `prisma migrate deploy` sur la base de test (valide aussi les migrations).
- Isolation : `TRUNCATE … RESTART IDENTITY CASCADE` de toutes les tables entre chaque fichier de
  test ; les tests d'un fichier créent leurs propres données via `test/factories/`.
- Fabriques : `createUser()`, `createProject({ owner, members: [{ user, role }] })`,
  `createTask({ project, status, assignee })`, `loginAs(user)` → access token.
- Exécution séquentielle (`--runInBand`) pour les e2e.

## 3. Couverture attendue

| Périmètre | Seuil |
|---|---|
| `*-access.ts`, `auth.service.ts` | 100 % lignes et branches |
| Services API | ≥ 90 % |
| Global API | ≥ 80 % |
| Global Web | ≥ 70 % |

La CI échoue sous ces seuils.

## 4. Matrice d'autorisation (obligatoire)

Test **paramétré** (`describe.each`) : pour chaque rôle × action, on vérifie le code HTTP **et**
l'état de la base après coup (la ligne n'a pas changé en cas de refus).

Acteurs : `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`, `OUTSIDER` (authentifié, non membre).

### Tâches

| Action | OWNER | ADMIN | MEMBER | VIEWER | OUTSIDER |
|---|:-:|:-:|:-:|:-:|:-:|
| GET `/tasks/:id` | 200 | 200 | 200 | 200 | 404 |
| GET `/projects/:id/tasks` | 200 | 200 | 200 | 200 | 404 |
| POST `/projects/:id/tasks` | 201 | 201 | 201 | 404 | 404 |
| PATCH `/tasks/:id` (titre) | 200 | 200 | 200 | 404 | 404 |
| PATCH tâche DONE → TODO | 200 | 200 | 404 | 404 | 404 |
| PATCH tâche DONE (titre seul) | 200 | 200 | 200 | 404 | 404 |
| DELETE tâche TODO | 204 | 204 | 204 | 404 | 404 |
| DELETE tâche DONE | 204 | 204 | 404 | 404 | 404 |

### Projets et membres

| Action | OWNER | ADMIN | MEMBER | VIEWER | OUTSIDER |
|---|:-:|:-:|:-:|:-:|:-:|
| GET `/projects/:id` | 200 | 200 | 200 | 200 | 404 |
| PATCH `/projects/:id` | 200 | 200 | 404 | 404 | 404 |
| DELETE `/projects/:id` | 204 | 404 | 404 | 404 | 404 |
| POST member (role MEMBER) | 201 | 201 | 404 | 404 | 404 |
| POST member (role ADMIN) | 201 | 404 | 404 | 404 | 404 |
| DELETE member MEMBER | 204 | 204 | 404 | 404 | 404 |
| DELETE member ADMIN | 204 | 404 | 404 | 404 | 404 |
| DELETE member OWNER | 404 | 404 | 404 | 404 | 404 |
| PATCH role ADMIN → MEMBER | 200 | 404 | 404 | 404 | 404 |

### Cas transverses obligatoires

- [ ] **Indiscernabilité** : le corps et le code de la réponse pour une tâche d'autrui sont
      **strictement identiques** à ceux d'un UUID aléatoire inexistant.
- [ ] `GET /tasks`, `GET /projects`, `GET /dashboard` ne contiennent **aucune** donnée d'un projet
      dont l'utilisateur n'est pas membre (jeu de données avec plusieurs projets étrangers).
- [ ] Assigner une tâche à un utilisateur non membre → `422`, la tâche est inchangée.
- [ ] Assigner une tâche d'un projet étranger à soi-même → `404` (pas `422`).
- [ ] `PATCH /tasks/:id` avec `projectId` ou `creatorId` dans le body → `400`.
- [ ] Retirer un membre désassigne ses tâches ; les tâches restent dans le projet.
- [ ] Ajouter un membre au projet personnel → `404`. Supprimer le projet personnel → `404`.
- [ ] Changement de rôle effectif immédiatement (sans nouveau token).
- [ ] Aucune réponse de l'API ne contient la chaîne `passwordHash` ni `tokenHash`.
- [ ] Aucune route de ressource ne renvoie `403` (assertion globale sur toute la suite).

## 5. Authentification

- [ ] Register crée user + projet personnel + adhésion OWNER (atomique : échec partiel impossible).
- [ ] Register avec email en casse différente d'un compte existant → `409`.
- [ ] Login mauvais mot de passe et email inconnu → même code, même message.
- [ ] Access token expiré → `401` (horloge simulée).
- [ ] Access token signé avec un autre secret / `alg: none` → `401`.
- [ ] Refresh : renvoie un nouveau cookie, l'ancien token est révoqué en base.
- [ ] **Réutilisation** d'un refresh déjà utilisé → `401` **et** toute la famille révoquée.
- [ ] Deux refresh concurrents avec le même token → exactement un succès.
- [ ] Refresh expiré (> 30 j) → `401`.
- [ ] Logout révoque la famille ; logout-all révoque toutes les sessions.
- [ ] Changement de mot de passe révoque les autres sessions, pas la courante.
- [ ] Le cookie a bien `HttpOnly`, `Secure` (prod), `SameSite=Strict`, `Path=/api/v1/auth`.
- [ ] Throttling : 6e tentative de login en 1 min → `429`.
- [ ] Le refresh token n'apparaît jamais en clair en base.

## 6. Contraintes SQL

- [ ] Deux `OWNER` sur un même projet → violation de l'index unique partiel.
- [ ] `status = DONE` sans `completed_at` → violation du `CHECK`.
- [ ] Tâche avec `assignee_id` non membre → violation FK composite (insertion SQL directe).
- [ ] Supprimer un projet supprime tâches et membres sans erreur (FK `NO ACTION`).

## 7. Frontend

- `api-client` : sur `401`, un seul refresh pour N requêtes parallèles, puis rejeu ; refresh en échec → redirection `/login`.
- `ProtectedRoute` : `loading` → squelette, `anonymous` → redirection avec `from`, `authenticated` → contenu.
- Formulaires : messages Zod, réinjection des erreurs `400` serveur.
- `can()` : table de vérité identique à la matrice §4.
- Composants de tâches : pas de boutons d'édition pour `VIEWER`, suppression désactivée pour `MEMBER` sur `DONE`.

## 8. Playwright (parcours critiques)

1. Inscription → arrivée sur le tableau de bord → création d'une tâche dans « Mes tâches ».
2. Changement de statut par glisser-déposer → compteurs du tableau de bord mis à jour.
3. Alice crée un projet, ajoute Bob (MEMBER) et Carol (VIEWER) ; Carol ne voit aucune action d'édition ;
   Bob ne peut pas supprimer une tâche DONE.
4. Session : rechargement de page → toujours connecté ; logout → `/login`, retour arrière impossible.
5. Mobile (viewport 390×844) : navigation basse, création de tâche.

## 9. Commandes

```bash
npm test -w apps/api                 # unitaires API
npm run test:e2e -w apps/api         # intégration API (lance la base de test)
npm test -w apps/web                 # Vitest
npm run test:e2e -w apps/web         # Playwright
npm run test:cov                     # couverture, échoue sous les seuils
```
