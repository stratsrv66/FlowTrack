import { IsString, IsOptional, MinLength, MaxLength, Matches, IsUrl } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  /** Project key (e.g., "FT", "PROJ") — used as prefix for issue keys */
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  @Matches(/^[A-Z0-9]+$/, { message: 'Key must be uppercase letters and numbers only' })
  key: string;

  /** Project description — accepts rich HTML (bold, color, sizes, separators). Sanitized server-side. */
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsOptional()
  @IsUrl()
  iconUrl?: string;
}
