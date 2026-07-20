import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ItemCodeService } from './item-code.service';
import { CreateItemCodeDto } from './dto/create-item-code.dto';

@Controller('item-codes')
export class ItemCodeController {
  constructor(private readonly itemCodeService: ItemCodeService) {}

  // Public — guests browse and copy codes without an account.
  @Get()
  list() {
    return this.itemCodeService.list();
  }

  // Any logged-in user may contribute a code; throttled so the shared list
  // can't be flooded from one account.
  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(@Body() dto: CreateItemCodeDto, @CurrentUser() user: JwtPayload) {
    return this.itemCodeService.create(user.sub, dto);
  }

  // Owner-only edit / delete (the service 404s for non-owners). Throttled like
  // create: an edit can rename a code, so an unlimited PATCH is both a spam
  // channel and a way to probe which codes already exist via 409s.
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  update(
    @Param('id') id: string,
    @Body() dto: CreateItemCodeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.itemCodeService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.itemCodeService.remove(id, user.sub);
  }
}
