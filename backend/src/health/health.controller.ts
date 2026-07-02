import { Controller, Get } from '@nestjs/common';

// Public liveness probe for the host platform (e.g. Railway healthcheck).
// Reachable at GET /api/health thanks to the global `api` prefix.
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}
