# Contrat de l'API REST

- Base : `/api/v1`
- Format : JSON (`Content-Type: application/json`), dates ISO 8601 UTC, identifiants UUID.
- Authentification : `Authorization: Bearer <accessToken>` sur toutes les routes sauf celles marquées 🌐.
- Les `:id` sont validés par `ParseUUIDPipe` (non-UUID → `400`).
- La spécification OpenAPI est générée depuis les DTO (`/api/docs` en dev).

## 1. Conventions

### Erreurs

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Ressource introuvable",
  "requestId": "a1b2c3…"
}
```

Erreurs de validation (`400`) : `message` est un tableau de `{ field, constraints[] }`.

| Code | Usage |
|---|---|
| 200 / 201 / 204 | Succès (lecture-modification / création / sans contenu) |
| 400 | Payload ou paramètres invalides, champ non autorisé |
| 401 | Non authentifié, token expiré, refresh invalide |
| 404 | Inexistant **ou** inaccessible pour cette action (voir [SECURITY.md §4](SECURITY.md#4-politique-404)) |
| 409 | Conflit (email déjà inscrit, membre déjà présent) |
| 422 | Règle métier violée par le **payload** (ex. assigné non membre du projet) |
| 429 | Trop de requêtes |
| 500 | Erreur interne (message générique) |

### Pagination

Query : `page` (≥ 1, défaut 1), `pageSize` (1–100, défaut 20).

```json
{ "data": [ … ], "meta": { "page": 1, "pageSize": 20, "total": 57 } }
```

### Contraintes de validation partagées

Le web (Zod) reproduit exactement ces règles.

| Champ | Contrainte |
|---|---|
| `email` | email valide, ≤ 254, normalisé `trim().toLowerCase()` |
| `password` | 8–128 caractères, ≥ 1 lettre et ≥ 1 chiffre |
| `name` (user) | 1–100 caractères après `trim` |
| `project.name` | 1–100 caractères après `trim` |
| `project.description` | ≤ 2000, optionnel |
| `task.title` | 1–200 caractères après `trim` |
| `task.description` | ≤ 5000, optionnel, texte brut |
| `task.status` | `TODO` \| `IN_PROGRESS` \| `DONE` |
| `task.priority` | `LOW` \| `MEDIUM` \| `HIGH` |
| `task.dueDate` | ISO 8601 ou `null` |
| `task.assigneeId` | UUID ou `null` |
| `member.role` (ajout/modif) | `ADMIN` \| `MEMBER` \| `VIEWER` (jamais `OWNER`) |

## 2. Auth — `/auth`

| Méthode | Route | | Body | Réponse |
|---|---|---|---|---|
| POST | `/auth/register` | 🌐 | `{ email, password, name }` | `201 { accessToken, user }` + cookie |
| POST | `/auth/login` | 🌐 | `{ email, password }` | `200 { accessToken, user }` + cookie |
| POST | `/auth/refresh` | 🌐 (cookie) | — | `200 { accessToken, user }` + nouveau cookie |
| POST | `/auth/logout` | 🌐 (cookie) | — | `204`, cookie effacé |
| POST | `/auth/logout-all` | 🔒 | — | `204`, cookie effacé |

- `register` crée dans une même transaction : l'utilisateur, son projet personnel, son adhésion `OWNER`.
- `register` : `409` si email déjà utilisé. `login` : `401 "Identifiants invalides"` dans tous les cas d'échec.
- `refresh` : `401` si cookie absent, inconnu, expiré, révoqué (+ révocation de la famille en cas de réutilisation).
- `logout` est idempotent (`204` même sans cookie valide).

Objet `user` :

```json
{ "id": "uuid", "email": "alice@demo.dev", "name": "Alice", "personalProjectId": "uuid", "createdAt": "…" }
```

## 3. Utilisateur — `/users/me`

| Méthode | Route | Body | Réponse |
|---|---|---|---|
| GET | `/users/me` | — | `200 user` |
| PATCH | `/users/me` | `{ name? }` | `200 user` |
| PATCH | `/users/me/password` | `{ currentPassword, newPassword }` | `204` ; révoque les autres sessions. `401` si `currentPassword` faux |

Pas de route `/users/:id` : on ne consulte jamais un autre utilisateur directement (seulement via les
membres d'un projet accessible).

## 4. Projets — `/projects`

| Méthode | Route | Rôle requis | Body | Réponse |
|---|---|---|---|---|
| GET | `/projects` | membre | — | `200 Project[]` (mes projets, avec `myRole`) |
| POST | `/projects` | — | `{ name, description? }` | `201 Project` (créateur = OWNER) |
| GET | `/projects/:id` | tous rôles | — | `200 Project` |
| PATCH | `/projects/:id` | OWNER, ADMIN | `{ name?, description? }` | `200 Project` |
| DELETE | `/projects/:id` | OWNER, non personnel | — | `204` |

Objet `Project` :

```json
{
  "id": "uuid",
  "name": "Site vitrine",
  "description": null,
  "isPersonal": false,
  "myRole": "ADMIN",
  "taskCounts": { "TODO": 4, "IN_PROGRESS": 2, "DONE": 9 },
  "memberCount": 3,
  "createdAt": "…", "updatedAt": "…"
}
```

`myRole` permet au web d'afficher/masquer les actions ; il ne remplace jamais le contrôle serveur.

### Membres — `/projects/:id/members`

| Méthode | Route | Rôle requis | Body | Réponse |
|---|---|---|---|---|
| GET | `/projects/:id/members` | tous rôles | — | `200 Member[]` |
| POST | `/projects/:id/members` | OWNER, ADMIN (OWNER pour ajouter un ADMIN) | `{ email, role }` | `201 Member` ; `409` déjà membre ; `404` email inconnu / projet personnel / droits insuffisants |
| PATCH | `/projects/:id/members/:userId` | OWNER, ADMIN (voir C5) | `{ role }` | `200 Member` |
| DELETE | `/projects/:id/members/:userId` | OWNER, ADMIN (voir C5) | — | `204` ; désassigne ses tâches |
| POST | `/projects/:id/leave` | ADMIN, MEMBER, VIEWER | — | `204` ; désassigne ses tâches |

```json
{ "userId": "uuid", "name": "Bob", "email": "bob@demo.dev", "role": "MEMBER", "joinedAt": "…" }
```

## 5. Tâches

| Méthode | Route | Rôle requis | Body / Query | Réponse |
|---|---|---|---|---|
| GET | `/projects/:projectId/tasks` | tous rôles | filtres ci-dessous | `200 Paginated<Task>` |
| POST | `/projects/:projectId/tasks` | OWNER, ADMIN, MEMBER | `CreateTaskDto` | `201 Task` |
| GET | `/tasks` | — | filtres + `assignedToMe=true` | `200 Paginated<Task>` (toutes mes tâches accessibles, tous projets) |
| GET | `/tasks/:id` | tous rôles | — | `200 Task` |
| PATCH | `/tasks/:id` | OWNER, ADMIN, MEMBER ; réouverture d'une tâche DONE : OWNER, ADMIN | `UpdateTaskDto` | `200 Task` |
| DELETE | `/tasks/:id` | OWNER, ADMIN, MEMBER ; tâche DONE : OWNER, ADMIN | — | `204` |

**Filtres** (query) : `status` (multiple : `status=TODO&status=IN_PROGRESS`), `priority`,
`assigneeId` (UUID ou `none`), `q` (recherche dans le titre, ≤ 100 car.), `dueBefore`, `dueAfter`,
`sort` ∈ `createdAt | dueDate | priority | updatedAt`, `order` ∈ `asc | desc`, `page`, `pageSize`.

**`CreateTaskDto`** : `{ title, description?, status?, priority?, dueDate?, assigneeId? }`

**`UpdateTaskDto`** : mêmes champs, tous optionnels. `projectId`, `creatorId`, `completedAt`, `id`
sont **refusés** (`400`, `forbidNonWhitelisted`).

Objet `Task` :

```json
{
  "id": "uuid",
  "projectId": "uuid",
  "projectName": "Site vitrine",
  "title": "Rédiger la page d'accueil",
  "description": "…",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "dueDate": "2026-10-20T00:00:00.000Z",
  "completedAt": null,
  "assignee": { "userId": "uuid", "name": "Bob" },
  "creator": { "userId": "uuid", "name": "Alice" },
  "createdAt": "…", "updatedAt": "…"
}
```

Erreurs spécifiques :

| Cas | Code |
|---|---|
| Tâche inexistante, projet non accessible, VIEWER qui écrit, MEMBER qui supprime/rouvre une tâche DONE | `404` |
| `assigneeId` non membre du projet (projet accessible en écriture) | `422` |

## 6. Tableau de bord — `/dashboard`

| Méthode | Route | Réponse |
|---|---|---|
| GET | `/dashboard` | `200 Dashboard` |

Calculé uniquement sur les tâches de **mes** projets (`taskWhereReadable`).

```json
{
  "counts": { "TODO": 12, "IN_PROGRESS": 5, "DONE": 31 },
  "overdue": 3,
  "dueSoon": [ /* Task[], échéance < 7 j, non DONE, max 5 */ ],
  "assignedToMe": [ /* Task[], non DONE, max 5, triées par échéance */ ],
  "recentlyCompleted": [ /* Task[], max 5 */ ],
  "projects": [ { "id": "uuid", "name": "…", "myRole": "OWNER", "progress": 0.64 } ]
}
```

## 7. Notifications — `/notifications` (post-MVP)

| Méthode | Route | Réponse |
|---|---|---|
| GET | `/notifications?unread=true` | `200 Paginated<Notification>` |
| GET | `/notifications/unread-count` | `200 { count }` |
| PATCH | `/notifications/:id/read` | `204` (`WHERE { id, userId }` → sinon 404) |
| POST | `/notifications/read-all` | `204` |

Événement prévu : `TASK_ASSIGNED` (à l'assigné, sauf s'il s'est assigné lui-même).

## 8. Santé 🌐

| Route | Réponse |
|---|---|
| `GET /health/live` | `200` si le processus tourne |
| `GET /health/ready` | `200` si la base répond (`SELECT 1`), sinon `503` |
