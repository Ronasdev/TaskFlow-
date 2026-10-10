import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectRole, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { taskWhereReadable } from '../tasks/task-access';
import { AddMemberDto, UpdateMemberDto } from './dto/member.dto';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import {
  memberWhereManageable,
  projectWhereCanAddMember,
  projectWhereDeletable,
  projectWhereManageable,
  projectWhereReadable,
} from './project-access';

const projectSelect = (userId: string) =>
  ({
    id: true,
    name: true,
    description: true,
    personalForUserId: true,
    createdAt: true,
    updatedAt: true,
    // Uniquement l'adhésion de l'utilisateur courant : donne `myRole`.
    members: { where: { userId }, select: { role: true } },
    _count: { select: { members: true } },
  }) satisfies Prisma.ProjectSelect;

type ProjectRow = Prisma.ProjectGetPayload<{ select: ReturnType<typeof projectSelect> }>;

export type TaskCounts = Record<TaskStatus, number>;

export interface ProjectView {
  id: string;
  name: string;
  description: string | null;
  isPersonal: boolean;
  myRole: ProjectRole;
  memberCount: number;
  taskCounts: TaskCounts;
  createdAt: Date;
  updatedAt: Date;
}

const memberSelect = {
  userId: true,
  role: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
} satisfies Prisma.ProjectMemberSelect;

type MemberRow = Prisma.ProjectMemberGetPayload<{ select: typeof memberSelect }>;

export interface MemberView {
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
  joinedAt: Date;
}

const toMember = (row: MemberRow): MemberView => ({
  userId: row.userId,
  name: row.user.name,
  email: row.user.email,
  role: row.role,
  joinedAt: row.createdAt,
});

export const emptyTaskCounts = (): TaskCounts => ({ TODO: 0, IN_PROGRESS: 0, DONE: 0 });

/**
 * Toutes les requêtes portent un filtre de projet-access.ts dans leur WHERE (SECURITY.md §3).
 * Aucune ligne ne correspond => 404, que la ressource soit inexistante ou inaccessible.
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ProjectView[]> {
    const rows = await this.prisma.project.findMany({
      where: projectWhereReadable(userId),
      select: projectSelect(userId),
      orderBy: [{ personalForUserId: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    });
    return this.withTaskCounts(userId, rows);
  }

  async findOne(userId: string, projectId: string): Promise<ProjectView> {
    const row = await this.prisma.project.findFirst({
      where: { id: projectId, ...projectWhereReadable(userId) },
      select: projectSelect(userId),
    });
    if (!row) throw new NotFoundException();
    const [project] = await this.withTaskCounts(userId, [row]);
    return project!;
  }

  async create(userId: string, dto: CreateProjectDto): Promise<ProjectView> {
    const row = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        members: { create: { userId, role: 'OWNER' } },
      },
      select: projectSelect(userId),
    });
    return toProject(row, emptyTaskCounts());
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto): Promise<ProjectView> {
    await this.prisma.project.update({
      where: { id: projectId, AND: [projectWhereManageable(userId)] },
      data: dto,
      select: { id: true },
    });
    return this.findOne(userId, projectId);
  }

  async remove(userId: string, projectId: string): Promise<void> {
    await this.prisma.project.delete({
      where: { id: projectId, AND: [projectWhereDeletable(userId)] },
      select: { id: true },
    });
  }

  async listMembers(userId: string, projectId: string): Promise<MemberView[]> {
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId, project: projectWhereReadable(userId) },
      select: memberSelect,
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    // Un projet lisible contient au moins l'utilisateur courant : vide => inaccessible.
    if (rows.length === 0) throw new NotFoundException();
    return rows.map(toMember);
  }

  async addMember(actorId: string, projectId: string, dto: AddMemberDto): Promise<MemberView> {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: { id: projectId, ...projectWhereCanAddMember(actorId, dto.role) },
        select: { id: true },
      });
      if (!project) throw new NotFoundException();

      // Email inconnu : même 404 générique (C11, pas d'énumération de comptes).
      const user = await tx.user.findUnique({ where: { email: dto.email }, select: { id: true } });
      if (!user) throw new NotFoundException();

      try {
        const row = await tx.projectMember.create({
          data: { projectId: project.id, userId: user.id, role: dto.role },
          select: memberSelect,
        });
        return toMember(row);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Cette personne est déjà membre du projet');
        }
        throw error;
      }
    });
  }

  async updateMemberRole(
    actorId: string,
    projectId: string,
    targetUserId: string,
    dto: UpdateMemberDto,
  ): Promise<MemberView> {
    const row = await this.prisma.projectMember.update({
      where: {
        projectId_userId: { projectId, userId: targetUserId },
        ...memberWhereManageable(actorId, dto.role),
      },
      data: { role: dto.role },
      select: memberSelect,
    });
    return toMember(row);
  }

  /** Retire un membre et désassigne ses tâches du projet dans la même transaction (C7). */
  async removeMember(actorId: string, projectId: string, targetUserId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { projectId, assigneeId: targetUserId, project: projectWhereManageable(actorId) },
        data: { assigneeId: null },
      }),
      // P2025 si non autorisé => 404 et annulation de la désassignation.
      this.prisma.projectMember.delete({
        where: {
          projectId_userId: { projectId, userId: targetUserId },
          ...memberWhereManageable(actorId),
        },
        select: { userId: true },
      }),
    ]);
  }

  /** Quitter un projet : tout rôle sauf OWNER (C4, C6). */
  async leave(userId: string, projectId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { projectId, assigneeId: userId, project: projectWhereReadable(userId) },
        data: { assigneeId: null },
      }),
      this.prisma.projectMember.delete({
        where: { projectId_userId: { projectId, userId }, role: { not: 'OWNER' } },
        select: { userId: true },
      }),
    ]);
  }

  private async withTaskCounts(userId: string, rows: ProjectRow[]): Promise<ProjectView[]> {
    if (rows.length === 0) return [];
    const groups = await this.prisma.task.groupBy({
      by: ['projectId', 'status'],
      where: { projectId: { in: rows.map((row) => row.id) }, ...taskWhereReadable(userId) },
      _count: { _all: true },
    });

    const counts = new Map<string, TaskCounts>();
    for (const group of groups) {
      const projectCounts = counts.get(group.projectId) ?? emptyTaskCounts();
      projectCounts[group.status] = group._count._all;
      counts.set(group.projectId, projectCounts);
    }
    return rows.map((row) => toProject(row, counts.get(row.id) ?? emptyTaskCounts()));
  }
}

function toProject(row: ProjectRow, taskCounts: TaskCounts): ProjectView {
  const membership = row.members[0];
  // Impossible si la requête porte le filtre d'accès : signale un oubli de filtre.
  if (!membership) throw new NotFoundException();
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isPersonal: row.personalForUserId !== null,
    myRole: membership.role,
    memberCount: row._count.members,
    taskCounts,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
