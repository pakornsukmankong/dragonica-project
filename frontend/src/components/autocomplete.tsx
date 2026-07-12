'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

export interface AutocompleteOption {
  value: string;
  label: string;
}

// Cap the rendered list so typing into a large option set (hundreds of
// dungeons) never renders an unbounded DOM tree.
const MAX_RESULTS = 100;

/**
 * Searchable combobox (autocomplete) styled to match `Select`. The user types
 * to filter the options; picking one emits its value, clearing the input (or
 * the X button) emits ''. Follows the WAI-ARIA combobox pattern with
 * keyboard navigation (arrows / Enter / Escape).
 */
export function Autocomplete({
  value,
  onChange,
  options,
  placeholder = 'Search...',
  emptyText = 'No results',
  className = '',
  disabled = false,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  // The text being typed while searching; null means "not editing" and the
  // input mirrors the selected option's label instead.
  const [query, setQuery] = useState<string | null>(null);

  const selected = options.find((o) => o.value === value);
  const inputText = query ?? selected?.label ?? '';

  const filtered = useMemo(() => {
    const q = (query ?? '').trim().toLowerCase();
    const base = q
      ? options.filter((o) => o.label.toLowerCase().includes(q))
      : options;
    return base.slice(0, MAX_RESULTS);
  }, [options, query]);

  const openList = () => {
    setOpen(true);
    // Highlight the current selection when reopening over the full list.
    const idx = filtered.findIndex((o) => o.value === value);
    setHighlighted(idx >= 0 ? idx : 0);
  };

  const closeList = () => {
    setOpen(false);
    setQuery(null); // revert uncommitted text to the selected label
  };

  const pick = (opt: AutocompleteOption) => {
    onChange(opt.value);
    setOpen(false);
    setQuery(null);
    inputRef.current?.blur();
  };

  const clear = () => {
    onChange('');
    setQuery(null);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        openList();
        return;
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setHighlighted((h) =>
        filtered.length === 0
          ? 0
          : (h + delta + filtered.length) % filtered.length,
      );
    } else if (e.key === 'Enter') {
      if (open && filtered[highlighted]) {
        e.preventDefault();
        pick(filtered[highlighted]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        closeList();
      }
    } else if (e.key === 'Tab') {
      closeList();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex w-full items-center gap-2 rounded-base border border-border bg-surface px-3 py-2 transition-colors hover:border-[var(--border-dark)] focus-within:border-[var(--focus)]">
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            open && filtered[highlighted]
              ? `${listId}-${filtered[highlighted].value}`
              : undefined
          }
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={inputText}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlighted(0);
            // Emptying the text clears the selection immediately.
            if (e.target.value === '' && value !== '') onChange('');
          }}
          onFocus={openList}
          onBlur={closeList}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50"
        />
        {selected ? (
          <button
            type="button"
            aria-label="Clear"
            // mousedown (not click) so it wins over the input's blur.
            onMouseDown={(e) => {
              e.preventDefault();
              clear();
            }}
            className="shrink-0 text-muted transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        )}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-base border border-border bg-surface p-1 shadow-sm"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">{emptyText}</li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={opt.value}
                id={`${listId}-${opt.value}`}
                role="option"
                aria-selected={opt.value === value}
                // mousedown so selection commits before the input blurs.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(opt);
                }}
                onMouseEnter={() => setHighlighted(i)}
                className={`flex cursor-pointer select-none items-center justify-between gap-2 rounded-sm px-3 py-2 text-sm outline-none ${
                  opt.value === value
                    ? 'bg-gold-soft text-gold'
                    : i === highlighted
                      ? 'bg-raised text-foreground'
                      : 'text-foreground'
                }`}
              >
                <span className="min-w-0 truncate">{opt.label}</span>
                {opt.value === value && (
                  <Check className="h-4 w-4 shrink-0 text-gold" />
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
