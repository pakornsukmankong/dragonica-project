import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private readonly supabaseUrl: string;
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      const jwksUri = `${this.supabaseUrl}/auth/v1/.well-known/jwks.json`;

      if (!this.jwks) {
        this.jwks = createRemoteJWKSet(new URL(jwksUri));
      }

      // Pin the algorithm AND the audience: only Supabase user access tokens
      // (aud "authenticated") are accepted, never other token types the same
      // key set might sign in the future.
      const { payload } = await jwtVerify(token, this.jwks, {
        algorithms: ['ES256'],
        audience: 'authenticated',
      });

      const user: JwtPayload = {
        sub: payload.sub as string,
        email: (payload.email as string) ?? '',
        aud: payload.aud as string,
        role: (payload.role as string) ?? '',
        iat: payload.iat as number,
        exp: payload.exp as number,
      };

      request.user = user;
      return true;
    } catch (err) {
      this.logger.error(`JWT verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
