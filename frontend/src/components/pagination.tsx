'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number; // 1-based
  pageCount: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  const btn =
    'flex h-8 w-8 items-center justify-center rounded-base border border-border text-foreground transition-colors hover:border-gold hover:text-gold disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground';

  return (
    <div className="mt-6 flex items-center justify-center gap-3">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={btn}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-xs text-muted tabular-nums">
        Page <span className="font-semibold text-foreground">{page}</span> of{' '}
        {pageCount}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        className={btn}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
