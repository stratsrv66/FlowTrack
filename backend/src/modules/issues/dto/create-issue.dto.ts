import {
  IsString, IsOptional, IsEnum, IsUUID, IsArray, IsDateString, MaxLength, MinLength,
} from 'class-validator';
import { IssuePriority, IssueType } from '@prisma/client';

export class CreateIssueDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  /** Rich-text description — accepts HTML; @username mentions are highlighted server-side */
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  description?: string;

  @IsOptional()
  @IsEnum(IssueType)
  type?: IssueType;

  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @IsUUID()
  statusId: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  labelIds?: string[];

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
