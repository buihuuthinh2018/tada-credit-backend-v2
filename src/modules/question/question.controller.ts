import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { QuestionService } from './question.service';
import { CreateQuestionDto, UpdateQuestionDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';

@ApiTags('Questions')
@ApiBearerAuth('JWT-auth')
@Controller('admin/questions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuestionController {
  constructor(
    private readonly questionService: QuestionService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions('question:create')
  @ApiOperation({ summary: 'Create a new question template' })
  @ApiResponse({ status: 201, description: 'Question created successfully' })
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
  @ApiOperation({ summary: 'Get all question templates' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean, example: false })
  @ApiResponse({ status: 200, description: 'Returns paginated list of questions' })
  findAll(
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
    @Query('activeOnly') activeOnly = false,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.questionService.findAll(pageNum, limitNum, activeOnly);
  }

  @Get(':id')
  @Permissions('question:read')
  @ApiOperation({ summary: 'Get question by ID' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  @ApiResponse({ status: 200, description: 'Returns question details' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  findOne(@Param('id') id: string) {
    return this.questionService.findById(id);
  }

  @Put(':id')
  @Permissions('question:update')
  @ApiOperation({ summary: 'Update question' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  @ApiResponse({ status: 200, description: 'Question updated successfully' })
  @ApiResponse({ status: 404, description: 'Question not found' })
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
  @ApiOperation({ summary: 'Delete question' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  @ApiResponse({ status: 200, description: 'Question deleted successfully' })
  @ApiResponse({ status: 404, description: 'Question not found' })
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
