import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import { EnsureItemDto } from './dto/ensure-item.dto';

@Controller('game-data')
@UseGuards(JwtAuthGuard)
export class PublicDataController {
  constructor(private readonly adminService: AdminService) {}

  @Get('items')
  getItems() {
    return this.adminService.getItems();
  }

  // Find-or-create an items row from a static game-database pick, so grind
  // drops can reference any game item without an admin seeding it first.
  @Post('items/ensure')
  ensureItem(@Body() dto: EnsureItemDto) {
    return this.adminService.ensureGameItem(dto);
  }

  @Get('dungeons')
  getDungeons() {
    return this.adminService.getDungeons();
  }

  @Get('classes')
  getClasses() {
    return this.adminService.getClasses();
  }
}
