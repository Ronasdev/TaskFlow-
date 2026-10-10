# Décisions d'architecture (ADR)

Format court : contexte → décision → conséquences. Une décision ne se modifie pas : on en ajoute une
nouvelle qui la remplace.

---

## ADR-001 — Modèle d'adhésion `ProjectMember` (variante 2)

**Contexte.** Deux modèles proposés : `User → Project → Task` (variante 1) ou
`User → ProjectManager → Project → Task` (variante 2). Les règles exigent un rôle **par projet**.

**Décision.** Variante 2. La table d'association est nommée `ProjectMember` (clé `(projectId, userId)`,
colonne `role`).

**Conséquences.** Le rôle est une donnée relationnelle, lisible dans un `WHERE` (`members.some`).
Un utilisateur peut avoir des rôles différents selon les projets.

---

## ADR-002 — Toute tâche appartient à un projet ; projet personnel automatique

**Contexte.** « Une personne gère ses tâches, elle ne voit que les siennes » et le schéma montre un lien
`User → Task`, mais les règles métier sont toutes exprimées par projet.

**Décision.** `Task.projectId` est obligatoire. À l'inscription, un projet personnel
(`personalForUserId = user.id`) est créé, l'utilisateur en est `OWNER` et seul membre (non partageable,
non supprimable). Le lien `User → Task` du schéma est porté par `assigneeId` et `creatorId`.

**Conséquences.** Une seule logique d'autorisation (par projet) au lieu de deux. Les tâches
« personnelles » sont visibles uniquement par leur propriétaire, par construction.

**Alternative écartée.** `Task.projectId` nullable + `Task.ownerId` : double chemin d'autorisation,
`WHERE` en `OR`, plus de risques d'erreur.

---

## ADR-003 — Autorisation dans le `WHERE` et `404` systématique

**Contexte.** Règles imposées : propriété dans le `WHERE`, jamais dans un `if` après lecture ;
ce qui n'est pas à moi n'existe pas.

**Décision.** Constructeurs de `WHERE` purs (`*-access.ts`), utilisation de `extendedWhereUnique` de
Prisma pour `update`/`delete`, traduction de `P2025` en `404`. Le **rôle** et les **règles d'état**
(tâche `DONE`) sont aussi dans le `WHERE` ; un rôle insuffisant renvoie donc également `404`.

**Conséquences.**
- Atomicité vérification/écriture, aucune donnée non autorisée chargée.
- Un membre qui voit une ressource mais n'a pas le droit d'agir reçoit `404` : l'UI doit masquer
  ces actions (`myRole`). C'est un choix assumé pour respecter « jamais 403 ».
- Les erreurs de **payload** sur une cible accessible (assigné non membre) restent en `422`, et
  les conflits en `409`.

---

## ADR-004 — Règle R6 garantie par une clé étrangère composite

**Décision.** `tasks(project_id, assignee_id) → project_members(project_id, user_id)`, `ON DELETE NO ACTION`.

**Conséquences.** Impossible d'avoir une tâche assignée hors projet, même par un bug ou un script.
Le retrait d'un membre doit désassigner ses tâches dans la même transaction. `NO ACTION` (et non
`RESTRICT`) laisse passer la suppression en cascade d'un projet entier.

---

## ADR-005 — Refresh token opaque, hashé, en cookie httpOnly, avec rotation

**Décision.** Access JWT 15 min en mémoire ; refresh opaque 30 j, SHA-256 en base, cookie
`HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, rotation à chaque usage, détection de
réutilisation par famille.

**Conséquences.** Révocable en base, résistant au XSS (pas de token persistant lisible en JS).
Web et API doivent être servis sur le même site. Un access token reste valide ≤ 15 min après révocation.

---

## ADR-006 — class-validator côté API, Zod côté web et configuration

**Décision.** Voir [STACK.md §4](STACK.md#4-class-validator-ou-zod--qui-valide-quoi-).
Pas de package partagé de schémas au MVP ; les contraintes sont documentées une seule fois dans
[API.md](API.md) et couvertes par les tests e2e.

**Évolution possible.** Package `packages/contracts` (Zod) + génération de types depuis OpenAPI.

---

## ADR-007 — Réouverture d'une tâche `DONE` réservée à OWNER/ADMIN

**Contexte.** R5 interdit à un `MEMBER` de supprimer une tâche `DONE`. Si un `MEMBER` peut la repasser
en `TODO`, il peut ensuite la supprimer : R5 serait contournable.

**Décision.** Transition `DONE → TODO/IN_PROGRESS` réservée à `OWNER`/`ADMIN` (même `WHERE` que la suppression).

---

## Points ouverts (à valider avant implémentation)

| # | Question | Proposition par défaut |
|---|---|---|
| Q1 | Un `MEMBER` doit-il pouvoir supprimer une tâche **non** `DONE` qu'il n'a pas créée ? | Oui (« peut modifier les tâches auxquelles il a accès ») |
| Q2 | Un `VIEWER` assigné à une tâche peut-il changer son statut ? | Non (R2 strict) |
| Q3 | Rôle insuffisant sur une ressource visible : `404` (actuel) ou `403` ? | `404` (« jamais 403 ») |
| Q4 | Refresh 30 j glissants ou durée absolue de session ? | Glissants (30 j depuis le dernier refresh) |
| Q5 | Ajout de membre : uniquement des comptes existants, ou invitation par email ? | Comptes existants au MVP, invitations post-MVP |
| Q6 | Transfert de propriété d'un projet | Hors MVP |
| Q7 | Suppression de compte (RGPD) | Post-MVP ; nécessite le transfert de propriété |
