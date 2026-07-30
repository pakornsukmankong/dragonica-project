import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
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

  // Optional time of day (24h HH:mm). Defaults to 00:00 in the service; the
  // full start/end instant order is enforced there and by a DB check.
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime?: string;

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
