import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { StatsService } from './stats.service';

// Public site stats — no user data, no auth needed. Rate-limited by the global
// ThrottlerGuard so the counter can't be hammered too hard.
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  // Count one page view and return the new total.
  @Post('visit')
  @HttpCode(200)
  visit() {
    return this.stats.recordVisit();
  }

  // Current total page views for the on-site counter.
  @Get('visits')
  visits() {
    return this.stats.getVisits();
  }
}
