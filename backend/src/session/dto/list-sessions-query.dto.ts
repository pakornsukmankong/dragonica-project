import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

// Query params for GET /sessions. When `page` is present the response is
// paginated ({ data, total }); without it the endpoint keeps returning the
// full array (the dashboard charts consume the whole history).
export class ListSessionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @IsUUID()
  characterId?: string;

  /** Inclusive start-of-day filter on started_at (YYYY-MM-DD). */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  /** Inclusive end-of-day filter on started_at (YYYY-MM-DD). */
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn(['date', 'gold'])
  sortBy?: 'date' | 'gold';
}
