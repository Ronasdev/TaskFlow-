# Architecture

## 1. Vue d'ensemble

```
┌──────────────┐
│  UTILISATEUR │
└──────┬───────┘
       │
┌──────▼──────────────────────┐
│  Frontend React (SPA, Vite) │
│  Dashboard · Tâches         │
│  Projets · Profil           │
└──────┬──────────────────────┘
       │ HTTPS (JSON, /api/v1)
       │  - Authorization: Bearer <access token>   (en mémoire)
       │  - Cookie httpOnly refresh_token          (/api/v1/auth uniquement)
┌──────▼──────────────────────┐
│  API NestJS                 │
│  Auth · Users · Projects    │
│  Tasks · Notifications      │
└──────┬──────────────────────┘
       │ Prisma Client (TCP, TLS en prod)
┌──────▼──────────────────────┐
│  PostgreSQL                 │
│  users · projects           │
│  project_members · tasks    │
│  refresh_tokens · notifs    │
└─────────────────────────────┘
```

- **Frontend** : SPA statique servie par un serveur web (Nginx) ou un CDN. Ne contient aucune logique
  d'autorisation fiable : elle masque des boutons pour l'ergonomie, l'API reste la seule autorité.
- **API** : stateless (hors table `refresh_tokens`), scalable horizontalement derrière un load balancer.
- **Base** : PostgreSQL unique, migrations versionnées par Prisma Migrate.

En production, Web et API sont servis **sous le même domaine** (`app.example.com` et
`app.example.com/api`) pour que le cookie de refresh soit first-party (`SameSite=Strict`) et éviter
les problèmes CORS. Voir [DEPLOYMENT.md](DEPLOYMENT.md).

## 2. Backend — organisation des dossiers

Organisation imposée (voir schéma de référence), complétée par le module `projects/`
(présent dans l'architecture globale) et `notifications/`.

```
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── auth/
│   │   ├── auth.controller.ts        # register, login, refresh, logout, logout-all
│   │   ├── auth.service.ts           # hash, émission/rotation/révocation des tokens
│   │   ├── auth.module.ts
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts     # guard global (APP_GUARD), contourné par @Public()
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts       # valide l'access token, expose { userId }
│   │   └── dto/                      # RegisterDto, LoginDto (class-validator)
│   ├── users/
│   │   ├── users.controller.ts       # GET/PATCH /users/me, PATCH /users/me/password
│   │   ├── users.service.ts
│   │   ├── users.module.ts
│   │   └── dto/
│   ├── projects/
│   │   ├── projects.controller.ts    # CRUD projets + gestion des membres
│   │   ├── projects.service.ts
│   │   ├── projects.module.ts
│   │   ├── project-access.ts         # constructeurs de WHERE (voir §4)
│   │   └── dto/
│   ├── tasks/
│   │   ├── tasks.controller.ts
│   │   ├── tasks.service.ts
│   │   ├── tasks.module.ts
│   │   ├── task-access.ts            # constructeurs de WHERE (voir §4)
│   │   └── dto/
│   ├── notifications/                # post-MVP
│   │   ├── notifications.controller.ts
│   │   ├── notifications.service.ts
│   │   └── notifications.module.ts
│   ├── dashboard/
│   │   ├── dashboard.controller.ts   # GET /dashboard (agrégats)
│   │   ├── dashboard.service.ts
│   │   └── dashboard.module.ts
│   ├── health/
│   │   └── health.controller.ts      # /health/live, /health/ready
│   ├── common/
│   │   ├── decorators/               # @CurrentUser(), @Public()
│   │   ├── filters/                  # AllExceptionsFilter (HTTP + erreurs Prisma)
│   │   └── utils/                    # ValidationPipe, transformations (trim, email)
│   ├── config/
│   │   └── env.ts                    # schéma Zod des variables d'environnement
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts         # PrismaClient + hooks de cycle de vie
│   ├── app.module.ts
│   ├── app.setup.ts                  # helmet, CORS, cookies, ValidationPipe, préfixe /api/v1 (partagé avec les tests e2e)
│   └── main.ts                       # bootstrap, logger pino, Swagger
└── test/
    ├── e2e/                          # Supertest sur base réelle
    └── factories/                    # fabriques de données de test
```

### Responsabilités par couche

| Couche | Fait | Ne fait pas |
|---|---|---|
| **Controller** | Routage, extraction de `@CurrentUser()`, validation des DTO (pipe global), code HTTP | Aucune logique métier, aucun accès Prisma |
| **Service** | Règles métier, construction des `WHERE` d'accès, transactions | Ne connaît pas HTTP (lève des exceptions Nest standard) |
| **`*-access.ts`** | Fonctions pures qui retournent des `Prisma.*WhereInput` d'autorisation | Aucun I/O |
| **PrismaService** | Connexion, cycle de vie | Aucune règle |
| **Filters** | Traduire `P2025` → 404, `P2002` → 409, FK assignée → 422, erreurs inconnues → 500 sans fuite | — |

Pas de couche « repository » supplémentaire : Prisma joue ce rôle. Les services appellent Prisma
directement, mais **uniquement** avec des `WHERE` produits par les fonctions `*-access.ts`.

## 3. Modules NestJS et dépendances

```
AppModule
├── ConfigModule (global, validé par Zod)
├── PrismaModule (global)
├── ThrottlerModule
├── AuthModule ──────▶ UsersModule
├── UsersModule
├── ProjectsModule
├── TasksModule ─────▶ NotificationsModule (post-MVP)
├── DashboardModule
├── NotificationsModule
└── HealthModule
```

Guards globaux (dans l'ordre) : `ThrottlerGuard` → `JwtAuthGuard`.
Toute route est **protégée par défaut** ; seules les routes décorées `@Public()` y échappent
(`register`, `login`, `refresh`, `health`).

## 4. Flux d'une modification de tâche

Chaîne de contrôle exigée : *authentifié → tâche existe → membre du projet → rôle nécessaire →
modification autorisée → on modifie.*

```
PATCH /api/v1/tasks/:id  { status: "DONE" }
│
├─ 1. JwtAuthGuard           → access token valide ? sinon 401
├─ 2. ValidationPipe         → body conforme à UpdateTaskDto ? sinon 400
├─ 3. TasksService.update(userId, id, dto)
│     │
│     ├─ 3a. Règles dépendant du payload (ex. assigneeId) → vérifiées DANS la transaction
│     │
│     └─ 3b. prisma.task.update({
│              where: {
│                id,                                   ← la tâche existe
│                project: { members: { some: {
│                  userId,                             ← l'utilisateur appartient au projet
│                  role: { in: ['OWNER','ADMIN','MEMBER'] }  ← il a le rôle nécessaire
│                }}},
│                ...règles d'état                      ← la modification est autorisée
│              },
│              data: dto,
│            })
│
├─ 4. Aucune ligne ne correspond → Prisma lève P2025 → AllExceptionsFilter → 404
└─ 5. Succès → 200 + tâche mise à jour
```

Les étapes « existe / membre / rôle / règle d'état » sont **une seule requête atomique** : il n'existe
aucune fenêtre entre la vérification et l'écriture (pas de TOCTOU), et aucune donnée non autorisée
n'est lue. Voir [SECURITY.md §3](SECURITY.md#3-autorisation--la-propriété-est-dans-le-where).

## 5. Frontend — organisation des dossiers

```
apps/web/src/
├── main.tsx
├── app/
│   ├── router.tsx              # définition des routes (publiques / protégées)
│   ├── providers.tsx           # QueryClientProvider, AuthProvider, ThemeProvider
│   └── layouts/
│       ├── AppLayout.tsx       # sidebar + topbar (zone protégée)
│       └── AuthLayout.tsx      # pages login/register
├── features/
│   ├── auth/                   # pages, hooks (useLogin…), schémas Zod, AuthProvider, ProtectedRoute
│   ├── dashboard/
│   ├── projects/
│   ├── tasks/
│   ├── profile/
│   └── notifications/
├── components/ui/              # Button, Input, Select, Dialog, Badge, Card, Toast, Skeleton…
├── lib/
│   ├── api-client.ts           # fetch + Bearer + refresh automatique sur 401
│   ├── query-keys.ts
│   └── utils.ts
├── types/                      # types des réponses API
└── styles/index.css            # Tailwind
```

Organisation **par fonctionnalité** : chaque dossier `features/x` contient ses pages, composants,
hooks TanStack Query et schémas Zod. Détails : [FRONTEND.md](FRONTEND.md).

## 6. Flux d'authentification

```
Login
  Web ──POST /auth/login {email,password}──▶ API
  Web ◀── 200 { accessToken, user } + Set-Cookie: refresh_token (httpOnly, 30 j) ──

Appel API
  Web ──GET /tasks  Authorization: Bearer <access>──▶ API

Access expiré (15 min)
  Web ──GET /tasks──▶ 401
  Web ──POST /auth/refresh (cookie)──▶ API : vérifie hash en base, révoque l'ancien, émet un nouveau
  Web ◀── 200 { accessToken } + nouveau cookie ──
  Web ──rejoue GET /tasks──▶ 200

Rechargement de page
  Web (pas d'access en mémoire) ──POST /auth/refresh──▶ session restaurée ou redirection /login
```

Détails (rotation, détection de réutilisation, révocation) : [SECURITY.md §2](SECURITY.md#2-authentification).

## 7. Choix structurants

Résumé ; justification complète dans [DECISIONS.md](DECISIONS.md).

- **Monorepo npm workspaces** (`apps/api`, `apps/web`) : un seul dépôt, une seule CI.
- **Toute tâche appartient à un projet.** Un projet personnel est créé à l'inscription ; « mes tâches
  perso » = tâches de ce projet. Une seule logique d'autorisation pour tout.
- **Modèle d'adhésion `ProjectMember`** (variante 2 du schéma de modèle) porteur du rôle.
- **API REST versionnée** `/api/v1`.
- **Pas de cache serveur / Redis au MVP** : PostgreSQL suffit (y compris pour les refresh tokens).
