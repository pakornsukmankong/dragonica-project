'use client';

/**
 * On/off switch. The label names the setting and stays put; the switch alone
 * carries the state, so it never has to read as both a state and an action.
 *
 * NB: `border` lives under `borderColor` in the Tailwind config, so there is no
 * `bg-border` — the off track uses `bg-root` (a well on `bg-raised` rows).
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  title,
  className = '',
  labelClassName = '',
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  title?: string;
  className?: string;
  /** Style the label — hide it with `sr-only`, never `hidden`: the switch takes
   *  its accessible name from this text, and `display: none` would drop it. */
  labelClassName?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-2 rounded-base px-2 py-1.5 text-xs transition-colors disabled:opacity-50 ${
        checked ? 'text-gold' : 'text-muted hover:text-foreground'
      } ${className}`}
    >
      <span
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-gold' : 'bg-root'
        }`}
      >
        <span
          className={`absolute left-0 top-0.5 h-3 w-3 rounded-full transition-transform ${
            checked
              ? 'translate-x-3.5 bg-root'
              : // bg-* covers background-image too, so Tailwind can't type a
                // bare var() — say it is a color.
                'translate-x-0.5 bg-[color:var(--muted)]'
          }`}
        />
      </span>
      <span className={labelClassName}>{label}</span>
    </button>
  );
}
