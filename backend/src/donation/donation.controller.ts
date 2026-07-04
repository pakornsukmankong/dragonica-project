import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
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
import { DonationService } from './donation.service';
import { CreateDonationDto } from './dto/create-donation.dto';

@Controller('donations')
export class DonationController {
  constructor(
    private readonly donationService: DonationService,
    private readonly beam: BeamService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateDonationDto, @CurrentUser() user: JwtPayload) {
    return this.donationService.create(user.sub, dto);
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
      throw new UnauthorizedException('Invalid Beam webhook signature');
    }
    return this.donationService.handleWebhook(JSON.parse(raw.toString('utf8')));
  }

  // Admin-only: full donation ledger.
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  findAllAdmin() {
    return this.donationService.findAll();
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
