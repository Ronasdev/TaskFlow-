# Modèle de données

## 1. Choix du modèle

Le schéma de référence propose deux variantes :

```
Variante 1                         Variante 2 (retenue)
User                               User
 ├── Project                        ├── ProjectMember (role) ── Project
 │     └── Task                     │          └── Task
 └── Task                           └── Task (assignée / créée)
```

**Variante 2 retenue**, la table d'adhésion étant nommée `ProjectMember` : les règles métier exigent
plusieurs utilisateurs par projet avec un **rôle par projet** (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`).
La variante 1 (un projet = un propriétaire) ne peut pas l'exprimer.

Le lien direct `User → Task` de la variante 2 correspond à l'**assignation** (et au créateur).
« Une personne gère ses tâches » est couvert par le **projet personnel** créé automatiquement à
l'inscription (voir [DECISIONS.md, ADR-002](DECISIONS.md)).

## 2. Diagramme entité-relation

```
┌──────────────┐ 1      n ┌──────────────────┐ n      1 ┌──────────────┐
│    User      │──────────│  ProjectMember   │──────────│   Project    │
│──────────────│          │──────────────────│          │──────────────│
│ id (uuid)    │          │ projectId  (PK)  │          │ id (uuid)    │
│ email (uniq) │          │ userId     (PK)  │          │ name         │
│ passwordHash │          │ role             │          │ description  │
│ name         │          │ createdAt        │          │ personalFor… │
│ createdAt    │          └────────┬─────────┘          │ createdAt    │
│ updatedAt    │                   │ 1                   └──────┬───────┘
└──────┬───────┘                   │                            │ 1
       │ 1                         │ 0..n (assignee)            │
       │                  ┌────────▼─────────┐  n               │
       │ n (creator)      │      Task        │◀─────────────────┘
       └─────────────────▶│──────────────────│
                          │ id (uuid)        │
┌──────────────┐          │ projectId        │
│ RefreshToken │ n ─── 1  │ assigneeId?      │── FK composite (projectId, assigneeId)
│──────────────│  User    │ creatorId?       │   → ProjectMember(projectId, userId)
│ tokenHash    │          │ title, desc      │
│ familyId     │          │ status, priority │
│ expiresAt    │          │ dueDate?         │
│ revokedAt?   │          │ completedAt?     │
└──────────────┘          └──────────────────┘

┌──────────────┐
│ Notification │ n ─── 1 User   (post-MVP)
└──────────────┘
```

## 3. Schéma Prisma cible

> Brouillon de référence pour l'implémentation. Les noms de tables sont en `snake_case` via `@@map`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ProjectRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  DONE
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique            // stocké normalisé : trim + lowercase
  passwordHash String   @map("password_hash")
  name         String   @db.VarChar(100)
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  memberships     ProjectMember[]
  createdTasks    Task[]          @relation("TaskCreator")
  refreshTokens   RefreshToken[]
  notifications   Notification[]
  personalProject Project?        @relation("PersonalProject")

  @@map("users")
}

model Project {
  id                String   @id @default(uuid()) @db.Uuid
  name              String   @db.VarChar(100)
  description       String?  @db.VarChar(2000)
  // Non nul uniquement pour le projet personnel d'un utilisateur (unique => un seul par user)
  personalForUserId String?  @unique @map("personal_for_user_id") @db.Uuid
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  personalFor User?           @relation("PersonalProject", fields: [personalForUserId], references: [id], onDelete: Cascade)
  members     ProjectMember[]
  tasks       Task[]

  @@map("projects")
}

model ProjectMember {
  projectId String      @map("project_id") @db.Uuid
  userId    String      @map("user_id") @db.Uuid
  role      ProjectRole
  createdAt DateTime    @default(now()) @map("created_at") @db.Timestamptz(3)

  project       Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user          User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  assignedTasks Task[]  @relation("TaskAssignee")

  @@id([projectId, userId])
  @@index([userId])          // "mes projets" : WHERE user_id = ?
  @@map("project_members")
}

model Task {
  id          String       @id @default(uuid()) @db.Uuid
  projectId   String       @map("project_id") @db.Uuid
  title       String       @db.VarChar(200)
  description String?      @db.VarChar(5000)
  status      TaskStatus   @default(TODO)
  priority    TaskPriority @default(MEDIUM)
  dueDate     DateTime?    @map("due_date") @db.Timestamptz(3)
  completedAt DateTime?    @map("completed_at") @db.Timestamptz(3)
  assigneeId  String?      @map("assignee_id") @db.Uuid
  creatorId   String?      @map("creator_id") @db.Uuid
  createdAt   DateTime     @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime     @updatedAt @map("updated_at") @db.Timestamptz(3)

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // Règle "une tâche assignée doit appartenir au même projet" garantie PAR LA BASE :
  // (project_id, assignee_id) doit exister dans project_members.
  // NoAction (vérifié en fin d'instruction) et non Restrict, pour que la suppression d'un projet
  // en cascade (tasks + members) ne soit pas bloquée.
  assignee ProjectMember? @relation("TaskAssignee", fields: [projectId, assigneeId], references: [projectId, userId], onDelete: NoAction)

  creator User? @relation("TaskCreator", fields: [creatorId], references: [id], onDelete: SetNull)

  @@index([projectId, status])
  @@index([assigneeId, status])
  @@index([projectId, dueDate])
  @@map("tasks")
}

model RefreshToken {
  id           String    @id @default(uuid()) @db.Uuid
  userId       String    @map("user_id") @db.Uuid
  tokenHash    String    @unique @map("token_hash")   // SHA-256 du token opaque, jamais le token en clair
  familyId     String    @map("family_id") @db.Uuid   // une famille = une session (login)
  expiresAt    DateTime  @map("expires_at") @db.Timestamptz(3)
  revokedAt    DateTime? @map("revoked_at") @db.Timestamptz(3)
  replacedById String?   @map("replaced_by_id") @db.Uuid
  userAgent    String?   @map("user_agent") @db.VarChar(500)
  ip           String?   @db.VarChar(64)
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([familyId])
  @@index([expiresAt])       // purge des tokens expirés
  @@map("refresh_tokens")
}

// Post-MVP
model Notification {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  type      String    @db.VarChar(50)      // ex. TASK_ASSIGNED
  payload   Json                           // { taskId, projectId, title, byUserName }
  readAt    DateTime? @map("read_at") @db.Timestamptz(3)
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, readAt])
  @@map("notifications")
}
```

## 4. Contraintes ajoutées en SQL brut (migration)

Prisma ne sait pas exprimer ces contraintes ; elles sont ajoutées à la main dans la migration
initiale (`migration.sql`) et **testées** (voir [TESTING.md](TESTING.md)).

```sql
-- Exactement un OWNER au plus par projet
CREATE UNIQUE INDEX project_one_owner ON project_members (project_id) WHERE role = 'OWNER';

-- completedAt cohérent avec le statut
ALTER TABLE tasks ADD CONSTRAINT task_completed_at_consistent
  CHECK ((status = 'DONE') = (completed_at IS NOT NULL));

-- Titres non vides
ALTER TABLE tasks    ADD CONSTRAINT task_title_not_blank    CHECK (length(btrim(title)) > 0);
ALTER TABLE projects ADD CONSTRAINT project_name_not_blank  CHECK (length(btrim(name)) > 0);
```

## 5. Invariants

| # | Invariant | Garanti par |
|---|---|---|
| I1 | Un projet a exactement un `OWNER` | Index unique partiel (≤ 1) + service (création atomique projet+owner, pas de retrait/rétrogradation de l'owner) |
| I2 | Une tâche assignée l'est à un membre **du même projet** | FK composite `(project_id, assignee_id) → project_members` |
| I3 | Retirer un membre désassigne ses tâches du projet | Service, dans la même transaction que la suppression du `ProjectMember` (sinon la FK bloque) |
| I4 | Un utilisateur a exactement un projet personnel, dont il est l'unique membre (`OWNER`) | `personal_for_user_id @unique` + service (inscription transactionnelle, ajout de membres refusé) |
| I5 | `completedAt` non nul ⇔ `status = DONE` | `CHECK` SQL + service (positionne/efface `completedAt`) |
| I6 | Les refresh tokens ne sont jamais stockés en clair | Service (SHA-256 avant écriture) |
| I7 | Email unique, insensible à la casse | Normalisation (lowercase) avant écriture + `@unique` |

## 6. Cascades

| Suppression de… | Effet |
|---|---|
| `Project` | Supprime ses `ProjectMember` et ses `Task` (cascade) |
| `ProjectMember` | Bloquée tant que des tâches lui sont assignées → le service désassigne d'abord (I3) |
| `User` (hors MVP) | Cascade sur memberships, tokens, notifications, projet personnel ; `creatorId` → `NULL`. Le service doit d'abord désassigner les tâches et traiter les projets dont il est `OWNER` |

## 7. Index et requêtes principales

| Requête | Index utilisé |
|---|---|
| Mes projets (`WHERE user_id = ?`) | `project_members(user_id)` |
| Filtre d'accès `project.members.some({ userId, role })` | PK `project_members(project_id, user_id)` |
| Tâches d'un projet par statut | `tasks(project_id, status)` |
| Mes tâches assignées / dashboard | `tasks(assignee_id, status)` |
| Échéances proches | `tasks(project_id, due_date)` |
| Validation d'un refresh token | `refresh_tokens(token_hash)` unique |

## 8. Seed (développement uniquement)

`prisma/seed.ts` crée : 3 utilisateurs (`alice@demo.dev`, `bob@demo.dev`, `carol@demo.dev`,
mot de passe `Password123!`), un projet partagé où Alice est `OWNER`, Bob `MEMBER`, Carol `VIEWER`,
et ~20 tâches dans tous les statuts. Le seed **refuse de s'exécuter** si `NODE_ENV=production`.
