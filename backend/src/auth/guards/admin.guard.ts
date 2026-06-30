import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.sub) {
      throw new ForbiddenException('Not authenticated');
    }

    const { data: profile } = await this.supabase
      .from('profiles')
      .select('role')
      .eq('id', user.sub)
      .single();

    if (!profile || profile.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
