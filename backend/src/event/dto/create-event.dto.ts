import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateEventDto {
  // Event name. Non-empty is enforced in the service after trimming (a string
  // of spaces passes MaxLength but is not a real title).
  @IsString()
  @MaxLength(120)
  title: string;

  // Day-level range (YYYY-MM-DD). end >= start is enforced in the service.
  @IsISO8601()
  startDate: string;

  @IsISO8601()
  endDate: string;

  // Free-text description; trimmed in the service, empty stored as null.
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  detail?: string;

  // Optional deep link to the game's own page. Must be an http(s) URL; empty
  // is stored as null.
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  link?: string;
}
