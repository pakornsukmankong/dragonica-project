import { IsIn } from 'class-validator';

export class UpdateVisibilityDto {
  @IsIn(['public', 'unlisted'])
  visibility: 'public' | 'unlisted';
}
