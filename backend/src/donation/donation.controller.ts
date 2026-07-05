import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Logger,
  Param,
  Patch,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { BeamService } from '../beam/beam.service';
import { StripeService } from '../stripe/stripe.service';
import { DonationService } from './donation.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';

@Controller('donations')
export class DonationController {
  private readonly logger = new Logger(DonationController.name);

  constructor(
    private readonly donationService: DonationService,
    private readonly beam: BeamService,
    private readonly stripe: StripeService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateDonationDto, @CurrentUser() user: JwtPayload) {
    return this.donationService.create(user.sub, dto);
  }

  // Manual mode only: render the PromptPay QR without recording anything. The
  // pending donation row is created only once the donor confirms the transfer
  // (a normal POST /donations), so unpaid QRs never clutter the ledger.
  @Post('preview')
  @UseGuards(JwtAuthGuard)
  preview(@Body() dto: CreateDonationDto) {
    return this.donationService.preview(dto);
  }

  // Public: Omise calls this after a charge changes state. No JWT — the
  // handler verifies authenticity by re-fetching the charge from Omise.
  @Post('omise/webhook')
  @HttpCode(200)
  webhook(@Body() event: unknown) {
    return this.donationService.handleWebhook(event);
  }

  // Public: Beam calls this on charge events. Verifies the X-Beam-Signature
  // over the *raw* body, then reconciles by re-fetching the charge from Beam
  // (never trusts the payload). No JWT.
  @Post('beam/webhook')
  @HttpCode(200)
  beamWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-beam-signature') signature?: string,
  ) {
    const raw = req.rawBody;
    if (!raw || !this.beam.verifyWebhookSignature(raw, signature)) {
      this.logger.warn('Beam webhook: invalid signature — rejected');
      throw new UnauthorizedException('Invalid Beam webhook signature');
    }
    return this.donationService.handleWebhook(JSON.parse(raw.toString('utf8')));
  }

  // Public: Stripe calls this on PaymentIntent events. Verifies the
  // Stripe-Signature over the *raw* body (SDK), then reconciles by re-fetching
  // the intent from Stripe (never trusts the payload). No JWT.
  @Post('stripe/webhook')
  @HttpCode(200)
  stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    const raw = req.rawBody;
    let event: unknown;
    try {
      if (!raw) throw new Error('missing raw body');
      event = this.stripe.constructWebhookEvent(raw, signature);
    } catch {
      this.logger.warn('Stripe webhook: invalid signature — rejected');
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }
    return this.donationService.handleWebhook(event);
  }

  // Which payment provider is active, so the frontend can render the matching
  // flow (e.g. manual PromptPay + admin confirmation vs. a live gateway).
  @Get('config')
  @UseGuards(JwtAuthGuard)
  config() {
    return this.donationService.getConfig();
  }

  // Admin-only: full donation ledger.
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  findAllAdmin() {
    return this.donationService.findAll();
  }

  // Admin-only: settle a manual (gateway-free) donation after checking the bank
  // statement — confirm marks it paid (→ wall), reject clears it.
  @Post('admin/:id/confirm')
  @UseGuards(JwtAuthGuard, AdminGuard)
  confirmManual(@Param('id') id: string) {
    return this.donationService.settleManual(id, 'successful');
  }

  @Post('admin/:id/reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  rejectManual(@Param('id') id: string) {
    return this.donationService.settleManual(id, 'failed');
  }

  // Admin-only: show or hide this donation's amount on the public wall.
  @Patch('admin/:id/visibility')
  @UseGuards(JwtAuthGuard, AdminGuard)
  setVisibility(@Param('id') id: string, @Body() dto: UpdateVisibilityDto) {
    return this.donationService.setHideAmount(id, dto.hideAmount);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  removeAdmin(@Param('id') id: string) {
    return this.donationService.remove(id);
  }

  @Get('wall')
  @UseGuards(JwtAuthGuard)
  wall() {
    return this.donationService.wall();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: JwtPayload) {
    return this.donationService.findAllByUser(user.sub);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.donationService.findOneByUser(id, user.sub);
  }
}
