import { IsString, IsOptional, MinLength, MaxLength, IsUrl, IsBoolean } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  /** Project description — accepts rich HTML (bold, color, sizes, separators). Sanitized server-side. */
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
