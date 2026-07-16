import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Like {@link JwtAuthGuard}, but never rejects: it attaches `request.user` when
 * a valid Supabase access token is present, and otherwise lets the request
 * through as a guest (no `request.user`). Use on endpoints that are public but
 * still want to attribute the caller when they happen to be signed in — e.g.
 * donations, which anyone can make but a logged-in donor is credited for.
 *
 * A malformed/expired token is treated as "guest" rather than an error, so a
 * stale session never blocks an otherwise-public action.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(OptionalJwtAuthGuard.name);
  private readonly supabaseUrl: string;
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // No credentials → proceed as a guest.
    if (!authHeader?.startsWith('Bearer ')) return true;

    const token = authHeader.slice('Bearer '.length);

    try {
      const jwksUri = `${this.supabaseUrl}/auth/v1/.well-known/jwks.json`;
      if (!this.jwks) {
        this.jwks = createRemoteJWKSet(new URL(jwksUri));
      }

      // Same pinning as JwtAuthGuard: only Supabase user access tokens.
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
    } catch (err) {
      // A bad token just means "guest" here — log and continue.
      this.logger.debug(
        `Optional JWT ignored (treating as guest): ${(err as Error).message}`,
      );
    }

    return true;
  }
}
