import { TaskPriority, TaskStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const toArray = ({ value }: { value: unknown }) =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value];

export const TASK_SORT_FIELDS = ['createdAt', 'updatedAt', 'dueDate', 'priority'] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export class ListTasksQuery {
  /** `?status=TODO&status=IN_PROGRESS` */
  @IsOptional()
  @Transform(toArray)
  @IsEnum(TaskStatus, { each: true })
  status?: TaskStatus[];

  @IsOptional()
  @Transform(toArray)
  @IsEnum(TaskPriority, { each: true })
  priority?: TaskPriority[];

  /** UUID d'un membre, ou `none` pour les tâches non assignées. */
  @ValidateIf(
    (query: ListTasksQuery) => query.assigneeId !== undefined && query.assigneeId !== 'none',
  )
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  assignedToMe?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  dueBefore?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  dueAfter?: string;

  @IsOptional()
  @IsIn(TASK_SORT_FIELDS)
  sort?: TaskSortField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
