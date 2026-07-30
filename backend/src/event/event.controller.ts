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
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  // Public — guests browse the timetable without an account.
  @Get()
  list() {
    return this.eventService.list();
  }

  // Any logged-in user may add an event; throttled so the shared calendar
  // can't be flooded from one account.
  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(@Body() dto: CreateEventDto, @CurrentUser() user: JwtPayload) {
    return this.eventService.create(user.sub, dto);
  }

  // Owner-only edit / delete (the service 404s for non-owners). Throttled like
  // create so an edit can't become a spam channel.
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  update(
    @Param('id') id: string,
    @Body() dto: CreateEventDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.eventService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.eventService.remove(id, user.sub);
  }
}
