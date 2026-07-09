import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { StatsService } from './stats.service';

// Public site stats — no user data, no auth needed.
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  // Count one page view and return the new total. A real visitor posts this
  // once per session — the tight per-IP throttle just caps counter inflation.
  @Post('visit')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  visit() {
    return this.stats.recordVisit();
  }

  // Current total page views for the on-site counter.
  @Get('visits')
  visits() {
    return this.stats.getVisits();
  }
}
