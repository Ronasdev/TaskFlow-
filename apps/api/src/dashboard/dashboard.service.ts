import { Injectable } from '@nestjs/common';
import { Prisma, ProjectRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { emptyTaskCounts, ProjectsService, TaskCounts } from '../projects/projects.service';
import { taskWhereReadable } from '../tasks/task-access';
import { taskSelect, TaskView, toTask } from '../tasks/tasks.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const LIST_SIZE = 5;

export interface Dashboard {
  counts: TaskCounts;
  overdue: number;
  dueSoon: TaskView[];
  assignedToMe: TaskView[];
  recentlyCompleted: TaskView[];
  projects: {
    id: string;
    name: string;
    myRole: ProjectRole;
    isPersonal: boolean;
    progress: number;
  }[];
}

/** Agrégats calculés uniquement sur les tâches des projets de l'utilisateur (taskWhereReadable). */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async get(userId: string): Promise<Dashboard> {
    const now = new Date();
    const readable = taskWhereReadable(userId);
    const open: Prisma.TaskWhereInput = { ...readable, status: { not: 'DONE' } };

    const [groups, overdue, dueSoon, assignedToMe, recentlyCompleted, projects] = await Promise.all(
      [
        this.prisma.task.groupBy({ by: ['status'], where: readable, _count: { _all: true } }),
        this.prisma.task.count({ where: { ...open, dueDate: { lt: now } } }),
        this.prisma.task.findMany({
          where: { ...open, dueDate: { gte: now, lte: new Date(now.getTime() + 7 * DAY_MS) } },
          select: taskSelect,
          orderBy: { dueDate: 'asc' },
          take: LIST_SIZE,
        }),
        this.prisma.task.findMany({
          where: { ...open, assigneeId: userId },
          select: taskSelect,
          orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
          take: LIST_SIZE,
        }),
        this.prisma.task.findMany({
          where: { ...readable, status: 'DONE' },
          select: taskSelect,
          orderBy: { completedAt: 'desc' },
          take: LIST_SIZE,
        }),
        this.projects.list(userId),
      ],
    );

    const counts = emptyTaskCounts();
    for (const group of groups) counts[group.status] = group._count._all;

    return {
      counts,
      overdue,
      dueSoon: dueSoon.map(toTask),
      assignedToMe: assignedToMe.map(toTask),
      recentlyCompleted: recentlyCompleted.map(toTask),
      projects: projects.map((project) => {
        const total =
          project.taskCounts.TODO + project.taskCounts.IN_PROGRESS + project.taskCounts.DONE;
        return {
          id: project.id,
          name: project.name,
          myRole: project.myRole,
          isPersonal: project.isPersonal,
          progress: total === 0 ? 0 : project.taskCounts.DONE / total,
        };
      }),
    };
  }
}
