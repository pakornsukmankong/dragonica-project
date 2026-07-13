import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkDropItemDto {
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

// All of a session's drops in one request, so saving a run costs one
// round-trip instead of one per item.
export class CreateDropsBulkDto {
  @IsUUID()
  sessionId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BulkDropItemDto)
  drops: BulkDropItemDto[];
}
