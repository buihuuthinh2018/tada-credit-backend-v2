import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { QuestionService } from './question.service';
import { CreateQuestionDto, UpdateQuestionDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';

@Controller('admin/questions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuestionController {
  constructor(
    private readonly questionService: QuestionService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions('question:create')
  async create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateQuestionDto,
  ) {
    const result = await this.questionService.create(dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'QUESTION_CREATED',
      targetType: 'question',
      targetId: result.id,
    });

    return result;
  }

  @Get()
  @Permissions('question:read')
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('activeOnly') activeOnly = false,
  ) {
    return this.questionService.findAll(page, limit, activeOnly);
  }

  @Get(':id')
  @Permissions('question:read')
  findOne(@Param('id') id: string) {
    return this.questionService.findById(id);
  }

  @Put(':id')
  @Permissions('question:update')
  async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    const result = await this.questionService.update(id, dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'QUESTION_UPDATED',
      targetType: 'question',
      targetId: id,
      metadata: { changes: dto },
    });

    return result;
  }

  @Delete(':id')
  @Permissions('question:delete')
  async delete(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const result = await this.questionService.delete(id);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'QUESTION_DELETED',
      targetType: 'question',
      targetId: id,
    });

    return result;
  }
}
