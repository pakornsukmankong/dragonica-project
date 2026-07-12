import { IsBoolean, IsOptional } from 'class-validator';

// Admin toggles what the public wall shows for a donation: mask just the
// amount (hideAmount) or withhold the whole entry (hideFromWall).
export class UpdateVisibilityDto {
  @IsOptional()
  @IsBoolean()
  hideAmount?: boolean;

  @IsOptional()
  @IsBoolean()
  hideFromWall?: boolean;
}
