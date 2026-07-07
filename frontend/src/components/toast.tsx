'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { AnimatePresence, m } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastVariant = 'default' | 'success' | 'error';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (t: {
    title: string;
    description?: string;
    variant?: ToastVariant;
  }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT = {
  default: { color: 'var(--gold)', Icon: Info },
  success: { color: 'var(--fg-success)', Icon: CheckCircle2 },
  error: { color: 'var(--fg-danger)', Icon: AlertCircle },
} as const;

// Auto-dismiss after this long. Managed with our own timers rather than
// Radix's `duration`, because Radix pauses its dismiss timer whenever the
// window loses focus (e.g. DevTools open, another tab) — which left toasts
// stuck open indefinitely.
const TOAST_DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback<ToastContextValue['toast']>(
    ({ title, description, variant = 'default' }) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_DURATION),
      );
    },
    [dismiss],
  );

  // Clear any pending timers on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={Infinity}>
        {children}

        {/* forceMount + asChild hand the element's lifecycle to
            AnimatePresence so a dismissed toast plays its exit before leaving
            the DOM (Radix would otherwise unmount it instantly). */}
        <AnimatePresence>
          {toasts.map((t) => {
            const { color, Icon } = VARIANT[t.variant];
            return (
              <ToastPrimitive.Root
                key={t.id}
                asChild
                forceMount
                onOpenChange={(open) => {
                  if (!open) dismiss(t.id);
                }}
              >
                <m.li
                  layout
                  initial={{ opacity: 0, x: 40, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  className="flex items-start gap-3 rounded-base border border-border bg-surface px-4 py-3 shadow-sm data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-[transform_200ms_ease-out]"
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
                  <div className="min-w-0 flex-1">
                    <ToastPrimitive.Title className="text-sm font-medium text-foreground">
                      {t.title}
                    </ToastPrimitive.Title>
                    {t.description && (
                      <ToastPrimitive.Description className="mt-0.5 break-words text-xs text-muted">
                        {t.description}
                      </ToastPrimitive.Description>
                    )}
                  </div>
                  <ToastPrimitive.Close
                    className="shrink-0 text-muted hover:text-foreground"
                    aria-label="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </ToastPrimitive.Close>
                </m.li>
              </ToastPrimitive.Root>
            );
          })}
        </AnimatePresence>

        <ToastPrimitive.Viewport className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 outline-none [&>*]:pointer-events-auto" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
