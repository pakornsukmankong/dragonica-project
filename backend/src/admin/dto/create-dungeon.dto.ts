import { IsString, IsInt, IsOptional, Min } from 'class-validator';

export class CreateDungeonDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  dragonCoreCost?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
