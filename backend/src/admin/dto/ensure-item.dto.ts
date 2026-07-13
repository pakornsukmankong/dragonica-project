import { IsInt, Min } from 'class-validator';

// A grind drop picked from the static game item database: find (or create)
// the matching `items` row. Only the game id crosses the wire — the row's
// name/rarity/icon come from the server-side manifest
// (backend/game-data/items-manifest.json), so a client cannot poison the
// shared row with fake values.
export class EnsureItemDto {
  @IsInt()
  @Min(1)
  gameItemId: number;
}
