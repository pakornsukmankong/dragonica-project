import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  rarity?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultPrice?: number;
}
