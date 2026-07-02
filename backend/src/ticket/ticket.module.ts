import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../auth/guards/admin.guard';
import { TicketController } from './ticket.controller';
import { TicketAdminController } from './ticket-admin.controller';
import { TicketService } from './ticket.service';

@Module({
  imports: [AuthModule],
  controllers: [TicketController, TicketAdminController],
  providers: [TicketService, AdminGuard],
})
export class TicketModule {}
