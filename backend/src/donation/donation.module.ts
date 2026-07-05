import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { OmiseModule } from '../omise/omise.module';
import { BeamModule } from '../beam/beam.module';
import { AdminGuard } from '../auth/guards/admin.guard';
import { OmiseProvider } from '../payment/omise.provider';
import { BeamProvider } from '../payment/beam.provider';
import { ManualProvider } from '../payment/manual.provider';
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
    ManualProvider,
    // Resolve the active gateway from the PAYMENT_PROVIDER flag (default omise).
    // All adapters are constructed; only the selected one is injected into
    // DonationService. `manual` skips the gateway entirely (PromptPay QR +
    // admin confirmation) while Omise/Beam are being verified.
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (
        config: ConfigService,
        omise: OmiseProvider,
        beam: BeamProvider,
        manual: ManualProvider,
      ) => {
        switch (config.get<string>('PAYMENT_PROVIDER')) {
          case 'manual':
            return manual;
          case 'beam':
            return beam;
          default:
            return omise;
        }
      },
      inject: [ConfigService, OmiseProvider, BeamProvider, ManualProvider],
    },
  ],
})
export class DonationModule {}
