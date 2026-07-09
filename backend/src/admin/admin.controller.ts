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
import { SkillService } from '../skill/skill.service';
import { AdminUpdateBuildDto } from '../skill/dto/admin-update-build.dto';
import { UpdateSessionDto } from '../session/dto/update-session.dto';
import { CreateDropDto } from '../session/dto/create-drop.dto';
import { UpdateDropDto } from '../session/dto/update-drop.dto';
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
    private readonly skillService: SkillService,
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

  // Any user's session drops (edit / add / delete). Declared before the
  // `sessions/:id` routes so the literal `drops` segment is matched first.
  @Post('sessions/drops')
  addDrop(@Body() dto: CreateDropDto) {
    return this.sessionService.addDropAsAdmin(dto);
  }

  @Patch('sessions/drops/:dropId')
  updateDrop(@Param('dropId') dropId: string, @Body() dto: UpdateDropDto) {
    return this.sessionService.updateDropAsAdmin(dropId, dto);
  }

  @Delete('sessions/drops/:dropId')
  removeDrop(@Param('dropId') dropId: string) {
    return this.sessionService.removeDropAsAdmin(dropId);
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

  // Community skill builds (moderation: list all, edit metadata, delete).
  // Comment deletion reuses DELETE /skills/comments/:id, which admins may
  // already use on anyone's comment.
  @Get('skill-builds')
  getSkillBuilds() {
    return this.skillService.listAllBuildsAsAdmin();
  }

  @Get('skill-builds/:id/comments')
  getSkillBuildComments(@Param('id') id: string) {
    return this.skillService.listCommentsByBuildId(id);
  }

  @Patch('skill-builds/:id')
  updateSkillBuild(@Param('id') id: string, @Body() dto: AdminUpdateBuildDto) {
    return this.skillService.updateBuildAsAdmin(id, dto);
  }

  @Delete('skill-builds/:id')
  deleteSkillBuild(@Param('id') id: string) {
    return this.skillService.deleteBuildAsAdmin(id);
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
