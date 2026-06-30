import { IsString, IsUUID, IsInt, IsOptional, Min } from 'class-validator';

export class CreateCharacterDto {
  @IsString()
  name: string;

  @IsUUID()
  classId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number;
}
