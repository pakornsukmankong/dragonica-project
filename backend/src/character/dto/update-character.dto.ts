import { IsString, IsUUID, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateCharacterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number;
}
