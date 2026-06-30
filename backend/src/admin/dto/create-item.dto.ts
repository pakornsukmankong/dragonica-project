import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  rarity?: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultPrice?: number;
}
