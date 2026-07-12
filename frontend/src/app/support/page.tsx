'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Heart,
  QrCode,
  Wallet,
  CreditCard,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  PlaySquare,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { NumericInput } from '@/components/numeric-input';
import { Select } from '@/components/select';
import type {
  Donation,
  DonationChannel,
  DonationCharge,
  DonationWallEntry,
} from '@/types';

const baht = (satang: number) => `฿${(satang / 100).toLocaleString('en-US')}`;

const PRESETS = [20, 50, 100, 300, 500];

// Channel value → i18n label key (under the `support` namespace). Order here is
// the order shown in the dropdown.
const CHANNEL_LABEL_KEYS: { value: DonationChannel; labelKey: string }[] = [
  { value: 'promptpay', labelKey: 'promptpay' },
  { value: 'card', labelKey: 'card' },
  { value: 'truemoney', labelKey: 'truemoney' },
  { value: 'rabbit_linepay', labelKey: 'rabbitLinepay' },
  { value: 'shopeepay', labelKey: 'shopeepay' },
  { value: 'grabpay', labelKey: 'grabpay' },
  { value: 'mobile_banking_scb', labelKey: 'mbScb' },
  { value: 'mobile_banking_kbank', labelKey: 'mbKbank' },
  { value: 'mobile_banking_bay', labelKey: 'mbBay' },
  { value: 'mobile_banking_bbl', labelKey: 'mbBbl' },
  { value: 'mobile_banking_ktb', labelKey: 'mbKtb' },
];

function SupportPageInner() {
  const t = useTranslations('support');
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Which payment provider the backend is using. In "manual" mode there is no
  // gateway: only PromptPay is offered, and the donor self-declares the transfer
  // then waits for an admin to confirm.
  const { data: paymentConfig, isLoading: configLoading } = useQuery<{
    provider: string;
    channels?: DonationChannel[];
    minAmount?: number;
  }>({
    queryKey: ['donations', 'config'],
    queryFn: () => api.get('/donations/config'),
    staleTime: Infinity,
  });
  const isManual = paymentConfig?.provider === 'manual';

  // Provider-specific minimum (Stripe ฿10, others ฿20) — the backend reports
  // it; keep the stricter ฿20 until the config resolves.
  const minAmount = paymentConfig?.minAmount ?? 20;
  const presets = minAmount < PRESETS[0] ? [minAmount, ...PRESETS] : PRESETS;

  // Only offer channels the active provider can actually collect (the backend
  // reports them). Falls back to all channels until the config resolves.
  const supportedChannels = paymentConfig?.channels;
  const channelOptions = CHANNEL_LABEL_KEYS.filter(
    ({ value }) => !supportedChannels || supportedChannels.includes(value),
  ).map(({ value, labelKey }) => ({
    value,
    label: t(labelKey),
  }));

  const [amount, setAmount] = useState<number | ''>(20);
  const [channel, setChannel] = useState<DonationChannel>('promptpay');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [hideAmount, setHideAmount] = useState(true);
  const [nameTouched, setNameTouched] = useState(false);

  // The active charge drives the payment modal (QR for PromptPay, or a
  // "confirming" spinner when returning from a TrueMoney redirect).
  const [charge, setCharge] = useState<DonationCharge | null>(null);
  const notified = useRef(false);

  // Prefill the display name from the user's profile.
  const { data: me } = useQuery<{ username: string | null; email: string }>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me'),
  });
  useEffect(() => {
    if (me && !nameTouched && !displayName) {
      setDisplayName(me.username?.trim() || me.email?.split('@')[0] || '');
    }
  }, [me, nameTouched, displayName]);

  // If the selected channel isn't supported by the active provider, snap to the
  // first one that is (e.g. GrabPay/mobile-banking hidden under Beam, or
  // everything but PromptPay under manual mode).
  useEffect(() => {
    if (supportedChannels && !supportedChannels.includes(channel)) {
      setChannel(supportedChannels[0] ?? 'promptpay');
    }
  }, [supportedChannels, channel]);

  // Thank-you wall.
  const { data: wall } = useQuery<DonationWallEntry[]>({
    queryKey: ['donations', 'wall'],
    queryFn: () => api.get('/donations/wall'),
  });

  // Live YouTube channel stats (falls back to static values on failure).
  const { data: ytChannel } = useQuery<{
    subscriberCount: number | null;
    title: string | null;
    avatarUrl: string | null;
  }>({
    queryKey: ['youtube', 'channel'],
    queryFn: () => api.get('/youtube/channel'),
    staleTime: 60 * 60 * 1000,
  });
  const ytTitle = ytChannel?.title || 'FLOKZ CHANNEL';
  const ytAvatar = ytChannel?.avatarUrl || '/youtube-avatar.jpg';
  const ytSubs = ytChannel?.subscriberCount ?? 479;

  // After a TrueMoney redirect, Omise returns to ?donation=<id>. Pick that up,
  // open the modal in "confirming" mode, and clear the param from the URL.
  useEffect(() => {
    const returned = searchParams.get('donation');
    if (returned && !charge) {
      setCharge({
        id: returned,
        status: 'pending',
        channel: 'truemoney',
        amount: 0,
        displayName: '',
        provider: 'omise',
        qrImageUri: null,
        authorizeUri: null,
        expiresAt: null,
      });
      router.replace('/support');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Poll the donation while it is pending; the backend re-checks Omise on read.
  // In manual mode there is nothing to poll — the donor closes the modal after
  // declaring the transfer and an admin settles it later, so skip polling. Key
  // this off the charge itself (authoritative) rather than the config query,
  // which may not have resolved yet when the donor clicks donate.
  const { data: polled } = useQuery<Donation>({
    queryKey: ['donation', charge?.id],
    queryFn: () => api.get(`/donations/${charge!.id}`),
    enabled: !!charge && charge.provider !== 'manual',
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return !s || s === 'pending' ? 3000 : false;
    },
  });

  const status = polled?.status ?? charge?.status ?? 'pending';
  const modalAmount = polled?.amount ?? charge?.amount ?? 0;

  // Fire a single toast + refresh the wall when the payment settles.
  useEffect(() => {
    if (!charge || status === 'pending' || notified.current) return;
    notified.current = true;
    if (status === 'successful') {
      toast({ title: t('toastThankYou'), variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['donations', 'wall'] });
    } else {
      toast({
        title: status === 'expired' ? t('toastExpired') : t('toastFailed'),
        description: t('toastFailedDesc'),
        variant: 'error',
      });
    }
  }, [status, charge, toast, queryClient]);

  const donationPayload = () => ({
    amount: Number(amount),
    channel,
    displayName: displayName.trim() || 'Anonymous',
    message: message.trim() || undefined,
    phoneNumber: channel === 'truemoney' ? phone.trim() : undefined,
    hideAmount,
  });

  // Gateway mode: create the pending donation immediately and collect payment
  // (QR in-app for PromptPay, off-site redirect for the rest).
  const createMut = useMutation({
    mutationFn: (): Promise<DonationCharge> =>
      api.post('/donations', donationPayload()),
    onSuccess: (c) => {
      // PromptPay is confirmed in-app via a QR modal. Omise returns a QR *and*
      // an authorize_uri for PromptPay, so key off the QR first: if there's a
      // QR, always show it in-app rather than bouncing off-site. Every other
      // channel (TrueMoney, mobile banking, e-wallets) has only an
      // authorize_uri — redirect there.
      if (c.qrImageUri) {
        notified.current = false;
        setCharge(c);
        return;
      }
      if (c.authorizeUri) {
        window.location.href = c.authorizeUri;
        return;
      }
      notified.current = false;
      setCharge(c);
    },
    onError: (e) =>
      toast({
        title: t('toastStartErrorTitle'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  // Manual mode: just render the QR — nothing is recorded until the donor
  // confirms the transfer.
  const previewMut = useMutation({
    mutationFn: (): Promise<DonationCharge> =>
      api.post('/donations/preview', donationPayload()),
    onSuccess: (c) => {
      notified.current = false;
      setCharge(c);
    },
    onError: (e) =>
      toast({
        title: t('toastStartErrorTitle'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  // Manual mode: the donor confirms they've transferred — only now do we record
  // the pending donation for an admin to verify.
  const confirmMut = useMutation({
    mutationFn: (): Promise<DonationCharge> =>
      api.post('/donations', donationPayload()),
    onSuccess: () => {
      setCharge(null);
      notified.current = false;
      toast({ title: t('toastAwaitingReview'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastStartErrorTitle'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const starting = isManual ? previewMut.isPending : createMut.isPending;
  const startDonation = () =>
    isManual ? previewMut.mutate() : createMut.mutate();

  const phoneValid = /^0\d{9}$/.test(phone.trim());
  const canSubmit =
    Number(amount) >= minAmount &&
    (channel !== 'truemoney' || phoneValid) &&
    // Wait for the provider to be known so we pick the right flow. This only
    // gates the initial load; if the config request fails, `configLoading`
    // still clears and we fall back to the gateway path (createMut) unchanged.
    !configLoading &&
    !starting;

  const closeModal = () => {
    setCharge(null);
    notified.current = false;
    queryClient.invalidateQueries({ queryKey: ['donation'] });
  };

  return (
    <main className="min-h-screen bg-root">
      <section className="relative overflow-hidden py-[60px] laptop:py-[90px]">
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: 'url(/texture.png)',
            backgroundRepeat: 'repeat',
            opacity: 0.05,
            mixBlendMode: 'multiply',
          }}
        />
        <div className="relative z-10 mx-auto max-w-container px-4 sm:px-7">
          {/* Header */}
          <div className="mb-10 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-base bg-gold-soft text-gold shadow-gold">
              <Heart className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl laptop:text-2xl font-medium text-foreground">
                {t('title')}
              </h1>
              <p className="text-sm text-muted mt-1">
                {t('subtitle')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 laptop:grid-cols-5 gap-6">
            {/* Donate form */}
            <div className="laptop:col-span-3 bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
              <h2 className="text-sm font-semibold text-foreground mb-5">
                {t('makeDonation')}
              </h2>

              {/* Amount */}
              <label className="block text-xs font-medium text-muted mb-2">
                {t('amountLabel', { min: minAmount })}
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(p)}
                    className={`rounded-base px-4 py-2 text-sm font-medium transition-colors duration-150 ${
                      amount === p
                        ? 'bg-gold-soft text-gold outline outline-1 outline-[rgba(224,165,60,0.35)]'
                        : 'bg-raised text-muted hover:text-foreground'
                    }`}
                  >
                    ฿{p}
                  </button>
                ))}
              </div>
              <div className="relative mb-5">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                  ฿
                </span>
                <NumericInput
                  value={amount}
                  onValueChange={(v) => setAmount(v === 0 ? '' : Math.min(150000, v))}
                  placeholder={String(minAmount)}
                  className="w-full rounded-base border border-border bg-surface pl-7 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)]"
                />
              </div>

              {/* Channel */}
              <label className="block text-xs font-medium text-muted mb-2">
                {t('paymentMethod')}
              </label>
              <div className="mb-5">
                <Select
                  value={channel}
                  onChange={(v) => setChannel(v as DonationChannel)}
                  options={channelOptions}
                />
              </div>

              {/* Phone (TrueMoney only) */}
              {channel === 'truemoney' && (
                <div className="mb-5">
                  <label className="block text-xs font-medium text-muted mb-2">
                    {t('phoneLabel')}
                  </label>
                  <input
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))
                    }
                    inputMode="numeric"
                    placeholder={t('phonePlaceholder')}
                    className="w-full rounded-base border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)]"
                  />
                  {phone && !phoneValid && (
                    <p className="mt-1 text-xs text-[var(--fg-danger)]">
                      {t('phoneError')}
                    </p>
                  )}
                </div>
              )}

              {/* Display name */}
              <label className="block text-xs font-medium text-muted mb-2">
                {t('displayNameLabel')}
              </label>
              <input
                value={displayName}
                onChange={(e) => {
                  setNameTouched(true);
                  setDisplayName(e.target.value);
                }}
                maxLength={60}
                placeholder={t('displayNamePlaceholder')}
                className="w-full rounded-base border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)] mb-5"
              />

              {/* Message */}
              <label className="block text-xs font-medium text-muted mb-2">
                {t('messageLabel')}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={200}
                rows={3}
                placeholder={t('messagePlaceholder')}
                className="w-full resize-none rounded-base border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)] mb-4"
              />

              {/* Privacy: keep the amount off the public wall (all providers). */}
              <label className="mb-6 flex cursor-pointer items-center gap-2.5 text-sm text-muted select-none">
                <input
                  type="checkbox"
                  checked={hideAmount}
                  onChange={(e) => setHideAmount(e.target.checked)}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--blue)]"
                />
                {t('hideAmountLabel')}
              </label>

              <button
                onClick={startDonation}
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-base bg-[var(--blue)] px-5 py-3 text-sm font-semibold text-[#1b1407] shadow-button transition-colors duration-150 hover:opacity-90 disabled:opacity-50"
              >
                {starting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : channel === 'promptpay' ? (
                  <QrCode className="h-4 w-4" />
                ) : channel === 'card' ? (
                  <CreditCard className="h-4 w-4" />
                ) : (
                  <Wallet className="h-4 w-4" />
                )}
                {starting
                  ? t('starting')
                  : amount
                    ? t('donate', { amount: baht(Number(amount) * 100) })
                    : t('donateBlank')}
              </button>
              <p className="mt-3 text-center text-[11px] text-muted">
                {isManual ? t('secureNoteManual') : t('secureNote')}
              </p>
            </div>

            {/* Right column: supporters wall + YouTube subscribe */}
            <div className="laptop:col-span-2 flex flex-col gap-6">
              {/* Thank-you wall */}
              <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-semibold text-foreground">
                    {t('recentSupporters')}
                  </h2>
                </div>
                {!wall || wall.length === 0 ? (
                  <p className="text-xs text-muted">{t('noSupporters')}</p>
                ) : (
                  <ul className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                    {wall.map((d, i) => (
                      <li
                        key={i}
                        className="flex items-start justify-between gap-3 rounded-base bg-raised px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {d.display_name}
                          </p>
                          {d.message && <SupporterMessage text={d.message} />}
                        </div>
                        {d.amount != null && (
                          <span className="shrink-0 text-sm font-semibold text-gold tabular-nums">
                            {baht(d.amount)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* YouTube subscribe */}
              <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
                <div className="mb-3 flex items-center gap-2">
                  <PlaySquare className="h-4 w-4 text-[#FF0000]" />
                  <h2 className="text-sm font-semibold text-foreground">
                    {t('youtubeTitle')}
                  </h2>
                </div>
                <p className="mb-4 text-xs text-muted">{t('youtubeSubtitle')}</p>
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ytAvatar}
                    alt={ytTitle}
                    className="h-12 w-12 shrink-0 rounded-full outline outline-1 outline-[rgba(255,255,255,0.1)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {ytTitle}
                    </p>
                    <p className="text-xs text-muted">
                      {t('subscriberCount', { count: ytSubs })}
                    </p>
                  </div>
                  <a
                    href="https://www.youtube.com/channel/UC2HoBQZT88jlscMBsWzg8KA?sub_confirmation=1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex shrink-0 items-center gap-1.5 rounded-base bg-[#FF0000] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    <PlaySquare className="h-4 w-4" />
                    {t('subscribe')}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {charge && (
        <PaymentModal
          charge={charge}
          status={status}
          amount={modalAmount}
          isManual={charge.provider === 'manual'}
          onClose={closeModal}
          onPaid={() => confirmMut.mutate()}
          confirming={confirmMut.isPending}
        />
      )}
    </main>
  );
}

function PaymentModal({
  charge,
  status,
  amount,
  isManual,
  onClose,
  onPaid,
  confirming,
}: {
  charge: DonationCharge;
  status: Donation['status'];
  amount: number;
  isManual: boolean;
  onClose: () => void;
  onPaid: () => void;
  confirming: boolean;
}) {
  const t = useTranslations('support');
  // Live countdown for the PromptPay QR (gateway mode only; manual has no poll).
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (status !== 'pending' || isManual) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status, isManual]);

  const remaining = useMemo(() => {
    if (!charge.expiresAt) return null;
    return Math.max(0, Math.floor((new Date(charge.expiresAt).getTime() - now) / 1000));
  }, [charge.expiresAt, now]);
  const mmss =
    remaining == null
      ? null
      : `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-base border border-border bg-surface p-6 text-center shadow-lg">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-muted hover:text-foreground"
          aria-label={t('modalClose')}
        >
          <X className="h-4 w-4" />
        </button>

        {status === 'successful' ? (
          <div className="py-4">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-[var(--fg-success)]" />
            <h3 className="text-base font-semibold text-foreground">
              {t('modalThankYou')}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {t('modalReceived', { amount: baht(amount) })}
            </p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-base bg-[var(--blue)] px-4 py-2.5 text-sm font-semibold text-[#1b1407] shadow-button hover:opacity-90"
            >
              {t('modalDone')}
            </button>
          </div>
        ) : status === 'failed' || status === 'expired' ? (
          <div className="py-4">
            {status === 'expired' ? (
              <Clock className="mx-auto mb-3 h-12 w-12 text-muted" />
            ) : (
              <XCircle className="mx-auto mb-3 h-12 w-12 text-[var(--fg-danger)]" />
            )}
            <h3 className="text-base font-semibold text-foreground">
              {status === 'expired' ? t('modalExpiredTitle') : t('modalFailedTitle')}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {t('modalNoCharge')}
            </p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-base border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-raised"
            >
              {t('modalClose')}
            </button>
          </div>
        ) : charge.qrImageUri ? (
          // PromptPay: show the QR and wait.
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {t('modalScanTitle', { amount: baht(amount) })}
            </h3>
            <p className="mt-1 text-xs text-muted">
              {t('modalScanHint')}
            </p>
            <div className="mx-auto my-4 w-56 rounded-base bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={charge.qrImageUri}
                alt="PromptPay QR code"
                className="h-full w-full"
              />
            </div>
            {isManual ? (
              // No gateway: the donor confirms they've transferred, then waits
              // for an admin to verify and publish the donation.
              <div>
                <button
                  onClick={onPaid}
                  disabled={confirming}
                  className="flex w-full items-center justify-center gap-2 rounded-base bg-[var(--blue)] px-4 py-2.5 text-sm font-semibold text-[#1b1407] shadow-button hover:opacity-90 disabled:opacity-50"
                >
                  {confirming && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {t('modalPaidButton')}
                </button>
                <button
                  onClick={onClose}
                  disabled={confirming}
                  className="mt-2 w-full rounded-base border border-border px-4 py-2.5 text-sm font-medium text-muted hover:bg-raised hover:text-foreground disabled:opacity-50"
                >
                  {t('modalCancelButton')}
                </button>
                <p className="mt-2 text-[11px] text-muted">
                  {t('modalManualHint')}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />
                {t('modalWaiting')}
                {mmss && <span className="tabular-nums">{t('modalExpiresIn', { time: mmss })}</span>}
              </div>
            )}
          </div>
        ) : (
          // TrueMoney return / linking: just confirming.
          <div className="py-6">
            <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-gold" />
            <h3 className="text-base font-semibold text-foreground">
              {t('modalConfirming')}
            </h3>
            <p className="mt-1 text-sm text-muted">{t('modalConfirmingHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// A supporter's message on the thank-you wall. Long messages are clamped to one
// line with an ellipsis; clicking expands to the full (multi-line) text. The
// row is only interactive when the text actually overflows.
function SupporterMessage({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setOverflow(el.scrollWidth > el.clientWidth);
  }, [text]);

  return (
    <p
      ref={ref}
      onClick={overflow ? () => setExpanded((v) => !v) : undefined}
      title={overflow && !expanded ? text : undefined}
      className={`text-xs text-muted ${
        expanded ? 'whitespace-pre-wrap break-words' : 'truncate'
      } ${overflow ? 'cursor-pointer hover:text-foreground' : ''}`}
    >
      {text}
    </p>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={null}>
      <SupportPageInner />
    </Suspense>
  );
}
