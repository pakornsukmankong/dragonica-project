import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';
import { SessionService } from '../session/session.service';
import { CharacterService } from '../character/character.service';
import { UpdateSessionDto } from '../session/dto/update-session.dto';
import { CreateDungeonDto } from './dto/create-dungeon.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { CreateClassDto } from './dto/create-class.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly sessionService: SessionService,
    private readonly characterService: CharacterService,
  ) {}

  // Users
  @Get('users')
  getUsers() {
    return this.adminService.getUsers();
  }

  @Get('users/:userId/sessions')
  getUserSessions(@Param('userId') userId: string) {
    return this.sessionService.findAllByUser(userId);
  }

  @Get('users/:userId/characters')
  getUserCharacters(@Param('userId') userId: string) {
    return this.characterService.findAllByUser(userId);
  }

  // Any user's sessions (edit / delete)
  @Patch('sessions/:id')
  updateSession(@Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.sessionService.updateAsAdmin(id, dto);
  }

  @Delete('sessions/:id')
  deleteSession(@Param('id') id: string) {
    return this.sessionService.removeAsAdmin(id);
  }

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
