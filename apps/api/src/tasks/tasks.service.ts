import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { projectWhereEditable, projectWhereReadable } from '../projects/project-access';
import { ListTasksQuery } from './dto/list-tasks.query';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import {
  taskWhereDeletable,
  taskWhereEditable,
  taskWhereReadable,
  taskWhereReopenable,
} from './task-access';

export const taskSelect = {
  id: true,
  projectId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { name: true } },
  assignee: { select: { user: { select: { id: true, name: true } } } },
  creator: { select: { id: true, name: true } },
} satisfies Prisma.TaskSelect;

type TaskRow = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

export interface UserRef {
  userId: string;
  name: string;
}

export interface TaskView {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  completedAt: Date | null;
  assignee: UserRef | null;
  creator: UserRef | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export const toTask = ({ project, assignee, creator, ...task }: TaskRow): TaskView => ({
  ...task,
  projectName: project.name,
  assignee: assignee ? { userId: assignee.user.id, name: assignee.user.name } : null,
  creator: creator ? { userId: creator.id, name: creator.name } : null,
});

const toDate = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : new Date(value);

/**
 * Chaîne de contrôle R7 : le guard JWT garantit l'authentification ; existence, appartenance,
 * rôle et règle d'état sont évalués dans le WHERE d'une seule requête (SECURITY.md §3.4).
 */
@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async listByProject(
    userId: string,
    projectId: string,
    query: ListTasksQuery,
  ): Promise<Paginated<TaskView>> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ...projectWhereReadable(userId) },
      select: { id: true },
    });
    if (!project) throw new NotFoundException();
    return this.list(userId, query, { projectId: project.id });
  }

  async list(
    userId: string,
    query: ListTasksQuery,
    scope: Prisma.TaskWhereInput = {},
  ): Promise<Paginated<TaskView>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.TaskWhereInput = {
      AND: [taskWhereReadable(userId), scope, filtersOf(userId, query)],
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        select: taskSelect,
        orderBy: orderByOf(query),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { data: rows.map(toTask), meta: { page, pageSize, total } };
  }

  async findOne(userId: string, taskId: string): Promise<TaskView> {
    const row = await this.prisma.task.findFirst({
      where: { id: taskId, ...taskWhereReadable(userId) },
      select: taskSelect,
    });
    if (!row) throw new NotFoundException();
    return toTask(row);
  }

  async create(userId: string, projectId: string, dto: CreateTaskDto): Promise<TaskView> {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: { id: projectId, ...projectWhereEditable(userId) },
        select: { id: true },
      });
      if (!project) throw new NotFoundException();

      // R6 : un assigné hors projet viole la FK composite => P2003 => 422.
      const row = await tx.task.create({
        data: {
          projectId: project.id,
          creatorId: userId,
          title: dto.title,
          description: dto.description ?? null,
          status: dto.status,
          priority: dto.priority,
          dueDate: toDate(dto.dueDate),
          assigneeId: dto.assigneeId ?? null,
          completedAt: dto.status === 'DONE' ? new Date() : null,
        },
        select: taskSelect,
      });
      return toTask(row);
    });
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto): Promise<TaskView> {
    const reopening = dto.status !== undefined && dto.status !== 'DONE';

    const row = await this.prisma.task.update({
      where: {
        id: taskId,
        AND: [taskWhereEditable(userId), ...(reopening ? [taskWhereReopenable(userId)] : [])],
      },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        dueDate: toDate(dto.dueDate),
        assigneeId: dto.assigneeId,
        ...(dto.status !== undefined && {
          completedAt: dto.status === 'DONE' ? new Date() : null,
        }),
      },
      select: taskSelect,
    });
    return toTask(row);
  }

  async remove(userId: string, taskId: string): Promise<void> {
    await this.prisma.task.delete({
      where: { id: taskId, AND: [taskWhereDeletable(userId)] },
      select: { id: true },
    });
  }
}

function filtersOf(userId: string, query: ListTasksQuery): Prisma.TaskWhereInput {
  const filters: Prisma.TaskWhereInput[] = [];
  if (query.status?.length) filters.push({ status: { in: query.status } });
  if (query.priority?.length) filters.push({ priority: { in: query.priority } });
  if (query.assigneeId !== undefined) {
    filters.push({ assigneeId: query.assigneeId === 'none' ? null : query.assigneeId });
  }
  if (query.assignedToMe) filters.push({ assigneeId: userId });
  if (query.q?.trim()) {
    filters.push({ title: { contains: query.q.trim(), mode: 'insensitive' } });
  }
  if (query.dueBefore) filters.push({ dueDate: { lte: new Date(query.dueBefore) } });
  if (query.dueAfter) filters.push({ dueDate: { gte: new Date(query.dueAfter) } });
  return { AND: filters };
}

function orderByOf(query: ListTasksQuery): Prisma.TaskOrderByWithRelationInput[] {
  const sort = query.sort ?? 'createdAt';
  const order = query.order ?? 'desc';
  const primary: Prisma.TaskOrderByWithRelationInput =
    sort === 'dueDate' ? { dueDate: { sort: order, nulls: 'last' } } : { [sort]: order };
  return [primary, { id: 'asc' }];
}
