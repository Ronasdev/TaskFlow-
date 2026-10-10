# Frontend

React + Vite + TypeScript + Tailwind CSS. SPA authentifiée, adaptative, thème clair/sombre.

## 1. Routes

| Chemin | Page | Accès |
|---|---|---|
| `/login` | Connexion | Public (redirige vers `/` si déjà connecté) |
| `/register` | Inscription | Public (idem) |
| `/` | Tableau de bord | 🔒 |
| `/tasks` | Toutes mes tâches (tous projets), filtres, « assignées à moi » | 🔒 |
| `/projects` | Liste de mes projets + création | 🔒 |
| `/projects/:projectId` | Tâches du projet (vue liste et vue Kanban) | 🔒 |
| `/projects/:projectId/settings` | Infos du projet, membres (selon `myRole`) | 🔒 |
| `/profile` | Profil, mot de passe, déconnexion de toutes les sessions | 🔒 |
| `*` | 404 | Public |

Une ressource API qui répond `404` affiche la page « Introuvable » — identique qu'elle n'existe pas
ou ne soit pas accessible.

## 2. Routes protégées et session

```
<AuthProvider>                     état : 'loading' | 'authenticated' | 'anonymous'
  └─ au montage : POST /auth/refresh
        ├─ 200 → accessToken en mémoire, user en contexte → 'authenticated'
        └─ 401 → 'anonymous'

<ProtectedRoute>
  ├─ 'loading'       → écran de chargement (squelette)
  ├─ 'anonymous'     → <Navigate to="/login" state={{ from: location }} />
  └─ 'authenticated' → <Outlet />

<PublicOnlyRoute>  (login/register)
  └─ 'authenticated' → <Navigate to={from ?? "/"} />
```

### `api-client.ts`

- `fetch` encapsulé, base `VITE_API_URL`, `credentials: 'include'` sur `/auth/*` uniquement.
- Ajoute `Authorization: Bearer <token>` depuis une variable **en mémoire** (pas de `localStorage`).
- Sur `401` (hors `/auth/*`) : lance **un seul** refresh partagé (promesse unique en vol), rejoue la
  requête une fois ; si le refresh échoue → vide la session, invalide le cache TanStack Query,
  redirige vers `/login`.
- Normalise les erreurs en `ApiError { status, message, fieldErrors? }`.

## 3. Données serveur (TanStack Query)

| Clé | Source |
|---|---|
| `['me']` | `GET /users/me` |
| `['dashboard']` | `GET /dashboard` |
| `['projects']` | `GET /projects` |
| `['projects', id]` | `GET /projects/:id` |
| `['projects', id, 'members']` | `GET /projects/:id/members` |
| `['tasks', { projectId?, ...filtres }]` | `GET /projects/:id/tasks` ou `GET /tasks` |
| `['tasks', 'detail', id]` | `GET /tasks/:id` |

- Mutations : mise à jour **optimiste** pour le changement de statut (glisser-déposer Kanban,
  case à cocher), rollback en cas d'erreur, invalidation de `['tasks']` et `['dashboard']`.
- `staleTime` 30 s, `refetchOnWindowFocus` activé.
- À la déconnexion : `queryClient.clear()`.

## 4. Formulaires

React Hook Form + Zod. Les schémas sont dans `features/*/schemas.ts` et reprennent les contraintes de
[API.md §1](API.md#contraintes-de-validation-partagées). Les erreurs `400` de l'API (par champ) sont
réinjectées dans le formulaire via `setError`.

| Formulaire | Schéma |
|---|---|
| Connexion | `loginSchema` |
| Inscription | `registerSchema` (+ confirmation du mot de passe) |
| Tâche (création / édition, en panneau latéral) | `taskSchema` |
| Projet | `projectSchema` |
| Ajout de membre | `addMemberSchema` |
| Profil / mot de passe | `profileSchema`, `changePasswordSchema` |

## 5. Affichage selon le rôle (ergonomie seulement)

Utilitaire unique `can(myRole, action, task?)` dans `features/projects/permissions.ts`, qui reflète
la matrice de [BUSINESS_RULES.md §3](BUSINESS_RULES.md#3-matrice-des-permissions).

| `myRole` | Effet UI |
|---|---|
| VIEWER | Badge « Lecture seule », pas de bouton créer/éditer/supprimer, Kanban non déplaçable |
| MEMBER | Édition ; bouton supprimer désactivé (avec info-bulle) sur les tâches `DONE` ; pas de gestion des membres |
| ADMIN | Tout sauf supprimer le projet et gérer les ADMIN |
| OWNER | Tout |

## 6. Design system

- **Tailwind v4**, tokens CSS (`--color-*`) pour clair/sombre, préférence système + bascule manuelle.
- Police : Inter (variable). Échelle d'espacement Tailwind standard, rayon `rounded-xl` sur les cartes.
- Couleurs de statut : `TODO` gris ardoise, `IN_PROGRESS` bleu, `DONE` vert ; priorité `HIGH` rouge,
  `MEDIUM` ambre, `LOW` gris.
- Composants `components/ui/` : `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Dialog`,
  `Sheet` (panneau latéral), `DropdownMenu`, `Badge`, `Card`, `Avatar`, `Skeleton`, `EmptyState`,
  `Toaster`.
- États obligatoires sur chaque vue de données : **chargement** (squelettes), **vide** (EmptyState
  avec action), **erreur** (message + réessayer).

### Adaptatif

| Largeur | Mise en page |
|---|---|
| < 768 px | Barre de navigation inférieure (Tableau de bord, Tâches, Projets, Profil) ; formulaires en plein écran ; Kanban en colonnes défilables horizontalement (scroll-snap) |
| 768–1279 px | Sidebar repliable (icônes) |
| ≥ 1280 px | Sidebar complète + contenu ; détail de tâche en panneau latéral |

### Accessibilité

- Navigation clavier complète, focus visible, primitives Radix pour dialogues et menus.
- Contrastes AA minimum dans les deux thèmes.
- Le statut n'est jamais communiqué par la couleur seule (libellé + icône).
- Le Kanban propose une alternative clavier (menu « Changer le statut »).

## 7. Variables d'environnement

| Variable | Exemple | Rôle |
|---|---|---|
| `VITE_API_URL` | `/api/v1` | Base de l'API (même domaine en prod) |

Validées par Zod au démarrage de l'app (`lib/env.ts`).
