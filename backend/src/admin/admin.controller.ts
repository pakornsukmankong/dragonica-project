import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';
import { CreateDungeonDto } from './dto/create-dungeon.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { CreateClassDto } from './dto/create-class.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Dungeons
  @Get('dungeons')
  getDungeons() {
    return this.adminService.getDungeons();
  }

  @Post('dungeons')
  createDungeon(@Body() dto: CreateDungeonDto) {
    return this.adminService.createDungeon(dto);
  }

  @Delete('dungeons/:id')
  deleteDungeon(@Param('id') id: string) {
    return this.adminService.deleteDungeon(id);
  }

  // Items
  @Get('items')
  getItems() {
    return this.adminService.getItems();
  }

  @Post('items')
  createItem(@Body() dto: CreateItemDto) {
    return this.adminService.createItem(dto);
  }

  @Delete('items/:id')
  deleteItem(@Param('id') id: string) {
    return this.adminService.deleteItem(id);
  }

  // Classes
  @Get('classes')
  getClasses() {
    return this.adminService.getClasses();
  }

  @Post('classes')
  createClass(@Body() dto: CreateClassDto) {
    return this.adminService.createClass(dto);
  }

  @Delete('classes/:id')
  deleteClass(@Param('id') id: string) {
    return this.adminService.deleteClass(id);
  }
}
