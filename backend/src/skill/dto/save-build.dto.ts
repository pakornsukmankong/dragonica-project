import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SaveBuildDto {
  @IsInt()
  classId: number; // skill_classes.id (21..28)

  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsInt()
  @Min(1)
  @Max(200)
  charLevel: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bonusSp?: number;

  // { [skillId]: points }. Structure/values are enforced by the build validator.
  @IsObject()
  allocations: Record<string, number>;

  @IsOptional()
  @IsIn(['public', 'unlisted'])
  visibility?: 'public' | 'unlisted';
}
