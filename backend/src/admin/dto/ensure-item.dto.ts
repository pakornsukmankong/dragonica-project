import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

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
}
