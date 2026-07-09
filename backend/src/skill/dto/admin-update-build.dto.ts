import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// Admin moderation edits: metadata only — allocations stay the author's.
export class AdminUpdateBuildDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(['public', 'unlisted'])
  visibility?: 'public' | 'unlisted';
}
