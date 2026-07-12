import {
  IsUUID,
  IsOptional,
  IsISO8601,
  IsInt,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSessionDto {
  @IsUUID()
  characterId: string;

  @IsOptional()
  @IsUUID()
  dungeonId?: string;

  @IsOptional()
  @IsISO8601()
  startedAt?: string;

  @IsOptional()
  @IsISO8601()
  endedAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  goldEarned?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  goldDropped?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
