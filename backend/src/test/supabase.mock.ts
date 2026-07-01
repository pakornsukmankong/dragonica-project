import { SupabaseService } from '../supabase/supabase.service';

export interface QueryResult {
  data: unknown;
  error: unknown;
  count?: number;
}

/**
 * Builds a fake SupabaseService whose `.from()` returns a chainable query
 * builder. Each call to `.from()` consumes the next queued result, so a test
 * lists the results in the order the service issues its queries.
 *
 * The builder is awaitable (for list queries ending in `.order()`) and also
 * resolves via `.single()` — both yield the same queued result.
 */
export function createSupabaseMock(results: QueryResult[]): {
  service: SupabaseService;
  from: jest.Mock;
  fromTables: string[];
} {
  const fromTables: string[] = [];
  let index = 0;
  const nextResult = (): QueryResult =>
    results[index++] ?? { data: null, error: null };

  const buildQuery = () => {
    const result = nextResult();
    const qb: Record<string, unknown> = {};
    for (const method of [
      'select',
      'insert',
      'update',
      'delete',
      'eq',
      'order',
      'limit',
    ]) {
      qb[method] = jest.fn(() => qb);
    }
    qb.single = jest.fn(() => Promise.resolve(result));
    qb.maybeSingle = jest.fn(() => Promise.resolve(result));
    qb.then = (
      resolve: (v: QueryResult) => unknown,
      reject?: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject);
    return qb;
  };

  const from = jest.fn((table: string) => {
    fromTables.push(table);
    return buildQuery();
  });

  const service = { from } as unknown as SupabaseService;
  return { service, from, fromTables };
}
