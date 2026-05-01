import { IsUUID, IsString, MaxLength } from 'class-validator';

export class CreateTransitionDto {
  @IsUUID()
  fromStatusId: string;

  @IsUUID()
  toStatusId: string;

  @IsString()
  @MaxLength(100)
  name: string;
}
