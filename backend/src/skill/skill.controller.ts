import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { SkillService } from './skill.service';
import { SaveBuildDto } from './dto/save-build.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';

@Controller('skills')
export class SkillController {
  constructor(private readonly skillService: SkillService) {}

  // --- public reference data (no auth) ---------------------------------------

  @Get('classes')
  listClasses() {
    return this.skillService.listClasses();
  }

  @Get('classes/:classId')
  getClassTree(@Param('classId', ParseIntPipe) classId: number) {
    return this.skillService.getClassTree(classId);
  }

  // Public community gallery of shared builds.
  @Get('community')
  community(
    @Query('classId') classId?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
  ) {
    return this.skillService.listPublicBuilds({
      classId: classId ? Number(classId) : undefined,
      search: search || undefined,
      sort: sort || undefined,
      page: page ? Number(page) : 1,
    });
  }

  // Public share view — anyone with the link can open the build.
  @Get('builds/:slug')
  getBuild(@Param('slug') slug: string) {
    return this.skillService.getBuildBySlug(slug);
  }

  // --- social: likes, comments, views -----------------------------------------

  @Get('builds/:slug/comments')
  comments(@Param('slug') slug: string) {
    return this.skillService.listComments(slug);
  }

  // Best-effort view counter; the client dedupes per session, this throttle
  // caps abuse per IP.
  @Post('builds/:slug/view')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  view(@Param('slug') slug: string) {
    return this.skillService.recordView(slug);
  }

  @Get('builds/:slug/liked')
  @UseGuards(JwtAuthGuard)
  liked(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    return this.skillService.getLiked(slug, user.sub);
  }

  @Post('builds/:slug/like')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  toggleLike(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    return this.skillService.toggleLike(slug, user.sub);
  }

  @Post('builds/:slug/comments')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  addComment(
    @Param('slug') slug: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.skillService.addComment(slug, user.sub, dto);
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  removeComment(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.skillService.deleteComment(id, user.sub);
  }

  // --- authenticated build management ----------------------------------------

  @Get('me/builds')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: JwtPayload) {
    return this.skillService.listMyBuilds(user.sub);
  }

  @Post('builds')
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: SaveBuildDto, @CurrentUser() user: JwtPayload) {
    return this.skillService.createBuild(user.sub, dto);
  }

  @Patch('builds/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: SaveBuildDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.skillService.updateBuild(id, user.sub, dto);
  }

  @Patch('builds/:id/visibility')
  @UseGuards(JwtAuthGuard)
  setVisibility(
    @Param('id') id: string,
    @Body() dto: UpdateVisibilityDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.skillService.setBuildVisibility(id, user.sub, dto.visibility);
  }

  @Delete('builds/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.skillService.deleteBuild(id, user.sub);
  }
}
