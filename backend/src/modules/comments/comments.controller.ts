import {
  Controller, Post, Patch, Delete, Body, Param,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class UpdateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body: string;
}

@Controller('issues/:issueId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /**
   * POST /issues/:issueId/comments
   * @body CreateCommentDto
   * Adds a comment (optionally a reply with parentId)
   */
  @Post()
  create(
    @Param('issueId') issueId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.commentsService.create(issueId, dto, userId);
  }

  /**
   * PATCH /issues/:issueId/comments/:commentId
   * @body { body: string }
   * Edits a comment — author only
   */
  @Patch(':commentId')
  update(
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.commentsService.update(commentId, dto.body, userId);
  }

  /**
   * DELETE /issues/:issueId/comments/:commentId
   * Soft-deletes a comment
   */
  @Delete(':commentId')
  remove(
    @Param('commentId') commentId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.commentsService.remove(commentId, userId);
  }
}
