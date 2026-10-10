# Stack technique

Versions indicatives à figer dans les `package.json` au démarrage de l'implémentation
(dernières versions stables au moment du `npm install`, majeures ci-dessous).

## 1. Socle

| Outil | Version | Rôle |
|---|---|---|
| Node.js | 22 LTS | Runtime API, outillage |
| npm | 10+ | Gestionnaire de paquets, **workspaces** |
| TypeScript | 5.x, `strict: true` | Langage des deux apps |
| ESLint (flat config) + Prettier | 9.x / 3.x | Lint et formatage |
| Docker / docker compose | récent | Base locale, images de prod |

## 2. Backend — `apps/api`

| Bibliothèque | Rôle |
|---|---|
| `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` (v11) | Framework |
| `@nestjs/config` | Chargement de la config, **validée par Zod** au démarrage |
| `@nestjs/passport`, `passport-jwt` | Stratégie JWT (access token) |
| `@nestjs/jwt` | Signature / vérification des access tokens |
| `argon2` | Hash des mots de passe (argon2id) |
| `class-validator`, `class-transformer` | Validation des DTO entrants |
| `prisma`, `@prisma/client` (v6) | ORM, migrations |
| `@nestjs/throttler` | Limitation de débit (login, register, refresh) |
| `helmet` | En-têtes HTTP de sécurité |
| `cookie-parser` | Lecture du cookie de refresh |
| `nestjs-pino`, `pino-http` | Logs JSON structurés, `requestId` |
| `@nestjs/schedule` (v6) | Purge quotidienne des refresh tokens. La v12 est publiée en ESM pur, incompatible avec Jest en CommonJS |
| `@nestjs/swagger` | Documentation OpenAPI générée depuis les DTO (`/api/docs`, désactivé en prod par défaut) |
| `zod` | Validation de l'environnement uniquement |

Tests : `jest`, `ts-jest`, `@nestjs/testing`, `supertest`.

## 3. Frontend — `apps/web`

| Bibliothèque | Rôle |
|---|---|
| `react`, `react-dom` (v19) | UI |
| `vite` + `@vitejs/plugin-react` | Build / dev server |
| `tailwindcss` (v4) + `@tailwindcss/vite` | Styles utilitaires |
| `react-router` (v7, mode librairie) | Routage, routes protégées |
| `@tanstack/react-query` (v5) | Cache des données serveur, mutations, invalidations |
| `react-hook-form` + `@hookform/resolvers` | Formulaires |
| `zod` | Schémas de formulaires **et** validation des réponses API critiques |
| `clsx`, `tailwind-merge` | Composition de classes |
| `lucide-react` | Icônes |
| `sonner` | Toasts |
| `date-fns` | Dates (échéances, « en retard ») |

Composants UI : composants maison dans `components/ui/` (style shadcn/ui, copiés et possédés par le
projet, basés sur des primitives accessibles `@radix-ui/*` pour Dialog, DropdownMenu, Select).

Tests : `vitest`, `@testing-library/react`, `@testing-library/user-event`, `msw`, `jsdom`.
E2E : `@playwright/test`.

## 4. class-validator ou Zod : qui valide quoi ?

Règle : **class-validator côté NestJS, Zod partout ailleurs.**

| Partie | Outil | Pourquoi |
|---|---|---|
| Body / query / params des routes API | **class-validator** (DTO + `ValidationPipe` global) | Intégration native Nest, génération Swagger depuis les mêmes DTO |
| Variables d'environnement de l'API | **Zod** | Validation fail-fast au boot, types inférés pour `ConfigService` |
| Formulaires React | **Zod** + React Hook Form | Messages d'erreur côté client, types inférés |
| Variables `import.meta.env` du web | **Zod** | Fail-fast au chargement |
| Réponses API (session, user) | **Zod** (ciblé) | Garde-fou si le contrat change |

Configuration du `ValidationPipe` global :

```ts
new ValidationPipe({
  whitelist: true,              // supprime les champs non déclarés
  forbidNonWhitelisted: true,   // ... et renvoie 400 s'il y en a (ex. tentative d'envoyer projectId, creatorId)
  transform: true,              // instancie les DTO, convertit les types
  transformOptions: { enableImplicitConversion: false },
})
```

> Les deux validations (Zod web, class-validator API) décrivent les **mêmes contraintes** (longueurs,
> formats). La source de vérité est l'API ; le web reflète ces règles pour l'UX. Les contraintes sont
> listées dans [API.md](API.md) pour éviter les divergences.

## 5. Base de données

| Élément | Choix |
|---|---|
| SGBD | PostgreSQL 16 |
| ORM | Prisma (client typé, `extendedWhereUnique` disponible nativement depuis Prisma 5) |
| Migrations | `prisma migrate dev` (local), `prisma migrate deploy` (CI/prod) |
| Identifiants | UUID v4 générés en base (`@default(uuid())` ou `gen_random_uuid()`) — non devinables |
| Fuseau | Tout en UTC (`timestamptz`) |

## 6. Hors périmètre volontaire (MVP)

- Redis / file de messages : non nécessaires tant que les notifications sont in-app et synchrones.
- WebSockets : rafraîchissement par TanStack Query (refetch on focus) suffisant.
- SSR / Next.js : SPA suffisante, pas de besoin SEO sur un espace authentifié.
- OAuth (Google, GitHub) : envisagé en phase ultérieure.
