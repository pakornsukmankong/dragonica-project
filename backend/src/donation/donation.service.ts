import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { SupabaseService } from '../supabase/supabase.service';
import { TablesUpdate } from '../supabase/types/database.types';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from '../payment/payment-provider.interface';
import { CreateDonationDto, DonationChannel } from './dto/create-donation.dto';
import { AdminUpdateDonationDto } from './dto/admin-update-donation.dto';

// Per-channel maximums (in Baht) enforced before hitting the gateway. The DTO
// already caps every amount at ฿150,000; TrueMoney is tightened further here.
const MAX_BAHT: Record<DonationChannel, number> = {
  promptpay: 150000,
  truemoney: 100000,
  mobile_banking_scb: 150000,
  mobile_banking_kbank: 150000,
  mobile_banking_bay: 150000,
  mobile_banking_bbl: 150000,
  mobile_banking_ktb: 150000,
  rabbit_linepay: 150000,
  shopeepay: 150000,
  grabpay: 150000,
  card: 150000,
};

// Placeholder payer email used only when a guest donates without giving one.
// Some gateways require a syntactically-valid email on the charge (Stripe
// PromptPay puts it on billing_details); they don't verify the mailbox, and we
// don't set receipt_email, so nothing is ever sent to it — it just satisfies
// the required field so guests can pay without typing anything.
const GUEST_DONOR_EMAIL = 'guest@dgn-grind.dev';

type DonationStatus = 'pending' | 'successful' | 'failed' | 'expired';

export interface DonationRow {
  id: string;
  user_id: string;
  display_name: string;
  message: string | null;
  amount: number; // satang
  currency: string;
  channel: CreateDonationDto['channel'];
  // Gateway charge id (column is named omise_charge_id for historical reasons;
  // it now holds whichever provider's charge id created the donation).
  omise_charge_id: string | null;
  provider: string | null;
  status: DonationStatus;
  hide_amount: boolean;
  hide_from_wall: boolean;
  created_at: string;
  paid_at: string | null;
}

@Injectable()
export class DonationService {
  private readonly logger = new Logger(DonationService.name);

  constructor(
    private readonly supabase: SupabaseService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly config: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  /** The active provider's minimum and the per-channel cap, both in whole Baht. */
  private assertAmountWithinLimits(dto: CreateDonationDto) {
    if (dto.amount < this.provider.minAmount) {
      throw new BadRequestException(
        this.i18n.t('errors.donation.min_not_met', {
          args: { min: this.provider.minAmount },
        }),
      );
    }
    if (dto.amount > MAX_BAHT[dto.channel]) {
      throw new BadRequestException(
        this.i18n.t('errors.donation.max_exceeded', {
          args: {
            channel: dto.channel,
            max: MAX_BAHT[dto.channel].toLocaleString(),
          },
        }),
      );
    }
  }

  /**
   * Start a donation: record it, create the gateway charge, return payment info.
   * `userId`/`userEmail` come from the JWT for signed-in donors; both are null/
   * undefined for guests, who supply their own payer email via the DTO.
   */
  async create(
    userId: string | null,
    userEmail: string | undefined,
    dto: CreateDonationDto,
  ) {
    this.assertAmountWithinLimits(dto);

    const amountSatang = dto.amount * 100;
    const displayName = dto.displayName.trim() || 'Anonymous';
    // Prefer the account email, then a guest-provided one, then a placeholder so
    // gateways that require a payer email still work when a guest gives none.
    const payerEmail =
      userEmail?.trim() || dto.email?.trim() || GUEST_DONOR_EMAIL;

    // 1. Record the pending donation first so we always have a row to reconcile
    //    against, even if the charge call fails midway.
    const { data: inserted, error: insertError } = await this.supabase
      .from('donations')
      .insert({
        user_id: userId,
        display_name: displayName,
        message: dto.message?.trim() || null,
        amount: amountSatang,
        currency: 'THB',
        channel: dto.channel,
        provider: this.provider.name,
        hide_amount: dto.hideAmount ?? false,
        status: 'pending',
      })
      .select('*')
      .single();

    if (insertError) throw insertError;
    const donation = inserted as DonationRow;

    // 2. Create the gateway charge via the active provider.
    let charge;
    try {
      charge = await this.provider.createCharge({
        channel: dto.channel,
        amount: amountSatang,
        phoneNumber: dto.phoneNumber,
        email: payerEmail,
        referenceId: donation.id,
        returnUrl: `${this.config.get('FRONTEND_URL') || 'http://localhost:3000'}/support?donation=${donation.id}`,
      });
    } catch (err) {
      // Leave the row as failed; surface the provider error.
      await this.supabase
        .from('donations')
        .update({ status: 'failed' })
        .eq('id', donation.id);
      throw err;
    }

    // 3. Link the charge id so the webhook/poll can reconcile later.
    await this.supabase
      .from('donations')
      .update({ omise_charge_id: charge.providerChargeId })
      .eq('id', donation.id);

    return {
      id: donation.id,
      status: charge.status,
      channel: donation.channel,
      amount: donation.amount,
      displayName: donation.display_name,
      provider: this.provider.name,
      qrImageUri: charge.qrImageUri,
      authorizeUri: charge.authorizeUri,
      expiresAt: charge.expiresAt,
    };
  }

  /** Which payment provider is active — lets the frontend pick the right flow. */
  getConfig() {
    return {
      provider: this.provider.name,
      channels: this.provider.supportedChannels,
      minAmount: this.provider.minAmount,
    };
  }

  /** Admin: every donation, most recent first (guarded by AdminGuard). */
  async findAll(limit = 200) {
    const { data, error } = await this.supabase
      .from('donations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  /** Admin: edit a donation's display name / message. */
  async updateDetails(id: string, dto: AdminUpdateDonationDto) {
    const update: TablesUpdate<'donations'> = {};
    if (dto.displayName !== undefined) {
      update.display_name = dto.displayName.trim() || 'Anonymous';
    }
    if (dto.message !== undefined) {
      // An empty message clears it (same normalization as create()).
      update.message = dto.message.trim() || null;
    }

    // Nothing to change — an empty update would error at the DB layer.
    if (Object.keys(update).length === 0) {
      const { data } = await this.supabase
        .from('donations')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!data)
        throw new NotFoundException(this.i18n.t('errors.donation.not_found'));
      return data as DonationRow;
    }

    const { data: updated, error } = await this.supabase
      .from('donations')
      .update(update)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!updated)
      throw new NotFoundException(this.i18n.t('errors.donation.not_found'));
    return updated as DonationRow;
  }

  /** Admin: delete a donation record by id. */
  async remove(id: string) {
    const { data, error } = await this.supabase
      .from('donations')
      .select('id')
      .eq('id', id)
      .single();

    if (error || !data)
      throw new NotFoundException(this.i18n.t('errors.donation.not_found'));

    const { error: deleteError } = await this.supabase
      .from('donations')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    return { deleted: true };
  }

  /**
   * Admin: manually settle a `manual`-provider donation after verifying the
   * transfer in the bank statement. `successful` publishes it to the wall;
   * `failed` clears an abandoned/incomplete one. Only pending manual rows are
   * eligible — a gateway charge is never settled by hand.
   */
  async settleManual(id: string, status: 'successful' | 'failed') {
    const { data } = await this.supabase
      .from('donations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!data)
      throw new NotFoundException(this.i18n.t('errors.donation.not_found'));

    const row = data as DonationRow;
    if (row.provider !== 'manual')
      throw new BadRequestException(this.i18n.t('errors.donation.not_manual'));
    if (row.status !== 'pending')
      throw new BadRequestException(this.i18n.t('errors.donation.not_pending'));

    const update: TablesUpdate<'donations'> = { status };
    if (status === 'successful') update.paid_at = new Date().toISOString();

    const { data: updated, error } = await this.supabase
      .from('donations')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated as DonationRow;
  }

  /**
   * Manual mode: build the PromptPay QR for an amount without persisting
   * anything. The donor sees the QR, transfers, and only then confirms — at
   * which point a normal `create()` records the pending row. This keeps the
   * ledger free of QRs that were opened but never paid.
   */
  async preview(dto: CreateDonationDto) {
    if (this.provider.name !== 'manual')
      throw new BadRequestException(
        this.i18n.t('errors.donation.preview_unavailable'),
      );

    this.assertAmountWithinLimits(dto);

    const amountSatang = dto.amount * 100;
    const charge = await this.provider.createCharge({
      channel: dto.channel,
      amount: amountSatang,
      phoneNumber: dto.phoneNumber,
      referenceId: 'preview',
      returnUrl: '',
    });

    return {
      id: '', // no row yet — created on confirm
      status: charge.status,
      channel: dto.channel,
      amount: amountSatang,
      displayName: dto.displayName.trim() || 'Anonymous',
      provider: this.provider.name,
      qrImageUri: charge.qrImageUri,
      authorizeUri: charge.authorizeUri,
      expiresAt: charge.expiresAt,
    };
  }

  /** Admin: show or hide a donation's amount on the public thank-you wall. */
  async setVisibility(
    id: string,
    opts: { hideAmount?: boolean; hideFromWall?: boolean },
  ) {
    const { data } = await this.supabase
      .from('donations')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (!data)
      throw new NotFoundException(this.i18n.t('errors.donation.not_found'));

    const update: TablesUpdate<'donations'> = {};
    if (opts.hideAmount !== undefined) update.hide_amount = opts.hideAmount;
    if (opts.hideFromWall !== undefined)
      update.hide_from_wall = opts.hideFromWall;
    if (Object.keys(update).length === 0) return data as DonationRow;

    const { data: updated, error } = await this.supabase
      .from('donations')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated as DonationRow;
  }

  /** A user's own donation history (most recent first). */
  async findAllByUser(userId: string) {
    const { data, error } = await this.supabase
      .from('donations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Fetch one of the user's donations. If it is still pending, re-check with the
   * gateway so polling drives the status forward even when the webhook hasn't
   * arrived yet (e.g. local dev where the gateway can't reach localhost).
   */
  async findOneByUser(id: string, userId: string) {
    const { data, error } = await this.supabase
      .from('donations')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data)
      throw new NotFoundException(this.i18n.t('errors.donation.not_found'));

    let donation = data as DonationRow;
    if (donation.status === 'pending' && donation.omise_charge_id) {
      donation = await this.syncFromProvider(
        donation.omise_charge_id,
        donation,
      );
    }
    return donation;
  }

  /**
   * Look up a donation by id alone (no owner scope) so a guest — who has no
   * session — can poll the payment modal forward. The id is an unguessable
   * uuid, so possessing it is the capability. Like {@link findOneByUser}, a
   * still-pending row is re-checked against the gateway.
   */
  async findOnePublic(id: string) {
    const { data, error } = await this.supabase
      .from('donations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data)
      throw new NotFoundException(this.i18n.t('errors.donation.not_found'));

    let donation = data as DonationRow;
    if (donation.status === 'pending' && donation.omise_charge_id) {
      donation = await this.syncFromProvider(
        donation.omise_charge_id,
        donation,
      );
    }
    return donation;
  }

  /** Public thank-you wall: recent confirmed donations. */
  async wall(limit = 50) {
    const { data, error } = await this.supabase
      .from('donations')
      .select('display_name, amount, message, paid_at, hide_amount')
      .eq('status', 'successful')
      .eq('hide_from_wall', false)
      .order('paid_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Withhold the amount server-side for donors who opted out, so a hidden
    // amount never reaches the client at all.
    return (data ?? []).map(({ hide_amount, amount, ...rest }) => ({
      ...rest,
      amount: hide_amount ? null : amount,
    }));
  }

  /**
   * Handle a gateway webhook. We never trust the payload's status — we take only
   * the charge id from it and re-fetch the real charge from the gateway with our
   * secret key, so a forged webhook cannot mark a donation as paid.
   */
  async handleWebhook(event: unknown): Promise<{ received: boolean }> {
    const chargeId = this.provider.extractChargeId(event);
    if (!chargeId) return { received: true };

    const { data } = await this.supabase
      .from('donations')
      .select('*')
      .eq('omise_charge_id', chargeId)
      .maybeSingle();

    if (!data) {
      // Not one of ours (or not linked yet) — acknowledge and move on.
      return { received: true };
    }

    await this.syncFromProvider(chargeId, data as DonationRow);
    return { received: true };
  }

  /** Re-fetch a charge from the gateway and persist any status change. */
  private async syncFromProvider(
    chargeId: string,
    current: DonationRow,
  ): Promise<DonationRow> {
    let status: DonationStatus;
    try {
      status = (await this.provider.getCharge(chargeId)).status;
    } catch (err) {
      this.logger.warn(
        `Could not sync charge ${chargeId}: ${(err as Error).message}`,
      );
      return current;
    }

    if (status === current.status) return current;

    const update: TablesUpdate<'donations'> = { status };
    if (status === 'successful' && !current.paid_at) {
      update.paid_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('donations')
      .update(update)
      .eq('id', current.id)
      .select('*')
      .single();

    if (error) throw error;
    return data as DonationRow;
  }
}
