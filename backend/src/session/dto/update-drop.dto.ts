import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateDropDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceEach?: number;
}
