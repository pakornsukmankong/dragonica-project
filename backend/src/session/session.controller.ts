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
import { SessionService } from './session.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { CreateDropDto } from './dto/create-drop.dto';
import { UpdateDropDto } from './dto/update-drop.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.sessionService.findAllByUser(user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.sessionService.findOneByUser(id, user.sub);
  }

  @Post()
  create(@Body() dto: CreateSessionDto, @CurrentUser() user: JwtPayload) {
    return this.sessionService.create(user.sub, dto);
  }

  @Post('drops')
  addDrop(@Body() dto: CreateDropDto, @CurrentUser() user: JwtPayload) {
    return this.sessionService.addDrop(user.sub, dto);
  }

  @Patch('drops/:dropId')
  updateDrop(
    @Param('dropId') dropId: string,
    @Body() dto: UpdateDropDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sessionService.updateDrop(user.sub, dropId, dto);
  }

  @Delete('drops/:dropId')
  removeDrop(@Param('dropId') dropId: string, @CurrentUser() user: JwtPayload) {
    return this.sessionService.removeDrop(user.sub, dropId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sessionService.update(id, user.sub, dto);
  }

  @Delete()
  removeAll(@CurrentUser() user: JwtPayload) {
    return this.sessionService.removeAllByUser(user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.sessionService.remove(id, user.sub);
  }
}
