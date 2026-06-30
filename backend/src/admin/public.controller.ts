import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';

@Controller('game-data')
@UseGuards(JwtAuthGuard)
export class PublicDataController {
  constructor(private readonly adminService: AdminService) {}

  @Get('items')
  getItems() {
    return this.adminService.getItems();
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
