import { IsUUID, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateDropDto {
  @IsUUID()
  sessionId: string;

  @IsUUID()
  itemId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceEach?: number;
}
