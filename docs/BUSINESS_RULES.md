# Règles métier

## 1. Règles énoncées (cahier des charges)

| Réf. | Règle |
|---|---|
| R1 | Un utilisateur ne peut voir **que** les projets auxquels il appartient (et donc leurs tâches). |
| R2 | Un `VIEWER` peut consulter mais ne peut **rien** modifier. |
| R3 | Un `MEMBER` peut modifier les tâches auxquelles il a accès (celles des projets dont il est membre). |
| R4 | Seuls `OWNER` ou `ADMIN` peuvent ajouter / supprimer des membres. |
| R5 | Une tâche `DONE` ne peut pas être supprimée par n'importe qui : uniquement `OWNER` ou `ADMIN`. |
| R6 | Une tâche assignée doit l'être à un membre **du même projet**. |
| R7 | Chaîne de contrôle avant toute modification : authentifié → la tâche existe → membre du projet → rôle nécessaire → modification autorisée → on modifie. |
| R8 | La propriété est vérifiée dans le `WHERE`, jamais dans un `if` après lecture. |
| R9 | Ce qui n'est pas à moi n'existe pas : `404`, jamais `403`. |

## 2. Règles complémentaires (précisions de conception)

| Réf. | Règle |
|---|---|
| C1 | À l'inscription, un **projet personnel** (« Mes tâches ») est créé ; l'utilisateur en est `OWNER` et seul membre. |
| C2 | Le projet personnel ne peut ni recevoir de membres, ni être supprimé, ni changer de propriétaire. |
| C3 | Le créateur d'un projet en devient `OWNER`. Il y a exactement un `OWNER` par projet. |
| C4 | L'`OWNER` ne peut pas être retiré ni rétrogradé (le transfert de propriété est hors MVP). |
| C5 | Un `ADMIN` ne peut pas promouvoir quelqu'un `OWNER`, ni modifier/retirer un autre `ADMIN` ; seul l'`OWNER` gère les `ADMIN`. |
| C6 | Un membre peut **quitter** un projet de lui-même (sauf l'`OWNER`). |
| C7 | Retirer un membre (ou qu'il quitte) désassigne ses tâches de ce projet (elles restent dans le projet). |
| C8 | Passer une tâche à `DONE` renseigne `completedAt` ; la sortir de `DONE` l'efface. |
| C9 | `projectId` et `creatorId` d'une tâche sont **immuables** (pas de déplacement de tâche entre projets au MVP). |
| C10 | Seuls `OWNER`/`ADMIN` modifient les infos du projet (nom, description) ; seul l'`OWNER` supprime le projet. |
| C11 | On ajoute un membre par **email d'un compte existant**. Si l'email est inconnu → `404` générique (pas d'énumération : même réponse que pour tout email non ajoutable). |
| C12 | Transitions de statut libres entre `TODO`, `IN_PROGRESS` et vers `DONE` pour tout rôle ayant le droit d'édition. **Rouvrir** une tâche `DONE` (`DONE → TODO/IN_PROGRESS`) est réservé à `OWNER`/`ADMIN` : sinon un `MEMBER` contournerait R5 en rouvrant la tâche puis en la supprimant. |

## 3. Matrice des permissions

Légende : ✅ autorisé · ❌ refusé (→ `404`, voir §4) · — sans objet

### Projet

| Action | OWNER | ADMIN | MEMBER | VIEWER | Non-membre |
|---|:-:|:-:|:-:|:-:|:-:|
| Voir le projet et ses membres | ✅ | ✅ | ✅ | ✅ | ❌ |
| Renommer / modifier la description | ✅ | ✅ | ❌ | ❌ | ❌ |
| Supprimer le projet (non personnel) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ajouter un membre `MEMBER`/`VIEWER` | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ajouter un membre `ADMIN` | ✅ | ❌ | ❌ | ❌ | ❌ |
| Changer le rôle d'un `MEMBER`/`VIEWER` (entre `MEMBER`/`VIEWER`) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Promouvoir / rétrograder un `ADMIN` | ✅ | ❌ | ❌ | ❌ | ❌ |
| Retirer un `MEMBER`/`VIEWER` | ✅ | ✅ | ❌ | ❌ | ❌ |
| Retirer un `ADMIN` | ✅ | ❌ | ❌ | ❌ | ❌ |
| Quitter le projet | ❌ (C4) | ✅ | ✅ | ✅ | — |

### Tâches

| Action | OWNER | ADMIN | MEMBER | VIEWER | Non-membre |
|---|:-:|:-:|:-:|:-:|:-:|
| Lister / voir les tâches | ✅ | ✅ | ✅ | ✅ | ❌ |
| Créer une tâche | ✅ | ✅ | ✅ | ❌ | ❌ |
| Modifier (titre, description, priorité, échéance, statut) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Rouvrir une tâche `DONE` (C12) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assigner / désassigner (à un membre du projet) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Supprimer une tâche `TODO` / `IN_PROGRESS` | ✅ | ✅ | ✅ | ❌ | ❌ |
| Supprimer une tâche `DONE` | ✅ | ✅ | ❌ (R5) | ❌ | ❌ |

> Un `VIEWER` peut être **assigné** à une tâche (il en est informé) mais ne peut pas la modifier,
> y compris son statut. Si ce comportement ne convient pas, voir les points ouverts dans
> [DECISIONS.md](DECISIONS.md).

## 4. Codes de retour liés aux règles

| Situation | Code | Justification |
|---|---|---|
| Pas de token / token invalide ou expiré | `401` | Non authentifié |
| La ressource n'existe pas | `404` | — |
| La ressource existe mais l'utilisateur n'est pas membre du projet | `404` | R9 : ce qui n'est pas à moi n'existe pas |
| L'utilisateur est membre mais son rôle ne permet pas l'action | `404` | R8 + R9 : le rôle fait partie du `WHERE` ; aucune ligne ne correspond « pour cette action » |
| Suppression ou réouverture d'une tâche `DONE` par un `MEMBER` | `404` | Idem : la règle d'état est dans le `WHERE` |
| `assigneeId` qui n'est pas membre du projet | `422` | Erreur de **donnée d'entrée** sur un projet accessible (le payload est invalide, pas la cible) |
| Ajout d'un membre déjà présent | `409` | Conflit sur une ressource accessible |
| Retrait / rétrogradation de l'`OWNER`, ajout de membre au projet personnel, `ADMIN` qui cible un `ADMIN` | `404` | Ces règles sont exprimées dans le `WHERE` : aucune ligne ne correspond pour cette action |
| Payload invalide (format, champ inconnu) | `400` | Validation DTO |

**`403` n'est jamais renvoyé** par les routes de ressources. L'interface masque ou désactive les
actions non permises en se basant sur le rôle renvoyé par l'API (`myRole`), pour que l'utilisateur
ne rencontre pas ces `404` en usage normal.

## 5. Application de la chaîne de contrôle (R7) par action

| Action | Étape « rôle nécessaire » | Étape « modification autorisée » | Où |
|---|---|---|---|
| Lire une tâche | rôle ∈ {tous} | — | `WHERE` |
| Créer une tâche | rôle ∈ {OWNER, ADMIN, MEMBER} sur le projet cible | `assigneeId` membre du projet (R6) | `WHERE` sur le projet + FK composite |
| Modifier une tâche | rôle ∈ {OWNER, ADMIN, MEMBER} | `assigneeId` membre du projet (R6) ; champs immuables rejetés par le DTO (C9) ; si le payload sort la tâche de `DONE` : rôle ∈ {OWNER, ADMIN} (C12) | `WHERE` + FK composite + DTO |
| Supprimer une tâche | rôle ∈ {OWNER, ADMIN, MEMBER} | si `MEMBER` : `status ≠ DONE` (R5) | `WHERE` |
| Ajouter un membre | rôle ∈ {OWNER, ADMIN} ; `OWNER` si rôle cible = ADMIN | projet non personnel (C2) | `WHERE` sur le projet |
| Retirer un membre | rôle ∈ {OWNER, ADMIN} ; `OWNER` si cible ADMIN | cible ≠ OWNER (C4) | `WHERE` sur la ligne `ProjectMember` cible |

Exemples concrets de ces `WHERE` : [SECURITY.md §3](SECURITY.md#3-autorisation--la-propriété-est-dans-le-where).
