import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UuidParam } from '../common/decorators/uuid-param.decorator';
import { ListTasksQuery } from './dto/list-tasks.query';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('projects/:projectId/tasks')
  listByProject(
    @CurrentUser('id') userId: string,
    @UuidParam('projectId') projectId: string,
    @Query() query: ListTasksQuery,
  ) {
    return this.tasks.listByProject(userId, projectId, query);
  }

  @Post('projects/:projectId/tasks')
  create(
    @CurrentUser('id') userId: string,
    @UuidParam('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(userId, projectId, dto);
  }

  @Get('tasks')
  list(@CurrentUser('id') userId: string, @Query() query: ListTasksQuery) {
    return this.tasks.list(userId, query);
  }

  @Get('tasks/:id')
  findOne(@CurrentUser('id') userId: string, @UuidParam('id') id: string) {
    return this.tasks.findOne(userId, id);
  }

  @Patch('tasks/:id')
  update(
    @CurrentUser('id') userId: string,
    @UuidParam('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(userId, id, dto);
  }

  @Delete('tasks/:id')
  @HttpCode(204)
  async remove(@CurrentUser('id') userId: string, @UuidParam('id') id: string) {
    await this.tasks.remove(userId, id);
  }
}
