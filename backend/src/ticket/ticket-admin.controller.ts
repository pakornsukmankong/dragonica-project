import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { TicketService } from './ticket.service';
import { CreateMessageDto } from './dto/create-message.dto';
import {
  TicketStatus,
  UpdateTicketStatusDto,
} from './dto/update-ticket-status.dto';

@Controller('admin/tickets')
@UseGuards(JwtAuthGuard, AdminGuard)
export class TicketAdminController {
  constructor(private readonly ticketService: TicketService) {}

  @Get()
  findAll(@Query('status') status?: TicketStatus) {
    return this.ticketService.findAll(status);
  }

  @Get('unread-count')
  unreadCount() {
    return this.ticketService.unreadCountForAdmin();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketService.viewForAdmin(id);
  }

  @Post(':id/messages')
  reply(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketService.addAdminMessage(user.sub, id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.ticketService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ticketService.remove(id);
  }
}
