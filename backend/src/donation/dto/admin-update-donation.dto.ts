import { IsOptional, IsString, MaxLength } from 'class-validator';

// Admin edits a donation's public-facing fields (same length caps as
// CreateDonationDto). An empty message clears it.
export class AdminUpdateDonationDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
