import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  // Empty string is allowed — it clears the display name back to the email.
  @IsOptional()
  @IsString()
  @MaxLength(30)
  username?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
