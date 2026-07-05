import { IsBoolean } from 'class-validator';

// Admin toggles whether a donation's amount is shown on the public wall.
export class UpdateVisibilityDto {
  @IsBoolean()
  hideAmount: boolean;
}
