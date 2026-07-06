import { IsString, IsOptional } from 'class-validator';

export class CreateDungeonDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
