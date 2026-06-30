import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getSummary(user.sub);
  }

  @Get('character-stats')
  getCharacterStats(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getCharacterStats(user.sub);
  }

  @Get('dungeon-stats')
  getDungeonStats(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getDungeonStats(user.sub);
  }
}
