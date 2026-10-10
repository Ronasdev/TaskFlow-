# Sécurité

## 1. Modèle de menace (résumé)

| Menace | Contre-mesure principale |
|---|---|
| Accès aux données d'un autre utilisateur (IDOR) | Filtre d'appartenance dans **chaque** `WHERE` (§3), UUID non devinables |
| Énumération de ressources | `404` uniforme (§4) |
| Escalade de rôle dans un projet | Rôle requis dans le `WHERE`, règles OWNER/ADMIN (§3.5) |
| Vol d'access token (XSS) | Token en mémoire uniquement, durée 15 min, CSP stricte |
| Vol de refresh token | Cookie `httpOnly` + `Secure` + `SameSite=Strict`, rotation, détection de réutilisation, hash en base |
| Force brute login | Limitation de débit, argon2id, message d'erreur générique |
| Injection SQL | Prisma paramétré ; `$queryRawUnsafe` interdit |
| Mass assignment | `whitelist` + `forbidNonWhitelisted` ; `projectId`, `creatorId`, `role` jamais pris du body hors DTO dédiés |
| Fuite d'informations | Filtre d'exceptions global, aucun stack trace en prod, logs expurgés |

## 2. Authentification

### 2.1 Mots de passe

- Hash **argon2id** (paramètres par défaut de la lib `argon2`, ajustés si besoin à ~50 ms/hash en prod).
- Politique : 8 à 128 caractères (la borne haute évite le DoS par hash), au moins une lettre et un chiffre.
- Login : message unique `Identifiants invalides` que l'email existe ou non. Si l'utilisateur n'existe
  pas, on vérifie quand même un **hash factice** pour que le temps de réponse soit identique.
- Inscription : `409` si l'email est déjà pris (compromis accepté, atténué par la limitation de débit).

### 2.2 Access token (JWT)

| Propriété | Valeur |
|---|---|
| Algorithme | HS256, secret ≥ 32 octets aléatoires (`JWT_ACCESS_SECRET`) |
| Durée | **15 minutes** (`JWT_ACCESS_TTL=15m`) |
| Claims | `sub` (userId), `sid` (identifiant de session = famille de refresh tokens), `iat`, `exp`, `iss`, `aud` — **pas** de rôle, **pas** d'email |
| Transport | En-tête `Authorization: Bearer …` |
| Stockage côté web | **Mémoire uniquement** (variable du module `api-client`), jamais `localStorage` |

Les rôles ne sont pas dans le token : ils dépendent du projet et sont lus en base à chaque requête,
dans le `WHERE`. Un changement de rôle est donc effectif immédiatement.

### 2.3 Refresh token

| Propriété | Valeur |
|---|---|
| Format | Opaque : 32 octets aléatoires (`crypto.randomBytes`) encodés base64url — **pas** un JWT |
| Stockage en base | `SHA-256(token)` dans `refresh_tokens.token_hash` ; le token clair n'est jamais persisté |
| Durée | **30 jours** glissants (chaque rotation émet un token valable 30 j) |
| Transport | Cookie `refresh_token` : `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=2592000` |
| Révocable | Oui : `revoked_at` en base |

**Rotation à chaque utilisation** (`POST /auth/refresh`) :

```
1. Lire le cookie ; absent → 401
2. Chercher la ligne par token_hash
   - introuvable           → 401
   - expirée               → 401
   - déjà révoquée         → RÉUTILISATION DÉTECTÉE :
                              révoquer toute la famille (familyId), logger un événement de sécurité, 401
3. Transaction :
   - updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } })
     count = 0 → un refresh concurrent a gagné → 401
   - créer un nouveau token (même familyId), lier replacedById
4. Émettre un nouvel access token + nouveau cookie
```

Le web sérialise les refresh (une seule promesse en vol) pour ne pas se déclencher lui-même la
détection de réutilisation lors d'appels parallèles.

**Révocation** :

| Événement | Effet |
|---|---|
| `POST /auth/logout` | Révoque la famille du cookie courant, efface le cookie |
| `POST /auth/logout-all` | Révoque tous les refresh tokens de l'utilisateur |
| Changement de mot de passe | Révoque tous les refresh tokens **sauf** la famille courante |
| Réutilisation détectée | Révoque la famille concernée |

> Limite assumée : un access token déjà émis reste valide jusqu'à son expiration (≤ 15 min) après
> révocation. C'est le compromis standard du couple JWT court + refresh révocable.

**Purge** : une tâche planifiée (`@nestjs/schedule`, quotidienne) supprime les tokens expirés ou
révoqués depuis plus de 7 jours.

### 2.4 CSRF

Seules les routes `/api/v1/auth/*` reçoivent le cookie (attribut `Path`). Protections :
`SameSite=Strict`, vérification de l'en-tête `Origin` contre `CORS_ORIGINS` sur ces routes, et la
réponse de `/auth/refresh` (le nouvel access token) n'est pas lisible cross-origin (CORS restrictif).
Toutes les autres routes s'authentifient par en-tête `Authorization`, non envoyé automatiquement par
le navigateur.

## 3. Autorisation : la propriété est dans le `WHERE`

### 3.1 La règle

> **Interdit** : lire une ressource, puis vérifier dans un `if` qu'elle appartient à l'utilisateur.
>
> **Obligatoire** : la condition d'appartenance (et de rôle, et d'état si nécessaire) fait partie du
> `WHERE` de la requête qui lit, modifie ou supprime.

```ts
// ❌ INTERDIT
const task = await prisma.task.findUnique({ where: { id }, include: { project: { include: { members: true } } } });
if (!task.project.members.some(m => m.userId === userId)) throw new ForbiddenException();
await prisma.task.update({ where: { id }, data });

// ✅ OBLIGATOIRE
await prisma.task.update({
  where: { id, AND: [taskWhereEditable(userId)] },   // aucune ligne → P2025 → 404
  data,
});
```

Pourquoi : (1) une donnée non autorisée n'est jamais chargée, donc ne peut pas fuiter par erreur
(log, sérialisation, `include` oublié) ; (2) vérification et écriture sont **atomiques** (pas de
TOCTOU) ; (3) un oubli de `if` n'est plus possible : sans le `WHERE` d'accès, la requête ne compile
pas dans la revue (voir §3.6).

### 3.2 Constructeurs de `WHERE` (fonctions pures)

Centralisés dans `projects/project-access.ts` et `tasks/task-access.ts`. **Aucune** requête Prisma
sur `Project`, `ProjectMember` ou `Task` ne doit être écrite sans eux.

```ts
// Rôles
export const ALL_ROLES  = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;
export const EDITORS    = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export const MANAGERS   = ['OWNER', 'ADMIN'] as const;

// project-access.ts
export const memberWith = (userId: string, roles: readonly ProjectRole[]) =>
  ({ members: { some: { userId, role: { in: [...roles] } } } }) satisfies Prisma.ProjectWhereInput;

export const projectWhereReadable  = (userId: string) => memberWith(userId, ALL_ROLES);
export const projectWhereManageable = (userId: string) => memberWith(userId, MANAGERS);
export const projectWhereOwned     = (userId: string) => memberWith(userId, ['OWNER']);

// task-access.ts
export const taskWhereReadable = (userId: string): Prisma.TaskWhereInput =>
  ({ project: memberWith(userId, ALL_ROLES) });

export const taskWhereEditable = (userId: string): Prisma.TaskWhereInput =>
  ({ project: memberWith(userId, EDITORS) });

// Une tâche DONE n'est supprimable (R5) ni réouvrable (C12) que par OWNER/ADMIN ;
// une tâche non DONE l'est par tout EDITOR.
export const taskWhereDoneGuarded = (userId: string): Prisma.TaskWhereInput => ({
  OR: [
    { status: { not: 'DONE' }, project: memberWith(userId, EDITORS) },
    { project: memberWith(userId, MANAGERS) },
  ],
});
export const taskWhereDeletable  = taskWhereDoneGuarded;
export const taskWhereReopenable = taskWhereDoneGuarded;
```

### 3.3 Patrons par opération

| Opération | Patron Prisma | Aucune ligne → |
|---|---|---|
| Lire un élément | `findFirst({ where: { id, ...readable(userId) } })` ; `null` → `NotFoundException` | 404 |
| Lister | `findMany({ where: { ...readable(userId), ...filtres } })` | `[]` |
| Modifier | `update({ where: { id, AND: [editable(userId)] } })` (`extendedWhereUnique`) | P2025 → 404 |
| Supprimer | `delete({ where: { id, AND: [deletable(userId)] } })` | P2025 → 404 |

> Sur un `WhereUniqueInput`, le filtre d'accès passe par `AND: [...]` : l'étaler (`...`) entrerait en
> conflit de type avec le champ unique `id`. Sur `findFirst` / `findMany`, l'étalement suffit.
| Créer dans un projet | `findFirst` du projet avec `memberWith(userId, EDITORS)` dans une transaction, puis `create` | 404 |

> Le test `if (!row) throw NotFound` après un `findFirst` filtré est autorisé : il teste l'**absence**
> d'une ligne déjà filtrée par le `WHERE`, il ne vérifie pas la propriété.

### 3.4 Exemple complet : modification d'une tâche (chaîne R7)

```ts
async update(userId: string, taskId: string, dto: UpdateTaskDto) {
  const reopening = dto.status !== undefined && dto.status !== 'DONE';

  return this.prisma.task.update({
    where: {
      id: taskId,                                             // la tâche existe
      AND: [
        taskWhereEditable(userId),                            // membre + rôle EDITOR
        ...(reopening ? [taskWhereReopenable(userId)] : []),  // règle d'état (C12)
      ],
    },
    data: {
      ...dto,                                                 // DTO whitelisté, sans projectId/creatorId
      ...(dto.status && { completedAt: dto.status === 'DONE' ? new Date() : null }),
    },
  });
  // P2025 → 404 (tâche inexistante, pas membre, VIEWER, MEMBER qui rouvre)
  // P2003 sur la FK assignee → 422 « l'assigné doit être membre du projet » (R6)
}
```

Note sur R6 : la FK composite `(project_id, assignee_id) → project_members` n'est évaluée que si le
`WHERE` a matché une ligne. Un non-membre obtient donc toujours `404`, jamais `422` — aucune fuite.

> `completedAt` : le web n'envoie `status` que s'il change. Si l'API reçoit `DONE` pour une tâche
> déjà `DONE`, `completedAt` est réécrit à l'instant courant — comportement accepté (une seule requête,
> pas de lecture préalable).

### 3.5 Exemple : retrait d'un membre (R4, C4, C5, C7)

```ts
async removeMember(actorId: string, projectId: string, targetUserId: string) {
  const where: Prisma.ProjectMemberWhereUniqueInput = {
    projectId_userId: { projectId, userId: targetUserId },
    project: { personalForUserId: null },                          // C2
    OR: [
      { role: { in: ['MEMBER', 'VIEWER'] }, project: memberWith(actorId, MANAGERS) },
      { role: 'ADMIN',                      project: memberWith(actorId, ['OWNER']) }, // C5
    ],                                                             // OWNER jamais ciblable (C4)
  };

  await this.prisma.$transaction([
    // C7 : désassigner d'abord (sinon la FK composite bloque) — même filtre d'autorisation
    this.prisma.task.updateMany({
      where: { projectId, assigneeId: targetUserId, project: memberWith(actorId, MANAGERS) },
      data: { assigneeId: null },
    }),
    this.prisma.projectMember.delete({ where }),                   // P2025 → 404, rollback
  ]);
}
```

### 3.6 Garde-fous

- **Revue de code** : toute requête `prisma.task.*`, `prisma.project.*`, `prisma.projectMember.*` sans
  constructeur d'accès est un refus de PR (checklist dans [CONVENTIONS.md](CONVENTIONS.md)).
- **Lint** : règle ESLint `no-restricted-syntax` interdisant `ForbiddenException` dans `src/` (hors auth)
  et `$queryRawUnsafe` / `$executeRawUnsafe` partout.
- **Tests** : la matrice complète rôle × action est testée en e2e contre une vraie base
  ([TESTING.md §4](TESTING.md#4-matrice-dautorisation-obligatoire)).

## 4. Politique 404

- Toute ressource inaccessible **pour l'action demandée** répond `404` avec un corps identique à celui
  d'une ressource réellement inexistante :
  `{ "statusCode": 404, "error": "Not Found", "message": "Ressource introuvable" }`.
- Le message ne nomme jamais la cause (pas « vous n'êtes pas membre »).
- Les `id` invalides (non-UUID) répondent `400` via `ParseUUIDPipe` — ce qui ne révèle rien.
- `403` n'est **jamais** utilisé par les routes de ressources.
- Les temps de réponse sont homogènes : une seule requête dans tous les cas.

## 5. Durcissement HTTP et applicatif

| Élément | Configuration |
|---|---|
| `helmet` | Activé (HSTS, noSniff, frameguard…) |
| CORS | `origin` = liste `CORS_ORIGINS`, `credentials: true`, jamais `*` |
| Taille du body | `100kb` max |
| Throttling | Global `THROTTLE_GLOBAL_LIMIT` (100) req/min/IP ; `login` 5/min/IP ; `register` 3/min/IP ; `refresh` 30/min/IP. Les limites d'auth sont multipliées par `THROTTLE_AUTH_MULTIPLIER` (1 en production, relevé uniquement pour les tests E2E) |
| `trust proxy` | Activé en prod (1 saut) pour l'IP réelle derrière le reverse proxy |
| Erreurs | `AllExceptionsFilter` : 500 générique, détail uniquement dans les logs |
| Logs | pino, `redact` sur `req.headers.authorization`, `req.headers.cookie`, `*.password`, `*.passwordHash`, `*.token` |
| Sérialisation | Les services retournent des `select` explicites : `passwordHash` n'est jamais sélectionné hors auth |
| Swagger | Désactivé en prod (`ENABLE_SWAGGER=false`) |
| Dépendances | `npm audit --audit-level=high` en CI, Dependabot |
| Secrets | Uniquement via variables d'environnement, validées au boot ; jamais commités |

### Frontend

- Access token en mémoire ; rechargement de page → `POST /auth/refresh`.
- CSP servie par Nginx (`apps/web/nginx/security-headers.conf`) : `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'`.
  `'unsafe-inline'` est limité aux **styles** (la bibliothèque de toasts injecte une feuille de style) ; aucun script inline n'est autorisé — le script d'initialisation du thème est un fichier externe.
- Aucun `dangerouslySetInnerHTML` ; les descriptions de tâches sont rendues en texte brut.
- Les gardes de routes côté web sont de l'**ergonomie**, pas de la sécurité.
