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
import { CharacterService } from './character.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('characters')
@UseGuards(JwtAuthGuard)
export class CharacterController {
  constructor(private readonly characterService: CharacterService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.characterService.findAllByUser(user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.characterService.findOneByUser(id, user.sub);
  }

  @Post()
  create(@Body() dto: CreateCharacterDto, @CurrentUser() user: JwtPayload) {
    return this.characterService.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCharacterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.characterService.update(id, user.sub, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.characterService.remove(id, user.sub);
  }
}
