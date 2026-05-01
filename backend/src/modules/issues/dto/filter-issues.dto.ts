import { IsOptional, IsEnum, IsUUID, IsString } from 'class-validator';
import { IssuePriority, IssueType } from '@prisma/client';
import { CursorPaginationDto } from '../../../common/utils/pagination.util';

export class FilterIssuesDto extends CursorPaginationDto {
  @IsOptional()
  @IsUUID()
  statusId?: string;

  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @IsOptional()
  @IsEnum(IssueType)
  type?: IssueType;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;
}
