'use client';

import * as RS from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  /** Optional leading visual: an image URL or a ReactNode (e.g. <ItemIcon />). */
  icon?: string | ReactNode | null;
}

// A string icon is an image URL; anything else renders as-is.
function OptionIcon({ icon }: { icon: string | ReactNode }) {
  if (typeof icon !== 'string') return <>{icon}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- dynamic storage URL thumbnail
    <img src={icon} alt="" className="h-4 w-4 shrink-0 rounded-xs object-cover" />
  );
}

// Radix forbids an empty-string Item value, so map "" (our "None"/"All"
// sentinel) to a placeholder token internally and back on the way out.
const EMPTY = '__empty__';
const toRadix = (v: string) => (v === '' ? EMPTY : v);
const fromRadix = (v: string) => (v === EMPTY ? '' : v);

/**
 * Themed dropdown built on @radix-ui/react-select (the primitive Shadcn UI
 * uses), styled with this project's dark/gold tokens. Drop-in replacement for
 * a native <select> with a simple value/onChange/options API.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
  disabled = false,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}) {
  const hasEmptyOption = options.some((o) => o.value === '');
  // Show the placeholder only when "" isn't itself a real selectable option.
  const rootValue = value === '' && !hasEmptyOption ? undefined : toRadix(value);
  // Icon of the currently selected option, mirrored in the trigger.
  const selectedIcon = options.find((o) => o.value === value)?.icon;

  return (
    <RS.Root
      value={rootValue}
      onValueChange={(v) => onChange(fromRadix(v))}
      disabled={disabled}
    >
      <RS.Trigger
        id={id}
        className={`flex w-full items-center justify-between gap-2 rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors hover:border-[var(--border-dark)] focus:border-[var(--focus)] data-[state=open]:border-[var(--focus)] data-[placeholder]:text-muted disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        {selectedIcon != null && <OptionIcon icon={selectedIcon} />}
        {/* min-w-0 + truncate so a long label ellipsizes instead of wrapping
            the trigger onto two lines. */}
        <span className="min-w-0 flex-1 truncate text-left">
          <RS.Value placeholder={placeholder} />
        </span>
        <RS.Icon>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform duration-150 data-[state=open]:rotate-180" />
        </RS.Icon>
      </RS.Trigger>

      <RS.Portal>
        <RS.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-60 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-base border border-border bg-surface shadow-sm"
        >
          <RS.Viewport className="p-1">
            {options.map((opt) => (
              <RS.Item
                key={opt.value}
                value={toRadix(opt.value)}
                className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-sm px-3 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-raised data-[state=checked]:bg-gold-soft data-[state=checked]:text-gold"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {opt.icon != null && <OptionIcon icon={opt.icon} />}
                  <RS.ItemText>{opt.label}</RS.ItemText>
                </span>
                <RS.ItemIndicator>
                  <Check className="h-4 w-4 shrink-0 text-gold" />
                </RS.ItemIndicator>
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  );
}
