import { IsString, IsOptional, IsBoolean, IsHexColor, IsInt, Min, MaxLength } from 'class-validator';

export class CreateStatusDto {
  @IsString()
  @MaxLength(50)
  name: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;
}
