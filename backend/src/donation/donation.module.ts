import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OmiseModule } from '../omise/omise.module';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DonationController } from './donation.controller';
import { DonationService } from './donation.service';

@Module({
  imports: [AuthModule, OmiseModule],
  controllers: [DonationController],
  providers: [DonationService, AdminGuard],
})
export class DonationModule {}
