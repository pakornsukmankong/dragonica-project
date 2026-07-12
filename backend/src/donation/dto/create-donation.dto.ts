import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

// Every payment channel we accept. Each value is also the exact Omise source
// `type` string, so it doubles as the source type when creating a charge.
// PromptPay is QR (poll); everything else is an off-site redirect
// (authorize_uri). TrueMoney additionally needs a phone number.
export const DONATION_CHANNELS = [
  'promptpay',
  'truemoney',
  'mobile_banking_scb',
  'mobile_banking_kbank',
  'mobile_banking_bay',
  'mobile_banking_bbl',
  'mobile_banking_ktb',
  'rabbit_linepay',
  'shopeepay',
  'grabpay',
  'card',
] as const;

export type DonationChannel = (typeof DONATION_CHANNELS)[number];

export class CreateDonationDto {
  // Amount in whole Baht. ฿10 is the absolute floor (Stripe's THB minimum);
  // the service enforces the active provider's own minimum (e.g. Omise ฿20)
  // and the per-channel caps.
  @IsInt()
  @Min(10)
  @Max(150000)
  amount: number;

  @IsIn(DONATION_CHANNELS)
  channel: DonationChannel;

  @IsString()
  @MaxLength(60)
  displayName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;

  // Required for TrueMoney Wallet only: a 10-digit Thai mobile number.
  @ValidateIf((o) => o.channel === 'truemoney')
  @Matches(/^0\d{9}$/, {
    message: 'phoneNumber must be a 10-digit number starting with 0',
  })
  phoneNumber?: string;

  // When true, keep the amount off the public thank-you wall (name + message
  // still show). Applies to every payment provider.
  @IsOptional()
  @IsBoolean()
  hideAmount?: boolean;
}
