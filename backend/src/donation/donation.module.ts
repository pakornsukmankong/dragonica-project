import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { OmiseModule } from '../omise/omise.module';
import { BeamModule } from '../beam/beam.module';
import { StripeModule } from '../stripe/stripe.module';
import { AdminGuard } from '../auth/guards/admin.guard';
import { OmiseProvider } from '../payment/omise.provider';
import { BeamProvider } from '../payment/beam.provider';
import { ManualProvider } from '../payment/manual.provider';
import { StripeProvider } from '../payment/stripe.provider';
import { PAYMENT_PROVIDER } from '../payment/payment-provider.interface';
import { DonationController } from './donation.controller';
import { DonationService } from './donation.service';

@Module({
  imports: [AuthModule, OmiseModule, BeamModule, StripeModule],
  controllers: [DonationController],
  providers: [
    DonationService,
    AdminGuard,
    OmiseProvider,
    BeamProvider,
    ManualProvider,
    StripeProvider,
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
        stripe: StripeProvider,
      ) => {
        const flag = config.get<string>('PAYMENT_PROVIDER');
        const provider =
          flag === 'manual'
            ? manual
            : flag === 'beam'
              ? beam
              : flag === 'stripe'
                ? stripe
                : omise;
        // One-line startup signal of which gateway is live.
        new Logger('PaymentProvider').log(
          `active provider = ${provider.name} (PAYMENT_PROVIDER=${flag ?? 'unset'})`,
        );
        return provider;
      },
      inject: [
        ConfigService,
        OmiseProvider,
        BeamProvider,
        ManualProvider,
        StripeProvider,
      ],
    },
  ],
})
export class DonationModule {}
