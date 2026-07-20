import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateItemCodeDto {
  // Non-empty is enforced in the service after trimming (a string of spaces
  // passes MaxLength but is not a real code).
  @IsString()
  @MaxLength(100)
  code: string;

  // What the code grants; trimmed in the service, empty stored as null.
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  expireDate?: string;
}
