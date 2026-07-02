import { NotFoundException } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { createSupabaseMock } from '../test/supabase.mock';

const USER = 'user-1';
const OTHER = 'user-2';

// Minimal i18n stub — tests assert on exception type, not localized text.
const i18n = {
  t: (key: string) => key,
} as unknown as import('nestjs-i18n').I18nService;

describe('TicketService (user scoping)', () => {
  describe('findOneByUser', () => {
    it('throws NotFound for a ticket the user does not own', async () => {
      const { service: supabase } = createSupabaseMock([
        { data: null, error: { code: 'PGRST116' } },
      ]);
      const svc = new TicketService(supabase, i18n);

      await expect(svc.findOneByUser('t1', OTHER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the ticket with its messages sorted chronologically', async () => {
      const ticket = {
        id: 't1',
        user_id: USER,
        subject: 'Help',
        ticket_messages: [
          { id: 'm2', created_at: '2026-01-02T00:00:00Z' },
          { id: 'm1', created_at: '2026-01-01T00:00:00Z' },
        ],
      };
      const { service: supabase } = createSupabaseMock([
        { data: ticket, error: null },
      ]);
      const svc = new TicketService(supabase, i18n);

      const result = await svc.findOneByUser('t1', USER);
      expect(result.ticket_messages.map((m: { id: string }) => m.id)).toEqual([
        'm1',
        'm2',
      ]);
    });
  });

  describe('addMessage', () => {
    it('runs the ownership check before inserting a reply', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: null, error: { code: 'PGRST116' } }, // findOneByUser fails
      ]);
      const svc = new TicketService(supabase, i18n);

      await expect(
        svc.addMessage(OTHER, 't1', { body: 'hi' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      // Must stop at the ownership check — no insert.
      expect(fromTables).toEqual(['tickets']);
    });
  });

  describe('create', () => {
    it('inserts the ticket then its first message', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: { id: 't1' }, error: null }, // insert ticket
        { data: null, error: null }, // insert first message
        {
          data: { id: 't1', user_id: USER, ticket_messages: [] },
          error: null,
        }, // findOneByUser
      ]);
      const svc = new TicketService(supabase, i18n);

      const result = await svc.create(USER, { subject: 'Bug', body: 'broken' });
      expect(result.id).toBe('t1');
      expect(fromTables).toEqual(['tickets', 'ticket_messages', 'tickets']);
    });
  });
});
