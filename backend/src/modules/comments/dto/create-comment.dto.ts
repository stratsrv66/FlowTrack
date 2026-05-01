import { IsString, IsOptional, IsUUID, MinLength, MaxLength, IsArray } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body: string;

  /** ID of the parent comment — for threaded replies */
  @IsOptional()
  @IsUUID()
  parentId?: string;

  /** User IDs mentioned in the comment (for @mention notifications) */
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  mentionedUserIds?: string[];
}
