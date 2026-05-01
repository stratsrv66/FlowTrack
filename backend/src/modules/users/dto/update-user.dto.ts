import {
  IsString, IsOptional, MaxLength, IsUrl, MinLength, Matches,
} from 'class-validator';

export class UpdateUserDto {
  /** Display name shown across the UI */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName?: string;

  /** Unique handle — letters, digits, underscores, hyphens */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username may contain only letters, digits, underscores and hyphens',
  })
  username?: string;

  /** Short biography shown on the profile page */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  /** URL of the user's avatar image */
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
