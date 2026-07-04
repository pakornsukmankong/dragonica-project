import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { OmiseModule } from '../omise/omise.module';
import { BeamModule } from '../beam/beam.module';
import { AdminGuard } from '../auth/guards/admin.guard';
import { OmiseProvider } from '../payment/omise.provider';
import { BeamProvider } from '../payment/beam.provider';
import { PAYMENT_PROVIDER } from '../payment/payment-provider.interface';
import { DonationController } from './donation.controller';
import { DonationService } from './donation.service';

@Module({
  imports: [AuthModule, OmiseModule, BeamModule],
  controllers: [DonationController],
  providers: [
    DonationService,
    AdminGuard,
    OmiseProvider,
    BeamProvider,
    // Resolve the active gateway from the PAYMENT_PROVIDER flag (default omise).
    // Both adapters are constructed; only the selected one is injected into
    // DonationService.
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (
        config: ConfigService,
        omise: OmiseProvider,
        beam: BeamProvider,
      ) =>
        (config.get<string>('PAYMENT_PROVIDER') ?? 'omise') === 'beam'
          ? beam
          : omise,
      inject: [ConfigService, OmiseProvider, BeamProvider],
    },
  ],
})
export class DonationModule {}
