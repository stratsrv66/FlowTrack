import {
  IsString, IsOptional, IsEnum, IsUUID, IsArray, IsDateString, MaxLength, IsNumber,
} from 'class-validator';
import { IssuePriority, IssueType } from '@prisma/client';

export class UpdateIssueDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

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

  @IsOptional()
  @IsUUID()
  statusId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  labelIds?: string[];

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsNumber()
  position?: number;
}
