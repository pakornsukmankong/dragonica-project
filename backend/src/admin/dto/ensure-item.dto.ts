import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// Sprite-atlas icon cell, mirroring the frontend's GameItemIcon shape
// (frontend/src/lib/items.ts) — stored as-is in items.icon (jsonb).
export class ItemIconDto {
  /** Atlas sheet name under /item-atlas/<a>.webp */
  @IsString()
  @MaxLength(60)
  a: string;

  /** 1-based cell index, row-major */
  @IsInt()
  @Min(1)
  i: number;

  /** Grid columns / rows */
  @IsInt()
  @Min(1)
  u: number;

  @IsInt()
  @Min(1)
  v: number;

  /** Sheet [width, height] in px when not the default 480x480 */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsInt({ each: true })
  @Min(1, { each: true })
  s?: [number, number];
}

// A grind drop picked from the static game item database: find (or create)
// the matching `items` row. Values come from the client's copy of the game
// data, so lengths are capped and rarity is restricted to the known tiers.
export class EnsureItemDto {
  @IsInt()
  @Min(1)
  gameItemId: number;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsIn(['common', 'uncommon', 'rare', 'epic', 'legendary'])
  rarity?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ItemIconDto)
  icon?: ItemIconDto;
}
