# TaskFlow — SaaS de gestion de tâches

> **Statut : MVP implémenté.** API, frontend, tests (unitaires, intégration sur PostgreSQL réel, E2E
> Playwright), images Docker et CI. Toute évolution doit respecter les documents de `docs/`.

TaskFlow est une application SaaS de gestion de tâches multi-utilisateurs. Chaque utilisateur gère
ses tâches dans des **projets** ; il ne voit **que** les projets auxquels il appartient et les tâches
de ces projets. Les droits dans un projet dépendent du **rôle** (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`).

---

## Fonctionnalités (MVP)

| Domaine | Fonctionnalités |
|---|---|
| Authentification | Inscription, connexion, déconnexion, JWT d'accès (15 min) + refresh token (30 j) révocable en base, rotation des refresh tokens |
| Projets | Création, liste de « mes projets », renommage, suppression (OWNER) ; projet personnel créé automatiquement à l'inscription |
| Membres | Ajout / retrait / changement de rôle (OWNER ou ADMIN uniquement) |
| Tâches | Création, modification, suppression, statut (`TODO`, `IN_PROGRESS`, `DONE`), priorité, échéance, assignation |
| Tableau de bord | Compteurs par statut, tâches en retard, tâches qui me sont assignées, échéances proches |
| Profil | Consultation et modification du profil, changement de mot de passe, déconnexion de toutes les sessions |
| Notifications | Notification in-app lors d'une assignation (post-MVP, voir [ROADMAP](docs/ROADMAP.md)) |
| UI | Interface adaptative (mobile → desktop), moderne, thème clair/sombre, routes protégées |

## Stack

| Couche | Technologies |
|---|---|
| Frontend | React · Vite · TypeScript · Tailwind CSS · React Router · TanStack Query · React Hook Form · **Zod** |
| Backend | NestJS · TypeScript · Passport JWT · **class-validator** / class-transformer |
| Base de données | PostgreSQL 16 · Prisma ORM |
| Tests | Jest + Supertest (API) · Vitest + Testing Library + MSW (web) · Playwright (E2E) |
| Ops | Docker · docker compose · GitHub Actions |

Détails et justification : [docs/STACK.md](docs/STACK.md).

## Architecture en un coup d'œil

```
Utilisateur ──▶ React (Vite, SPA) ──HTTPS──▶ API NestJS ──▶ PostgreSQL (Prisma)
                Dashboard / Tâches           Auth / Users / Projects
                Projets / Profil             Tasks / Notifications
```

Détails : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Les 3 principes de sécurité non négociables

1. **La propriété est dans le `WHERE`, jamais dans un `if` après lecture.**
   Chaque requête Prisma qui lit, modifie ou supprime une ressource inclut le filtre d'appartenance
   (membre du projet + rôle requis). Une ressource qui ne passe pas le filtre n'est jamais chargée en mémoire.
2. **Ce qui n'est pas à moi n'existe pas → `404`, jamais `403`.**
   Aucune réponse ne permet de deviner l'existence d'une ressource d'un autre utilisateur.
3. **Chaîne de contrôle d'une modification** : utilisateur authentifié ? → la tâche existe ? →
   l'utilisateur appartient au projet ? → il a le rôle nécessaire ? → la modification est autorisée
   (règles métier) ? → on modifie. Les étapes 2 à 4 sont évaluées **en une seule requête** SQL.

Détails : [docs/SECURITY.md](docs/SECURITY.md) et [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md).

## Structure du dépôt

```
.
├── apps/
│   ├── api/            # NestJS + Prisma
│   └── web/            # React + Vite + Tailwind
├── docs/               # Documentation de conception (ce que vous lisez)
├── docker-compose.yml          # Dev : PostgreSQL
├── docker-compose.test.yml     # Tests : PostgreSQL éphémère
├── docker-compose.prod.yml     # Prod
├── .github/workflows/ci.yml
├── package.json        # npm workspaces
└── README.md
```

## Démarrage rapide

Prérequis : Node.js 22 LTS, npm 10+, Docker.

```bash
# 1. Dépendances (génère aussi le client Prisma)
npm install
npm run db:generate -w apps/api

# 2. Variables d'environnement (puis remplacer JWT_ACCESS_SECRET)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. Base de données (PostgreSQL sur le port 5434)
npm run db:up
npm run db:deploy -w apps/api
npm run db:seed -w apps/api        # optionnel : alice@demo.dev / bob@demo.dev / carol@demo.dev, mot de passe Password123!

# 4. Lancer
npm run dev                        # API sur :3000 (Swagger : /api/v1/docs), Web sur http://localhost:5173
```

En développement, Vite relaie `/api` vers l'API : web et API partagent la même origine, comme en production.

### Tests

```bash
npm run db:test:up                 # PostgreSQL de test (port 5433, en mémoire)
npm test                           # unitaires API + Web
npm run test:e2e -w apps/api       # intégration API (matrice d'autorisation complète)
npm run test:e2e -w apps/web       # Playwright (stack démarrée ; E2E_BASE_URL pour cibler la prod locale)
```

### Production

```bash
cp .env.prod.example .env.prod     # renseigner les secrets
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build --wait
```

Détails : [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Scripts prévus (racine)

| Script | Rôle |
|---|---|
| `npm run dev` | Lance API et Web en parallèle |
| `npm run build` | Build de production des deux apps |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` sur tout le monorepo |
| `npm test` | Tests unitaires API + Web |
| `npm run test:e2e` | Tests d'intégration API (base réelle) + Playwright |
| `npm run db:up` / `npm run db:test:up` | Démarre la base de dev / de test |

## Documentation

| Document | Contenu |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Vue d'ensemble, couches, organisation du backend et du frontend, flux de requêtes |
| [STACK.md](docs/STACK.md) | Choix techniques, versions, bibliothèques, où s'applique class-validator vs Zod |
| [DATA_MODEL.md](docs/DATA_MODEL.md) | Modèle de données, schéma Prisma cible, index, contraintes |
| [BUSINESS_RULES.md](docs/BUSINESS_RULES.md) | Règles métier, matrice des permissions par rôle |
| [SECURITY.md](docs/SECURITY.md) | JWT + refresh tokens, autorisation par `WHERE`, politique 404, durcissement |
| [API.md](docs/API.md) | Contrat de l'API REST : routes, payloads, codes de retour |
| [FRONTEND.md](docs/FRONTEND.md) | Pages, routes protégées, gestion de session, design system |
| [TESTING.md](docs/TESTING.md) | Stratégie de tests, matrice d'autorisation à couvrir |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Variables d'environnement, Docker, CI/CD, mise en production |
| [CONVENTIONS.md](docs/CONVENTIONS.md) | Conventions de code, nommage, Git, format des erreurs |
| [DECISIONS.md](docs/DECISIONS.md) | Décisions d'architecture (ADR) et points ouverts |
| [ROADMAP.md](docs/ROADMAP.md) | Plan d'implémentation par phases et critères de « terminé » |

## Licence

À définir.
