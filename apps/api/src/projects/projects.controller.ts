import { Body, Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UuidParam } from '../common/decorators/uuid-param.decorator';
import { AddMemberDto, UpdateMemberDto } from './dto/member.dto';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.projects.list(userId);
  }

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateProjectDto) {
    return this.projects.create(userId, dto);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @UuidParam('id') id: string) {
    return this.projects.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @UuidParam('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser('id') userId: string, @UuidParam('id') id: string) {
    await this.projects.remove(userId, id);
  }

  @Get(':id/members')
  listMembers(@CurrentUser('id') userId: string, @UuidParam('id') id: string) {
    return this.projects.listMembers(userId, id);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser('id') userId: string,
    @UuidParam('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.projects.addMember(userId, id, dto);
  }

  @Patch(':id/members/:userId')
  updateMember(
    @CurrentUser('id') actorId: string,
    @UuidParam('id') id: string,
    @UuidParam('userId') targetUserId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.projects.updateMemberRole(actorId, id, targetUserId, dto);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  async removeMember(
    @CurrentUser('id') actorId: string,
    @UuidParam('id') id: string,
    @UuidParam('userId') targetUserId: string,
  ) {
    await this.projects.removeMember(actorId, id, targetUserId);
  }

  @Post(':id/leave')
  @HttpCode(204)
  async leave(@CurrentUser('id') userId: string, @UuidParam('id') id: string) {
    await this.projects.leave(userId, id);
  }
}
