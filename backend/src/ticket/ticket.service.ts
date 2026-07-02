import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { TicketStatus } from './dto/update-ticket-status.dto';

interface TicketMessageRow {
  id: string;
  ticket_id: string;
  author_id: string;
  is_admin: boolean;
  body: string;
  image_url: string | null;
  created_at: string;
}

@Injectable()
export class TicketService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly i18n: I18nService,
  ) {}

  // Nested messages come back unordered; sort them chronologically.
  private sortMessages<T extends { ticket_messages?: TicketMessageRow[] }>(
    ticket: T,
  ): T {
    if (Array.isArray(ticket.ticket_messages)) {
      ticket.ticket_messages.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    }
    return ticket;
  }

  // ===== User =====

  async create(userId: string, dto: CreateTicketDto) {
    const { data: ticket, error } = await this.supabase
      .from('tickets')
      .insert({ user_id: userId, subject: dto.subject.trim(), status: 'open' })
      .select('id')
      .single();

    if (error) throw error;

    const { error: messageError } = await this.supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticket.id,
        author_id: userId,
        is_admin: false,
        body: dto.body.trim(),
        image_url: dto.imageUrl ?? null,
      });

    if (messageError) throw messageError;

    return this.findOneByUser(ticket.id, userId);
  }

  async findAllByUser(userId: string) {
    const { data, error } = await this.supabase
      .from('tickets')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async findOneByUser(id: string, userId: string) {
    const { data, error } = await this.supabase
      .from('tickets')
      .select('*, ticket_messages(*)')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data)
      throw new NotFoundException(this.i18n.t('errors.ticket.not_found'));

    return this.sortMessages(data);
  }

  // Opening a ticket marks it read for the user (clears their unread badge).
  async viewByUser(id: string, userId: string) {
    const ticket = await this.findOneByUser(id, userId);
    await this.patchTicket(id, { user_last_read_at: new Date().toISOString() });
    return ticket;
  }

  // Number of the user's tickets with an unseen admin reply.
  async unreadCountForUser(userId: string): Promise<{ count: number }> {
    const { data, error } = await this.supabase
      .from('tickets')
      .select('updated_at, user_last_read_at')
      .eq('user_id', userId)
      .eq('last_sender_is_admin', true)
      .neq('status', 'closed');

    if (error) throw error;
    return { count: this.countUnseen(data, 'user_last_read_at') };
  }

  async addMessage(userId: string, ticketId: string, dto: CreateMessageDto) {
    // Ownership check — throws NotFound if the ticket isn't theirs.
    const ticket = await this.findOneByUser(ticketId, userId);

    // A closed ticket is read-only for the user.
    if (ticket.status === 'closed') {
      throw new ForbiddenException(this.i18n.t('errors.ticket.closed'));
    }

    const { error } = await this.supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      author_id: userId,
      is_admin: false,
      body: dto.body.trim(),
      image_url: dto.imageUrl ?? null,
    });

    if (error) throw error;

    await this.patchTicket(ticketId, {
      updated_at: new Date().toISOString(),
      last_sender_is_admin: false,
    });
    return this.findOneByUser(ticketId, userId);
  }

  // ===== Admin =====

  async findAll(status?: TicketStatus) {
    let query = this.supabase
      .from('tickets')
      .select('*, profiles(username)')
      .order('updated_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .from('tickets')
      .select('*, profiles(username), ticket_messages(*)')
      .eq('id', id)
      .single();

    if (error || !data)
      throw new NotFoundException(this.i18n.t('errors.ticket.not_found'));

    return this.sortMessages(data);
  }

  // Opening a ticket marks it read for the admin side (clears the admin badge).
  async viewForAdmin(id: string) {
    const ticket = await this.findOne(id);
    await this.patchTicket(id, {
      admin_last_read_at: new Date().toISOString(),
    });
    return ticket;
  }

  // Number of tickets awaiting an admin response (unseen user message).
  async unreadCountForAdmin(): Promise<{ count: number }> {
    const { data, error } = await this.supabase
      .from('tickets')
      .select('updated_at, admin_last_read_at')
      .eq('last_sender_is_admin', false)
      .neq('status', 'closed');

    if (error) throw error;
    return { count: this.countUnseen(data, 'admin_last_read_at') };
  }

  async addAdminMessage(
    adminId: string,
    ticketId: string,
    dto: CreateMessageDto,
  ) {
    const ticket = await this.findOne(ticketId);

    const { error } = await this.supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      author_id: adminId,
      is_admin: true,
      body: dto.body.trim(),
      image_url: dto.imageUrl ?? null,
    });

    if (error) throw error;

    // A first admin reply moves an open ticket into "in progress". The admin
    // has, by definition, just seen the thread.
    await this.patchTicket(ticketId, {
      updated_at: new Date().toISOString(),
      last_sender_is_admin: true,
      admin_last_read_at: new Date().toISOString(),
      ...(ticket.status === 'open' ? { status: 'in_progress' } : {}),
    });
    return this.findOne(ticketId);
  }

  // Admin: delete a ticket and its messages (FK cascade).
  async remove(id: string) {
    const { data, error } = await this.supabase
      .from('tickets')
      .select('id')
      .eq('id', id)
      .single();

    if (error || !data)
      throw new NotFoundException(this.i18n.t('errors.ticket.not_found'));

    const { error: deleteError } = await this.supabase
      .from('tickets')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    return { deleted: true };
  }

  async updateStatus(id: string, status: TicketStatus) {
    const { data, error } = await this.supabase
      .from('tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .single();

    if (error || !data)
      throw new NotFoundException(this.i18n.t('errors.ticket.not_found'));

    return this.findOne(id);
  }

  private async patchTicket(ticketId: string, patch: Record<string, unknown>) {
    const { error } = await this.supabase
      .from('tickets')
      .update(patch)
      .eq('id', ticketId);

    if (error) throw error;
  }

  // Count rows where the viewer hasn't looked since the last update.
  private countUnseen(
    rows: { updated_at: string; [key: string]: unknown }[] | null,
    readField: 'user_last_read_at' | 'admin_last_read_at',
  ): number {
    if (!rows) return 0;
    return rows.filter((r) => {
      const readAt = r[readField] as string | null;
      return !readAt || new Date(readAt) < new Date(r.updated_at);
    }).length;
  }
}
