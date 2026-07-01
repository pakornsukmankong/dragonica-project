import {
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

export class CreateDonationDto {
  // Amount in whole Baht. Omise minimum is ฿20; PromptPay max is ฿150,000.
  // Per-channel caps are enforced in the service.
  @IsInt()
  @Min(20)
  @Max(150000)
  amount: number;

  @IsIn(['promptpay', 'truemoney'])
  channel: 'promptpay' | 'truemoney';

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
}
