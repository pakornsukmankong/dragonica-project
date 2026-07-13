import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Shape of an error coming back from @supabase/supabase-js (PostgrestError).
interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

function isPostgrestError(err: unknown): err is PostgrestLikeError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'message' in err &&
    // Other SDK errors (e.g. Stripe) also carry code+message but tag a `type`;
    // Postgrest errors don't — so don't misclassify them as a DB error.
    !('type' in err) &&
    // Node system errors (fs, net: ENOENT, ECONNREFUSED, …) also carry
    // code+message but always tag `errno`; those are server bugs, not bad
    // requests — let them fall through to a logged 500.
    !('errno' in err)
  );
}

/**
 * Catches everything that reaches the framework boundary and returns a
 * consistent JSON shape. Crucially, it never forwards raw Supabase/Postgres
 * error text to the client (which can leak table/column names) — those are
 * logged server-side and replaced with a safe message.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      // Trusted: DTO validation, guards, NotFoundException, etc.
      status = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : ((res as { message?: string | string[] }).message ??
            exception.message);
    } else if (isPostgrestError(exception)) {
      // Map the few codes worth surfacing; keep the rest opaque.
      if (exception.code === '23505') {
        status = HttpStatus.CONFLICT;
        message = 'That record already exists';
      } else if (exception.code === '23503') {
        // Foreign-key violation, e.g. deleting a row still referenced elsewhere.
        status = HttpStatus.CONFLICT;
        message =
          'This record is still in use by other data and cannot be deleted.';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = 'Database request failed';
      }
      this.logger.error(
        `Postgrest ${exception.code ?? '?'} on ${request.method} ${request.url}: ${exception.message}`,
      );
    } else {
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
