import { IsIn } from 'class-validator';

export const TICKET_STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'closed',
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export class UpdateTicketStatusDto {
  @IsIn(TICKET_STATUSES)
  status: TicketStatus;
}
