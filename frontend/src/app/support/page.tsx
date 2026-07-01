'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Heart,
  QrCode,
  Wallet,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  X,
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

const CHANNEL_OPTIONS = [
  { value: 'promptpay', label: 'PromptPay (QR)' },
  { value: 'truemoney', label: 'TrueMoney Wallet' },
];

function SupportPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [amount, setAmount] = useState<number | ''>(100);
  const [channel, setChannel] = useState<DonationChannel>('promptpay');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
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

  // Thank-you wall.
  const { data: wall } = useQuery<DonationWallEntry[]>({
    queryKey: ['donations', 'wall'],
    queryFn: () => api.get('/donations/wall'),
  });

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
        qrImageUri: null,
        authorizeUri: null,
        expiresAt: null,
      });
      router.replace('/support');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Poll the donation while it is pending; the backend re-checks Omise on read.
  const { data: polled } = useQuery<Donation>({
    queryKey: ['donation', charge?.id],
    queryFn: () => api.get(`/donations/${charge!.id}`),
    enabled: !!charge,
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
      toast({ title: 'Thank you for your support! ❤️', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['donations', 'wall'] });
    } else {
      toast({
        title: status === 'expired' ? 'QR code expired' : 'Payment failed',
        description: 'No charge was made. Feel free to try again.',
        variant: 'error',
      });
    }
  }, [status, charge, toast, queryClient]);

  const createMut = useMutation({
    mutationFn: (): Promise<DonationCharge> =>
      api.post('/donations', {
        amount: Number(amount),
        channel,
        displayName: displayName.trim() || 'Anonymous',
        message: message.trim() || undefined,
        phoneNumber: channel === 'truemoney' ? phone.trim() : undefined,
      }),
    onSuccess: (c) => {
      // TrueMoney: bounce to Omise's OTP page. PromptPay: show the QR modal.
      if (c.channel === 'truemoney' && c.authorizeUri) {
        window.location.href = c.authorizeUri;
        return;
      }
      notified.current = false;
      setCharge(c);
    },
    onError: (e) =>
      toast({
        title: 'Could not start the donation',
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const phoneValid = /^0\d{9}$/.test(phone.trim());
  const canSubmit =
    Number(amount) >= 20 &&
    (channel !== 'truemoney' || phoneValid) &&
    !createMut.isPending;

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
                Support the Project
              </h1>
              <p className="text-sm text-muted mt-1">
                Donations keep the servers running. Thank you for chipping in ❤️
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 laptop:grid-cols-5 gap-6">
            {/* Donate form */}
            <div className="laptop:col-span-3 bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
              <h2 className="text-sm font-semibold text-foreground mb-5">
                Make a donation
              </h2>

              {/* Amount */}
              <label className="block text-xs font-medium text-muted mb-2">
                Amount (THB) — min ฿20
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESETS.map((p) => (
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
                  placeholder="100"
                  className="w-full rounded-base border border-border bg-surface pl-7 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)]"
                />
              </div>

              {/* Channel */}
              <label className="block text-xs font-medium text-muted mb-2">
                Payment method
              </label>
              <div className="mb-5">
                <Select
                  value={channel}
                  onChange={(v) => setChannel(v as DonationChannel)}
                  options={CHANNEL_OPTIONS}
                />
              </div>

              {/* Phone (TrueMoney only) */}
              {channel === 'truemoney' && (
                <div className="mb-5">
                  <label className="block text-xs font-medium text-muted mb-2">
                    TrueMoney phone number
                  </label>
                  <input
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))
                    }
                    inputMode="numeric"
                    placeholder="0812345678"
                    className="w-full rounded-base border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)]"
                  />
                  {phone && !phoneValid && (
                    <p className="mt-1 text-xs text-[var(--fg-danger)]">
                      Enter a 10-digit number starting with 0.
                    </p>
                  )}
                </div>
              )}

              {/* Display name */}
              <label className="block text-xs font-medium text-muted mb-2">
                Display name (shown on the wall)
              </label>
              <input
                value={displayName}
                onChange={(e) => {
                  setNameTouched(true);
                  setDisplayName(e.target.value);
                }}
                maxLength={60}
                placeholder="Anonymous"
                className="w-full rounded-base border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)] mb-5"
              />

              {/* Message */}
              <label className="block text-xs font-medium text-muted mb-2">
                Message (optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={200}
                rows={3}
                placeholder="Say something nice..."
                className="w-full resize-none rounded-base border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)] mb-6"
              />

              <button
                onClick={() => createMut.mutate()}
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-base bg-[var(--blue)] px-5 py-3 text-sm font-semibold text-[#1b1407] shadow-button transition-colors duration-150 hover:opacity-90 disabled:opacity-50"
              >
                {createMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : channel === 'promptpay' ? (
                  <QrCode className="h-4 w-4" />
                ) : (
                  <Wallet className="h-4 w-4" />
                )}
                {createMut.isPending
                  ? 'Starting...'
                  : `Donate ${amount ? baht(Number(amount) * 100) : ''}`}
              </button>
              <p className="mt-3 text-center text-[11px] text-muted">
                Payments are processed securely by Omise. We never see your card
                or bank details.
              </p>
            </div>

            {/* Thank-you wall */}
            <div className="laptop:col-span-2 bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
              <div className="mb-4 flex items-center gap-2">
                <Heart className="h-4 w-4 text-gold" />
                <h2 className="text-sm font-semibold text-foreground">
                  Recent Supporters
                </h2>
              </div>
              {!wall || wall.length === 0 ? (
                <p className="text-xs text-muted">
                  No donations yet. Be the first to support the project!
                </p>
              ) : (
                <ul className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {wall.map((d, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-3 rounded-base bg-raised px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {d.display_name}
                        </p>
                        {d.message && (
                          <p className="truncate text-xs text-muted">
                            {d.message}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-gold tabular-nums">
                        {baht(d.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {charge && (
        <PaymentModal
          charge={charge}
          status={status}
          amount={modalAmount}
          onClose={closeModal}
        />
      )}
    </main>
  );
}

function PaymentModal({
  charge,
  status,
  amount,
  onClose,
}: {
  charge: DonationCharge;
  status: Donation['status'];
  amount: number;
  onClose: () => void;
}) {
  // Live countdown for the PromptPay QR.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (status !== 'pending') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

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
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {status === 'successful' ? (
          <div className="py-4">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-[var(--fg-success)]" />
            <h3 className="text-base font-semibold text-foreground">
              Thank you! ❤️
            </h3>
            <p className="mt-1 text-sm text-muted">
              Your donation of {baht(amount)} was received.
            </p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-base bg-[var(--blue)] px-4 py-2.5 text-sm font-semibold text-[#1b1407] shadow-button hover:opacity-90"
            >
              Done
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
              {status === 'expired' ? 'QR code expired' : 'Payment failed'}
            </h3>
            <p className="mt-1 text-sm text-muted">
              No charge was made. You can try again.
            </p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-base border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-raised"
            >
              Close
            </button>
          </div>
        ) : charge.qrImageUri ? (
          // PromptPay: show the QR and wait.
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Scan to pay {baht(amount)}
            </h3>
            <p className="mt-1 text-xs text-muted">
              Open your banking app and scan this PromptPay QR.
            </p>
            <div className="mx-auto my-4 w-56 rounded-base bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={charge.qrImageUri}
                alt="PromptPay QR code"
                className="h-full w-full"
              />
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />
              Waiting for payment
              {mmss && <span className="tabular-nums">· expires in {mmss}</span>}
            </div>
          </div>
        ) : (
          // TrueMoney return / linking: just confirming.
          <div className="py-6">
            <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-gold" />
            <h3 className="text-base font-semibold text-foreground">
              Confirming your payment...
            </h3>
            <p className="mt-1 text-sm text-muted">This only takes a moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={null}>
      <SupportPageInner />
    </Suspense>
  );
}
