import { TaskPriority, TaskStatus } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { IsOptionalNonNull } from '../../common/decorators/optional.decorator';
import { Trim } from '../../common/utils/strings';

const titleMessage = 'Le titre doit contenir entre 1 et 200 caractères';

/**
 * `projectId`, `creatorId`, `completedAt` ne sont pas déclarés : `forbidNonWhitelisted` les
 * rejette en 400 (C9, protection contre le mass assignment).
 */
export class CreateTaskDto {
  @Trim()
  @IsString()
  @Length(1, 200, { message: titleMessage })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Date invalide (format ISO 8601 attendu)' })
  dueDate?: string | null;

  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;
}

export class UpdateTaskDto {
  @IsOptionalNonNull()
  @Trim()
  @IsString()
  @Length(1, 200, { message: titleMessage })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptionalNonNull()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptionalNonNull()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Date invalide (format ISO 8601 attendu)' })
  dueDate?: string | null;

  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;
}
