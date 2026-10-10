# Déploiement et exploitation

## 1. Environnements

| Environnement | Usage | Base |
|---|---|---|
| `development` | Poste local, `npm run dev`, hot reload | Docker local, seed de démo |
| `test` | CI et tests e2e | Conteneur éphémère |
| `production` | Utilisateurs | PostgreSQL managé (sauvegardes, TLS) |

## 2. Variables d'environnement

### API (`apps/api/.env`) — validées par Zod au démarrage, l'API refuse de démarrer si invalides

| Variable | Exemple | Obligatoire | Description |
|---|---|:-:|---|
| `NODE_ENV` | `production` | ✅ | `development` \| `test` \| `production` |
| `PORT` | `3000` | | Port HTTP |
| `DATABASE_URL` | `postgresql://app:***@db:5432/taskflow?schema=public&sslmode=require` | ✅ | Connexion Prisma |
| `JWT_ACCESS_SECRET` | 64 caractères aléatoires | ✅ | ≥ 32 caractères, refus au boot sinon |
| `JWT_ACCESS_TTL` | `15m` | | Durée de l'access token |
| `JWT_ISSUER` / `JWT_AUDIENCE` | `taskflow-api` / `taskflow-web` | | Claims `iss` / `aud` |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | | Durée du refresh token |
| `COOKIE_SECURE` | `true` | | `true` obligatoire en prod (vérifié au boot) |
| `CORS_ORIGINS` | `https://app.example.com` | ✅ | Liste séparée par des virgules |
| `TRUST_PROXY` | `1` | | Nombre de proxies de confiance (1 = Nginx du conteneur web ; 2 si un load balancer TLS est devant) |
| `THROTTLE_GLOBAL_LIMIT` | `100` | | Requêtes/minute/IP sur l'ensemble de l'API |
| `THROTTLE_AUTH_MULTIPLIER` | `1` | | Multiplie les limites des routes d'auth. **1 en production** ; relevé seulement pour les tests E2E |
| `LOG_LEVEL` | `info` | | `debug` \| `info` \| `warn` \| `error` |
| `ENABLE_SWAGGER` | `false` | | `/api/docs` |

Générer un secret : `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

### Web (`apps/web/.env`)

| Variable | Exemple | Description |
|---|---|---|
| `VITE_API_URL` | `/api/v1` | Injectée **au build** |

Les fichiers `.env` ne sont jamais commités ; seuls les `.env.example` le sont.

## 3. Images Docker

### API — `apps/api/Dockerfile` (multi-stage)

1. `base` : `node:22-alpine` + openssl, manifestes npm du monorepo.
2. `build` : `npm ci`, `prisma generate`, `nest build`.
3. `prod-deps` : `npm ci --omit=dev` (le CLI `prisma` est une dépendance de prod : le job `migrate` utilise la même image).
4. `runtime` : `node:22-alpine`, utilisateur non-root `node`, uniquement `dist/`, `node_modules` de prod,
   `prisma/` (schéma + migrations). `HEALTHCHECK` sur `/api/v1/health/live`.
   Commande : `node dist/main.js`.

### Web — `apps/web/Dockerfile`

1. `build` : `npm ci`, `vite build`.
2. `runtime` : `nginxinc/nginx-unprivileged` (non-root, port 8080) servant `dist/`, avec (`apps/web/nginx/`) :
   - `try_files $uri /index.html` (SPA) ;
   - `location /api/ { proxy_pass http://api:3000; }` (même domaine → cookie first-party) ;
   - en-têtes CSP, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin` ;
   - cache long (`immutable`) sur `/assets/*` (fichiers hashés), `no-cache` sur `index.html` ;
   - gzip ;
   - `/healthz` pour le health check du conteneur.

### docker compose

| Fichier | Services |
|---|---|
| `docker-compose.yml` (dev) | `db` (postgres:16-alpine, volume nommé, port hôte **5434**) |
| `docker-compose.test.yml` | `db-test` (port hôte **5433**, tmpfs) |
| `docker-compose.prod.yml` | `web` (Nginx non-root sur 8080, à placer derrière un reverse proxy TLS), `api`, `migrate` (job one-shot), `db` |

Lancer la stack de production :

```bash
cp .env.prod.example .env.prod      # renseigner APP_ORIGIN, POSTGRES_PASSWORD, JWT_ACCESS_SECRET
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build --wait
```

## 4. Migrations

- Dev : `prisma migrate dev --name <description>` → fichier versionné et relu en PR.
- Prod : job `migrate` exécuté **avant** le déploiement de la nouvelle version de l'API :
  `npx prisma migrate deploy`. L'API ne lance jamais de migration au démarrage.
- Règle : migrations **rétrocompatibles** (expand → déployer → contract) pour permettre le
  déploiement sans interruption.

## 5. CI/CD — GitHub Actions

`ci.yml` sur chaque PR et sur `main` :

```
install (npm ci, cache)
├── lint          (eslint, prettier --check)
├── typecheck     (tsc --noEmit, les deux apps)
├── test-api      (unitaires + e2e avec service postgres:16, migrate deploy)
├── test-web      (vitest)
├── e2e           (docker compose + Playwright, sur main et PR labellisées)
├── audit         (npm audit --audit-level=high)
└── build         (images Docker, push sur le registre si main)
```

`deploy.yml` sur tag `v*` : job `migrate` puis déploiement des images `api` et `web`.

## 6. Exploitation

| Sujet | Mise en place |
|---|---|
| Logs | JSON (pino) sur stdout, `requestId` propagé (`X-Request-Id`), collectés par la plateforme |
| Santé | `liveness` : `/health/live` ; `readiness` : `/health/ready` (base joignable) |
| Arrêt propre | `app.enableShutdownHooks()` ; Prisma déconnecté sur `SIGTERM` |
| Sauvegardes | Sauvegarde quotidienne + PITR du PostgreSQL managé, restauration testée trimestriellement |
| Purge | Tâche quotidienne de purge des refresh tokens expirés/révoqués |
| Mise à l'échelle | API stateless : plusieurs réplicas possibles. Le throttling en mémoire devient par instance → passer à un store partagé si > 1 réplica |
| Monitoring (recommandé) | Sentry (erreurs API et web), métriques de latence/5xx |

## 7. Checklist de mise en production

- [ ] Secrets générés aléatoirement et stockés dans le gestionnaire de secrets de la plateforme
- [ ] `NODE_ENV=production`, `COOKIE_SECURE=true`, `ENABLE_SWAGGER=false`
- [ ] HTTPS partout, HSTS actif, redirection HTTP → HTTPS
- [ ] `CORS_ORIGINS` limité au domaine de prod
- [ ] Connexion base en TLS, utilisateur applicatif **sans** droits superuser
- [ ] `prisma migrate deploy` exécuté et vérifié
- [ ] Sauvegardes activées et restauration testée
- [ ] Seed de démo **non** exécuté
- [ ] Health checks branchés sur l'orchestrateur
- [ ] Alerting sur taux de 5xx et indisponibilité
