import { IsString, IsOptional } from 'class-validator';

export class UpdateDungeonDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
